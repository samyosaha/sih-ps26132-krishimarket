from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from datetime import datetime

from app.database import get_db
from app.models import PriceRecord
from app.sanitize import sanitize_string
from app.rate_limiter import create_rate_limiter

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
    days: int = Query(
        default=7,
        ge=1,
        le=90,
        description="Return records from the most recent N distinct dates",
    ),
    limit: int = Query(
        default=500,
        ge=1,
        le=2000,
        description="Maximum number of records to return",
    ),
    db: Session = Depends(get_db),
    _rl=Depends(create_rate_limiter(max_calls=30, window_seconds=60)),
):
    # Sanitize string inputs to prevent injection
    if commodity:
        commodity = sanitize_string(commodity, max_length=100)
    if state:
        state = sanitize_string(state, max_length=100)
    if district:
        district = sanitize_string(district, max_length=100)

    query = db.query(PriceRecord)

    # Case-insensitive filtering to handle mismatches between
    # the frontend labels and data.gov.in values
    if commodity:
        query = query.filter(func.lower(PriceRecord.commodity) == commodity.lower())
    if state:
        query = query.filter(func.lower(PriceRecord.state) == state.lower())
    if district:
        query = query.filter(func.lower(PriceRecord.district) == district.lower())

    query = query.order_by(PriceRecord.arrival_date.desc())

    results = query.all()

    # If no results in the DB, trigger a live fetch from data.gov.in
    if not results and commodity and state:
        from app.services.price_ingestion import fetch_live_prices

        live_results = fetch_live_prices(
            commodity=commodity, state=state, district=district
        )
        if live_results:
            # Re-query from DB after the live fetch populated it
            query = db.query(PriceRecord)
            if commodity:
                query = query.filter(
                    func.lower(PriceRecord.commodity) == commodity.lower()
                )
            if state:
                query = query.filter(
                    func.lower(PriceRecord.state) == state.lower()
                )
            if district:
                query = query.filter(
                    func.lower(PriceRecord.district) == district.lower()
                )
            query = query.order_by(PriceRecord.arrival_date.desc())
            results = query.all()

    distinct_dates = sorted(
        {r.arrival_date for r in results if r.arrival_date}, reverse=True
    )[:days]
    filtered = [r for r in results if r.arrival_date in distinct_dates]

    # Enforce result limit
    return filtered[:limit]