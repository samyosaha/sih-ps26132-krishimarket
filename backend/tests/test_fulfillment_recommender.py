"""
test_fulfillment_recommender.py — Phase 8 Fulfillment Recommender
=================================================================
Standalone test script that exercises the recommender across exactly 5
scenarios specified in the task.  It builds its own in-memory SQLite
database — no external services, no running server needed.

Run with:
    python -m pytest tests/test_fulfillment_recommender.py -v -s
  or directly:
    cd backend && python tests/test_fulfillment_recommender.py

Expected outcomes
-----------------
a) distance ~20 km, qty  50 kg                         → buyer_pickup
b) distance ~20 km, qty 500 kg, transporter available  → local_transporter
c) distance ~300 km, perishable, kisan rail route      → kisan_rail
d) distance ~300 km, non-perishable, 2 same-state lots → consolidated_truck
e) distance ~300 km, non-perishable, no lots/rail/transporter → buyer_pickup
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
    Hub, Lot, Offer, Transporter, User,
    VehicleType, QualityGrade, LotStatus, OfferStatus, UserRole,
)
from app.services.fulfillment_recommender import recommend, RecommendationResult


# ---------------------------------------------------------------------------
# Shared in-memory DB fixture
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def db():
    """
    Create a fully isolated in-memory SQLite database for the test module.

    We seed:
    - Hub A at lat=18.5, lng=73.8  (Pune area — "lot hub")
    - Hub B at lat=18.7, lng=73.9  (nearby — ~20 km from A)
    - Hub C at lat=21.1, lng=79.1  (Nagpur area — ~300 km from A)
    - Hub D at lat=21.2, lng=79.2  (same state as C — for consolidation test)
    - Transporters in Hub A's district
    - A demo farmer user and lots
    """
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    # ── Hubs ─────────────────────────────────────────────────────────────────
    # Hub A — "lot's hub" — Pune district, Maharashtra
    hub_a = Hub(
        name="Pune Mandi",
        district="Pune",
        state="Maharashtra",
        lat=18.5,
        lng=73.8,
        has_kisan_rail_station=False,
    )
    # Hub B — buyer's hub for scenarios (a) and (b) — ~20 km from A
    hub_b = Hub(
        name="Pimpri Mandi",
        district="Pimpri-Chinchwad",
        state="Maharashtra",
        lat=18.65,   # approx. 16 km north of hub_a
        lng=73.8,
        has_kisan_rail_station=False,
    )
    # Hub C — buyer's hub for scenarios (c), (d), (e) — ~300 km from A
    hub_c = Hub(
        name="Nagpur Mandi",
        district="Nagpur",
        state="Maharashtra",
        lat=21.15,
        lng=79.09,
        has_kisan_rail_station=True,
        kisan_rail_station_name="Nagpur",
    )
    # Hub D — another Maharashtra hub for consolidation (same state as C)
    hub_d = Hub(
        name="Amravati Mandi",
        district="Amravati",
        state="Maharashtra",
        lat=20.93,
        lng=77.77,
        has_kisan_rail_station=False,
    )
    session.add_all([hub_a, hub_b, hub_c, hub_d])
    session.flush()

    # ── Transporters ─────────────────────────────────────────────────────────
    # Scenario (b): transporter in Hub A's district, capacity fits 500 kg
    t1 = Transporter(
        name="Rajesh Transport Co.",
        district="Pune",
        vehicle_type=VehicleType.medium_truck,
        capacity_kg=1000.0,
        verified=True,
    )
    session.add(t1)
    session.flush()

    # ── Demo farmer user ─────────────────────────────────────────────────────
    farmer = User(
        name="Test Farmer",
        phone="9000000001",
        email="farmer@test.com",
        password_hash="x",
        role=UserRole.farmer,
    )
    session.add(farmer)
    session.flush()

    # ── Demo buyer user ──────────────────────────────────────────────────────
    buyer = User(
        name="Test Buyer",
        phone="9000000002",
        email="buyer@test.com",
        password_hash="x",
        role=UserRole.buyer,
    )
    session.add(buyer)
    session.flush()

    # ── Lot for scenarios (a) and (b) — qty varies per scenario ──────────────
    # We create two separate lots so the scenarios are independent.

    # Lot for scenario (a): 50 kg
    lot_a = Lot(
        farmer_id=farmer.id,
        commodity="Tomatoes",
        quantity_kg=50.0,
        quality_grade=QualityGrade.A,
        asking_price_per_kg=12.0,
        district="Pune",
        state="Maharashtra",
        hub_id=hub_a.id,
    )
    # Lot for scenario (b): 500 kg
    lot_b = Lot(
        farmer_id=farmer.id,
        commodity="Tomatoes",
        quantity_kg=500.0,
        quality_grade=QualityGrade.A,
        asking_price_per_kg=12.0,
        district="Pune",
        state="Maharashtra",
        hub_id=hub_a.id,
    )
    # Lot for scenario (c): 200 kg perishable, Hub A, Kisan Rail via Pune
    # NB: kisan_rail_routes.lookup("Pune") returns exists=True, station="Pune Junction"
    lot_c = Lot(
        farmer_id=farmer.id,
        commodity="Grapes",
        quantity_kg=200.0,
        quality_grade=QualityGrade.A,
        asking_price_per_kg=80.0,
        district="Pune",
        state="Maharashtra",
        hub_id=hub_a.id,
    )
    # Lot for scenario (d): 200 kg non-perishable, Hub A
    lot_d = Lot(
        farmer_id=farmer.id,
        commodity="Wheat",
        quantity_kg=200.0,
        quality_grade=QualityGrade.B,
        asking_price_per_kg=22.0,
        district="Pune",
        state="Maharashtra",
        hub_id=hub_a.id,
    )
    # Lot for scenario (e): 200 kg non-perishable, Hub A — NO other lots added
    lot_e = Lot(
        farmer_id=farmer.id,
        commodity="Rice",
        quantity_kg=200.0,
        quality_grade=QualityGrade.B,
        asking_price_per_kg=35.0,
        district="Pune",
        state="Maharashtra",
        hub_id=hub_a.id,
    )
    session.add_all([lot_a, lot_b, lot_c, lot_d, lot_e])
    session.flush()

    # ── Seed consolidation lots for scenario (d) ──────────────────────────────
    # Two other lots at Hub A with pending offers whose delivery_district
    # resolves to a Maharashtra hub (same state as the buyer at "Nagpur").
    other_lot_1 = Lot(
        farmer_id=farmer.id,
        commodity="Soybean",
        quantity_kg=100.0,
        quality_grade=QualityGrade.B,
        asking_price_per_kg=50.0,
        district="Pune",
        state="Maharashtra",
        hub_id=hub_a.id,
    )
    other_lot_2 = Lot(
        farmer_id=farmer.id,
        commodity="Onion",
        quantity_kg=80.0,
        quality_grade=QualityGrade.C,
        asking_price_per_kg=10.0,
        district="Pune",
        state="Maharashtra",
        hub_id=hub_a.id,
    )
    session.add_all([other_lot_1, other_lot_2])
    session.flush()

    # Offers on those lots — delivery_district points to "Amravati" (hub_d, Maharashtra)
    # hub_service.match_hub("Amravati") should resolve to hub_d (same state as Nagpur)
    offer_1 = Offer(
        lot_id=other_lot_1.id,
        buyer_id=buyer.id,
        offered_price_per_kg=52.0,
        status=OfferStatus.pending,
        delivery_district="Amravati",   # Maharashtra — same state as "Nagpur"
    )
    offer_2 = Offer(
        lot_id=other_lot_2.id,
        buyer_id=buyer.id,
        offered_price_per_kg=11.0,
        status=OfferStatus.pending,
        delivery_district="Amravati",   # Maharashtra — same state
    )
    session.add_all([offer_1, offer_2])
    session.commit()

    yield session, {
        "hub_a": hub_a,
        "hub_b": hub_b,
        "hub_c": hub_c,
        "hub_d": hub_d,
        "t1": t1,
        "lot_a": lot_a,
        "lot_b": lot_b,
        "lot_c": lot_c,
        "lot_d": lot_d,
        "lot_e": lot_e,
    }

    session.close()
    engine.dispose()


# ===========================================================================
# Scenario helpers
# ===========================================================================

def print_result(scenario: str, result: RecommendationResult, expected_method: str) -> None:
    status = "PASS" if result.method == expected_method else "FAIL"
    print(f"\n{'='*70}")
    print(f"Scenario {scenario}  [{status}]")
    print(f"  method           : {result.method}")
    print(f"  expected         : {expected_method}")
    print(f"  reason           : {result.reason}")
    print(f"  estimated_cost   : {result.estimated_cost}")
    print(f"  estimated_hours  : {result.estimated_hours}")
    print(f"{'='*70}")


# ===========================================================================
# Scenario (a): distance ~20 km, qty 50 kg → expect buyer_pickup
# ===========================================================================
def test_scenario_a_buyer_pickup(db):
    """
    50 kg lot, buyer district resolves to hub ~20 km away.
    STEP 1 fires (dist <= 50): qty <= 200 → buyer pickup.
    """
    session, fixtures = db
    lot = fixtures["lot_a"]           # 50 kg at hub_a (Pune)

    # "Pimpri-Chinchwad" resolves to hub_b which is ~16 km from hub_a
    result = recommend(
        db=session,
        lot_id=lot.id,
        buyer_district="Pimpri-Chinchwad",
        perishability_flag=False,
    )

    print_result("(a)", result, "buyer_pickup")
    assert result.method == "buyer_pickup", (
        f"Expected buyer_pickup, got {result.method}: {result.reason}"
    )
    assert result.estimated_hours is not None, "Should return estimated hours for short haul"


# ===========================================================================
# Scenario (b): distance ~20 km, qty 500 kg, transporter in district
#               → expect local_transporter
# ===========================================================================
def test_scenario_b_named_transporter(db):
    """
    500 kg lot, buyer ~20 km away, verified transporter in Pune district.
    STEP 1 fires: qty > 200 AND transporter available → named transporter.
    """
    session, fixtures = db
    lot = fixtures["lot_b"]           # 500 kg at hub_a (Pune)

    result = recommend(
        db=session,
        lot_id=lot.id,
        buyer_district="Pimpri-Chinchwad",
        perishability_flag=False,
    )

    print_result("(b)", result, "local_transporter")
    assert result.method == "local_transporter", (
        f"Expected local_transporter, got {result.method}: {result.reason}"
    )
    assert "Rajesh Transport Co." in result.reason, (
        f"Transporter name should appear in reason. Got: {result.reason}"
    )


# ===========================================================================
# Scenario (c): distance ~300 km, perishable=True, kisan_rail_route_exists=True
#               → expect kisan_rail
# ===========================================================================
def test_scenario_c_kisan_rail(db):
    """
    200 kg perishable lot at Pune hub (kisan_rail_routes.lookup('Pune') → True).
    Buyer district = Nagpur (~300 km).
    STEP 1 skipped (dist > 50). STEP 2 fires: perishable + rail.
    """
    session, fixtures = db
    lot = fixtures["lot_c"]           # 200 kg Grapes at hub_a (Pune)

    result = recommend(
        db=session,
        lot_id=lot.id,
        buyer_district="Nagpur",
        perishability_flag=True,      # explicitly perishable
    )

    print_result("(c)", result, "kisan_rail")
    assert result.method == "kisan_rail", (
        f"Expected kisan_rail, got {result.method}: {result.reason}"
    )
    assert "subsidy" in result.reason.lower(), "Should mention subsidy-eligibility"
    assert result.estimated_hours is not None, "Should include hours estimate"


# ===========================================================================
# Scenario (d): distance ~300 km, perishable=False, 2 same-state pending lots
#               → expect consolidated_truck
# ===========================================================================
def test_scenario_d_consolidated_truck(db):
    """
    200 kg non-perishable Wheat at Pune hub.
    Buyer district = Nagpur (~300 km, Maharashtra).
    STEP 1 skipped. STEP 2 skipped (not perishable).
    STEP 3: 2 other lots at hub_a with pending offers to 'Amravati' (Maharashtra).
    → consolidated_truck.
    """
    session, fixtures = db
    lot = fixtures["lot_d"]           # 200 kg Wheat at hub_a (Pune)

    result = recommend(
        db=session,
        lot_id=lot.id,
        buyer_district="Nagpur",
        perishability_flag=False,
    )

    print_result("(d)", result, "consolidated_truck")
    assert result.method == "consolidated_truck", (
        f"Expected consolidated_truck, got {result.method}: {result.reason}"
    )
    assert "2" in result.reason, (
        f"Should mention 2 other lots. Got: {result.reason}"
    )


# ===========================================================================
# Scenario (e): distance ~300 km, perishable=False, no other lots,
#               no kisan rail, no transporter in district → buyer_pickup
# ===========================================================================
def test_scenario_e_buyer_pickup_fallback(db):
    """
    200 kg non-perishable Rice at Pune hub.
    Buyer district = Nagpur (~300 km).
    STEP 1 skipped. STEP 2 skipped (not perishable).
    STEP 3: lot_e has no other lots with same-state offers (they're on lot_d's
            consolidation set — lot_e is independent).

    BUT we need to ensure no transporter applies for THIS scenario.
    Since our only transporter is in Pune district, STEP 4 would normally
    find it.  To isolate scenario (e) correctly (no transporter available),
    we temporarily remove the transporter from the session's view by querying
    differently... Instead, we point lot_e to a NEW hub in a district that
    has NO transporter.
    """
    session, fixtures = db

    # Create a new hub in a district with no transporter (Satara) so STEP 4 finds nothing
    hub_satara = Hub(
        name="Satara Mandi",
        district="Satara",
        state="Maharashtra",
        lat=17.68,
        lng=74.0,
        has_kisan_rail_station=False,
    )
    session.add(hub_satara)
    session.flush()

    # Temporarily reassign lot_e to hub_satara for this test
    lot_e = fixtures["lot_e"]
    original_hub_id = lot_e.hub_id
    lot_e.hub_id = hub_satara.id
    session.flush()

    result = recommend(
        db=session,
        lot_id=lot_e.id,
        buyer_district="Nagpur",
        perishability_flag=False,
    )

    # Restore lot_e's hub (so fixture remains clean)
    lot_e.hub_id = original_hub_id
    session.flush()
    session.delete(hub_satara)
    session.flush()

    print_result("(e)", result, "buyer_pickup")
    assert result.method == "buyer_pickup", (
        f"Expected buyer_pickup fallback, got {result.method}: {result.reason}"
    )


# ===========================================================================
# HTTP Endpoint Test
# ===========================================================================
def test_endpoint_fulfillment_recommendation(db):
    """Test the GET /lots/{lot_id}/fulfillment-recommendation HTTP endpoint."""
    from fastapi.testclient import TestClient
    from app.main import app
    from app.database import get_db

    session, fixtures = db
    lot = fixtures["lot_a"]

    def override_get_db():
        yield session

    app.dependency_overrides[get_db] = override_get_db
    try:
        client = TestClient(app)
        response = client.get(
            f"/lots/{lot.id}/fulfillment-recommendation",
            params={"buyer_district": "Pimpri-Chinchwad", "perishable": False},
        )
        assert response.status_code == 200, response.text
        data = response.json()
        assert data["method"] == "buyer_pickup"
        assert "Pune Mandi" in data["reason"]
        assert data["estimated_cost"] == 0.0
        assert data["estimated_hours"] is not None
    finally:
        app.dependency_overrides.pop(get_db, None)


# ===========================================================================
# Direct runner (not via pytest)
# ===========================================================================

if __name__ == "__main__":
    print("\nRunning Fulfillment Recommender — 5 scenario test")
    print("=" * 70)

    from sqlalchemy import create_engine as _ce
    from sqlalchemy.orm import sessionmaker as _sm

    # Build the engine + session inline (mirrors the pytest fixture)
    _engine = _ce("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(_engine)
    _Session = _sm(bind=_engine)
    _session = _Session()

    # ── Seed ──────────────────────────────────────────────────────────────
    hub_a = Hub(name="Pune Mandi", district="Pune", state="Maharashtra",
                lat=18.5, lng=73.8, has_kisan_rail_station=False)
    hub_b = Hub(name="Pimpri Mandi", district="Pimpri-Chinchwad", state="Maharashtra",
                lat=18.65, lng=73.8, has_kisan_rail_station=False)
    hub_c = Hub(name="Nagpur Mandi", district="Nagpur", state="Maharashtra",
                lat=21.15, lng=79.09, has_kisan_rail_station=True,
                kisan_rail_station_name="Nagpur")
    hub_d = Hub(name="Amravati Mandi", district="Amravati", state="Maharashtra",
                lat=20.93, lng=77.77, has_kisan_rail_station=False)
    hub_satara = Hub(name="Satara Mandi", district="Satara", state="Maharashtra",
                     lat=17.68, lng=74.0, has_kisan_rail_station=False)
    _session.add_all([hub_a, hub_b, hub_c, hub_d, hub_satara])
    _session.flush()

    t1 = Transporter(name="Rajesh Transport Co.", district="Pune",
                     vehicle_type=VehicleType.medium_truck,
                     capacity_kg=1000.0, verified=True)
    _session.add(t1)
    _session.flush()

    farmer = User(name="Test Farmer", phone="9000000001", email="farmer@test.com",
                  password_hash="x", role=UserRole.farmer)
    buyer = User(name="Test Buyer", phone="9000000002", email="buyer@test.com",
                 password_hash="x", role=UserRole.buyer)
    _session.add_all([farmer, buyer])
    _session.flush()

    lot_a = Lot(farmer_id=farmer.id, commodity="Tomatoes", quantity_kg=50.0,
                quality_grade=QualityGrade.A, asking_price_per_kg=12.0,
                district="Pune", state="Maharashtra", hub_id=hub_a.id)
    lot_b = Lot(farmer_id=farmer.id, commodity="Tomatoes", quantity_kg=500.0,
                quality_grade=QualityGrade.A, asking_price_per_kg=12.0,
                district="Pune", state="Maharashtra", hub_id=hub_a.id)
    lot_c = Lot(farmer_id=farmer.id, commodity="Grapes", quantity_kg=200.0,
                quality_grade=QualityGrade.A, asking_price_per_kg=80.0,
                district="Pune", state="Maharashtra", hub_id=hub_a.id)
    lot_d = Lot(farmer_id=farmer.id, commodity="Wheat", quantity_kg=200.0,
                quality_grade=QualityGrade.B, asking_price_per_kg=22.0,
                district="Pune", state="Maharashtra", hub_id=hub_a.id)
    lot_e = Lot(farmer_id=farmer.id, commodity="Rice", quantity_kg=200.0,
                quality_grade=QualityGrade.B, asking_price_per_kg=35.0,
                district="Satara", state="Maharashtra", hub_id=hub_satara.id)
    other_lot_1 = Lot(farmer_id=farmer.id, commodity="Soybean", quantity_kg=100.0,
                      quality_grade=QualityGrade.B, asking_price_per_kg=50.0,
                      district="Pune", state="Maharashtra", hub_id=hub_a.id)
    other_lot_2 = Lot(farmer_id=farmer.id, commodity="Onion", quantity_kg=80.0,
                      quality_grade=QualityGrade.C, asking_price_per_kg=10.0,
                      district="Pune", state="Maharashtra", hub_id=hub_a.id)
    _session.add_all([lot_a, lot_b, lot_c, lot_d, lot_e, other_lot_1, other_lot_2])
    _session.flush()

    offer_1 = Offer(lot_id=other_lot_1.id, buyer_id=buyer.id,
                    offered_price_per_kg=52.0, status=OfferStatus.pending,
                    delivery_district="Amravati")
    offer_2 = Offer(lot_id=other_lot_2.id, buyer_id=buyer.id,
                    offered_price_per_kg=11.0, status=OfferStatus.pending,
                    delivery_district="Amravati")
    _session.add_all([offer_1, offer_2])
    _session.commit()

    # ── Run 5 scenarios ───────────────────────────────────────────────────
    results = {}

    r_a = recommend(_session, lot_a.id, "Pimpri-Chinchwad", perishability_flag=False)
    print_result("(a) 20km, 50kg → buyer_pickup", r_a, "buyer_pickup")
    results["a"] = r_a.method == "buyer_pickup"

    r_b = recommend(_session, lot_b.id, "Pimpri-Chinchwad", perishability_flag=False)
    print_result("(b) 20km, 500kg, transporter → local_transporter", r_b, "local_transporter")
    results["b"] = r_b.method == "local_transporter"

    r_c = recommend(_session, lot_c.id, "Nagpur", perishability_flag=True)
    print_result("(c) 300km, perishable, rail → kisan_rail", r_c, "kisan_rail")
    results["c"] = r_c.method == "kisan_rail"

    r_d = recommend(_session, lot_d.id, "Nagpur", perishability_flag=False)
    print_result("(d) 300km, 2 same-state lots → consolidated_truck", r_d, "consolidated_truck")
    results["d"] = r_d.method == "consolidated_truck"

    r_e = recommend(_session, lot_e.id, "Nagpur", perishability_flag=False)
    print_result("(e) 300km, no rail/transporter/lots → buyer_pickup", r_e, "buyer_pickup")
    results["e"] = r_e.method == "buyer_pickup"

    _session.close()
    _engine.dispose()

    # ── Summary ───────────────────────────────────────────────────────────
    print("\n" + "=" * 70)
    print("SUMMARY")
    all_passed = all(results.values())
    for key, passed in results.items():
        print(f"  Scenario ({key}): {'PASS' if passed else 'FAIL'}")
    print(f"\nOverall: {'ALL PASSED' if all_passed else 'SOME FAILED'}")
    sys.exit(0 if all_passed else 1)
