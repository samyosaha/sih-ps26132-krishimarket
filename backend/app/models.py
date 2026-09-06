import enum
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, ForeignKey, DateTime, Enum, Text
)
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base


class UserRole(str, enum.Enum):
    farmer = "farmer"
    buyer = "buyer"
    admin = "admin"


class QualityGrade(str, enum.Enum):
    A = "A"
    B = "B"
    C = "C"


class LotStatus(str, enum.Enum):
    available = "available"
    reserved = "reserved"
    sold = "sold"


class OfferStatus(str, enum.Enum):
    pending = "pending"
    accepted = "accepted"
    rejected = "rejected"


class PaymentStatus(str, enum.Enum):
    pending = "pending"
    paid = "paid"
    delivered = "delivered"


class DisputeStatus(str, enum.Enum):
    open = "open"
    resolved = "resolved"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    phone = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=True)
    password_hash = Column(String, nullable=False)
    role = Column(Enum(UserRole), nullable=False)
    is_verified_buyer = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    lots = relationship("Lot", back_populates="farmer")
    offers = relationship("Offer", back_populates="buyer")


class Lot(Base):
    __tablename__ = "lots"

    id = Column(Integer, primary_key=True, index=True)
    farmer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    commodity = Column(String, nullable=False)
    variety = Column(String, nullable=True)
    quantity_kg = Column(Float, nullable=False)
    quality_grade = Column(Enum(QualityGrade), nullable=False)
    asking_price_per_kg = Column(Float, nullable=False)
    district = Column(String, nullable=False)
    state = Column(String, nullable=False)
    status = Column(Enum(LotStatus), default=LotStatus.available)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    farmer = relationship("User", back_populates="lots")
    offers = relationship("Offer", back_populates="lot")


class Offer(Base):
    __tablename__ = "offers"

    id = Column(Integer, primary_key=True, index=True)
    lot_id = Column(Integer, ForeignKey("lots.id"), nullable=False)
    buyer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    offered_price_per_kg = Column(Float, nullable=False)
    message = Column(Text, nullable=True)
    status = Column(Enum(OfferStatus), default=OfferStatus.pending)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    lot = relationship("Lot", back_populates="offers")
    buyer = relationship("User", back_populates="offers")
    transaction = relationship("Transaction", back_populates="offer", uselist=False)


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    offer_id = Column(Integer, ForeignKey("offers.id"), nullable=False)
    final_price_per_kg = Column(Float, nullable=False)
    payment_status = Column(Enum(PaymentStatus), default=PaymentStatus.pending)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    offer = relationship("Offer", back_populates="transaction")
    disputes = relationship("Dispute", back_populates="transaction")


class Dispute(Base):
    __tablename__ = "disputes"

    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(Integer, ForeignKey("transactions.id"), nullable=False)
    raised_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    reason = Column(Text, nullable=False)
    status = Column(Enum(DisputeStatus), default=DisputeStatus.open)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    transaction = relationship("Transaction", back_populates="disputes")


class PriceRecord(Base):
    __tablename__ = "price_records"

    id = Column(Integer, primary_key=True, index=True)
    state = Column(String, nullable=False)
    district = Column(String, nullable=False)
    market = Column(String, nullable=False)
    commodity = Column(String, nullable=False)
    variety = Column(String, nullable=True)
    grade = Column(String, nullable=True)
    arrival_date = Column(DateTime, nullable=True)
    min_price = Column(Float, nullable=True)
    max_price = Column(Float, nullable=True)
    modal_price = Column(Float, nullable=True)