"""
Seed the price_records table with realistic historical mandi price data
so the Price Discovery & Forecast features work out of the box.

Generates 60 days of daily price records for major commodity+state+district
combinations, using realistic base prices and smooth random walks to
simulate actual market trends.
"""

import random
import math
from datetime import datetime, timedelta

from app.database import SessionLocal, engine, Base
from app.models import PriceRecord

# ── Commodity → (base modal ₹/quintal, typical spread %, realistic market name suffix) ──
COMMODITY_PROFILES = {
    "Wheat":                      (2200, 0.08),
    "Rice":                       (2800, 0.10),
    "Maize":                      (1900, 0.09),
    "Bajra":                      (2100, 0.08),
    "Jowar":                      (2600, 0.07),
    "Barley":                     (1700, 0.08),
    "Ragi":                       (3200, 0.09),
    "Onion":                      (1500, 0.15),
    "Potato":                     (1200, 0.12),
    "Tomato":                     (2000, 0.20),
    "Soyabean":                   (4200, 0.08),
    "Groundnut":                  (5000, 0.07),
    "Mustard":                    (4800, 0.06),
    "Cotton":                     (6000, 0.07),
    "Sugarcane":                  (3000, 0.05),
    "Chilli":                     (8000, 0.10),
    "Turmeric":                   (7500, 0.08),
    "Garlic":                     (3500, 0.12),
    "Ginger":                     (4000, 0.10),
    "Arhar (Tur/Red Gram)":       (6500, 0.06),
    "Moong (Green Gram)":         (7000, 0.07),
    "Urad (Black Gram)":          (6800, 0.07),
    "Masoor":                     (5500, 0.06),
    "Bengal Gram (Gram)(Whole)":   (4600, 0.07),
    "Banana":                     (2500, 0.10),
    "Apple":                      (8000, 0.08),
    "Mango":                      (4500, 0.12),
    "Coconut":                    (2800, 0.09),
    "Lemon":                      (3000, 0.15),
    "Papaya":                     (1800, 0.10),
    "Cabbage":                    (1000, 0.14),
    "Cauliflower":                (1500, 0.14),
    "Brinjal":                    (1800, 0.12),
    "Okra (Ladies Finger)":       (2200, 0.11),
    "Capsicum":                   (3500, 0.13),
}

# ── State → [(district, market_name)] ──
# Cover every state the frontend lists, with 1-3 districts each
STATE_DISTRICTS = {
    "Andhra Pradesh":       [("Guntur", "Guntur Market Yard"), ("Krishna", "Vijayawada Market"), ("Kurnool", "Kurnool Mandi")],
    "Arunachal Pradesh":    [("Papum Pare", "Itanagar Market")],
    "Assam":                [("Kamrup", "Guwahati Market"), ("Nagaon", "Nagaon Mandi")],
    "Bihar":                [("Patna", "Patna Market Yard"), ("Muzaffarpur", "Muzaffarpur Mandi"), ("Gaya", "Gaya Market")],
    "Chhattisgarh":         [("Raipur", "Raipur Mandi"), ("Durg", "Durg Market")],
    "Goa":                  [("North Goa", "Mapusa Market"), ("South Goa", "Margao Market")],
    "Gujarat":              [("Ahmedabad", "Ahmedabad APMC"), ("Rajkot", "Rajkot Mandi"), ("Surat", "Surat Market")],
    "Haryana":              [("Karnal", "Karnal Mandi"), ("Hisar", "Hisar Mandi"), ("Ambala", "Ambala Market")],
    "Himachal Pradesh":     [("Shimla", "Shimla Market"), ("Kullu", "Kullu Mandi")],
    "Jharkhand":            [("Ranchi", "Ranchi Market Yard"), ("Dhanbad", "Dhanbad Mandi")],
    "Karnataka":            [("Bangalore", "Yeshwanthpur APMC"), ("Hubli", "Hubli Market"), ("Mysore", "Mysore Mandi")],
    "Kerala":               [("Ernakulam", "Kochi Market"), ("Thiruvananthapuram", "Trivandrum Market")],
    "Madhya Pradesh":       [("Indore", "Indore Mandi"), ("Bhopal", "Bhopal Market"), ("Jabalpur", "Jabalpur Mandi")],
    "Maharashtra":          [("Pune", "Pune Market Yard"), ("Nashik", "Nashik APMC"), ("Nagpur", "Nagpur Mandi"), ("Mumbai City", "Mumbai APMC"), ("Ahmednagar", "Ahmednagar Market"), ("Solapur", "Solapur Mandi"), ("Kolhapur", "Kolhapur Market")],
    "Manipur":              [("Imphal West", "Imphal Market")],
    "Meghalaya":            [("East Khasi Hills", "Shillong Market")],
    "Mizoram":              [("Aizawl", "Aizawl Market")],
    "Nagaland":             [("Dimapur", "Dimapur Market")],
    "Odisha":               [("Khordha", "Bhubaneswar Market"), ("Cuttack", "Cuttack Mandi")],
    "Punjab":               [("Ludhiana", "Ludhiana Mandi"), ("Amritsar", "Amritsar Mandi"), ("Patiala", "Patiala Market")],
    "Rajasthan":            [("Jaipur", "Jaipur Mandi"), ("Jodhpur", "Jodhpur Market"), ("Kota", "Kota Mandi")],
    "Sikkim":               [("Gangtok", "Gangtok Market")],
    "Tamil Nadu":           [("Chennai", "Koyambedu Market"), ("Coimbatore", "Coimbatore Mandi"), ("Madurai", "Madurai Market")],
    "Telangana":            [("Hyderabad", "Hyderabad Market"), ("Warangal", "Warangal Mandi")],
    "Tripura":              [("West Tripura", "Agartala Market")],
    "Uttar Pradesh":        [("Lucknow", "Lucknow Mandi"), ("Agra", "Agra Market"), ("Varanasi", "Varanasi Mandi"), ("Kanpur Nagar", "Kanpur Market")],
    "Uttarakhand":          [("Dehradun", "Dehradun Mandi"), ("Haridwar", "Haridwar Market")],
    "West Bengal":          [("Kolkata", "Kolkata Market"), ("Howrah", "Howrah Mandi"), ("Bardhaman", "Bardhaman Market")],
    "Andaman and Nicobar":  [("South Andaman", "Port Blair Market")],
    "Chandigarh":           [("Chandigarh", "Chandigarh Mandi")],
    "Delhi":                [("New Delhi", "Azadpur Mandi"), ("South Delhi", "Okhla Market")],
    "Jammu and Kashmir":    [("Srinagar", "Srinagar Market"), ("Jammu", "Jammu Mandi")],
    "Ladakh":               [("Leh", "Leh Market")],
    "Puducherry":           [("Puducherry", "Puducherry Market")],
}

