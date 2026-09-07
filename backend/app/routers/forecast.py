from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.forecasting import forecast_price
from app.sanitize import sanitize_string
from app.rate_limiter import create_rate_limiter

router = APIRouter(prefix="/forecast", tags=["forecast"])


@router.get("")
def get_forecast(
    commodity: str = Query(..., max_length=100),
    state: str = Query(..., max_length=100),
    district: Optional[str] = Query(default=None, max_length=100),
    db: Session = Depends(get_db),
    _rl=Depends(create_rate_limiter(max_calls=20, window_seconds=60)),
):
    # Sanitize inputs
    commodity = sanitize_string(commodity, max_length=100)
    state = sanitize_string(state, max_length=100)
    if district:
        district = sanitize_string(district, max_length=100)

    return forecast_price(commodity=commodity, state=state, district=district, db=db)