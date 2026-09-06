from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.models import Dispute, Transaction, Offer, Lot, User, UserRole, DisputeStatus
from app.auth import get_current_user

router = APIRouter(prefix="/disputes", tags=["disputes"])


class DisputeCreate(BaseModel):
    transaction_id: int
    reason: str


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
):
    transaction = db.query(Transaction).filter(Transaction.id == payload.transaction_id).first()
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    offer = db.query(Offer).filter(Offer.id == transaction.offer_id).first()
    lot = db.query(Lot).filter(Lot.id == offer.lot_id).first()

    if current_user.id not in (lot.farmer_id, offer.buyer_id):
        raise HTTPException(status_code=403, detail="Not part of this transaction")

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

    dispute.status = DisputeStatus.resolved
    db.commit()
    db.refresh(dispute)
    return dispute