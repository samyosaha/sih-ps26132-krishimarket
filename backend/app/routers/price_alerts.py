"""
Price alerts router — user-managed alerts triggered by the daily price sync.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional

from app.database import get_db
from app.models import PriceAlert, AlertCondition, User
from app.auth import get_current_user
from app.rate_limiter import create_rate_limiter

router = APIRouter(prefix="/price-alerts", tags=["price-alerts"])


# ── Schemas ──────────────────────────────────────────────────────────

class PriceAlertCreate(BaseModel):
    commodity: str = Field(..., min_length=1, max_length=100)
    state: Optional[str] = Field(default=None, max_length=100)
    district: Optional[str] = Field(default=None, max_length=100)
    target_price: float = Field(..., gt=0)
    condition: AlertCondition


class PriceAlertResponse(BaseModel):
    id: int
    commodity: str
    state: Optional[str]
    district: Optional[str]
    target_price: float
    condition: AlertCondition
    is_active: bool
    last_triggered_at: Optional[str]
    created_at: Optional[str]

    class Config:
        from_attributes = True


# ── Endpoints ────────────────────────────────────────────────────────


@router.post("", response_model=PriceAlertResponse)
def create_price_alert(
    payload: PriceAlertCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _rl=Depends(create_rate_limiter(max_calls=10, window_seconds=60)),
):
    """Create a new price alert."""
    # Limit active alerts per user to prevent abuse
    active_count = (
        db.query(PriceAlert)
        .filter(
            PriceAlert.user_id == current_user.id,
            PriceAlert.is_active == True,  # noqa: E712
        )
        .count()
    )
    if active_count >= 20:
        raise HTTPException(
            status_code=400,
            detail="Maximum 20 active price alerts allowed",
        )

    alert = PriceAlert(
        user_id=current_user.id,
        commodity=payload.commodity,
        state=payload.state,
        district=payload.district,
        target_price=payload.target_price,
        condition=payload.condition,
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)

    return _to_response(alert)


@router.get("/me", response_model=list[PriceAlertResponse])
def get_my_alerts(
    active_only: bool = Query(default=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List the current user's price alerts."""
    query = db.query(PriceAlert).filter(PriceAlert.user_id == current_user.id)

    if active_only:
        query = query.filter(PriceAlert.is_active == True)  # noqa: E712

    alerts = query.order_by(PriceAlert.created_at.desc()).all()
    return [_to_response(a) for a in alerts]


@router.delete("/{alert_id}")
def delete_price_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Deactivate a price alert."""
    alert = (
        db.query(PriceAlert)
        .filter(
            PriceAlert.id == alert_id,
            PriceAlert.user_id == current_user.id,
        )
        .first()
    )
    if not alert:
        raise HTTPException(status_code=404, detail="Price alert not found")

    alert.is_active = False
    db.commit()

    return {"message": "Price alert deactivated"}


# ── Helpers ──────────────────────────────────────────────────────────

def _to_response(a: PriceAlert) -> PriceAlertResponse:
    return PriceAlertResponse(
        id=a.id,
        commodity=a.commodity,
        state=a.state,
        district=a.district,
        target_price=a.target_price,
        condition=a.condition,
        is_active=a.is_active,
        last_triggered_at=a.last_triggered_at.isoformat() if a.last_triggered_at else None,
        created_at=a.created_at.isoformat() if a.created_at else None,
    )
