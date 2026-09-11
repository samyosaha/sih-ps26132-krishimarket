from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field, field_validator

from app.database import get_db
from app.models import (
    Transaction, Offer, Lot, User, PaymentStatus, DeliveryStatus,
)
from app.auth import get_current_user
from app.rate_limiter import create_rate_limiter
from app.sanitize import sanitize_text
from app.services.notification_service import (
    notify_payment_update,
    notify_rate_prompt,
)
from app.services.delivery_state_machine import (
    transition as delivery_transition,
    DeliveryEvent,
    DeliveryTransitionError,
)

router = APIRouter(prefix="/transactions", tags=["transactions"])

# Valid payment status transitions (forward-only state machine)
_VALID_TRANSITIONS: dict[PaymentStatus, set[PaymentStatus]] = {
    PaymentStatus.pending: {PaymentStatus.paid},
    PaymentStatus.paid: {PaymentStatus.failed},
    PaymentStatus.failed: set(),  # terminal state
}


class UserStub(BaseModel):
    id: int
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    is_verified_buyer: bool = False


class TransactionResponse(BaseModel):
    id: int
    offer_id: int
    final_price_per_kg: float
    payment_status: PaymentStatus
    delivery_status: Optional[str] = None
    delivery_method: Optional[str] = None
    lot_id: Optional[int] = None
    lot_title: Optional[str] = None
    quantity: Optional[float] = None
    unit: str = "kg"
    total_amount: Optional[float] = None
    farmer: Optional[UserStub] = None
    buyer: Optional[UserStub] = None
    created_at: Optional[str] = None
    hub_checkin_photo_url: Optional[str] = None
    hub_checkin_weight_kg: Optional[float] = None
    hub_checkin_grade: Optional[str] = None
    estimated_delivery_cost: Optional[float] = None
    lot_grade: Optional[str] = None
    lot_quantity_kg: Optional[float] = None
    delivery_district: Optional[str] = None

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

    # Normalise delivery_status to its string value
    ds = t.delivery_status
    ds_str = ds.value if hasattr(ds, "value") else str(ds) if ds else None
    dm = t.delivery_method
    dm_str = dm.value if hasattr(dm, "value") else str(dm) if dm else None

    lot_grade = None
    if lot and lot.quality_grade:
        lot_grade = lot.quality_grade.value if hasattr(lot.quality_grade, "value") else str(lot.quality_grade)

    return TransactionResponse(
        id=t.id,
        offer_id=t.offer_id,
        final_price_per_kg=t.final_price_per_kg,
        payment_status=t.payment_status,
        delivery_status=ds_str,
        delivery_method=dm_str,
        lot_id=lot.id if lot else None,
        lot_title=lot.commodity + (" — " + lot.variety if lot and lot.variety else "") if lot else None,
        quantity=quantity,
        unit="kg",
        total_amount=total_amount,
        farmer=UserStub(
            id=farmer.id, name=farmer.name, email=farmer.email, phone=farmer.phone,
            is_verified_buyer=farmer.is_verified_buyer,
        ) if farmer else None,
        buyer=UserStub(
            id=buyer.id, name=buyer.name, email=buyer.email, phone=buyer.phone,
            is_verified_buyer=buyer.is_verified_buyer,
        ) if buyer else None,
        created_at=t.created_at.isoformat() if t.created_at else None,
        hub_checkin_photo_url=t.hub_checkin_photo_url,
        hub_checkin_weight_kg=t.hub_checkin_weight_kg,
        hub_checkin_grade=t.hub_checkin_grade,
        estimated_delivery_cost=t.estimated_delivery_cost,
        lot_grade=lot_grade,
        lot_quantity_kg=lot.quantity_kg if lot else None,
        delivery_district=offer.delivery_district if offer else None,
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

    # The 'delivered' status no longer exists for payments; this check is unnecessary.
    # If needed, you could compare against the current status directly.
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

    # Notify both parties about the status change
    farmer = db.query(User).filter(User.id == lot.farmer_id).first()
    buyer = db.query(User).filter(User.id == offer.buyer_id).first()

    notify_payment_update(
        db, lot.farmer_id, transaction.id, requested_status.value
    )
    notify_payment_update(
        db, offer.buyer_id, transaction.id, requested_status.value
    )

    # No longer a 'delivered' payment status; skip rating prompts here.
    # If you want to trigger rating after payment, handle it in a separate endpoint.


    return _enrich_transaction(transaction, db)


# ── Delivery State Machine Endpoints ─────────────────────────────────
# All delivery_status changes go through the state machine — no direct sets.


def _get_transaction_for_delivery(
    transaction_id: int, db: Session, current_user: User,
) -> tuple[Transaction, Offer, Lot]:
    """Load & authorise a transaction for a delivery-status event."""
    transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    offer = db.query(Offer).filter(Offer.id == transaction.offer_id).first()
    lot = db.query(Lot).filter(Lot.id == offer.lot_id).first()
    if current_user.id not in (lot.farmer_id, offer.buyer_id):
        raise HTTPException(status_code=403, detail="Not part of this transaction")
    return transaction, offer, lot


class DispatchRequest(BaseModel):
    delivery_method: str = Field(..., min_length=1, max_length=200)


class RejectRequest(BaseModel):
    reason: str = Field(..., min_length=10, max_length=1000)

    @field_validator("reason")
    @classmethod
    def sanitize_reason(cls, v: str) -> str:
        return sanitize_text(v, max_length=1000)


@router.post("/{transaction_id}/dispatch", response_model=TransactionResponse)
def dispatch_transaction(
    transaction_id: int,
    payload: DispatchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _rl=Depends(create_rate_limiter(max_calls=10, window_seconds=60)),
):
    """Advance delivery status to 'dispatched' with a delivery_method string."""
    transaction, offer, lot = _get_transaction_for_delivery(
        transaction_id, db, current_user,
    )
    try:
        delivery_transition(
            db, transaction, DeliveryEvent.DISPATCH,
            delivery_method=payload.delivery_method,
        )
    except DeliveryTransitionError as exc:
        raise HTTPException(status_code=400, detail=exc.message)
    db.commit()
    db.refresh(transaction)
    return _enrich_transaction(transaction, db)


@router.post("/{transaction_id}/in-transit", response_model=TransactionResponse)
def mark_in_transit(
    transaction_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _rl=Depends(create_rate_limiter(max_calls=10, window_seconds=60)),
):
    """Advance delivery status to 'in_transit'."""
    transaction, offer, lot = _get_transaction_for_delivery(
        transaction_id, db, current_user,
    )
    try:
        delivery_transition(db, transaction, DeliveryEvent.IN_TRANSIT)
    except DeliveryTransitionError as exc:
        raise HTTPException(status_code=400, detail=exc.message)
    db.commit()
    db.refresh(transaction)
    return _enrich_transaction(transaction, db)


@router.post("/{transaction_id}/delivered", response_model=TransactionResponse)
def mark_delivered(
    transaction_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _rl=Depends(create_rate_limiter(max_calls=10, window_seconds=60)),
):
    """Advance delivery status to 'delivered'."""
    transaction, offer, lot = _get_transaction_for_delivery(
        transaction_id, db, current_user,
    )
    try:
        delivery_transition(db, transaction, DeliveryEvent.DELIVER)
    except DeliveryTransitionError as exc:
        raise HTTPException(status_code=400, detail=exc.message)
    db.commit()
    db.refresh(transaction)
    return _enrich_transaction(transaction, db)


@router.post("/{transaction_id}/reject", response_model=TransactionResponse)
def reject_transaction(
    transaction_id: int,
    payload: RejectRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _rl=Depends(create_rate_limiter(max_calls=10, window_seconds=60)),
):
    """Reject / raise a dispute — transitions to 'disputed' and creates a Dispute record."""
    transaction, offer, lot = _get_transaction_for_delivery(
        transaction_id, db, current_user,
    )
    try:
        delivery_transition(
            db, transaction, DeliveryEvent.DISPUTE,
            reason=payload.reason,
            raised_by_id=current_user.id,
        )
    except DeliveryTransitionError as exc:
        raise HTTPException(status_code=400, detail=exc.message)
    db.commit()
    db.refresh(transaction)
    return _enrich_transaction(transaction, db)