import os
from dotenv import load_dotenv
from fastapi import FastAPI, Depends, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from app.database import engine, Base
from app import models  # noqa: F401
from app.auth import get_current_user
from app.models import User, UserRole
from app.routers import auth as auth_router
from app.routers import lots as lots_router
from app.routers import offers as offers_router
from app.routers import transactions as transactions_router
from app.routers import disputes as disputes_router
from app.routers import prices as prices_router
from app.routers import forecast as forecast_router

load_dotenv()

Base.metadata.create_all(bind=engine)


# ── Security Middleware ──────────────────────────────────────────────


class RequestSizeLimitMiddleware(BaseHTTPMiddleware):
    """Reject request bodies larger than a configured limit (default: 1 MB)."""

    def __init__(self, app, max_body_bytes: int = 1_048_576):
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
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
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
app.add_middleware(RequestSizeLimitMiddleware, max_body_bytes=1_048_576)  # 1 MB

app.include_router(auth_router.router)
app.include_router(lots_router.router)
app.include_router(offers_router.router)
app.include_router(transactions_router.router)
app.include_router(disputes_router.router)
app.include_router(prices_router.router)
app.include_router(forecast_router.router)

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