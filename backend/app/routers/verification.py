"""
Buyer verification router — lightweight admin-reviewed verification.
"""

import io
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.database import get_db
from app.models import (
    VerificationRequest, VerificationStatus, User, UserRole,
)
from app.auth import get_current_user
from app.services.storage_service import save_file, StorageError
from app.services.notification_service import notify_verification_update
from app.rate_limiter import create_rate_limiter

router = APIRouter(tags=["verification"])


# ── Schemas ──────────────────────────────────────────────────────────

class VerificationResponse(BaseModel):
    id: int
    user_id: int
    business_name: str
    gst_number: Optional[str]
    id_document_url: Optional[str]
    status: VerificationStatus
    rejection_reason: Optional[str]
    created_at: Optional[str]
    reviewed_at: Optional[str]

    class Config:
        from_attributes = True


class VerificationReviewRequest(BaseModel):
    status: VerificationStatus  # approved or rejected
    rejection_reason: Optional[str] = None


# ── Buyer-facing endpoints ───────────────────────────────────────────


@router.post("/verification/apply", response_model=VerificationResponse)
async def apply_for_verification(
    business_name: str = Form(..., min_length=2, max_length=200),
    gst_number: Optional[str] = Form(default=None, max_length=20),
    id_document: Optional[UploadFile] = File(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _rl=Depends(create_rate_limiter(max_calls=3, window_seconds=60)),
):
    """Submit a verification request. Only buyers can apply."""
    if current_user.role != UserRole.buyer:
        raise HTTPException(status_code=403, detail="Only buyers can apply for verification")

    if current_user.is_verified_buyer:
        raise HTTPException(status_code=400, detail="You are already verified")

    # Check for existing pending request
    existing = (
        db.query(VerificationRequest)
        .filter(
            VerificationRequest.user_id == current_user.id,
            VerificationRequest.status == VerificationStatus.pending,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=409,
            detail="You already have a pending verification request",
        )

    # Handle document upload
    document_url = None
    if id_document:
        try:
            content = io.BytesIO(await id_document.read())
            document_url = save_file(
                content,
                id_document.filename or "document",
                category="verification",
                content_type=id_document.content_type,
            )
        except StorageError as e:
            raise HTTPException(status_code=400, detail=str(e))

    request = VerificationRequest(
        user_id=current_user.id,
        business_name=business_name,
        gst_number=gst_number,
        id_document_url=document_url,
    )
    db.add(request)
    db.commit()
    db.refresh(request)

    return _to_response(request)


@router.get("/verification/status", response_model=list[VerificationResponse])
def get_my_verification_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get the current user's verification request(s)."""
    requests = (
        db.query(VerificationRequest)
        .filter(VerificationRequest.user_id == current_user.id)
        .order_by(VerificationRequest.created_at.desc())
        .all()
    )
    return [_to_response(r) for r in requests]


# ── Admin endpoints ──────────────────────────────────────────────────


@router.get("/admin/verification-requests", response_model=list[VerificationResponse])
def list_verification_requests(
    status_filter: Optional[VerificationStatus] = Query(default=None, alias="status"),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all verification requests (admin only)."""
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    query = db.query(VerificationRequest)
    if status_filter:
        query = query.filter(VerificationRequest.status == status_filter)

    requests = (
        query
        .order_by(VerificationRequest.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [_to_response(r) for r in requests]


@router.patch(
    "/admin/verification-requests/{request_id}",
    response_model=VerificationResponse,
)
def review_verification_request(
    request_id: int,
    payload: VerificationReviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Approve or reject a verification request (admin only)."""
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    if payload.status not in (VerificationStatus.approved, VerificationStatus.rejected):
        raise HTTPException(status_code=400, detail="Status must be 'approved' or 'rejected'")

    request = db.query(VerificationRequest).filter(VerificationRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Verification request not found")

    if request.status != VerificationStatus.pending:
        raise HTTPException(status_code=400, detail="This request has already been reviewed")

    if payload.status == VerificationStatus.rejected and not payload.rejection_reason:
        raise HTTPException(status_code=400, detail="Rejection reason is required")

    # Update verification request
    request.status = payload.status
    request.reviewed_by_id = current_user.id
    request.reviewed_at = datetime.now(timezone.utc)
    request.rejection_reason = payload.rejection_reason

    # If approved, set the user's verified flag
    if payload.status == VerificationStatus.approved:
        user = db.query(User).filter(User.id == request.user_id).first()
        if user:
            user.is_verified_buyer = True

    db.commit()
    db.refresh(request)

    # Notify the applicant of the outcome
    notify_verification_update(
        db,
        request.user_id,
        approved=(payload.status == VerificationStatus.approved),
        reason=payload.rejection_reason,
    )

    return _to_response(request)


# ── Admin: manually verify a buyer ────────────────────────────────────

class VerifyBuyerResponse(BaseModel):
    id: int
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    is_verified_buyer: bool

    class Config:
        from_attributes = True


@router.patch("/admin/users/{user_id}/verify", response_model=VerifyBuyerResponse)
def verify_buyer_manual(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Manually verify a buyer (admin only). Sets is_verified_buyer = true."""
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.role != UserRole.buyer:
        raise HTTPException(status_code=400, detail="Only buyers can be verified")

    user.is_verified_buyer = True
    db.commit()
    db.refresh(user)

    return VerifyBuyerResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        phone=user.phone,
        is_verified_buyer=user.is_verified_buyer,
    )


# ── Helpers ──────────────────────────────────────────────────────────

def _to_response(r: VerificationRequest) -> VerificationResponse:
    return VerificationResponse(
        id=r.id,
        user_id=r.user_id,
        business_name=r.business_name,
        gst_number=r.gst_number,
        id_document_url=r.id_document_url,
        status=r.status,
        rejection_reason=r.rejection_reason,
        created_at=r.created_at.isoformat() if r.created_at else None,
        reviewed_at=r.reviewed_at.isoformat() if r.reviewed_at else None,
    )
