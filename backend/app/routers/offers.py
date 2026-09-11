from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel, Field, field_validator

from app.database import get_db
from app.models import Offer, Lot, Transaction, User, UserRole, OfferStatus, LotStatus
from app.auth import get_current_user
from app.sanitize import sanitize_text, sanitize_string
from app.rate_limiter import create_rate_limiter
from app.services.notification_service import (
    notify_new_offer, notify_offer_accepted, notify_offer_rejected,
)

router = APIRouter(prefix="/offers", tags=["offers"])


# ── Request schemas ──────────────────────────────────────────────────

class OfferCreate(BaseModel):
    lot_id: int
    offered_price_per_kg: float = Field(..., gt=0, le=100_000)
    message: Optional[str] = Field(default=None, max_length=500)
    delivery_district: Optional[str] = Field(default=None, max_length=100)

    @field_validator("message")
    @classmethod
    def sanitize_message(cls, v: str | None) -> str | None:
        if v is None:
            return v
        return sanitize_text(v, max_length=500)

    @field_validator("delivery_district")
    @classmethod
    def sanitize_delivery_district(cls, v: str | None) -> str | None:
        if v is None:
            return v
        return sanitize_string(v, max_length=100)


# ── Nested response schemas ──────────────────────────────────────────

class UserStub(BaseModel):
    id: int
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    is_verified_buyer: bool = False

    class Config:
        from_attributes = True


class LotStub(BaseModel):
    id: int
    commodity: str
    variety: Optional[str] = None
    quantity_kg: float
    quality_grade: str
    asking_price_per_kg: float
    district: str
    state: str
    status: str
    farmer_name: Optional[str] = None

    class Config:
        from_attributes = True


class OfferResponse(BaseModel):
    id: int
    lot_id: int
    buyer_id: int
    offered_price_per_kg: float
    message: Optional[str]
    status: OfferStatus
    delivery_district: Optional[str] = None

    class Config:
        from_attributes = True


class OfferWithBuyer(OfferResponse):
    """Offer enriched with buyer info — used in farmer's received offers."""
    buyer: UserStub


class OfferWithLotAndFarmer(OfferResponse):
    """Offer enriched with lot + farmer info — used in buyer's sent offers."""
    lot: Optional[LotStub] = None
    farmer: Optional[UserStub] = None


class ReceivedOffersGroup(BaseModel):
    """One lot with all its offers (including buyer info)."""
    lot: LotStub
    offers: list[OfferWithBuyer]


# ── Endpoints ────────────────────────────────────────────────────────

@router.post("", response_model=OfferResponse)
def create_offer(
    payload: OfferCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _rl=Depends(create_rate_limiter(max_calls=10, window_seconds=60)),
):
    if current_user.role != UserRole.buyer:
        raise HTTPException(status_code=403, detail="Only buyers can make offers")

    lot = db.query(Lot).filter(Lot.id == payload.lot_id).first()
    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")

    # Only allow offers on available lots
    if lot.status != LotStatus.available:
        raise HTTPException(
            status_code=400,
            detail="This lot is no longer available for offers",
        )

    # Prevent duplicate pending offers from the same buyer on the same lot
    existing_offer = (
        db.query(Offer)
        .filter(
            Offer.lot_id == payload.lot_id,
            Offer.buyer_id == current_user.id,
            Offer.status == OfferStatus.pending,
        )
        .first()
    )
    if existing_offer:
        raise HTTPException(
            status_code=409,
            detail="You already have a pending offer on this lot",
        )

    offer = Offer(
        lot_id=payload.lot_id,
        buyer_id=current_user.id,
        offered_price_per_kg=payload.offered_price_per_kg,
        message=payload.message,
        delivery_district=payload.delivery_district,
    )
    db.add(offer)
    db.commit()
    db.refresh(offer)

    # Notify the farmer about the new offer
    notify_new_offer(db, lot.farmer_id, current_user.name, lot.commodity, offer.id)

    return offer


