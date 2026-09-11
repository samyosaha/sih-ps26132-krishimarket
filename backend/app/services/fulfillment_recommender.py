"""
Fulfillment Recommender — Phase 8
==================================
Pure rule-based decision engine that recommends a delivery method for a lot.

No LLM calls.  Every branch is deterministic and explainable to a judge
line-by-line.  The decision tree is implemented as a single ``recommend()``
function with clearly-labelled steps (STEP 1 … STEP 4).

Inputs (resolved inside this function)
---------------------------------------
* lot.quantity_kg
* lot.perishability_flag  (lot.perishability_flag is not a DB column yet; we
  treat it as a parameter so the API can pass it in from the lot's data or a
  future column — see NOTE below)
* distance_km  — Haversine distance between lot's Hub and buyer's resolved Hub
* kisan_rail_route_exists — looked up from kisan_rail_routes.KISAN_RAIL_TABLE

NOTE on perishability_flag
--------------------------
The ``lots`` table does not yet have a ``perishability_flag`` column.  For the
recommender the flag is passed in as a query parameter by the API endpoint.
This matches the spec: "lot.perishability_flag" is an *input* to the engine,
not an automatic DB field.  Adding the column is a trivial future migration;
the recommender already accepts it.

District resolution
--------------------
Buyer's ``delivery_district`` string is resolved to its nearest Hub using
``hub_service.match_hub()`` — the EXACT same function built in Step 2.
No second matching algorithm is introduced here.

Haversine formula
------------------
Uses the standard Haversine formula to compute great-circle distance in km
between two (lat, lng) pairs.  Falls back gracefully when lat/lng are NULL.

Decision logic (first match wins, top-to-bottom)
-------------------------------------------------
STEP 1  distance_km <= 50
        → if qty > 200 AND verified transporter in hub district → named transporter
        → else                                                  → buyer pickup

STEP 2  perishability_flag AND kisan_rail_route_exists
        → Kisan Rail with estimated hours = distance_km / 40 (labeled estimate)

STEP 3  At least one OTHER lot at the SAME Hub with a pending-or-accepted offer
        whose delivery_district resolves to the SAME STATE as the buyer
        → Consolidated truck, shared with N other lot(s)

STEP 4  Fallback
        → Verified transporter in hub district with best capacity fit
        → or buyer pickup at hub
"""

import math
from dataclasses import dataclass
from typing import Optional

from sqlalchemy.orm import Session

from app.models import Lot, Offer, Transporter, Hub, OfferStatus
from app.services.hub_service import match_hub
from app.services import kisan_rail_routes


# ---------------------------------------------------------------------------
# Data class returned by the recommender
# ---------------------------------------------------------------------------

@dataclass
class RecommendationResult:
    """Structured output from the fulfillment recommender."""
    method: str            # human-readable method name (matches DeliveryMethod enum values)
    reason: str            # plain-English explanation — explainable to judges
    estimated_cost: Optional[float]   # INR estimate or None
    estimated_hours: Optional[float]  # transit time estimate or None


# ---------------------------------------------------------------------------
# Helper: Haversine distance
# ---------------------------------------------------------------------------

def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """
    Compute the great-circle distance in kilometres between two points
    on the Earth surface using the Haversine formula.

    Parameters
    ----------
    lat1, lng1 : float  — latitude/longitude of point A (decimal degrees)
    lat2, lng2 : float  — latitude/longitude of point B (decimal degrees)

    Returns
    -------
    float — distance in kilometres (always >= 0)
    """
    R = 6_371.0  # Earth's mean radius in km

    # Convert degrees to radians
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lam = math.radians(lng2 - lng1)

    # Haversine formula
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lam / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c


# ---------------------------------------------------------------------------
# Helper: pick best-fit transporter for a district
# ---------------------------------------------------------------------------

def _best_fit_transporter(db: Session, district: str, quantity_kg: float) -> Optional[Transporter]:
    """
    Return the verified transporter in ``district`` whose capacity_kg is the
    smallest value that is still >= quantity_kg (best capacity fit).
    If no transporter meets that threshold, return the one with the largest
    capacity (partial load, still better than nothing).
    Returns None if there are no verified transporters in the district.
    """
    transporters = (
        db.query(Transporter)
        .filter(
            Transporter.district == district,
            Transporter.verified == True,  # noqa: E712
        )
        .all()
    )
    if not transporters:
        return None

    # Try to find smallest capacity >= quantity_kg
    fitting = [t for t in transporters if t.capacity_kg >= quantity_kg]
    if fitting:
        return min(fitting, key=lambda t: t.capacity_kg)

    # Fall back to the largest available
    return max(transporters, key=lambda t: t.capacity_kg)


