import os
import logging
from dotenv import load_dotenv
from fastapi import FastAPI, Depends, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
from apscheduler.schedulers.background import BackgroundScheduler
from pathlib import Path
from sqlalchemy import text

from app.database import engine, Base, SessionLocal, ensure_sqlite_schema
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
from app.routers import ratings as ratings_router
from app.routers import verification as verification_router
from app.routers import notifications as notifications_router
from app.routers import price_alerts as price_alerts_router
from app.routers import translation as translation_router
from app.routers import voice as voice_router
from app.routers import tts as tts_router

load_dotenv()
logger = logging.getLogger(__name__)

Base.metadata.create_all(bind=engine)
ensure_sqlite_schema()


# ── Security Middleware ──────────────────────────────────────────────


class RequestSizeLimitMiddleware(BaseHTTPMiddleware):
    """Reject request bodies larger than a configured limit (default: 5 MB)."""

    def __init__(self, app, max_body_bytes: int = 5_242_880):
        super().__init__(app)
        self.max_body_bytes = max_body_bytes

    async def dispatch(self, request: Request, call_next):
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > self.max_body_bytes:
            return Response(
                content='{"detail":"Request body too large"}',
                status_code=413,
                media_type="application/json",
            )
        return await call_next(request)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security-related response headers to every backend response."""

    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        # Prevent API responses from being cached by shared caches
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        return response


# ── App configuration ────────────────────────────────────────────────

app = FastAPI(
    title="KrishiMarket API",
    description="Farmer-Buyer marketplace backend with price discovery and forecasting",
    version="1.0.0",
    # Hide docs in production for reduced attack surface
    docs_url="/docs" if os.getenv("ENVIRONMENT", "development") != "production" else None,
    redoc_url="/redoc" if os.getenv("ENVIRONMENT", "development") != "production" else None,
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
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=[
        "Authorization",
        "Content-Type",
        "Accept",
        "Origin",
        "X-Requested-With",
    ],
)

# Apply security middleware (order matters: outermost runs first)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestSizeLimitMiddleware, max_body_bytes=5_242_880)  # 5 MB for doc uploads

# ── Routers ──────────────────────────────────────────────────────────

app.include_router(auth_router.router)
app.include_router(lots_router.router)
app.include_router(offers_router.router)
app.include_router(transactions_router.router)
app.include_router(disputes_router.router)
app.include_router(prices_router.router)
app.include_router(forecast_router.router)
app.include_router(ratings_router.router)
app.include_router(verification_router.router)
app.include_router(notifications_router.router)
app.include_router(price_alerts_router.router)
app.include_router(translation_router.router)
app.include_router(voice_router.router)
app.include_router(tts_router.router)

# ── Static file serving for uploads (local dev) ──────────────────────

uploads_dir = Path("uploads")
uploads_dir.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")

# ── Background scheduler ────────────────────────────────────────────

scheduler = BackgroundScheduler()
scheduler.add_job(sync_prices, "interval", days=1, id="daily_price_sync")


@app.on_event("startup")
def start_scheduler():
    if os.getenv("ENVIRONMENT", "development").lower() != "production":
        try:
            from app.demo_accounts import seed

            seed()
        except Exception:
            pass
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


# ── Root endpoints ───────────────────────────────────────────────────

@app.get("/")
def read_root():
    return {
        "status": "ok",
        "service": "KrishiMarket API",
        "docs": "/docs",
    }

@app.get("/health")
def health_check():
    try:
        db = SessionLocal()
        try:
            db.execute(text("SELECT 1"))
        finally:
            db.close()
        return {"status": "ok", "database": "connected"}
    except Exception as exc:
        logger.error("Health check database probe failed: %s", exc)
        return {"status": "degraded", "database": "unavailable"}


# ── Admin endpoints ─────────────────────────────────────────────────

@app.post("/admin/sync-prices")
def trigger_price_sync(current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    try:
        count = sync_prices()
        return {"status": "ok", "records_processed": count}
    except Exception as e:
        raise HTTPException(status_code=503, detail="Price synchronization failed") from e


@app.post("/admin/backfill-prices")
def trigger_backfill(current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    try:
        count = backfill_prices()
        return {"status": "ok", "records_processed": count}
    except Exception as e:
        raise HTTPException(status_code=503, detail="Price backfill failed") from e
