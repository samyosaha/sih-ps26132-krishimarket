from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.models import Lot, User, UserRole, QualityGrade, LotStatus
from app.auth import get_current_user

router = APIRouter(prefix="/lots", tags=["lots"])


class LotCreate(BaseModel):
    commodity: str
    variety: Optional[str] = None
    quantity_kg: float
    quality_grade: QualityGrade
    asking_price_per_kg: float
    district: str
    state: str


class LotUpdate(BaseModel):
    quantity_kg: Optional[float] = None
    asking_price_per_kg: Optional[float] = None
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

    class Config:
        from_attributes = True


class LotDetailResponse(LotResponse):
    farmer_name: str


@router.post("", response_model=LotResponse)
def create_lot(
    payload: LotCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
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
    return lot


@router.get("", response_model=list[LotResponse])
def list_lots(
    commodity: Optional[str] = None,
    state: Optional[str] = None,
    district: Optional[str] = None,
    quality_grade: Optional[QualityGrade] = None,
    status: Optional[LotStatus] = LotStatus.available,
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
    return query.order_by(Lot.created_at.desc()).all()


@router.get("/{lot_id}", response_model=LotDetailResponse)
def get_lot(lot_id: int, db: Session = Depends(get_db)):
    lot = db.query(Lot).filter(Lot.id == lot_id).first()
    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")

    return LotDetailResponse(
        **LotResponse.model_validate(lot).model_dump(),
        farmer_name=lot.farmer.name,
    )


@router.patch("/{lot_id}", response_model=LotResponse)
def update_lot(
    lot_id: int,
    payload: LotUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
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
    return lot