# ---------------------------------------------------------------------------
# Main recommender function
# ---------------------------------------------------------------------------

def recommend(
    db: Session,
    lot_id: int,
    buyer_district: str,
    perishability_flag: bool = False,
) -> RecommendationResult:
    """
    Recommend a delivery method for the given lot and buyer district.

    Parameters
    ----------
    db              : SQLAlchemy session
    lot_id          : ID of the lot to recommend for
    buyer_district  : Buyer's delivery district as a plain string
                      (captured at recommendation / offer time)
    perishability_flag : True if the commodity is perishable

    Returns
    -------
    RecommendationResult  with method, reason, estimated_cost, estimated_hours.
    Raises ValueError if the lot or its hub cannot be found.
    """

    # ── Load lot ─────────────────────────────────────────────────────────────
    lot: Optional[Lot] = db.query(Lot).filter(Lot.id == lot_id).first()
    if lot is None:
        raise ValueError(f"Lot {lot_id} not found")

    # ── Resolve lot's Hub ────────────────────────────────────────────────────
    # The lot should already have a hub_id assigned at creation time.
    # We load it directly; if missing we fall through gracefully.
    lot_hub: Optional[Hub] = lot.hub if lot.hub_id else None

    # If for some reason the lot has no hub_id, try to resolve from district/state
    if lot_hub is None:
        lot_hub, _ = match_hub(db, district=lot.district, state=lot.state)

    # ── Resolve buyer's district to nearest Hub ──────────────────────────────
    # We reuse hub_service.match_hub() — the EXACT function built in Step 2.
    # No second matching algorithm is introduced here.
    buyer_hub, buyer_is_fallback = match_hub(db, district=buyer_district)

    # ── Compute Haversine distance between the two Hubs ──────────────────────
    # Falls back to a large sentinel value (9999 km) when lat/lng are missing
    # so that distance-sensitive branches (STEP 1) are safely skipped.
    distance_km: float
    if (
        lot_hub is not None
        and buyer_hub is not None
        and lot_hub.lat is not None
        and lot_hub.lng is not None
        and buyer_hub.lat is not None
        and buyer_hub.lng is not None
    ):
        distance_km = _haversine_km(lot_hub.lat, lot_hub.lng, buyer_hub.lat, buyer_hub.lng)
    else:
        # One or both hubs lack coordinates — we cannot compute a real distance.
        # Use the sentinel so STEP 1 (≤50 km) is never falsely triggered.
        distance_km = 9_999.0

    # ── Kisan Rail lookup for lot's Hub district ─────────────────────────────
    hub_district_for_rail = lot_hub.district if lot_hub else lot.district
    rail_info = kisan_rail_routes.lookup(hub_district_for_rail)
    kisan_rail_route_exists: bool = rail_info["exists"]
    kisan_rail_station: Optional[str] = rail_info.get("station_name")

    # Hub name used in human-readable messages
    hub_name = lot_hub.name if lot_hub else f"{lot.district} Hub"

    # =========================================================================
    # STEP 1 — Short-haul: distance <= 50 km
    # =========================================================================
    # First match wins — if this branch fires, we return immediately.
    if distance_km <= 50:

        # Sub-branch A: large quantity AND verified transporter in hub district
        if lot.quantity_kg > 200 and lot_hub is not None:
            transporter = _best_fit_transporter(db, lot_hub.district, lot.quantity_kg)
            if transporter is not None:
                return RecommendationResult(
                    method="local_transporter",
                    reason=(
                        f"Short haul ({distance_km:.0f} km) with large quantity "
                        f"({lot.quantity_kg:.0f} kg). "
                        f"Recommended: {transporter.name} "
                        f"({transporter.vehicle_type.value.replace('_', ' ')}, "
                        f"capacity {transporter.capacity_kg:.0f} kg) — "
                        f"verified transporter in {lot_hub.district}."
                    ),
                    estimated_cost=None,   # transporter negotiates directly
                    estimated_hours=round(distance_km / 40, 1),
                )

        # Sub-branch B: buyer pickup (either qty <= 200 or no transporter)
        return RecommendationResult(
            method="buyer_pickup",
            reason=(
                f"Short haul ({distance_km:.0f} km). "
                f"Buyer pickup at {hub_name} is the most economical option."
            ),
            estimated_cost=0.0,
            estimated_hours=round(distance_km / 40, 1),
        )

    # =========================================================================
    # STEP 2 — Perishable + Kisan Rail available
    # =========================================================================
    # Only reached if STEP 1 did NOT fire (distance > 50 km).
    if perishability_flag and kisan_rail_route_exists:
        # Estimated transit time: distance / 40 km/h (labeled clearly as estimate)
        estimated_hours = round(distance_km / 40, 1)
        station = kisan_rail_station or hub_district_for_rail

        return RecommendationResult(
            method="kisan_rail",
            reason=(
                f"Perishable commodity, long haul ({distance_km:.0f} km). "
                f"Kisan Rail via {station} — subsidy-eligible, "
                f"~{estimated_hours} hrs (estimated at distance / 40 km·h⁻¹)."
            ),
            estimated_cost=None,   # subsidy amount varies; not computed here
            estimated_hours=estimated_hours,
        )

    # =========================================================================
    # STEP 3 — Consolidation opportunity at the same Hub
    # =========================================================================
    # Check whether at least one OTHER lot at the SAME Hub has a
    # pending-or-accepted offer whose delivery_district resolves to the
    # SAME STATE as this buyer's district.
    #
    # "Same state" is determined by resolving each other offer's
    # delivery_district to a Hub and checking that hub's state field.
    # We reuse match_hub() for every resolution — no new algorithm.
    if lot_hub is not None:
        buyer_state = buyer_hub.state if buyer_hub else None

        if buyer_state:
            # Fetch all other lots at the same hub (excluding this lot)
            other_lots = (
                db.query(Lot)
                .filter(Lot.hub_id == lot_hub.id, Lot.id != lot_id)
                .all()
            )

            same_state_count = 0
            for other_lot in other_lots:
                # Only consider lots that have a pending or accepted offer
                active_offers = (
                    db.query(Offer)
                    .filter(
                        Offer.lot_id == other_lot.id,
                        Offer.status.in_([OfferStatus.pending, OfferStatus.accepted]),
                        Offer.delivery_district.isnot(None),
                    )
                    .all()
                )
                for offer in active_offers:
                    # Resolve offer's delivery_district to a hub
                    other_hub, _ = match_hub(db, district=offer.delivery_district)
                    if other_hub is not None and other_hub.state == buyer_state:
                        same_state_count += 1
                        break  # count each lot once, not each offer

            if same_state_count > 0:
                return RecommendationResult(
                    method="consolidated_truck",
                    reason=(
                        f"Long haul ({distance_km:.0f} km). "
                        f"Consolidation opportunity: {same_state_count} other lot(s) at "
                        f"{hub_name} also heading to {buyer_state}. "
                        f"Consolidated truck reduces per-unit freight cost."
                    ),
                    estimated_cost=None,
                    estimated_hours=round(distance_km / 40, 1),
                )

    # =========================================================================
    # STEP 4 — Fallback: best-fit transporter or buyer pickup
    # =========================================================================
    # None of the earlier branches matched.  Try to find a verified transporter
    # in the lot's hub district; if none exists, fall back to buyer pickup.
    if lot_hub is not None:
        transporter = _best_fit_transporter(db, lot_hub.district, lot.quantity_kg)
        if transporter is not None:
            return RecommendationResult(
                method="local_transporter",
                reason=(
                    f"Long haul ({distance_km:.0f} km), non-perishable, no consolidation "
                    f"opportunity. Best available transporter: {transporter.name} "
                    f"({transporter.vehicle_type.value.replace('_', ' ')}, "
                    f"capacity {transporter.capacity_kg:.0f} kg) in {lot_hub.district}."
                ),
                estimated_cost=None,
                estimated_hours=round(distance_km / 40, 1),
            )

    # Absolute fallback — buyer pickup
    return RecommendationResult(
        method="buyer_pickup",
        reason=(
            f"No Kisan Rail route, no verified transporter, and no consolidation "
            f"opportunity found. Buyer pickup at {hub_name} is the only available option."
        ),
        estimated_cost=0.0,
        estimated_hours=None,
    )
