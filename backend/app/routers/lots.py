from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel, Field, field_validator

from app.database import get_db
from app.models import Lot, User, UserRole, QualityGrade, LotStatus
from app.auth import get_current_user
from app.sanitize import sanitize_string
from app.rate_limiter import create_rate_limiter
from app.services.hub_service import match_hub
from app.services.fulfillment_recommender import recommend as fr_recommend

router = APIRouter(prefix="/lots", tags=["lots"])


class LotCreate(BaseModel):
    commodity: str = Field(..., min_length=1, max_length=100)
    variety: Optional[str] = Field(default=None, max_length=100)
    quantity_kg: float = Field(..., gt=0, le=1_000_000)
    quality_grade: QualityGrade
    asking_price_per_kg: float = Field(..., gt=0, le=100_000)
    district: str = Field(..., min_length=1, max_length=100)
    state: str = Field(..., min_length=1, max_length=100)
    pincode: Optional[str] = Field(default=None, max_length=10)
    hub_id: Optional[int] = None

    @field_validator("commodity", "district", "state")
    @classmethod
    def sanitize_required_strings(cls, v: str) -> str:
        return sanitize_string(v, max_length=100)

    @field_validator("variety")
    @classmethod
    def sanitize_variety(cls, v: str | None) -> str | None:
        if v is None:
            return v
        return sanitize_string(v, max_length=100)

    @field_validator("pincode")
    @classmethod
    def sanitize_pincode(cls, v: str | None) -> str | None:
        if v is None:
            return v
        return sanitize_string(v, max_length=10)


class LotUpdate(BaseModel):
    quantity_kg: Optional[float] = Field(default=None, gt=0, le=1_000_000)
    asking_price_per_kg: Optional[float] = Field(default=None, gt=0, le=100_000)
    status: Optional[LotStatus] = None


class LotResponse(BaseModel):
    id: int
    farmer_id: int
    commodity: str
    variety: Optional[str]
    quantity_kg: float
    quality_grade: QualityGrade
    asking_price_per_kg: float
    district: str
    state: str
    status: LotStatus
    farmer_name: Optional[str] = None
    hub_id: Optional[int] = None
    hub_name: Optional[str] = None

    class Config:
        from_attributes = True


class LotDetailResponse(LotResponse):
    farmer_name: str


class HubSuggestionResponse(BaseModel):
    matched: bool
    hub_id: Optional[int] = None
    hub_name: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    is_regional_fallback: bool = False
    message: str


class FulfillmentRecommendationResponse(BaseModel):
    """Response schema for GET /lots/{lot_id}/fulfillment-recommendation."""
    method: str
    reason: str
    estimated_cost: Optional[float] = None
    estimated_hours: Optional[float] = None


def _lot_to_response(lot: Lot) -> LotResponse:
    """Convert a Lot ORM object to a LotResponse, including farmer_name and hub_name."""
    return LotResponse(
        id=lot.id,
        farmer_id=lot.farmer_id,
        commodity=lot.commodity,
        variety=lot.variety,
        quantity_kg=lot.quantity_kg,
        quality_grade=lot.quality_grade,
        asking_price_per_kg=lot.asking_price_per_kg,
        district=lot.district,
        state=lot.state,
        status=lot.status,
        farmer_name=lot.farmer.name if lot.farmer else None,
        hub_id=lot.hub_id,
        hub_name=lot.hub.name if lot.hub else None,
    )


@router.post("", response_model=LotResponse)
def create_lot(
    payload: LotCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _rl=Depends(create_rate_limiter(max_calls=10, window_seconds=60)),
):
    if current_user.role != UserRole.farmer:
        raise HTTPException(status_code=403, detail="Only farmers can create lots")

    assigned_hub_id = payload.hub_id
    if assigned_hub_id is None:
        matched_hub, _ = match_hub(
            db,
            district=payload.district,
            state=payload.state,
            pincode=payload.pincode,
        )
        if matched_hub:
            assigned_hub_id = matched_hub.id

    lot = Lot(
        farmer_id=current_user.id,
        commodity=payload.commodity,
        variety=payload.variety,
        quantity_kg=payload.quantity_kg,
        quality_grade=payload.quality_grade,
        asking_price_per_kg=payload.asking_price_per_kg,
        district=payload.district,
        state=payload.state,
        hub_id=assigned_hub_id,
    )
    db.add(lot)
    db.commit()
    db.refresh(lot)
    return _lot_to_response(lot)


