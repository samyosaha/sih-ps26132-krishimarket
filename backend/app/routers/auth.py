import os
import re
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr, Field, ValidationError, field_validator
from typing import Optional

from app.database import get_db
from app.models import User, UserRole, OtpPurpose
from app.auth import (
    hash_password, verify_password, create_access_token, create_refresh_token,
    decode_refresh_token, get_current_user,
)
from app.services.otp_service import (
    create_otp_record, invalidate_otp, verify_and_consume_otp, send_otp_sms,
)
from app.sanitize import sanitize_string
from app.rate_limiter import create_rate_limiter

router = APIRouter(prefix="/auth", tags=["auth"])

# Phone regex: 10-digit Indian mobile number, optional +91 prefix
_PHONE_RE = re.compile(r"^(\+?91)?[6-9]\d{9}$")

# Allowed roles for self-registration (admin can NOT self-register)
_ALLOWED_REGISTER_ROLES = {UserRole.farmer, UserRole.buyer}


def _normalise_phone(value: str) -> str:
    """Validate and store every Indian mobile number in one 10-digit format."""
    cleaned = re.sub(r"[\s\-().]+", "", value)
    if not _PHONE_RE.match(cleaned):
        raise ValueError("Please provide a valid 10-digit Indian phone number")
    return cleaned[-10:]


def _validate_password_strength(value: str) -> str:
    if len(value) < 8:
        raise ValueError("Password must be at least 8 characters")
    if not re.search(r"[A-Za-z]", value):
        raise ValueError("Password must contain at least one letter")
    if not re.search(r"\d", value):
        raise ValueError("Password must contain at least one digit")
    return value


