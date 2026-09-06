from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.models import Transaction, Offer, Lot, User, PaymentStatus
from app.auth import get_current_user

router = APIRouter(prefix="/transactions", tags=["transactions"])


class TransactionResponse(BaseModel):
    id: int
    offer_id: int
    final_price_per_kg: float
    payment_status: PaymentStatus

    class Config:
        from_attributes = True


class PaymentStatusUpdate(BaseModel):
    payment_status: PaymentStatus


@router.get("", response_model=list[TransactionResponse])
def list_transactions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(Transaction)
        .join(Offer, Transaction.offer_id == Offer.id)
        .join(Lot, Offer.lot_id == Lot.id)
        .filter(
            (Lot.farmer_id == current_user.id) | (Offer.buyer_id == current_user.id)
        )
        .all()
    )


@router.patch("/{transaction_id}/payment-status", response_model=TransactionResponse)
def update_payment_status(
    transaction_id: int,
    payload: PaymentStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    offer = db.query(Offer).filter(Offer.id == transaction.offer_id).first()
    lot = db.query(Lot).filter(Lot.id == offer.lot_id).first()

    if current_user.id not in (lot.farmer_id, offer.buyer_id):
        raise HTTPException(status_code=403, detail="Not part of this transaction")

    transaction.payment_status = payload.payment_status
    db.commit()
    db.refresh(transaction)
    return transaction