from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.models import Transaction, Offer, Lot, User, PaymentStatus
from app.auth import get_current_user

router = APIRouter(prefix="/transactions", tags=["transactions"])


class UserStub(BaseModel):
    id: int
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None


class TransactionResponse(BaseModel):
    id: int
    offer_id: int
    final_price_per_kg: float
    payment_status: PaymentStatus
    lot_id: Optional[int] = None
    lot_title: Optional[str] = None
    quantity: Optional[float] = None
    unit: str = "kg"
    total_amount: Optional[float] = None
    farmer: Optional[UserStub] = None
    buyer: Optional[UserStub] = None

    class Config:
        from_attributes = True


class PaymentStatusUpdate(BaseModel):
    payment_status: PaymentStatus


def _enrich_transaction(t: Transaction, db: Session) -> TransactionResponse:
    """Build a rich TransactionResponse from a Transaction ORM object."""
    offer = db.query(Offer).filter(Offer.id == t.offer_id).first()
    lot = db.query(Lot).filter(Lot.id == offer.lot_id).first() if offer else None
    farmer = db.query(User).filter(User.id == lot.farmer_id).first() if lot else None
    buyer = db.query(User).filter(User.id == offer.buyer_id).first() if offer else None

    quantity = lot.quantity_kg if lot else None
    total_amount = (t.final_price_per_kg * quantity) if quantity else None

    return TransactionResponse(
        id=t.id,
        offer_id=t.offer_id,
        final_price_per_kg=t.final_price_per_kg,
        payment_status=t.payment_status,
        lot_id=lot.id if lot else None,
        lot_title=lot.commodity + (" — " + lot.variety if lot and lot.variety else "") if lot else None,
        quantity=quantity,
        unit="kg",
        total_amount=total_amount,
        farmer=UserStub(
            id=farmer.id, name=farmer.name, email=farmer.email, phone=farmer.phone
        ) if farmer else None,
        buyer=UserStub(
            id=buyer.id, name=buyer.name, email=buyer.email, phone=buyer.phone
        ) if buyer else None,
    )


@router.get("", response_model=list[TransactionResponse])
def list_transactions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    txns = (
        db.query(Transaction)
        .join(Offer, Transaction.offer_id == Offer.id)
        .join(Lot, Offer.lot_id == Lot.id)
        .filter(
            (Lot.farmer_id == current_user.id) | (Offer.buyer_id == current_user.id)
        )
        .all()
    )
    return [_enrich_transaction(t, db) for t in txns]


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
    return _enrich_transaction(transaction, db)