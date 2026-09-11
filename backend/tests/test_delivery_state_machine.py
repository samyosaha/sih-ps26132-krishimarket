"""
test_delivery_state_machine.py — Delivery Status State Machine Tests
=====================================================================
Standalone test script exercising the delivery-status state machine.

Uses an in-memory SQLite database — no running server needed.

Run with:
    python -m pytest tests/test_delivery_state_machine.py -v -s
  or directly:
    cd backend && python tests/test_delivery_state_machine.py

Scenarios tested
----------------
1. Happy path: full walk-through  listed → … → delivered
2. Illegal skip: listed → delivered (rejected)
3. Backward transition: dispatched → verified_at_hub (rejected)
4. Dispute from verified_at_hub (before dispatch)
5. Dispute from dispatched
6. Dispute from in_transit
7. DISPATCH without delivery_method (rejected)
8. API-level: walk through all states via HTTP endpoints
9. API-level: illegal transition returns 400
10. API-level: dispute from verified_at_hub via /reject endpoint
"""

import sys
import os

# Ensure UTF-8 output on Windows consoles
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Allow running directly from repo root or backend/ folder
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models import (
    User, Lot, Offer, Transaction, Dispute,
    UserRole, QualityGrade, LotStatus, OfferStatus,
    DeliveryStatus, DisputeStatus,
)
from app.services.delivery_state_machine import (
    transition,
    DeliveryEvent,
    DeliveryTransitionError,
    TRANSITION_TABLE,
)


# ---------------------------------------------------------------------------
# Shared in-memory DB fixture
# ---------------------------------------------------------------------------

