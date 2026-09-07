"""
Server-side rate limiter using an in-memory sliding window.

Usage:
    from app.rate_limiter import create_rate_limiter

    # As a FastAPI dependency:
    @router.post("/login")
    def login(..., _rl=Depends(create_rate_limiter(max_calls=5, window_seconds=60))):
        ...
"""

import time
import threading
from collections import defaultdict
from fastapi import Request, HTTPException, status


class _SlidingWindowLimiter:
    """Thread-safe in-memory sliding window rate limiter."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        # key -> list of timestamps
        self._requests: dict[str, list[float]] = defaultdict(list)

    def is_allowed(self, key: str, max_calls: int, window_seconds: int) -> bool:
        """Return True if the request is within limits, False otherwise."""
        now = time.monotonic()
        cutoff = now - window_seconds

        with self._lock:
            timestamps = self._requests[key]
            # Prune expired entries
            self._requests[key] = [t for t in timestamps if t > cutoff]
            timestamps = self._requests[key]

            if len(timestamps) >= max_calls:
                return False

            timestamps.append(now)
            return True

    def cleanup(self, max_age: int = 300) -> None:
        """Remove stale keys older than max_age seconds (call periodically)."""
        now = time.monotonic()
        cutoff = now - max_age
        with self._lock:
            stale_keys = [
                k for k, v in self._requests.items()
                if not v or v[-1] < cutoff
            ]
            for k in stale_keys:
                del self._requests[k]


# Singleton limiter instance
_limiter = _SlidingWindowLimiter()


def create_rate_limiter(
    max_calls: int = 10,
    window_seconds: int = 60,
    key_func: str = "ip",
):
    """
    Create a FastAPI dependency that rate-limits requests.

    Args:
        max_calls: Maximum number of requests allowed in the window.
        window_seconds: Time window in seconds.
        key_func: How to identify the client.
            - "ip": Use client IP (for public/auth endpoints)
            - "user": Use authenticated user ID from JWT (for protected endpoints)
            - "ip+path": Use IP + request path (per-route limiting)

    Raises:
        HTTPException 429 if rate limit is exceeded.
    """

    async def _rate_limit_dependency(request: Request) -> None:
        # Determine the rate-limit key
        if key_func == "user":
            # Try to extract user ID from Authorization header
            auth_header = request.headers.get("authorization", "")
            if auth_header.startswith("Bearer "):
                token_snippet = auth_header[7:20]  # first 13 chars of token
            else:
                token_snippet = "anon"
            key = f"user:{token_snippet}"
        elif key_func == "ip+path":
            client_ip = request.client.host if request.client else "unknown"
            key = f"{client_ip}:{request.url.path}"
        else:
            client_ip = request.client.host if request.client else "unknown"
            key = f"ip:{client_ip}"

        if not _limiter.is_allowed(key, max_calls, window_seconds):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Please slow down and try again shortly.",
                headers={"Retry-After": str(window_seconds)},
            )

    return _rate_limit_dependency
