"""
Disputes router — dispute creation, listing, resolution, and public summary.
"""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func as sa_func
from pydantic import BaseModel, Field, field_validator

from app.database import get_db
from app.models import (
    Dispute, Transaction, Offer, Lot, User, UserRole,
    DisputeStatus, DisputeOutcome,
)
from app.auth import get_current_user
from app.sanitize import sanitize_text
from app.rate_limiter import create_rate_limiter
from app.services.notification_service import notify_dispute_update

router = APIRouter(prefix="/disputes", tags=["disputes"])


# ── Schemas ──────────────────────────────────────────────────────────

class DisputeCreate(BaseModel):
    transaction_id: int
    reason: str = Field(..., min_length=10, max_length=1000)

    @field_validator("reason")
    @classmethod
    def sanitize_reason(cls, v: str) -> str:
        return sanitize_text(v, max_length=1000)


class DisputeResponse(BaseModel):
    id: int
    transaction_id: int
    raised_by_id: int
    reason: str
    status: DisputeStatus
    resolution_notes: Optional[str] = None
    outcome: Optional[DisputeOutcome] = None
    resolved_at: Optional[str] = None

    class Config:
        from_attributes = True


class DisputeResolveRequest(BaseModel):
    resolution_notes: str = Field(..., min_length=5, max_length=2000)
    outcome: DisputeOutcome

    @field_validator("resolution_notes")
    @classmethod
    def sanitize_notes(cls, v: str) -> str:
        return sanitize_text(v, max_length=2000)


class DisputeSummary(BaseModel):
    """Privacy-conscious public summary — no full text exposed."""
    total_disputes: int
    resolved_count: int
    outcome_breakdown: dict[str, int]  # e.g. {"favor_farmer": 2, "favor_buyer": 1}


# ── Endpoints ────────────────────────────────────────────────────────


@router.post("", response_model=DisputeResponse)
def create_dispute(
    payload: DisputeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _rl=Depends(create_rate_limiter(max_calls=5, window_seconds=60)),
):
    transaction = db.query(Transaction).filter(Transaction.id == payload.transaction_id).first()
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    offer = db.query(Offer).filter(Offer.id == transaction.offer_id).first()
    lot = db.query(Lot).filter(Lot.id == offer.lot_id).first()

    if current_user.id not in (lot.farmer_id, offer.buyer_id):
        raise HTTPException(status_code=403, detail="Not part of this transaction")

    # Prevent duplicate open disputes on the same transaction by the same user
    existing_dispute = (
        db.query(Dispute)
        .filter(
            Dispute.transaction_id == payload.transaction_id,
            Dispute.raised_by_id == current_user.id,
            Dispute.status == DisputeStatus.open,
        )
        .first()
    )
    if existing_dispute:
        raise HTTPException(
            status_code=409,
            detail="You already have an open dispute on this transaction",
        )

    dispute = Dispute(
        transaction_id=payload.transaction_id,
        raised_by_id=current_user.id,
        reason=payload.reason,
    )
    db.add(dispute)
    db.commit()
    db.refresh(dispute)

    # Notify the other party
    other_party_id = offer.buyer_id if current_user.id == lot.farmer_id else lot.farmer_id
    notify_dispute_update(
        db, other_party_id, dispute.id,
        f"A dispute has been raised on transaction #{transaction.id}",
    )

    return _to_response(dispute)


@router.get("", response_model=list[DisputeResponse])
def list_my_disputes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    disputes = db.query(Dispute).filter(Dispute.raised_by_id == current_user.id).all()
    return [_to_response(d) for d in disputes]