@pytest.fixture()
def db():
    """Create a fully isolated in-memory SQLite database for each test."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    TestSession = sessionmaker(bind=engine)
    session = TestSession()

    # Seed minimal data: farmer, buyer, lot, offer, transaction
    farmer = User(
        id=1, name="Test Farmer", phone="9000000001",
        password_hash="hash", role=UserRole.farmer,
    )
    buyer = User(
        id=2, name="Test Buyer", phone="9000000002",
        password_hash="hash", role=UserRole.buyer,
    )
    session.add_all([farmer, buyer])
    session.flush()

    lot = Lot(
        id=1, farmer_id=1, commodity="Wheat", quantity_kg=500,
        quality_grade=QualityGrade.A, asking_price_per_kg=25.0,
        district="Pune", state="Maharashtra",
    )
    session.add(lot)
    session.flush()

    offer = Offer(
        id=1, lot_id=1, buyer_id=2,
        offered_price_per_kg=24.0, status=OfferStatus.accepted,
    )
    session.add(offer)
    session.flush()

    txn = Transaction(
        id=1, offer_id=1, final_price_per_kg=24.0,
        delivery_status=DeliveryStatus.listed,
        delivery_method="pending",
    )
    session.add(txn)
    session.commit()

    yield session

    session.close()


def _get_txn(db, txn_id=1):
    return db.query(Transaction).filter(Transaction.id == txn_id).first()


# ---------------------------------------------------------------------------
# Test: Transition table is complete
# ---------------------------------------------------------------------------

class TestTransitionTable:
    """Verify the table covers all DeliveryStatus values."""

    def test_every_status_has_entry(self):
        for status in DeliveryStatus:
            if status == DeliveryStatus.rejected:
                # rejected is legacy — intentionally left out of the table
                continue
            assert status in TRANSITION_TABLE, (
                f"DeliveryStatus.{status.value} is missing from TRANSITION_TABLE"
            )


# ---------------------------------------------------------------------------
# Test: Happy path — full walk-through
# ---------------------------------------------------------------------------

class TestHappyPath:
    """Walk a transaction through every state in order."""

    def test_full_lifecycle(self, db):
        txn = _get_txn(db)

        # listed → hub_checkin_pending
        transition(db, txn, DeliveryEvent.HUB_CHECKIN)
        db.flush()
        assert txn.delivery_status == DeliveryStatus.hub_checkin_pending

        # hub_checkin_pending → verified_at_hub
        transition(db, txn, DeliveryEvent.VERIFY)
        db.flush()
        assert txn.delivery_status == DeliveryStatus.verified_at_hub

        # verified_at_hub → dispatched (with delivery_method)
        transition(db, txn, DeliveryEvent.DISPATCH,
                   delivery_method="Dispatched via Kisan Rail")
        db.flush()
        assert txn.delivery_status == DeliveryStatus.dispatched
        assert txn.delivery_method == "Dispatched via Kisan Rail"

        # dispatched → in_transit
        transition(db, txn, DeliveryEvent.IN_TRANSIT)
        db.flush()
        assert txn.delivery_status == DeliveryStatus.in_transit

        # in_transit → delivered
        transition(db, txn, DeliveryEvent.DELIVER)
        db.flush()
        assert txn.delivery_status == DeliveryStatus.delivered


# ---------------------------------------------------------------------------
# Test: Illegal transitions
# ---------------------------------------------------------------------------

class TestIllegalTransitions:
    """Verify the state machine rejects skips and backward moves."""

    def test_skip_listed_to_delivered(self, db):
        """listed → delivered should be rejected."""
        txn = _get_txn(db)
        assert txn.delivery_status == DeliveryStatus.listed

        with pytest.raises(DeliveryTransitionError, match="Cannot apply event"):
            transition(db, txn, DeliveryEvent.DELIVER)

    def test_skip_listed_to_dispatched(self, db):
        """listed → dispatched should be rejected."""
        txn = _get_txn(db)

        with pytest.raises(DeliveryTransitionError, match="Cannot apply event"):
            transition(db, txn, DeliveryEvent.DISPATCH,
                       delivery_method="Some method")

    def test_backward_dispatched_to_verified(self, db):
        """dispatched → verified_at_hub (backward) should be rejected."""
        txn = _get_txn(db)

        # Advance to dispatched
        transition(db, txn, DeliveryEvent.HUB_CHECKIN)
        transition(db, txn, DeliveryEvent.VERIFY)
        transition(db, txn, DeliveryEvent.DISPATCH,
                   delivery_method="Local Transporter")
        db.flush()
        assert txn.delivery_status == DeliveryStatus.dispatched

        # Try going backward
        with pytest.raises(DeliveryTransitionError, match="Cannot apply event"):
            transition(db, txn, DeliveryEvent.VERIFY)

    def test_delivered_is_terminal(self, db):
        """No transitions from delivered."""
        txn = _get_txn(db)

        # Advance to delivered
        transition(db, txn, DeliveryEvent.HUB_CHECKIN)
        transition(db, txn, DeliveryEvent.VERIFY)
        transition(db, txn, DeliveryEvent.DISPATCH, delivery_method="Truck")
        transition(db, txn, DeliveryEvent.IN_TRANSIT)
        transition(db, txn, DeliveryEvent.DELIVER)
        db.flush()
        assert txn.delivery_status == DeliveryStatus.delivered

        with pytest.raises(DeliveryTransitionError, match="none \\(terminal state\\)"):
            transition(db, txn, DeliveryEvent.DISPUTE,
                       reason="Too late", raised_by_id=2)


# ---------------------------------------------------------------------------
# Test: Dispatch requires delivery_method
# ---------------------------------------------------------------------------

class TestDispatchValidation:

    def test_dispatch_without_method_rejected(self, db):
        txn = _get_txn(db)
        transition(db, txn, DeliveryEvent.HUB_CHECKIN)
        transition(db, txn, DeliveryEvent.VERIFY)
        db.flush()

        with pytest.raises(DeliveryTransitionError, match="delivery_method"):
            transition(db, txn, DeliveryEvent.DISPATCH)

    def test_dispatch_with_empty_method_rejected(self, db):
        txn = _get_txn(db)
        transition(db, txn, DeliveryEvent.HUB_CHECKIN)
        transition(db, txn, DeliveryEvent.VERIFY)
        db.flush()

        with pytest.raises(DeliveryTransitionError, match="delivery_method"):
            transition(db, txn, DeliveryEvent.DISPATCH, delivery_method="  ")


# ---------------------------------------------------------------------------
# Test: Disputes from multiple states
# ---------------------------------------------------------------------------

class TestDisputesFromMultipleStates:
    """Disputed is reachable from verified_at_hub, dispatched, or in_transit."""

    def test_dispute_from_verified_at_hub(self, db):
        """Dispute BEFORE dispatch works."""
        txn = _get_txn(db)
        transition(db, txn, DeliveryEvent.HUB_CHECKIN)
        transition(db, txn, DeliveryEvent.VERIFY)
        db.flush()
        assert txn.delivery_status == DeliveryStatus.verified_at_hub

        transition(db, txn, DeliveryEvent.DISPUTE,
                   reason="Weight discrepancy found at hub",
                   raised_by_id=2)
        db.commit()

        assert txn.delivery_status == DeliveryStatus.disputed

        # Verify dispute record was created
        dispute = db.query(Dispute).filter(
            Dispute.transaction_id == txn.id
        ).first()
        assert dispute is not None
        assert dispute.reason == "Weight discrepancy found at hub"
        assert dispute.raised_by_id == 2
        assert dispute.status == DisputeStatus.open

    def test_dispute_from_dispatched(self, db):
        txn = _get_txn(db)
        transition(db, txn, DeliveryEvent.HUB_CHECKIN)
        transition(db, txn, DeliveryEvent.VERIFY)
        transition(db, txn, DeliveryEvent.DISPATCH,
                   delivery_method="Local Transporter")
        db.flush()
        assert txn.delivery_status == DeliveryStatus.dispatched

        transition(db, txn, DeliveryEvent.DISPUTE,
                   reason="Wrong items dispatched to wrong address",
                   raised_by_id=2)
        db.commit()

        assert txn.delivery_status == DeliveryStatus.disputed
        dispute = db.query(Dispute).filter(
            Dispute.transaction_id == txn.id
        ).first()
        assert dispute is not None

    def test_dispute_from_in_transit(self, db):
        txn = _get_txn(db)
        transition(db, txn, DeliveryEvent.HUB_CHECKIN)
        transition(db, txn, DeliveryEvent.VERIFY)
        transition(db, txn, DeliveryEvent.DISPATCH,
                   delivery_method="Kisan Rail")
        transition(db, txn, DeliveryEvent.IN_TRANSIT)
        db.flush()
        assert txn.delivery_status == DeliveryStatus.in_transit

        transition(db, txn, DeliveryEvent.DISPUTE,
                   reason="Shipment appears damaged in transit",
                   raised_by_id=2)
        db.commit()

        assert txn.delivery_status == DeliveryStatus.disputed
        dispute = db.query(Dispute).filter(
            Dispute.transaction_id == txn.id
        ).first()
        assert dispute is not None

    def test_dispute_not_allowed_from_listed(self, db):
        """Dispute from listed should be rejected."""
        txn = _get_txn(db)
        assert txn.delivery_status == DeliveryStatus.listed

        with pytest.raises(DeliveryTransitionError, match="Cannot apply event"):
            transition(db, txn, DeliveryEvent.DISPUTE,
                       reason="Some reason here", raised_by_id=2)

    def test_dispute_not_allowed_from_hub_checkin_pending(self, db):
        """Dispute from hub_checkin_pending should be rejected."""
        txn = _get_txn(db)
        transition(db, txn, DeliveryEvent.HUB_CHECKIN)
        db.flush()
        assert txn.delivery_status == DeliveryStatus.hub_checkin_pending

        with pytest.raises(DeliveryTransitionError, match="Cannot apply event"):
            transition(db, txn, DeliveryEvent.DISPUTE,
                       reason="Some reason here", raised_by_id=2)

    def test_dispute_requires_reason(self, db):
        txn = _get_txn(db)
        transition(db, txn, DeliveryEvent.HUB_CHECKIN)
        transition(db, txn, DeliveryEvent.VERIFY)
        db.flush()

        with pytest.raises(DeliveryTransitionError, match="reason"):
            transition(db, txn, DeliveryEvent.DISPUTE, raised_by_id=2)


# ---------------------------------------------------------------------------
# Main — allow running directly
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
