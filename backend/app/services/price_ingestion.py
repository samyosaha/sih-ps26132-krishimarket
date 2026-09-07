import os
import time
import requests
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from app.database import SessionLocal
from app.models import PriceRecord

API_URL = "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070"

# All commodities the frontend supports
COMMODITIES = [
    "Wheat",
    "Rice",
    "Maize",
    "Bajra",
    "Jowar",
    "Barley",
    "Ragi",
    "Onion",
    "Potato",
    "Tomato",
    "Soyabean",
    "Groundnut",
    "Mustard",
    "Cotton",
    "Sugarcane",
    "Chilli",
    "Turmeric",
    "Garlic",
    "Ginger",
    "Arhar (Tur/Red Gram)",
    "Moong (Green Gram)",
    "Urad (Black Gram)",
    "Masoor",
    "Bengal Gram (Gram)(Whole)",
    "Banana",
    "Apple",
    "Mango",
    "Coconut",
    "Lemon",
    "Papaya",
    "Cabbage",
    "Cauliflower",
    "Brinjal",
    "Okra (Ladies Finger)",
    "Capsicum",
]

REQUEST_TIMEOUT = 60  # seconds
MAX_RETRIES = 3

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
}


def parse_date(date_str: str):
    if not date_str:
        return None
    try:
        return datetime.strptime(date_str, "%d/%m/%Y")
    except ValueError:
        return None


def parse_float(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _get_api_key() -> str:
    """Return the data.gov.in API key or a fallback sample key."""
    key = os.getenv("AGMARKNET_API_KEY", "").strip()
    if not key:
        # data.gov.in provides a sample key with a 10-record limit
        key = "579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b"
    return key


def _fetch_page(
    commodity: str,
    limit: int = 500,
    offset: int = 0,
    state: str | None = None,
    arrival_date: str | None = None,
) -> list[dict]:
    """Fetch a single page of records from data.gov.in."""
    api_key = _get_api_key()
    params = {
        "api-key": api_key,
        "format": "json",
        "limit": limit,
        "offset": offset,
        "filters[commodity]": commodity,
    }
    if state:
        params["filters[state]"] = state
    if arrival_date:
        params["filters[arrival_date]"] = arrival_date

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = requests.get(
                API_URL, params=params, headers=HEADERS, timeout=REQUEST_TIMEOUT
            )
            response.raise_for_status()
            data = response.json()
            return data.get("records", [])
        except requests.exceptions.RequestException as e:
            print(
                f"[price_ingestion] Attempt {attempt} failed for "
                f"{commodity} (state={state}, date={arrival_date}): {e}"
            )
            if attempt == MAX_RETRIES:
                print(
                    f"[price_ingestion] Giving up on {commodity} "
                    f"after {MAX_RETRIES} attempts"
                )
                return []
            time.sleep(2 * attempt)

    return []


def fetch_commodity_records(
    commodity: str,
    limit: int = 500,
    state: str | None = None,
    arrival_date: str | None = None,
) -> list[dict]:
    """
    Fetch records for a commodity, paginating automatically
    to collect all available data.
    """
    all_records: list[dict] = []
    offset = 0

    while True:
        page = _fetch_page(
            commodity=commodity,
            limit=limit,
            offset=offset,
            state=state,
            arrival_date=arrival_date,
        )
        all_records.extend(page)
        if len(page) < limit:
            break
        offset += limit
        time.sleep(0.3)

    return all_records


def upsert_record(db: Session, record: dict):
    state = record.get("state")
    district = record.get("district")
    market = record.get("market")
    commodity = record.get("commodity")
    variety = record.get("variety")
    grade = record.get("grade")
    arrival_date = parse_date(record.get("arrival_date"))

    existing = (
        db.query(PriceRecord)
        .filter(
            and_(
                PriceRecord.state == state,
                PriceRecord.market == market,
                PriceRecord.commodity == commodity,
                PriceRecord.arrival_date == arrival_date,
            )
        )
        .first()
    )

    min_price = parse_float(record.get("min_price"))
    max_price = parse_float(record.get("max_price"))
    modal_price = parse_float(record.get("modal_price"))

    if existing:
        existing.district = district
        existing.variety = variety
        existing.grade = grade
        existing.min_price = min_price
        existing.max_price = max_price
        existing.modal_price = modal_price
    else:
        db.add(
            PriceRecord(
                state=state,
                district=district,
                market=market,
                commodity=commodity,
                variety=variety,
                grade=grade,
                arrival_date=arrival_date,
                min_price=min_price,
                max_price=max_price,
                modal_price=modal_price,
            )
        )


def fetch_live_prices(
    commodity: str, state: str, district: str | None = None
) -> list[PriceRecord]:
    """
    On-demand live fetch: query data.gov.in for the given commodity+state,
    upsert results into the DB, and return matching PriceRecord objects.

    Called as a fallback when the /prices endpoint finds no local data.
    """
    db = SessionLocal()
    try:
        print(
            f"[price_ingestion] Live-fetching {commodity} "
            f"for {state} (district={district})"
        )
        records = fetch_commodity_records(
            commodity=commodity, state=state, limit=500
        )
        print(
            f"[price_ingestion] Live-fetch returned {len(records)} records"
        )
        for record in records:
            upsert_record(db, record)
        db.commit()

        # Now query back from DB with optional district filter
        query = db.query(PriceRecord).filter(
            func.lower(PriceRecord.commodity) == commodity.lower(),
            func.lower(PriceRecord.state) == state.lower(),
            PriceRecord.modal_price.isnot(None),
            PriceRecord.arrival_date.isnot(None),
        )
        if district:
            query = query.filter(
                func.lower(PriceRecord.district) == district.lower()
            )
        results = (
            query.order_by(PriceRecord.arrival_date.desc()).all()
        )

        # Detach from session so caller can use them safely
        db.expunge_all()
        return results
    except Exception as e:
        print(f"[price_ingestion] Live fetch error: {e}")
        db.rollback()
        return []
    finally:
        db.close()


def sync_prices():
    """
    Fetch the latest records for all commodities across all states.
    Intended to run as a periodic background job.
    """
    db = SessionLocal()
    total = 0
    try:
        for commodity in COMMODITIES:
            records = fetch_commodity_records(commodity)
            for record in records:
                upsert_record(db, record)
                total += 1
            db.commit()
            print(
                f"[price_ingestion] {commodity}: "
                f"{len(records)} records processed"
            )
            time.sleep(0.5)  # rate-limit between commodities
    finally:
        db.close()
    return total


def backfill_prices(days: int = 60):
    """
    Backfill historical data: for each of the last `days` days,
    fetch all commodities across all states.
    """
    db = SessionLocal()
    total = 0
    try:
        for day_offset in range(days):
            target_date = datetime.today() - timedelta(days=day_offset)
            date_str = target_date.strftime("%d/%m/%Y")
            print(
                f"[price_ingestion] Backfilling {date_str} "
                f"({day_offset + 1}/{days})"
            )

            for commodity in COMMODITIES:
                records = fetch_commodity_records(
                    commodity, arrival_date=date_str
                )
                for record in records:
                    upsert_record(db, record)
                    total += 1
                db.commit()
                print(
                    f"[price_ingestion]   {commodity}: "
                    f"{len(records)} records"
                )
                time.sleep(0.5)

        print(
            f"[price_ingestion] Backfill complete. "
            f"Total records processed: {total}"
        )
    finally:
        db.close()
    return total