@router.get("/mine", response_model=list[LotResponse])
def list_my_lots(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all lots belonging to the authenticated farmer."""
    if current_user.role != UserRole.farmer:
        raise HTTPException(status_code=403, detail="Only farmers can view their own lots")
    lots = (
        db.query(Lot)
        .filter(Lot.farmer_id == current_user.id)
        .order_by(Lot.created_at.desc())
        .all()
    )
    return [_lot_to_response(lot) for lot in lots]


@router.get("", response_model=list[LotResponse])
def list_lots(
    commodity: Optional[str] = None,
    state: Optional[str] = None,
    district: Optional[str] = None,
    quality_grade: Optional[QualityGrade] = None,
    status: Optional[LotStatus] = LotStatus.available,
    limit: int = Query(default=50, ge=1, le=200, description="Max results to return"),
    offset: int = Query(default=0, ge=0, description="Number of results to skip"),
    db: Session = Depends(get_db),
):
    query = db.query(Lot)
    if commodity:
        query = query.filter(func.lower(Lot.commodity) == commodity.lower())
    if state:
        query = query.filter(func.lower(Lot.state) == state.lower())
    if district:
        query = query.filter(func.lower(Lot.district) == district.lower())
    if quality_grade:
        query = query.filter(Lot.quality_grade == quality_grade)
    if status:
        query = query.filter(Lot.status == status)
    lots = query.order_by(Lot.created_at.desc()).offset(offset).limit(limit).all()
    return [_lot_to_response(lot) for lot in lots]


@router.get("/suggest-hub", response_model=HubSuggestionResponse)
def suggest_hub(
    district: Optional[str] = Query(default=None),
    state: Optional[str] = Query(default=None),
    pincode: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    """
    Match district, state, or pincode to the nearest seeded logistics hub.
    Falls back gracefully to state-level hubs, or indicates direct buyer pickup.
    """
    matched_hub, is_fallback = match_hub(
        db,
        district=district,
        state=state,
        pincode=pincode,
    )
    if matched_hub:
        if is_fallback:
            msg = f"Nearest Hub: {matched_hub.name} ({matched_hub.district}) — you'll drop off produce here"
        else:
            msg = f"Nearest Hub: {matched_hub.name} — you'll drop off produce here"
        return HubSuggestionResponse(
            matched=True,
            hub_id=matched_hub.id,
            hub_name=matched_hub.name,
            district=matched_hub.district,
            state=matched_hub.state,
            is_regional_fallback=is_fallback,
            message=msg,
        )

    return HubSuggestionResponse(
        matched=False,
        hub_id=None,
        hub_name=None,
        district=None,
        state=None,
        is_regional_fallback=False,
        message="No nearby Hub yet — direct buyer pickup only for this lot",
    )


@router.get("/{lot_id}/fulfillment-recommendation",
            response_model=FulfillmentRecommendationResponse)
def get_fulfillment_recommendation(
    lot_id: int,
    buyer_district: str = Query(
        ...,
        description="Buyer's delivery district (plain string). Resolved to nearest Hub internally.",
    ),
    perishable: bool = Query(
        default=False,
        description="Set true if the commodity is perishable (e.g. fresh vegetables, fruit).",
    ),
    db: Session = Depends(get_db),
):
    """
    Recommend a delivery method for a lot given the buyer's delivery district.

    The engine is purely rule-based (no LLM). Decision order (first match wins):
    1. distance <= 50 km  → transporter (if qty>200 & available) or buyer pickup
    2. perishable + Kisan Rail route  → Kisan Rail with subsidy note
    3. Same-state consolidation opportunity at Hub  → consolidated truck
    4. Best-fit transporter or buyer pickup fallback
    """
    lot = db.query(Lot).filter(Lot.id == lot_id).first()
    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")

    try:
        result = fr_recommend(
            db=db,
            lot_id=lot_id,
            buyer_district=buyer_district,
            perishability_flag=perishable,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    return FulfillmentRecommendationResponse(
        method=result.method,
        reason=result.reason,
        estimated_cost=result.estimated_cost,
        estimated_hours=result.estimated_hours,
    )


@router.get("/{lot_id}", response_model=LotDetailResponse)
def get_lot(lot_id: int, db: Session = Depends(get_db)):
    lot = db.query(Lot).filter(Lot.id == lot_id).first()
    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")

    return LotDetailResponse(
        id=lot.id,
        farmer_id=lot.farmer_id,
        commodity=lot.commodity,
        variety=lot.variety,
        quantity_kg=lot.quantity_kg,
        quality_grade=lot.quality_grade,
        asking_price_per_kg=lot.asking_price_per_kg,
        district=lot.district,
        state=lot.state,
        status=lot.status,
        farmer_name=lot.farmer.name if lot.farmer else "Unknown",
        hub_id=lot.hub_id,
        hub_name=lot.hub.name if lot.hub else None,
    )


@router.patch("/{lot_id}", response_model=LotResponse)
def update_lot(
    lot_id: int,
    payload: LotUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _rl=Depends(create_rate_limiter(max_calls=15, window_seconds=60)),
):
    lot = db.query(Lot).filter(Lot.id == lot_id).first()
    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")
    if lot.farmer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your lot")

    if payload.quantity_kg is not None:
        lot.quantity_kg = payload.quantity_kg
    if payload.asking_price_per_kg is not None:
        lot.asking_price_per_kg = payload.asking_price_per_kg
    if payload.status is not None:
        lot.status = payload.status

    db.commit()
    db.refresh(lot)
    return _lot_to_response(lot)