DAYS_OF_DATA = 60  # 60 days of historical records
SEED = 42


def generate_price_series(base_price: float, spread_pct: float, num_days: int, rng: random.Random):
    """
    Generate a realistic price series using a smooth random walk
    with seasonal-like oscillation.
    """
    prices = []
    current = base_price * rng.uniform(0.90, 1.10)  # start near base
    trend = rng.uniform(-0.002, 0.003)  # slight daily drift
    volatility = base_price * spread_pct * 0.03  # daily volatility

    for day in range(num_days):
        # Add smooth sinusoidal component (weekly cycle)
        seasonal = math.sin(2 * math.pi * day / 7) * (base_price * 0.02)
        # Random shock
        shock = rng.gauss(0, volatility)
        current = current * (1 + trend) + shock + seasonal * 0.3
        # Clamp to reasonable range
        current = max(base_price * 0.5, min(base_price * 1.8, current))
        modal = round(current, 2)
        min_p = round(modal * (1 - spread_pct * rng.uniform(0.3, 0.6)), 2)
        max_p = round(modal * (1 + spread_pct * rng.uniform(0.3, 0.6)), 2)
        prices.append((modal, min_p, max_p))
    return prices


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # Clear existing price records to avoid duplicates on re-run
    existing = db.query(PriceRecord).count()
    if existing > 0:
        print(f"Clearing {existing} existing price records...")
        db.query(PriceRecord).delete()
        db.commit()

    rng = random.Random(SEED)
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    total = 0
    batch = []

    for state, district_list in STATE_DISTRICTS.items():
        for district, market in district_list:
            for commodity, (base_price, spread) in COMMODITY_PROFILES.items():
                # Use a deterministic sub-seed per combo for reproducibility
                sub_seed = hash(f"{state}-{district}-{commodity}") % (2**31)
                combo_rng = random.Random(sub_seed)
                prices = generate_price_series(base_price, spread, DAYS_OF_DATA, combo_rng)

                for day_offset in range(DAYS_OF_DATA):
                    date = today - timedelta(days=DAYS_OF_DATA - 1 - day_offset)
                    modal, min_p, max_p = prices[day_offset]
                    batch.append(PriceRecord(
                        state=state,
                        district=district,
                        market=market,
                        commodity=commodity,
                        variety="Local",
                        grade="FAQ",
                        arrival_date=date,
                        min_price=min_p,
                        max_price=max_p,
                        modal_price=modal,
                    ))
                    total += 1

                    # Batch insert every 5000 records
                    if len(batch) >= 5000:
                        db.bulk_save_objects(batch)
                        db.commit()
                        batch = []
                        print(f"  ... {total} records inserted so far")

    if batch:
        db.bulk_save_objects(batch)
        db.commit()

    print(f"\n✅ Seeded {total} price records across {len(STATE_DISTRICTS)} states, "
          f"{sum(len(d) for d in STATE_DISTRICTS.values())} districts, "
          f"{len(COMMODITY_PROFILES)} commodities, {DAYS_OF_DATA} days each.")
    db.close()


if __name__ == "__main__":
    seed()
