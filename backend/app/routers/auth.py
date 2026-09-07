import re
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr, Field, field_validator

from app.database import get_db
from app.models import User, UserRole
from app.auth import hash_password, verify_password, create_access_token, get_current_user
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
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: int
    name: str
    phone: str
    email: str | None
    role: UserRole
    is_verified_buyer: bool

    class Config:
        from_attributes = True


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

    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse)
def login(
    payload: LoginRequest,
    db: Session = Depends(get_db),
    _rl=Depends(create_rate_limiter(max_calls=5, window_seconds=60)),
):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserResponse)
def read_current_user(current_user: User = Depends(get_current_user)):
    return current_user