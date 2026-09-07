from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.models import Transaction, Offer, Lot, User, PaymentStatus
from app.auth import get_current_user
from app.rate_limiter import create_rate_limiter

router = APIRouter(prefix="/transactions", tags=["transactions"])

# Valid payment status transitions (forward-only state machine)
_VALID_TRANSITIONS: dict[PaymentStatus, set[PaymentStatus]] = {
    PaymentStatus.pending: {PaymentStatus.paid},
    PaymentStatus.paid: {PaymentStatus.delivered},
    PaymentStatus.delivered: set(),  # terminal state
}


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
    limit: int = Query(default=50, ge=1, le=200, description="Max results to return"),
    offset: int = Query(default=0, ge=0, description="Number of results to skip"),
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
        .order_by(Transaction.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [_enrich_transaction(t, db) for t in txns]


@router.patch("/{transaction_id}/payment-status", response_model=TransactionResponse)
def update_payment_status(
    transaction_id: int,
    payload: PaymentStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _rl=Depends(create_rate_limiter(max_calls=10, window_seconds=60)),
):
    transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    offer = db.query(Offer).filter(Offer.id == transaction.offer_id).first()
    lot = db.query(Lot).filter(Lot.id == offer.lot_id).first()

    if current_user.id not in (lot.farmer_id, offer.buyer_id):
        raise HTTPException(status_code=403, detail="Not part of this transaction")

    # Enforce valid state transitions
    current_status = transaction.payment_status
    requested_status = payload.payment_status

    if requested_status == current_status:
        raise HTTPException(
            status_code=400,
            detail=f"Payment status is already '{current_status.value}'",
        )

    allowed_next = _VALID_TRANSITIONS.get(current_status, set())
    if requested_status not in allowed_next:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Cannot transition from '{current_status.value}' to "
                f"'{requested_status.value}'. "
                f"Allowed transitions: {', '.join(s.value for s in allowed_next) or 'none (terminal state)'}"
            ),
        )

    transaction.payment_status = requested_status
    db.commit()
    db.refresh(transaction)
    return _enrich_transaction(transaction, db)