from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field, field_validator

from app.database import get_db
from app.models import Dispute, Transaction, Offer, Lot, User, UserRole, DisputeStatus
from app.auth import get_current_user
from app.sanitize import sanitize_text
from app.rate_limiter import create_rate_limiter

router = APIRouter(prefix="/disputes", tags=["disputes"])


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

    class Config:
        from_attributes = True


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
    return dispute


@router.get("", response_model=list[DisputeResponse])
def list_my_disputes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(Dispute).filter(Dispute.raised_by_id == current_user.id).all()


@router.patch("/{dispute_id}/resolve", response_model=DisputeResponse)
def resolve_dispute(
    dispute_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Only admins can resolve disputes")

    dispute = db.query(Dispute).filter(Dispute.id == dispute_id).first()
    if not dispute:
        raise HTTPException(status_code=404, detail="Dispute not found")

    if dispute.status == DisputeStatus.resolved:
        raise HTTPException(status_code=400, detail="Dispute is already resolved")

    dispute.status = DisputeStatus.resolved
    db.commit()
    db.refresh(dispute)
    return dispute