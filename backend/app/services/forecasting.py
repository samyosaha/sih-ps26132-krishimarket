from typing import Optional
from datetime import timedelta
import numpy as np
from sklearn.linear_model import LinearRegression
from sqlalchemy.orm import Session

from app.models import PriceRecord

MIN_DATA_POINTS = 7
HOLD_THRESHOLD_PCT = 4.0


def forecast_price(
    commodity: str,
    state: str,
    district: Optional[str],
    db: Session,
) -> dict:
    query = db.query(PriceRecord).filter(
        PriceRecord.commodity == commodity,
        PriceRecord.state == state,
        PriceRecord.modal_price.isnot(None),
        PriceRecord.arrival_date.isnot(None),
    )
    if district:
        query = query.filter(PriceRecord.district == district)

    records = query.order_by(PriceRecord.arrival_date.asc()).all()

    if len(records) < MIN_DATA_POINTS:
        return {
            "status": "insufficient_data",
            "message": f"Only {len(records)} data point(s) available; need at least {MIN_DATA_POINTS}.",
            "commodity": commodity,
            "state": state,
            "district": district,
        }

    dates = [r.arrival_date for r in records]
    prices = [r.modal_price for r in records]

    day_indices = np.array([(d - dates[0]).days for d in dates]).reshape(-1, 1)
    price_values = np.array(prices)

    model = LinearRegression()
    model.fit(day_indices, price_values)

    last_day_index = day_indices[-1][0]
    future_7 = np.array([[last_day_index + 7]])
    future_14 = np.array([[last_day_index + 14]])

    predicted_7d = float(model.predict(future_7)[0])
    predicted_14d = float(model.predict(future_14)[0])

    window = min(7, len(prices))
    moving_avg = float(np.mean(prices[-window:]))

    current_price = float(prices[-1])

    # Blend the linear trend prediction with the smoothed moving average
    # to reduce the influence of a single noisy last data point.
    smoothed_current = (current_price + moving_avg) / 2
    predicted_7d = (predicted_7d + moving_avg) / 2

    pct_change_7d = ((predicted_7d - smoothed_current) / smoothed_current) * 100

    if pct_change_7d > HOLD_THRESHOLD_PCT:
        recommendation = "hold"
        reason = (
            f"Prices are trending up — predicted to rise about "
            f"{pct_change_7d:.1f}% over the next 7 days. Holding may fetch a better price."
        )
    else:
        recommendation = "sell_now"
        if pct_change_7d >= 0:
            reason = (
                f"Prices look roughly flat (about {pct_change_7d:.1f}% change expected "
                f"over 7 days) — selling now avoids the risk of a downturn."
            )
        else:
            reason = (
                f"Prices are trending down — predicted to fall about "
                f"{abs(pct_change_7d):.1f}% over the next 7 days. Selling now may get a better price than waiting."
            )

    chart_start = max(0, len(records) - 30)
    history_points = [
        {"date": r.arrival_date.strftime("%Y-%m-%d"), "price": r.modal_price}
        for r in records[chart_start:]
    ]

    last_date = dates[-1]
    prediction_points = [
        {
            "date": (last_date + timedelta(days=7)).strftime("%Y-%m-%d"),
            "price": round(predicted_7d, 2),
        },
        {
            "date": (last_date + timedelta(days=14)).strftime("%Y-%m-%d"),
            "price": round(predicted_14d, 2),
        },
    ]

    return {
        "status": "ok",
        "commodity": commodity,
        "state": state,
        "district": district,
        "current_price": round(current_price, 2),
        "predicted_price_7d": round(predicted_7d, 2),
        "predicted_price_14d": round(predicted_14d, 2),
        "recommendation": recommendation,
        "reason": reason,
        "chart_points": history_points + prediction_points,
    }