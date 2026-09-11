"""
Test: both parties can raise their own separate dispute on the same transaction.

The backend Dispute model supports one-per-raiser. This test confirms:
  1. Farmer raises dispute  -> 200 OK
  2. Buyer raises dispute   -> 200 OK (NOT blocked)
  3. Farmer raises again    -> 409 Conflict
  4. GET /disputes as farmer lists both disputes
  5. GET /disputes as buyer  lists both disputes
"""

import os
import sys

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
from app.main import app
from app.models import (
    User, Lot, Offer, Transaction,
    UserRole, QualityGrade, OfferStatus, DeliveryStatus,
)
from app.auth import hash_password, create_access_token


from sqlalchemy.pool import StaticPool


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture()
def db_session():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestSession = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    session = TestSession()

    farmer = User(
        id=10, name="Farmer A", phone="9111000001",
        password_hash=hash_password("farmer_pw"),
        role=UserRole.farmer,
    )
    buyer = User(
        id=11, name="Buyer B", phone="9111000002",
        password_hash=hash_password("buyer_pw"),
        role=UserRole.buyer,
    )
    session.add_all([farmer, buyer])
    session.flush()

    lot = Lot(
        id=10, farmer_id=10, commodity="Rice", quantity_kg=200,
        quality_grade=QualityGrade.A, asking_price_per_kg=40.0,
        district="Nagpur", state="Maharashtra",
    )
    session.add(lot)
    session.flush()

    offer = Offer(
        id=10, lot_id=10, buyer_id=11,
        offered_price_per_kg=39.0, status=OfferStatus.accepted,
    )
    session.add(offer)
    session.flush()

    txn = Transaction(
        id=10, offer_id=10, final_price_per_kg=39.0,
        delivery_status=DeliveryStatus.listed,
        delivery_method="pending",
    )
    session.add(txn)
    session.commit()
    session.close()

    yield TestSession

    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client(db_session):
    def override():
        db = db_session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


from app.rate_limiter import _limiter


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    with _limiter._lock:
        _limiter._requests.clear()
    yield
    with _limiter._lock:
        _limiter._requests.clear()


def _token(user_id: int) -> str:
    return create_access_token(data={"sub": str(user_id)})


# ── Tests ─────────────────────────────────────────────────────────────────────

class TestMultilateralDisputes:
    """Both parties can file their own dispute on the same transaction."""

    def test_farmer_raises_dispute(self, client, db_session):
        token = _token(10)

        resp = client.post(
            "/disputes",
            json={"transaction_id": 10, "reason": "Quality was not as described in the lot."},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["raised_by_id"] == 10
        assert data["status"] == "open"

    def test_buyer_can_raise_separate_dispute_after_farmer(self, client, db_session):
        farmer_token = _token(10)
        buyer_token = _token(11)

        # Farmer raises first
        r1 = client.post(
            "/disputes",
            json={"transaction_id": 10, "reason": "Farmer: quality issue in the delivered goods."},
            headers={"Authorization": f"Bearer {farmer_token}"},
        )
        assert r1.status_code == 200, r1.text

        # Buyer raises their own — must NOT be blocked
        r2 = client.post(
            "/disputes",
            json={"transaction_id": 10, "reason": "Buyer: late delivery, item arrived damaged."},
            headers={"Authorization": f"Bearer {buyer_token}"},
        )
        assert r2.status_code == 200, r2.text
        data2 = r2.json()
        assert data2["raised_by_id"] == 11
        assert data2["status"] == "open"

    def test_same_user_cannot_raise_second_open_dispute(self, client, db_session):
        farmer_token = _token(10)

        # First dispute
        r1 = client.post(
            "/disputes",
            json={"transaction_id": 10, "reason": "First dispute reason — quality mismatch."},
            headers={"Authorization": f"Bearer {farmer_token}"},
        )
        assert r1.status_code == 200, r1.text

        # Second dispute by same user on same transaction should be 409
        r2 = client.post(
            "/disputes",
            json={"transaction_id": 10, "reason": "Second dispute reason — still unhappy."},
            headers={"Authorization": f"Bearer {farmer_token}"},
        )
        assert r2.status_code == 409, r2.text

    def test_get_disputes_farmer_sees_both(self, client, db_session):
        farmer_token = _token(10)
        buyer_token = _token(11)

        client.post(
            "/disputes",
            json={"transaction_id": 10, "reason": "Farmer complaint about quality here."},
            headers={"Authorization": f"Bearer {farmer_token}"},
        )
        client.post(
            "/disputes",
            json={"transaction_id": 10, "reason": "Buyer complaint about late delivery ok."},
            headers={"Authorization": f"Bearer {buyer_token}"},
        )

        resp = client.get("/disputes", headers={"Authorization": f"Bearer {farmer_token}"})
        assert resp.status_code == 200, resp.text
        rows = resp.json()
        txn_ids = [d["transaction_id"] for d in rows]
        raiser_ids = [d["raised_by_id"] for d in rows]
        # Farmer should see both disputes on transaction 10
        assert txn_ids.count(10) == 2
        assert 10 in raiser_ids  # farmer raised one
        assert 11 in raiser_ids  # buyer raised one

    def test_get_disputes_buyer_sees_both(self, client, db_session):
        farmer_token = _token(10)
        buyer_token = _token(11)

        client.post(
            "/disputes",
            json={"transaction_id": 10, "reason": "Farmer complaint about quality matters."},
            headers={"Authorization": f"Bearer {farmer_token}"},
        )
        client.post(
            "/disputes",
            json={"transaction_id": 10, "reason": "Buyer complaint about delivery timing."},
            headers={"Authorization": f"Bearer {buyer_token}"},
        )

        resp = client.get("/disputes", headers={"Authorization": f"Bearer {buyer_token}"})
        assert resp.status_code == 200, resp.text
        rows = resp.json()
        txn_ids = [d["transaction_id"] for d in rows]
        raiser_ids = [d["raised_by_id"] for d in rows]
        assert txn_ids.count(10) == 2
        assert 10 in raiser_ids
        assert 11 in raiser_ids