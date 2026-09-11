"""
Kisan Rail Route Lookup — Phase 8 Fulfillment Recommender
==========================================================

This module provides a *static* lookup table that indicates whether a Kisan
Rail freight service exists originating from a given Hub district.

Scope
-----
Real-time schedule queries (Indian Railways API) are out of scope for the SIH
prototype.  Instead we seed a fixed dict with known Kisan Rail corridors that
were announced / operational as of 2024.  The data is sufficient to drive the
rule-based decision engine and to make the demo explainable to judges.

Data sources consulted
----------------------
* Press releases from Indian Railways / Ministry of Agriculture on Kisan Rail
  launches (2020–2024).
* Agmarknet mandi districts used as Hub districts in this project.

Structure
---------
Keys: Hub district name (case-insensitive match — see ``lookup()`` below).
Values: dict with:
    exists        (bool)  — whether at least one Kisan Rail route is active
    station_name  (str)   — nearest Kisan Rail loading station
"""

from typing import Optional

# ---------------------------------------------------------------------------
# Seed data — real Kisan Rail corridors keyed by Hub district
# ---------------------------------------------------------------------------
# Format: district_lower -> {"exists": bool, "station_name": str}
_KISAN_RAIL_TABLE: dict[str, dict] = {
    # Maharashtra corridors (origin of many Kisan Rail services)
    "nashik": {
        "exists": True,
        "station_name": "Nashik Road",
    },
    "nashik road": {
        "exists": True,
        "station_name": "Nashik Road",
    },
    "solapur": {
        "exists": True,
        "station_name": "Solapur",
    },
    "sangli": {
        "exists": True,
        "station_name": "Sangli",
    },
    "pune": {
        "exists": True,
        "station_name": "Pune Junction",
    },
    "nagpur": {
        "exists": True,
        "station_name": "Nagpur",
    },
    "nandurbar": {
        "exists": True,
        "station_name": "Nandurbar",
    },
    # Andhra Pradesh / Telangana
    "anantapur": {
        "exists": True,
        "station_name": "Guntakal Junction",
    },
    "kurnool": {
        "exists": True,
        "station_name": "Kurnool Town",
    },
    # Karnataka
    "bengaluru": {
        "exists": True,
        "station_name": "Krishnarajapuram",
    },
    "tumkur": {
        "exists": True,
        "station_name": "Tumkur",
    },
    # Punjab / Haryana
    "ludhiana": {
        "exists": True,
        "station_name": "Ludhiana",
    },
    "amritsar": {
        "exists": True,
        "station_name": "Amritsar",
    },
    # Uttar Pradesh
    "varanasi": {
        "exists": True,
        "station_name": "Varanasi Junction",
    },
    "lucknow": {
        "exists": True,
        "station_name": "Lucknow NR",
    },
    # Bihar
    "muzaffarpur": {
        "exists": True,
        "station_name": "Muzaffarpur Junction",
    },
    "darbhanga": {
        "exists": True,
        "station_name": "Darbhanga",
    },
}


def lookup(district: Optional[str]) -> dict:
    """
    Return Kisan Rail route info for the given Hub district.

    Matching is case-insensitive; leading/trailing whitespace is stripped.
    Returns ``{"exists": False, "station_name": None}`` if not found.

    Parameters
    ----------
    district:
        Hub district name (e.g. ``"Nashik"``, ``"Solapur"``).

    Returns
    -------
    dict with keys ``exists`` (bool) and ``station_name`` (str | None).
    """
    if not district:
        return {"exists": False, "station_name": None}

    key = district.strip().lower()
    return _KISAN_RAIL_TABLE.get(key, {"exists": False, "station_name": None})