@router.patch("/{dispute_id}/resolve", response_model=DisputeResponse)
def resolve_dispute(
    dispute_id: int,
    payload: DisputeResolveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Resolve a dispute with notes, outcome, and audit trail (admin only)."""
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Only admins can resolve disputes")

    dispute = db.query(Dispute).filter(Dispute.id == dispute_id).first()
    if not dispute:
        raise HTTPException(status_code=404, detail="Dispute not found")

    if dispute.status == DisputeStatus.resolved:
        raise HTTPException(status_code=400, detail="Dispute is already resolved")

    # Set resolution details with full audit trail
    dispute.status = DisputeStatus.resolved
    dispute.resolution_notes = payload.resolution_notes
    dispute.outcome = payload.outcome
    dispute.resolved_by_id = current_user.id
    dispute.resolved_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(dispute)

    # Notify the dispute raiser
    outcome_label = payload.outcome.value.replace("_", " ")
    notify_dispute_update(
        db, dispute.raised_by_id, dispute.id,
        f"Your dispute has been resolved. Outcome: {outcome_label}",
    )

    # Also notify the other party in the transaction
    transaction = db.query(Transaction).filter(Transaction.id == dispute.transaction_id).first()
    if transaction:
        offer = db.query(Offer).filter(Offer.id == transaction.offer_id).first()
        lot = db.query(Lot).filter(Lot.id == offer.lot_id).first()
        other_party_id = (
            offer.buyer_id if dispute.raised_by_id == lot.farmer_id else lot.farmer_id
        )
        notify_dispute_update(
            db, other_party_id, dispute.id,
            f"A dispute on transaction #{transaction.id} has been resolved. Outcome: {outcome_label}",
        )

    return _to_response(dispute)


# ── Admin: list all disputes ─────────────────────────────────────────

@router.get("/admin/all", response_model=list[DisputeResponse])
def list_all_disputes(
    status_filter: Optional[DisputeStatus] = Query(default=None, alias="status"),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all disputes (admin only)."""
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    query = db.query(Dispute)
    if status_filter:
        query = query.filter(Dispute.status == status_filter)

    disputes = (
        query.order_by(Dispute.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [_to_response(d) for d in disputes]


# ── Public user dispute summary ──────────────────────────────────────

@router.get("/user/{user_id}/summary", response_model=DisputeSummary)
def get_user_dispute_summary(
    user_id: int,
    db: Session = Depends(get_db),
):
    """
    Public, privacy-conscious dispute summary for a user.
    Shows counts and outcome breakdown only — no full text.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Count disputes where the user is either raiser or the other party
    # "Involved in" = raiser OR (other party in the transaction)
    all_disputes = (
        db.query(Dispute)
        .join(Transaction, Dispute.transaction_id == Transaction.id)
        .join(Offer, Transaction.offer_id == Offer.id)
        .join(Lot, Offer.lot_id == Lot.id)
        .filter(
            (Dispute.raised_by_id == user_id)
            | (Offer.buyer_id == user_id)
            | (Lot.farmer_id == user_id)
        )
        .all()
    )

    # Deduplicate by dispute ID
    seen_ids = set()
    unique_disputes = []
    for d in all_disputes:
        if d.id not in seen_ids:
            seen_ids.add(d.id)
            unique_disputes.append(d)

    total = len(unique_disputes)
    resolved = [d for d in unique_disputes if d.status == DisputeStatus.resolved]

    outcome_breakdown = {}
    for d in resolved:
        if d.outcome:
            key = d.outcome.value
            outcome_breakdown[key] = outcome_breakdown.get(key, 0) + 1

    return DisputeSummary(
        total_disputes=total,
        resolved_count=len(resolved),
        outcome_breakdown=outcome_breakdown,
    )


# ── Helpers ──────────────────────────────────────────────────────────

def _to_response(d: Dispute) -> DisputeResponse:
    return DisputeResponse(
        id=d.id,
        transaction_id=d.transaction_id,
        raised_by_id=d.raised_by_id,
        reason=d.reason,
        status=d.status,
        resolution_notes=d.resolution_notes,
        outcome=d.outcome,
        resolved_at=d.resolved_at.isoformat() if d.resolved_at else None,
    )