"""
OTP generation, hashing, verification, and SMS delivery.

SMS is sent via 2Factor.in (India-optimized, good test mode).
When SMS_API_KEY is not set, OTPs are logged to the console for local dev.
"""

import os
import secrets
import logging
from datetime import datetime, timedelta, timezone

import httpx
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from sqlalchemy import func as sa_func

from app.models import OtpRequest, OtpPurpose

logger = logging.getLogger(__name__)

# Use bcrypt for OTP hashing (same library as passwords, but OTPs are
# short-lived so the slower hash is acceptable for rate-limited requests)
_otp_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ── Configuration ────────────────────────────────────────────────────

OTP_LENGTH = 6
OTP_EXPIRY_MINUTES = 5
MAX_OTP_REQUESTS_PER_WINDOW = 3   # max 3 OTP sends per phone per 10 min
OTP_REQUEST_WINDOW_MINUTES = 10
MAX_VERIFY_ATTEMPTS = 5           # lock out after 5 failed verifications
RESEND_COOLDOWN_SECONDS = 60      # minimum seconds between OTP sends

SMS_API_KEY = os.getenv("SMS_API_KEY", "").strip()
SMS_API_BASE = "https://2factor.in/API/V1"


# ── OTP generation and hashing ───────────────────────────────────────

def generate_otp() -> str:
    """Generate a random 6-digit numeric OTP."""
    # `random` is predictable and is not suitable for authentication codes.
    return f"{secrets.randbelow(10 ** OTP_LENGTH):0{OTP_LENGTH}d}"


def invalidate_otp(db: Session, otp_record: OtpRequest) -> None:
    """Prevent a code from being used when delivery was unsuccessful."""
    otp_record.is_used = True
    db.commit()


def hash_otp(otp: str) -> str:
    """Hash an OTP for safe storage — never store plaintext."""
    return _otp_ctx.hash(otp)


def verify_otp_hash(plain_otp: str, hashed: str) -> bool:
    """Verify a plaintext OTP against its stored hash."""
    return _otp_ctx.verify(plain_otp, hashed)


# ── Rate limiting checks ────────────────────────────────────────────

def check_rate_limit(db: Session, phone: str, purpose: OtpPurpose) -> None:
    """
    Raise ValueError if the phone has exceeded the OTP request limit.
    Checks both the window limit and the resend cooldown.
    """
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(minutes=OTP_REQUEST_WINDOW_MINUTES)

    # Count recent requests for this phone
    recent_count = (
        db.query(sa_func.count(OtpRequest.id))
        .filter(
            OtpRequest.phone_number == phone,
            OtpRequest.purpose == purpose,
            OtpRequest.created_at >= window_start,
        )
        .scalar()
    )

    if recent_count >= MAX_OTP_REQUESTS_PER_WINDOW:
        raise ValueError(
            f"Too many OTP requests. Please wait before requesting again."
        )

    # Check resend cooldown — most recent request must be > RESEND_COOLDOWN ago
    last_request = (
        db.query(OtpRequest)
        .filter(
            OtpRequest.phone_number == phone,
            OtpRequest.purpose == purpose,
        )
        .order_by(OtpRequest.created_at.desc())
        .first()
    )
    if last_request and last_request.created_at:
        # Ensure last_request.created_at is timezone-aware
        last_created = last_request.created_at
        if last_created.tzinfo is None:
            last_created = last_created.replace(tzinfo=timezone.utc)
        elapsed = (now - last_created).total_seconds()
        if elapsed < RESEND_COOLDOWN_SECONDS:
            wait = int(RESEND_COOLDOWN_SECONDS - elapsed)
            raise ValueError(
                f"Please wait {wait} seconds before requesting a new OTP."
            )


def check_attempt_limit(otp_record: OtpRequest) -> None:
    """Raise ValueError if the OTP has been attempted too many times."""
    if otp_record.attempt_count >= MAX_VERIFY_ATTEMPTS:
        raise ValueError(
            "Too many verification attempts. Please request a new OTP."
        )


# ── OTP record management ───────────────────────────────────────────

def create_otp_record(
    db: Session, phone: str, purpose: OtpPurpose
) -> tuple[OtpRequest, str]:
    """
    Generate an OTP, store its hash, and return the record + plaintext code.

    The plaintext code is returned ONLY so it can be passed to send_otp_sms.
    It must NEVER be logged, stored in plaintext, or returned in an API response.
    """
    check_rate_limit(db, phone, purpose)

    otp_plain = generate_otp()
    otp_hashed = hash_otp(otp_plain)

    record = OtpRequest(
        phone_number=phone,
        otp_hash=otp_hashed,
        purpose=purpose,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRY_MINUTES),
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return record, otp_plain


def get_latest_valid_otp(
    db: Session, phone: str, purpose: OtpPurpose
) -> OtpRequest | None:
    """
    Return the most recent unused, unexpired OTP for the given phone + purpose.
    """
    now = datetime.now(timezone.utc)
    return (
        db.query(OtpRequest)
        .filter(
            OtpRequest.phone_number == phone,
            OtpRequest.purpose == purpose,
            OtpRequest.is_used == False,  # noqa: E712
            OtpRequest.expires_at > now,
        )
        .order_by(OtpRequest.created_at.desc())
        .first()
    )


def verify_and_consume_otp(
    db: Session, phone: str, otp_plain: str, purpose: OtpPurpose
) -> bool:
    """
    Verify an OTP and mark it as used if correct.

    Returns True on success, raises ValueError on failure.
    """
    record = get_latest_valid_otp(db, phone, purpose)
    if not record:
        raise ValueError("No valid OTP found. It may have expired — please request a new one.")

    check_attempt_limit(record)

    # Increment attempt count regardless of outcome
    record.attempt_count += 1

    if not verify_otp_hash(otp_plain, record.otp_hash):
        db.commit()
        remaining = MAX_VERIFY_ATTEMPTS - record.attempt_count
        raise ValueError(
            f"Incorrect OTP. {remaining} attempt(s) remaining."
        )

    # Success — mark as used
    record.is_used = True
    db.commit()
    return True


# ── SMS sending ──────────────────────────────────────────────────────

async def send_otp_sms(phone: str, otp: str) -> bool:
    """
    Send the OTP via 2Factor.in SMS API.

    When SMS_API_KEY is not configured, logs the OTP to console for dev/testing.
    IMPORTANT: In production, NEVER log the plaintext OTP.
    """
    if not SMS_API_KEY:
        # Dev mode — log to console (ONLY in development!)
        logger.warning(
            "[OTP DEV MODE] OTP for %s: %s  "
            "(Set SMS_API_KEY to enable real SMS delivery)",
            phone,
            otp,
        )
        return True

    try:
        # 2Factor.in transactional SMS API
        url = f"{SMS_API_BASE}/{SMS_API_KEY}/SMS/{phone}/{otp}"
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.get(url)
            data = response.json()

        if data.get("Status") == "Success":
            logger.info("[OTP] SMS sent successfully to %s", phone)
            return True
        else:
            logger.error("[OTP] SMS send failed: %s", data)
            return False

    except Exception as e:
        logger.error("[OTP] SMS send error: %s", e)
        return False
