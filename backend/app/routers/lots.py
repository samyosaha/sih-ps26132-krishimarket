from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field, field_validator

from app.database import get_db
from app.models import Lot, User, UserRole, QualityGrade, LotStatus
from app.auth import get_current_user
from app.sanitize import sanitize_string
from app.rate_limiter import create_rate_limiter

router = APIRouter(prefix="/lots", tags=["lots"])


class LotCreate(BaseModel):
    commodity: str = Field(..., min_length=1, max_length=100)
    variety: Optional[str] = Field(default=None, max_length=100)
    quantity_kg: float = Field(..., gt=0, le=1_000_000)
    quality_grade: QualityGrade
    asking_price_per_kg: float = Field(..., gt=0, le=100_000)
    district: str = Field(..., min_length=1, max_length=100)
    state: str = Field(..., min_length=1, max_length=100)

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

    class Config:
        from_attributes = True


class LotDetailResponse(LotResponse):
    farmer_name: str


def _lot_to_response(lot: Lot) -> LotResponse:
    """Convert a Lot ORM object to a LotResponse, including farmer_name."""
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

    lot = Lot(
        farmer_id=current_user.id,
        commodity=payload.commodity,
        variety=payload.variety,
        quantity_kg=payload.quantity_kg,
        quality_grade=payload.quality_grade,
        asking_price_per_kg=payload.asking_price_per_kg,
        district=payload.district,
        state=payload.state,
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
        query = query.filter(Lot.commodity == commodity)
    if state:
        query = query.filter(Lot.state == state)
    if district:
        query = query.filter(Lot.district == district)
    if quality_grade:
        query = query.filter(Lot.quality_grade == quality_grade)
    if status:
        query = query.filter(Lot.status == status)
    lots = query.order_by(Lot.created_at.desc()).offset(offset).limit(limit).all()
    return [_lot_to_response(lot) for lot in lots]


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