class SignupDetails(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    phone: str = Field(..., min_length=10, max_length=15)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    role: UserRole

    @field_validator("role")
    @classmethod
    def prevent_admin_self_registration(cls, value: UserRole) -> UserRole:
        if value == UserRole.admin:
            raise ValueError("Admin accounts cannot be created through public registration")
        return value

    @field_validator("name")
    @classmethod
    def sanitize_name(cls, v: str) -> str:
        return sanitize_string(v, max_length=100)

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        return _normalise_phone(v)

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        return _validate_password_strength(v)

    @field_validator("role")
    @classmethod
    def block_admin_registration(cls, v: UserRole) -> UserRole:
        if v not in _ALLOWED_REGISTER_ROLES:
            raise ValueError("Invalid role. Please choose 'farmer' or 'buyer'.")
        return v


class RegisterRequest(SignupDetails):
    """Legacy registration endpoint, now protected by a sign-up OTP."""
    otp: str = Field(..., min_length=6, max_length=6)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str | None = None
    token_type: str = "bearer"


class OtpChallengeResponse(BaseModel):
    message: str
    phone: str
    expires_in_seconds: int = 300
    dev_otp: str | None = None


class UserResponse(BaseModel):
    id: int
    name: str
    phone: str
    email: str | None
    role: UserRole
    is_verified_buyer: bool
    preferred_language: str = "en"
    phone_verified: bool = False
    average_rating: float | None = None
    total_ratings: int = 0

    class Config:
        from_attributes = True


# ── OTP schemas ──────────────────────────────────────────────────────

class OtpRequestSchema(BaseModel):
    phone: str = Field(..., min_length=10, max_length=15)
    purpose: OtpPurpose = OtpPurpose.login
    email: EmailStr | None = None

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        return _normalise_phone(v)


class OtpVerifySchema(BaseModel):
    phone: str = Field(..., min_length=10, max_length=15)
    otp: str = Field(..., min_length=6, max_length=6)
    purpose: OtpPurpose = OtpPurpose.login
    # Sign-up details are supplied only after a user has received the code.
    name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    email: EmailStr | None = None
    password: Optional[str] = Field(default=None, min_length=8, max_length=128)
    role: Optional[UserRole] = None

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        return _normalise_phone(v)


class ForgotPasswordSchema(BaseModel):
    phone: str = Field(..., min_length=10, max_length=15)

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        return _normalise_phone(v)


class ResetPasswordSchema(BaseModel):
    phone: str = Field(..., min_length=10, max_length=15)
    otp: str = Field(..., min_length=6, max_length=6)
    new_password: str = Field(..., min_length=8, max_length=128)

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        return _normalise_phone(v)

    @field_validator("new_password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        return _validate_password_strength(v)


class RefreshTokenRequest(BaseModel):
    refresh_token: str


def _tokens_for(user: User) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token({"sub": str(user.id)}),
        refresh_token=create_refresh_token({"sub": str(user.id)}),
    )


def _create_user_from_signup(payload: SignupDetails, db: Session) -> User:
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=409, detail="Email already registered")
    if db.query(User).filter(User.phone == payload.phone).first():
        raise HTTPException(status_code=409, detail="Phone number already registered")

    user = User(
        name=payload.name,
        phone=payload.phone,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=payload.role,
        phone_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _dev_otp_response(otp_plain: str) -> dict[str, str | int]:
    """Expose the code only for local development when no SMS provider is set."""
    response: dict[str, str | int] = {
        "message": "OTP sent successfully",
        "expires_in_seconds": 300,
    }
    if os.getenv("ENVIRONMENT", "development").lower() in {"development", "dev", "local"}:
        from app.services.otp_service import SMS_API_KEY

        if not SMS_API_KEY:
            response["dev_otp"] = otp_plain
            response["message"] = f"OTP sent (dev mode). Code: {otp_plain}"
    return response


async def _send_new_otp(db: Session, phone: str, purpose: OtpPurpose) -> dict[str, str | int]:
    """Create and deliver an OTP, invalidating it if the SMS gateway fails."""
    record, otp_plain = create_otp_record(db, phone, purpose)
    if not await send_otp_sms(phone, otp_plain):
        invalidate_otp(db, record)
        raise HTTPException(status_code=502, detail="Failed to send OTP. Please try again.")
    return _dev_otp_response(otp_plain)


@router.post("/register", response_model=TokenResponse)
def register(
    payload: RegisterRequest,
    db: Session = Depends(get_db),
    _rl=Depends(create_rate_limiter(max_calls=5, window_seconds=60)),
):
    """Complete legacy registration only after a valid sign-up OTP is supplied."""
    try:
        verify_and_consume_otp(db, payload.phone, payload.otp, OtpPurpose.signup)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return _tokens_for(_create_user_from_signup(payload, db))


@router.post("/login", response_model=OtpChallengeResponse)
async def login(
    payload: LoginRequest,
    db: Session = Depends(get_db),
    _rl=Depends(create_rate_limiter(max_calls=5, window_seconds=60)),
):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    try:
        delivery = await _send_new_otp(db, user.phone, OtpPurpose.login)
    except ValueError as e:
        raise HTTPException(status_code=429, detail=str(e))
    return OtpChallengeResponse(phone=user.phone, **delivery)


@router.get("/me", response_model=UserResponse)
def read_current_user(current_user: User = Depends(get_current_user)):
    return current_user


# ── OTP endpoints ────────────────────────────────────────────────────


@router.post("/otp/request")
async def request_otp(
    payload: OtpRequestSchema,
    db: Session = Depends(get_db),
    _rl=Depends(create_rate_limiter(max_calls=3, window_seconds=60)),
):
    """Generate and send an OTP to the given phone number."""
    existing_phone = db.query(User).filter(User.phone == payload.phone).first()
    if payload.purpose == OtpPurpose.signup:
        if existing_phone:
            raise HTTPException(status_code=409, detail="Phone number already registered")
        if payload.email and db.query(User).filter(User.email == payload.email).first():
            raise HTTPException(status_code=409, detail="Email already registered")
    elif payload.purpose == OtpPurpose.login:
        if not existing_phone:
            raise HTTPException(status_code=400, detail="No account found for this phone number")
    else:
        raise HTTPException(status_code=400, detail="Use the password recovery endpoint for reset OTPs")

    try:
        return await _send_new_otp(db, payload.phone, payload.purpose)
    except ValueError as e:
        raise HTTPException(status_code=429, detail=str(e))


@router.post("/otp/verify", response_model=TokenResponse)
def verify_otp(
    payload: OtpVerifySchema,
    db: Session = Depends(get_db),
    _rl=Depends(create_rate_limiter(max_calls=5, window_seconds=60)),
):
    """Verify an OTP and issue a JWT."""
    signup: SignupDetails | None = None
    if payload.purpose == OtpPurpose.signup:
        try:
            signup = SignupDetails.model_validate(
                {
                    "name": payload.name,
                    "phone": payload.phone,
                    "email": payload.email,
                    "password": payload.password,
                    "role": payload.role,
                }
            )
        except ValidationError as e:
            raise HTTPException(status_code=422, detail=e.errors())

    try:
        verify_and_consume_otp(db, payload.phone, payload.otp, payload.purpose)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    user = db.query(User).filter(User.phone == payload.phone).first()

    if payload.purpose == OtpPurpose.signup:
        user = _create_user_from_signup(signup, db)
    else:
        # Login via OTP
        if not user:
            raise HTTPException(status_code=404, detail="No account found for this phone number")
        user.phone_verified = True
        db.commit()

    return _tokens_for(user)


# ── Password recovery ────────────────────────────────────────────────


@router.post("/password/forgot")
async def forgot_password(
    payload: ForgotPasswordSchema,
    db: Session = Depends(get_db),
    _rl=Depends(create_rate_limiter(max_calls=3, window_seconds=60)),
):
    """Send a password-reset OTP to the user's verified phone."""
    user = db.query(User).filter(User.phone == payload.phone).first()
    if not user:
        # Don't reveal whether the phone exists — return success either way
        return {"message": "If this phone is registered, an OTP has been sent."}

    try:
        delivery = await _send_new_otp(db, payload.phone, OtpPurpose.password_reset)
    except ValueError as e:
        raise HTTPException(status_code=429, detail=str(e))

    response: dict[str, str] = {"message": "If this phone is registered, an OTP has been sent."}
    if "dev_otp" in delivery:
        response["dev_otp"] = str(delivery["dev_otp"])
    return response


@router.post("/password/reset")
def reset_password(
    payload: ResetPasswordSchema,
    db: Session = Depends(get_db),
    _rl=Depends(create_rate_limiter(max_calls=5, window_seconds=60)),
):
    """Verify OTP and set a new password."""
    try:
        verify_and_consume_otp(db, payload.phone, payload.otp, OtpPurpose.password_reset)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    user = db.query(User).filter(User.phone == payload.phone).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.password_hash = hash_password(payload.new_password)
    db.commit()

    return {"message": "Password reset successfully. Please log in with your new password."}


# ── Token refresh ────────────────────────────────────────────────────


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(
    payload: RefreshTokenRequest,
    db: Session = Depends(get_db),
):
    """Exchange a valid refresh token for a new access + refresh token pair."""
    token_data = decode_refresh_token(payload.refresh_token)
    user_id = token_data.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    access = create_access_token({"sub": str(user.id)})
    refresh = create_refresh_token({"sub": str(user.id)})
    return TokenResponse(access_token=access, refresh_token=refresh)


# ── Language preference ──────────────────────────────────────────────


class LanguageUpdate(BaseModel):
    preferred_language: str = Field(..., min_length=2, max_length=10)


@router.patch("/me/language", response_model=UserResponse)
def update_language(
    payload: LanguageUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update the current user's preferred language."""
    allowed = {"en", "hi", "mr"}  # extensible
    if payload.preferred_language not in allowed:
        raise HTTPException(status_code=400, detail=f"Unsupported language. Choose from: {', '.join(allowed)}")
    current_user.preferred_language = payload.preferred_language
    db.commit()
    db.refresh(current_user)
    return current_user
