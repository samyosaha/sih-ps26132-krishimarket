import os
import time
import requests
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_
from app.database import SessionLocal
from app.models import PriceRecord

API_URL = "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070"

COMMODITIES = ["Onion", "Tomato", "Cotton", "Soybean", "Wheat"]

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


def fetch_commodity_records(commodity: str, limit: int = 500, arrival_date: str | None = None):
    api_key = os.getenv("AGMARKNET_API_KEY")
    params = {
        "api-key": api_key,
        "format": "json",
        "limit": limit,
        "filters[commodity]": commodity,
        "filters[state]": "Maharashtra",
    }
    if arrival_date:
        params["filters[arrival_date]"] = arrival_date

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = requests.get(API_URL, params=params, headers=HEADERS, timeout=REQUEST_TIMEOUT)
            response.raise_for_status()
            data = response.json()
            return data.get("records", [])
        except requests.exceptions.RequestException as e:
            print(f"[price_ingestion] Attempt {attempt} failed for {commodity} ({arrival_date}): {e}")
            if attempt == MAX_RETRIES:
                print(f"[price_ingestion] Giving up on {commodity} ({arrival_date}) after {MAX_RETRIES} attempts")
                return []
            time.sleep(2 * attempt)


def upsert_record(db: Session, record: dict):
    state = record.get("state")
    district = record.get("district")
    market = record.get("market")
    commodity = record.get("commodity")
    variety = record.get("variety")
    grade = record.get("grade")
    arrival_date = parse_date(record.get("arrival_date"))

    existing = db.query(PriceRecord).filter(
        and_(
            PriceRecord.state == state,
            PriceRecord.market == market,
            PriceRecord.commodity == commodity,
            PriceRecord.arrival_date == arrival_date,
        )
    ).first()

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
        db.add(PriceRecord(
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
        ))


def sync_prices():
    db = SessionLocal()
    total = 0
    try:
        for commodity in COMMODITIES:
            records = fetch_commodity_records(commodity)
            for record in records:
                upsert_record(db, record)
                total += 1
            db.commit()
            print(f"[price_ingestion] {commodity}: {len(records)} records processed")
    finally:
        db.close()
    return total


def backfill_prices(days: int = 60):
    db = SessionLocal()
    total = 0
    try:
        for day_offset in range(days):
            target_date = datetime.today() - timedelta(days=day_offset)
            date_str = target_date.strftime("%d/%m/%Y")
            print(f"[price_ingestion] Backfilling {date_str} ({day_offset + 1}/{days})")

            for commodity in COMMODITIES:
                records = fetch_commodity_records(commodity, arrival_date=date_str)
                for record in records:
                    upsert_record(db, record)
                    total += 1
                db.commit()
                print(f"[price_ingestion]   {commodity}: {len(records)} records")
                time.sleep(0.3)

        print(f"[price_ingestion] Backfill complete. Total records processed: {total}")
    finally:
        db.close()
    return total