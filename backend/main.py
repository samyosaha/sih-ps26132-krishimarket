from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.background import BackgroundScheduler
from app.database import engine, Base
from app import models  # noqa: F401
from app.auth import get_current_user
from app.models import User, UserRole
from app.services.price_ingestion import sync_prices, backfill_prices
from app.routers import auth as auth_router
from app.routers import lots as lots_router
from app.routers import offers as offers_router
from app.routers import transactions as transactions_router
from app.routers import disputes as disputes_router
from app.routers import prices as prices_router
from app.routers import forecast as forecast_router

Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(lots_router.router)
app.include_router(offers_router.router)
app.include_router(transactions_router.router)
app.include_router(disputes_router.router)
app.include_router(prices_router.router)
app.include_router(forecast_router.router)

scheduler = BackgroundScheduler()
scheduler.add_job(sync_prices, "interval", days=1, id="daily_price_sync")

@app.on_event("startup")
def start_scheduler():
    scheduler.start()

@app.on_event("shutdown")
def stop_scheduler():
    scheduler.shutdown()

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.post("/admin/sync-prices")
def trigger_price_sync(current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    count = sync_prices()
    return {"status": "ok", "records_processed": count}

@app.post("/admin/backfill-prices")
def trigger_backfill(current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    count = backfill_prices()
    return {"status": "ok", "records_processed": count}