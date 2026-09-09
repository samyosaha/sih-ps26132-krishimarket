import os
import time
import requests
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from app.database import SessionLocal
from app.models import PriceRecord, PriceAlert, AlertCondition, NotificationType
from app.services.notification_service import create_notification

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


def check_price_alerts(commodities: list[str] | None = None) -> int:
    """
    Match active price alerts against the latest synced prices.

    Creates an in-app Notification on every match and sets the alert's
    last_triggered_at.  A 24-hour dedup prevents repeat firing: an alert
    will not re-trigger if last_triggered_at is within the last 24 hours.

    Returns the number of alerts triggered.
    """
    db = SessionLocal()
    triggered = 0
    try:
        query = db.query(PriceAlert).filter(
            PriceAlert.is_active == True,  # noqa: E712
        )
        if commodities:
            lowered = [c.lower() for c in commodities]
            query = query.filter(
                func.lower(PriceAlert.commodity).in_(lowered)
            )
        alerts = query.all()

        now = datetime.now(timezone.utc)

        for alert in alerts:
            # 24-hour dedup window
            if alert.last_triggered_at:
                last = alert.last_triggered_at
                if last.tzinfo is None:
                    last = last.replace(tzinfo=timezone.utc)
                if (now - last) < timedelta(hours=24):
                    continue

            # Latest matching price record
            price_query = db.query(PriceRecord).filter(
                func.lower(PriceRecord.commodity) == alert.commodity.lower(),
                PriceRecord.modal_price.isnot(None),
            )
            if alert.state:
                price_query = price_query.filter(
                    func.lower(PriceRecord.state) == alert.state.lower()
                )
            if alert.district:
                price_query = price_query.filter(
                    func.lower(PriceRecord.district) == alert.district.lower()
                )

            record = (
                price_query.order_by(PriceRecord.arrival_date.desc()).first()
            )
            if not record:
                continue

            matched = False
            if (
                alert.condition == AlertCondition.at_or_above
                and record.modal_price >= alert.target_price
            ):
                matched = True
            elif (
                alert.condition == AlertCondition.at_or_below
                and record.modal_price <= alert.target_price
            ):
                matched = True

            if matched:
                create_notification(
                    db,
                    user_id=alert.user_id,
                    notification_type=NotificationType.price_alert,
                    title=f"Price alert: {alert.commodity}",
                    body=(
                        f"{alert.commodity} modal price is now "
                        f"\u20b9{record.modal_price:.2f}/quintal"
                    ),
                    related_entity_type="price_alert",
                    related_entity_id=alert.id,
                )
                alert.last_triggered_at = now
                triggered += 1
                print(
                    f"[price_ingestion] Price alert #{alert.id} triggered "
                    f"for user {alert.user_id} ({alert.commodity})"
                )

        db.commit()
    except Exception as e:
        print(f"[price_ingestion] check_price_alerts error: {e}")
        db.rollback()
    finally:
        db.close()
    return triggered


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

    # After a successful sync, fire any matching price alerts
    try:
        triggered = check_price_alerts(commodities=COMMODITIES)
        print(f"[price_ingestion] Price alerts triggered: {triggered}")
    except Exception as e:
        print(f"[price_ingestion] check_price_alerts failed: {e}")

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