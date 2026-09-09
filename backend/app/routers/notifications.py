"""
Notifications router — in-app notification list, read marking, and FCM subscription.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func as sa_func
from pydantic import BaseModel
from typing import Optional

from app.database import get_db
from app.models import (
    Notification, NotificationType, DeviceToken, DevicePlatform, User,
)
from app.auth import get_current_user
from app.rate_limiter import create_rate_limiter

router = APIRouter(prefix="/notifications", tags=["notifications"])


# ── Schemas ──────────────────────────────────────────────────────────

class NotificationResponse(BaseModel):
    id: int
    type: NotificationType
    title: str
    body: str
    related_entity_type: Optional[str]
    related_entity_id: Optional[int]
    is_read: bool
    created_at: Optional[str]

    class Config:
        from_attributes = True


class NotificationListResponse(BaseModel):
    notifications: list[NotificationResponse]
    total: int
    unread_count: int


class SubscribeRequest(BaseModel):
    token: str
    platform: DevicePlatform = DevicePlatform.web


# ── Endpoints ────────────────────────────────────────────────────────


@router.get("", response_model=NotificationListResponse)
def list_notifications(
    unread_only: bool = Query(default=False),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List notifications for the current user (paginated)."""
    base_query = db.query(Notification).filter(Notification.user_id == current_user.id)

    if unread_only:
        base_query = base_query.filter(Notification.is_read == False)  # noqa: E712

    total = base_query.count()
    unread_count = (
        db.query(sa_func.count(Notification.id))
        .filter(
            Notification.user_id == current_user.id,
            Notification.is_read == False,  # noqa: E712
        )
        .scalar()
    )

    notifications = (
        base_query
        .order_by(Notification.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return NotificationListResponse(
        notifications=[_to_response(n) for n in notifications],
        total=total,
        unread_count=unread_count or 0,
    )


@router.get("/unread-count")
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lightweight endpoint for the notification badge count."""
    count = (
        db.query(sa_func.count(Notification.id))
        .filter(
            Notification.user_id == current_user.id,
            Notification.is_read == False,  # noqa: E712
        )
        .scalar()
    )
    return {"unread_count": count or 0}


@router.patch("/{notification_id}/read")
def mark_as_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark a notification as read."""
    notification = (
        db.query(Notification)
        .filter(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
        )
        .first()
    )
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    notification.is_read = True
    db.commit()

    return {"message": "Marked as read"}


@router.patch("/read-all")
def mark_all_as_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark all notifications as read for the current user."""
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False,  # noqa: E712
    ).update({"is_read": True})
    db.commit()

    return {"message": "All notifications marked as read"}


# ── FCM subscription ────────────────────────────────────────────────


@router.post("/subscribe")
def subscribe_push(
    payload: SubscribeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _rl=Depends(create_rate_limiter(max_calls=10, window_seconds=60)),
):
    """Register an FCM device token for push notifications."""
    # Check if token already exists
    existing = db.query(DeviceToken).filter(DeviceToken.token == payload.token).first()
    if existing:
        # Update ownership if token was previously registered to another user
        existing.user_id = current_user.id
        existing.platform = payload.platform
        existing.last_used_at = datetime.now(timezone.utc)
        db.commit()
        return {"message": "Token updated"}

    device_token = DeviceToken(
        user_id=current_user.id,
        token=payload.token,
        platform=payload.platform,
    )
    db.add(device_token)
    db.commit()

    return {"message": "Subscribed to push notifications"}


@router.delete("/subscribe")
def unsubscribe_push(
    payload: SubscribeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Unregister an FCM device token."""
    token = (
        db.query(DeviceToken)
        .filter(
            DeviceToken.token == payload.token,
            DeviceToken.user_id == current_user.id,
        )
        .first()
    )
    if token:
        db.delete(token)
        db.commit()

    return {"message": "Unsubscribed from push notifications"}


# ── Helpers ──────────────────────────────────────────────────────────

def _to_response(n: Notification) -> NotificationResponse:
    return NotificationResponse(
        id=n.id,
        type=n.type,
        title=n.title,
        body=n.body,
        related_entity_type=n.related_entity_type,
        related_entity_id=n.related_entity_id,
        is_read=n.is_read,
        created_at=n.created_at.isoformat() if n.created_at else None,
    )
