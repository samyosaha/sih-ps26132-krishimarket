from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.models import Offer, Lot, Transaction, User, UserRole, OfferStatus, LotStatus
from app.auth import get_current_user

router = APIRouter(prefix="/offers", tags=["offers"])


class OfferCreate(BaseModel):
    lot_id: int
    offered_price_per_kg: float
    message: Optional[str] = None


class OfferResponse(BaseModel):
    id: int
    lot_id: int
    buyer_id: int
    offered_price_per_kg: float
    message: Optional[str]
    status: OfferStatus

    class Config:
        from_attributes = True


@router.post("", response_model=OfferResponse)
def create_offer(
    payload: OfferCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.buyer:
        raise HTTPException(status_code=403, detail="Only buyers can make offers")

    lot = db.query(Lot).filter(Lot.id == payload.lot_id).first()
    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")

    offer = Offer(
        lot_id=payload.lot_id,
        buyer_id=current_user.id,
        offered_price_per_kg=payload.offered_price_per_kg,
        message=payload.message,
    )
    db.add(offer)
    db.commit()
    db.refresh(offer)
    return offer


@router.get("/received", response_model=list[OfferResponse])
def offers_received(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.farmer:
        raise HTTPException(status_code=403, detail="Only farmers can view received offers")

    return (
        db.query(Offer)
        .join(Lot, Offer.lot_id == Lot.id)
        .filter(Lot.farmer_id == current_user.id)
        .all()
    )


@router.get("/sent", response_model=list[OfferResponse])
def offers_sent(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.buyer:
        raise HTTPException(status_code=403, detail="Only buyers can view sent offers")

    return db.query(Offer).filter(Offer.buyer_id == current_user.id).all()


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
):
    offer = _get_owned_offer(offer_id, db, current_user)

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
    return offer


@router.patch("/{offer_id}/reject", response_model=OfferResponse)
def reject_offer(
    offer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    offer = _get_owned_offer(offer_id, db, current_user)
    offer.status = OfferStatus.rejected
    db.commit()
    db.refresh(offer)
    return offer