@router.get("/received", response_model=list[ReceivedOffersGroup])
def offers_received(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return offers grouped by lot for the authenticated farmer."""
    if current_user.role != UserRole.farmer:
        raise HTTPException(status_code=403, detail="Only farmers can view received offers")

    # Get all lots for this farmer that have offers
    lots = (
        db.query(Lot)
        .filter(Lot.farmer_id == current_user.id)
        .options(joinedload(Lot.offers))
        .all()
    )

    result = []
    for lot in lots:
        if not lot.offers:
            continue

        lot_stub = LotStub(
            id=lot.id,
            commodity=lot.commodity,
            variety=lot.variety,
            quantity_kg=lot.quantity_kg,
            quality_grade=lot.quality_grade.value if hasattr(lot.quality_grade, 'value') else str(lot.quality_grade),
            asking_price_per_kg=lot.asking_price_per_kg,
            district=lot.district,
            state=lot.state,
            status=lot.status.value if hasattr(lot.status, 'value') else str(lot.status),
            farmer_name=lot.farmer.name if lot.farmer else None,
        )

        offer_items = []
        for offer in lot.offers:
            buyer = db.query(User).filter(User.id == offer.buyer_id).first()
            buyer_stub = UserStub(
                id=buyer.id,
                name=buyer.name,
                email=buyer.email,
                phone=buyer.phone,
                is_verified_buyer=buyer.is_verified_buyer,
            ) if buyer else UserStub(id=offer.buyer_id, name="Unknown")

            offer_items.append(OfferWithBuyer(
                id=offer.id,
                lot_id=offer.lot_id,
                buyer_id=offer.buyer_id,
                offered_price_per_kg=offer.offered_price_per_kg,
                message=offer.message,
                status=offer.status,
                buyer=buyer_stub,
            ))

        result.append(ReceivedOffersGroup(lot=lot_stub, offers=offer_items))

    return result


@router.get("/sent", response_model=list[OfferWithLotAndFarmer])
def offers_sent(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all offers placed by the authenticated buyer, with lot + farmer info."""
    if current_user.role != UserRole.buyer:
        raise HTTPException(status_code=403, detail="Only buyers can view sent offers")

    offers = db.query(Offer).filter(Offer.buyer_id == current_user.id).all()

    result = []
    for offer in offers:
        lot = db.query(Lot).filter(Lot.id == offer.lot_id).first()
        farmer = db.query(User).filter(User.id == lot.farmer_id).first() if lot else None

        lot_stub = LotStub(
            id=lot.id,
            commodity=lot.commodity,
            variety=lot.variety,
            quantity_kg=lot.quantity_kg,
            quality_grade=lot.quality_grade.value if hasattr(lot.quality_grade, 'value') else str(lot.quality_grade),
            asking_price_per_kg=lot.asking_price_per_kg,
            district=lot.district,
            state=lot.state,
            status=lot.status.value if hasattr(lot.status, 'value') else str(lot.status),
            farmer_name=farmer.name if farmer else None,
        ) if lot else None

        farmer_stub = UserStub(
            id=farmer.id,
            name=farmer.name,
            email=farmer.email,
            phone=farmer.phone,
        ) if farmer else None

        result.append(OfferWithLotAndFarmer(
            id=offer.id,
            lot_id=offer.lot_id,
            buyer_id=offer.buyer_id,
            offered_price_per_kg=offer.offered_price_per_kg,
            message=offer.message,
            status=offer.status,
            lot=lot_stub,
            farmer=farmer_stub,
        ))

    return result


# ── Accept / Reject ──────────────────────────────────────────────────

def _get_owned_offer(offer_id: int, db: Session, current_user: User) -> Offer:
    offer = db.query(Offer).filter(Offer.id == offer_id).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    lot = db.query(Lot).filter(Lot.id == offer.lot_id).first()
    if not lot or lot.farmer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your lot's offer")
    return offer


@router.patch("/{offer_id}/accept", response_model=OfferResponse)
def accept_offer(
    offer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _rl=Depends(create_rate_limiter(max_calls=15, window_seconds=60)),
):
    offer = _get_owned_offer(offer_id, db, current_user)

    # Only pending offers can be accepted
    if offer.status != OfferStatus.pending:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot accept an offer that is already {offer.status.value}",
        )

    offer.status = OfferStatus.accepted

    transaction = Transaction(
        offer_id=offer.id,
        final_price_per_kg=offer.offered_price_per_kg,
    )
    db.add(transaction)

    lot = db.query(Lot).filter(Lot.id == offer.lot_id).first()
    lot.status = LotStatus.reserved

    db.commit()
    db.refresh(offer)

    # Notify the buyer that their offer was accepted
    notify_offer_accepted(db, offer.buyer_id, lot.commodity, offer.id)

    return offer


@router.patch("/{offer_id}/reject", response_model=OfferResponse)
def reject_offer(
    offer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _rl=Depends(create_rate_limiter(max_calls=15, window_seconds=60)),
):
    offer = _get_owned_offer(offer_id, db, current_user)

    # Only pending offers can be rejected
    if offer.status != OfferStatus.pending:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot reject an offer that is already {offer.status.value}",
        )

    offer.status = OfferStatus.rejected
    db.commit()
    db.refresh(offer)

    # Notify the buyer that their offer was rejected
    lot = db.query(Lot).filter(Lot.id == offer.lot_id).first()
    notify_offer_rejected(db, offer.buyer_id, lot.commodity if lot else "lot", offer.id)

    return offer