import re
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional

from app.database import get_db
from app.models import User, UserRole, OtpPurpose
from app.auth import (
    hash_password, verify_password, create_access_token, create_refresh_token,
    decode_refresh_token, get_current_user,
)
from app.services.otp_service import (
    create_otp_record, verify_and_consume_otp, send_otp_sms,
)
from app.sanitize import sanitize_string
from app.rate_limiter import create_rate_limiter

router = APIRouter(prefix="/auth", tags=["auth"])

# Phone regex: 10-digit Indian mobile number, optional +91 prefix
_PHONE_RE = re.compile(r"^(\+?91)?[6-9]\d{9}$")

# Allowed roles for self-registration (admin can NOT self-register)
_ALLOWED_REGISTER_ROLES = {UserRole.farmer, UserRole.buyer}


class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    phone: str = Field(..., min_length=10, max_length=15)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    role: UserRole

    @field_validator("name")
    @classmethod
    def sanitize_name(cls, v: str) -> str:
        return sanitize_string(v, max_length=100)

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        cleaned = re.sub(r"[\s\-().]+", "", v)
        if not _PHONE_RE.match(cleaned):
            raise ValueError("Please provide a valid 10-digit Indian phone number")
        return cleaned

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not re.search(r"[A-Za-z]", v):
            raise ValueError("Password must contain at least one letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one digit")
        return v

    @field_validator("role")
    @classmethod
    def block_admin_registration(cls, v: UserRole) -> UserRole:
        if v not in _ALLOWED_REGISTER_ROLES:
            raise ValueError("Invalid role. Please choose 'farmer' or 'buyer'.")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str | None = None
    token_type: str = "bearer"


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

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        cleaned = re.sub(r"[\s\-().]+", "", v)
        if not _PHONE_RE.match(cleaned):
            raise ValueError("Please provide a valid 10-digit Indian phone number")
        return cleaned


class OtpVerifySchema(BaseModel):
    phone: str = Field(..., min_length=10, max_length=15)
    otp: str = Field(..., min_length=6, max_length=6)
    purpose: OtpPurpose = OtpPurpose.login
    # For signup via OTP, include user details
    name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    role: Optional[UserRole] = None

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        cleaned = re.sub(r"[\s\-().]+", "", v)
        if not _PHONE_RE.match(cleaned):
            raise ValueError("Please provide a valid 10-digit Indian phone number")
        return cleaned


class ForgotPasswordSchema(BaseModel):
    phone: str = Field(..., min_length=10, max_length=15)

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        cleaned = re.sub(r"[\s\-().]+", "", v)
        if not _PHONE_RE.match(cleaned):
            raise ValueError("Please provide a valid 10-digit Indian phone number")
        return cleaned


class ResetPasswordSchema(BaseModel):
    phone: str = Field(..., min_length=10, max_length=15)
    otp: str = Field(..., min_length=6, max_length=6)
    new_password: str = Field(..., min_length=8, max_length=128)

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        cleaned = re.sub(r"[\s\-().]+", "", v)
        if not _PHONE_RE.match(cleaned):
            raise ValueError("Please provide a valid 10-digit Indian phone number")
        return cleaned

    @field_validator("new_password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not re.search(r"[A-Za-z]", v):
            raise ValueError("Password must contain at least one letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one digit")
        return v


class RefreshTokenRequest(BaseModel):
    refresh_token: str


@router.post("/register", response_model=TokenResponse)
def register(
    payload: RegisterRequest,
    db: Session = Depends(get_db),
    _rl=Depends(create_rate_limiter(max_calls=5, window_seconds=60)),
):
    existing_email = db.query(User).filter(User.email == payload.email).first()
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already registered")

    existing_phone = db.query(User).filter(User.phone == payload.phone).first()
    if existing_phone:
        raise HTTPException(status_code=400, detail="Phone number already registered")

    user = User(
        name=payload.name,
        phone=payload.phone,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=payload.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    access = create_access_token({"sub": str(user.id)})
    refresh = create_refresh_token({"sub": str(user.id)})
    return TokenResponse(access_token=access, refresh_token=refresh)


@router.post("/login", response_model=TokenResponse)
def login(
    payload: LoginRequest,
    db: Session = Depends(get_db),
    _rl=Depends(create_rate_limiter(max_calls=5, window_seconds=60)),
):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    access = create_access_token({"sub": str(user.id)})
    refresh = create_refresh_token({"sub": str(user.id)})
    return TokenResponse(access_token=access, refresh_token=refresh)


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
    try:
        record, otp_plain = create_otp_record(db, payload.phone, payload.purpose)
        sent = await send_otp_sms(payload.phone, otp_plain)
        if not sent:
            raise HTTPException(status_code=502, detail="Failed to send OTP. Please try again.")
        return {"message": "OTP sent successfully", "expires_in_seconds": 300}
    except ValueError as e:
        raise HTTPException(status_code=429, detail=str(e))


@router.post("/otp/verify", response_model=TokenResponse)
def verify_otp(
    payload: OtpVerifySchema,
    db: Session = Depends(get_db),
    _rl=Depends(create_rate_limiter(max_calls=5, window_seconds=60)),
):
    """Verify an OTP and issue a JWT."""
    try:
        verify_and_consume_otp(db, payload.phone, payload.otp, payload.purpose)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Find or create user
    user = db.query(User).filter(User.phone == payload.phone).first()

    if payload.purpose == OtpPurpose.signup:
        if user:
            raise HTTPException(status_code=400, detail="Phone number already registered")
        if not payload.name or not payload.role:
            raise HTTPException(
                status_code=400,
                detail="Name and role are required for signup",
            )
        user = User(
            name=payload.name,
            phone=payload.phone,
            password_hash=hash_password(payload.otp),  # temporary, user should set a real password
            role=payload.role,
            phone_verified=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        # Login via OTP
        if not user:
            raise HTTPException(status_code=404, detail="No account found for this phone number")
        user.phone_verified = True
        db.commit()

    access = create_access_token({"sub": str(user.id)})
    refresh = create_refresh_token({"sub": str(user.id)})
    return TokenResponse(access_token=access, refresh_token=refresh)


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
        record, otp_plain = create_otp_record(db, payload.phone, OtpPurpose.password_reset)
        await send_otp_sms(payload.phone, otp_plain)
    except ValueError as e:
        raise HTTPException(status_code=429, detail=str(e))

    return {"message": "If this phone is registered, an OTP has been sent."}


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