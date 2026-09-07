import os
from dotenv import load_dotenv
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

load_dotenv()

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="KrishiMarket API",
    description="Farmer-Buyer marketplace backend with price discovery and forecasting",
    version="1.0.0",
)

cors_origins_env = os.getenv("CORS_ORIGINS", "")
if cors_origins_env:
    allow_origins = [origin.strip() for origin in cors_origins_env.split(",") if origin.strip()]
else:
    allow_origins = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Force HTTPS in production
if os.getenv("FORCE_HTTPS", "").lower() in ("true", "1", "yes"):
    from starlette.middleware.httpsredirect import HTTPSRedirectMiddleware
    app.add_middleware(HTTPSRedirectMiddleware)

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
    try:
        scheduler.start()
    except Exception:
        pass

@app.on_event("shutdown")
def stop_scheduler():
    try:
        scheduler.shutdown()
    except Exception:
        pass

@app.get("/")
def read_root():
    return {
        "status": "ok",
        "service": "KrishiMarket API",
        "docs": "/docs",
    }

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.post("/admin/sync-prices")
def trigger_price_sync(current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    try:
        count = sync_prices()
        return {"status": "ok", "records_processed": count}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/admin/backfill-prices")
def trigger_backfill(current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    try:
        count = backfill_prices()
        return {"status": "ok", "records_processed": count}
    except Exception as e:
        return {"status": "error", "message": str(e)}