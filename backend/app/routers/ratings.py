"""
Ratings router — two-way rating system after completed transactions.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func as sa_func
from pydantic import BaseModel, Field
from typing import Optional

from app.database import get_db
from app.models import (
    Rating, Transaction, Offer, Lot, User, PaymentStatus,
)
from app.auth import get_current_user
from app.sanitize import sanitize_text
from app.rate_limiter import create_rate_limiter

router = APIRouter(prefix="", tags=["ratings"])


# ── Schemas ──────────────────────────────────────────────────────────

class RatingCreate(BaseModel):
    rating_value: int = Field(..., ge=1, le=5)
    comment: Optional[str] = Field(default=None, max_length=500)

    # Sanitize comment to prevent XSS
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        return v


class RatingResponse(BaseModel):
    id: int
    transaction_id: int
    rater_id: int
    ratee_id: int
    rating_value: int
    comment: Optional[str]
    rater_name: Optional[str] = None

    class Config:
        from_attributes = True


class UserRatingSummary(BaseModel):
    average_rating: Optional[float]
    total_ratings: int
    ratings: list[RatingResponse]


# ── Endpoints ────────────────────────────────────────────────────────


@router.post("/transactions/{transaction_id}/ratings", response_model=RatingResponse)
def create_rating(
    transaction_id: int,
    payload: RatingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _rl=Depends(create_rate_limiter(max_calls=10, window_seconds=60)),
):
    """
    Rate the other party after a completed transaction.
    Only allowed when payment_status == 'delivered'.
    One rating per person per transaction.
    """
    # Verify transaction exists and is delivered
    transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    if transaction.payment_status != PaymentStatus.delivered:
        raise HTTPException(
            status_code=400,
            detail="Ratings can only be submitted after delivery is confirmed",
        )

    # Determine the two parties
    offer = db.query(Offer).filter(Offer.id == transaction.offer_id).first()
    lot = db.query(Lot).filter(Lot.id == offer.lot_id).first()

    farmer_id = lot.farmer_id
    buyer_id = offer.buyer_id

    if current_user.id not in (farmer_id, buyer_id):
        raise HTTPException(status_code=403, detail="Not part of this transaction")

    # Determine who is being rated
    if current_user.id == farmer_id:
        ratee_id = buyer_id
    else:
        ratee_id = farmer_id

    # Check unique constraint — one rating per person per transaction
    existing = (
        db.query(Rating)
        .filter(
            Rating.transaction_id == transaction_id,
            Rating.rater_id == current_user.id,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=409,
            detail="You have already rated this transaction",
        )

    # Sanitize comment
    comment = sanitize_text(payload.comment, max_length=500) if payload.comment else None

    rating = Rating(
        transaction_id=transaction_id,
        rater_id=current_user.id,
        ratee_id=ratee_id,
        rating_value=payload.rating_value,
        comment=comment,
    )
    db.add(rating)
    db.commit()
    db.refresh(rating)

    # Recompute ratee's average rating
    _recompute_user_rating(db, ratee_id)

    return RatingResponse(
        id=rating.id,
        transaction_id=rating.transaction_id,
        rater_id=rating.rater_id,
        ratee_id=rating.ratee_id,
        rating_value=rating.rating_value,
        comment=rating.comment,
        rater_name=current_user.name,
    )


@router.get("/users/{user_id}/ratings", response_model=UserRatingSummary)
def get_user_ratings(
    user_id: int,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    """Get a user's rating summary and recent ratings."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    ratings = (
        db.query(Rating)
        .filter(Rating.ratee_id == user_id)
        .order_by(Rating.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    # Enrich with rater names
    rating_responses = []
    for r in ratings:
        rater = db.query(User).filter(User.id == r.rater_id).first()
        rating_responses.append(RatingResponse(
            id=r.id,
            transaction_id=r.transaction_id,
            rater_id=r.rater_id,
            ratee_id=r.ratee_id,
            rating_value=r.rating_value,
            comment=r.comment,
            rater_name=rater.name if rater else None,
        ))

    return UserRatingSummary(
        average_rating=user.average_rating,
        total_ratings=user.total_ratings,
        ratings=rating_responses,
    )


# ── Helpers ──────────────────────────────────────────────────────────

def _recompute_user_rating(db: Session, user_id: int) -> None:
    """Recompute and persist average_rating + total_ratings for a user."""
    result = (
        db.query(
            sa_func.avg(Rating.rating_value),
            sa_func.count(Rating.id),
        )
        .filter(Rating.ratee_id == user_id)
        .first()
    )

    avg_val, count = result
    user = db.query(User).filter(User.id == user_id).first()
    if user:
        user.average_rating = round(float(avg_val), 2) if avg_val else None
        user.total_ratings = count or 0
        db.commit()
