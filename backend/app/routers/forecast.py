from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.forecasting import forecast_price

router = APIRouter(prefix="/forecast", tags=["forecast"])


@router.get("")
def get_forecast(
    commodity: str = Query(...),
    state: str = Query(...),
    district: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    return forecast_price(commodity=commodity, state=state, district=district, db=db)