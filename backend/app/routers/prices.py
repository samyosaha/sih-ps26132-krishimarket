from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime

from app.database import get_db
from app.models import PriceRecord

router = APIRouter(prefix="/prices", tags=["prices"])


class PriceRecordResponse(BaseModel):
    id: int
    state: str
    district: str
    market: str
    commodity: str
    variety: Optional[str]
    grade: Optional[str]
    arrival_date: Optional[datetime]
    min_price: Optional[float]
    max_price: Optional[float]
    modal_price: Optional[float]

    class Config:
        from_attributes = True


@router.get("", response_model=list[PriceRecordResponse])
def get_prices(
    commodity: Optional[str] = None,
    state: Optional[str] = None,
    district: Optional[str] = None,
    days: int = Query(default=7, description="Return records from the most recent N distinct dates"),
    db: Session = Depends(get_db),
):
    query = db.query(PriceRecord)
    if commodity:
        query = query.filter(PriceRecord.commodity == commodity)
    if state:
        query = query.filter(PriceRecord.state == state)
    if district:
        query = query.filter(PriceRecord.district == district)

    query = query.order_by(PriceRecord.arrival_date.desc())

    results = query.all()

    distinct_dates = sorted({r.arrival_date for r in results if r.arrival_date}, reverse=True)[:days]
    return [r for r in results if r.arrival_date in distinct_dates]