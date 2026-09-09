"""
Notification service — creates in-app notifications and sends push via FCM.

Firebase push is optional: when FIREBASE_SERVICE_ACCOUNT_JSON is not set,
notifications are created in the database (in-app) but no push is sent.
"""

import os
import json
import logging
from typing import Optional

from sqlalchemy.orm import Session

from app.models import Notification, NotificationType, DeviceToken

logger = logging.getLogger(__name__)

# ── Firebase initialization (lazy, optional) ─────────────────────────

_firebase_app = None


def _get_firebase_app():
    """Lazily initialize Firebase Admin SDK."""
    global _firebase_app
    if _firebase_app is not None:
        return _firebase_app

    firebase_config = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON", "").strip()
    if not firebase_config:
        logger.info("[notifications] FIREBASE_SERVICE_ACCOUNT_JSON not set — push disabled")
        return None

    try:
        import firebase_admin
        from firebase_admin import credentials

        # Config can be a file path or raw JSON
        if firebase_config.startswith("{"):
            cred = credentials.Certificate(json.loads(firebase_config))
        else:
            cred = credentials.Certificate(firebase_config)

        _firebase_app = firebase_admin.initialize_app(cred)
        logger.info("[notifications] Firebase initialized for push notifications")
        return _firebase_app
    except Exception as e:
        logger.error("[notifications] Firebase init failed: %s", e)
        return None


# ── Public API ───────────────────────────────────────────────────────


def create_notification(
    db: Session,
    user_id: int,
    notification_type: NotificationType,
    title: str,
    body: str,
    related_entity_type: Optional[str] = None,
    related_entity_id: Optional[int] = None,
) -> Notification:
    """
    Create an in-app notification and attempt push delivery.

    This is the single entry point for all notification creation.
    """
    notification = Notification(
        user_id=user_id,
        type=notification_type,
        title=title,
        body=body,
        related_entity_type=related_entity_type,
        related_entity_id=related_entity_id,
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)

    # Attempt push delivery (non-blocking — don't fail if push fails)
    try:
        _send_push_to_user(db, user_id, title, body)
    except Exception as e:
        logger.warning("[notifications] Push delivery failed for user %s: %s", user_id, e)

    return notification


def _send_push_to_user(db: Session, user_id: int, title: str, body: str) -> None:
    """Send a push notification to all of a user's registered devices."""
    firebase_app = _get_firebase_app()
    if not firebase_app:
        return  # Push not configured

    tokens = (
        db.query(DeviceToken)
        .filter(DeviceToken.user_id == user_id)
        .all()
    )

    if not tokens:
        return

    try:
        from firebase_admin import messaging

        for device_token in tokens:
            message = messaging.Message(
                notification=messaging.Notification(
                    title=title,
                    body=body,
                ),
                token=device_token.token,
            )
            try:
                messaging.send(message)
                logger.debug("[notifications] Push sent to token %s...", device_token.token[:20])
            except messaging.UnregisteredError:
                # Token is invalid — clean it up
                logger.info("[notifications] Removing invalid FCM token for user %s", user_id)
                db.delete(device_token)
                db.commit()
            except Exception as e:
                logger.warning("[notifications] Push send error: %s", e)

    except ImportError:
        logger.warning("[notifications] firebase_admin.messaging not available")


# ── Convenience functions for common notification types ──────────────


def notify_new_offer(db: Session, farmer_id: int, buyer_name: str, lot_commodity: str, offer_id: int):
    """Notify a farmer that they received a new offer."""
    create_notification(
        db,
        user_id=farmer_id,
        notification_type=NotificationType.new_offer,
        title="New offer received",
        body=f"{buyer_name} made an offer on your {lot_commodity} listing",
        related_entity_type="offer",
        related_entity_id=offer_id,
    )


def notify_offer_accepted(db: Session, buyer_id: int, lot_commodity: str, offer_id: int):
    """Notify a buyer that their offer was accepted."""
    create_notification(
        db,
        user_id=buyer_id,
        notification_type=NotificationType.offer_accepted,
        title="Offer accepted!",
        body=f"Your offer on {lot_commodity} has been accepted",
        related_entity_type="offer",
        related_entity_id=offer_id,
    )


def notify_offer_rejected(db: Session, buyer_id: int, lot_commodity: str, offer_id: int):
    """Notify a buyer that their offer was rejected."""
    create_notification(
        db,
        user_id=buyer_id,
        notification_type=NotificationType.offer_rejected,
        title="Offer not accepted",
        body=f"Your offer on {lot_commodity} was not accepted",
        related_entity_type="offer",
        related_entity_id=offer_id,
    )


def notify_rate_prompt(db: Session, user_id: int, transaction_id: int, other_party_name: str):
    """Prompt a user to rate after delivery."""
    create_notification(
        db,
        user_id=user_id,
        notification_type=NotificationType.rate_prompt,
        title="Rate your trade",
        body=f"Your transaction with {other_party_name} is complete. Please leave a rating.",
        related_entity_type="transaction",
        related_entity_id=transaction_id,
    )


def notify_payment_update(db: Session, user_id: int, transaction_id: int, new_status: str):
    """Notify about payment status changes."""
    create_notification(
        db,
        user_id=user_id,
        notification_type=NotificationType.payment_update,
        title="Payment update",
        body=f"Transaction payment status updated to: {new_status}",
        related_entity_type="transaction",
        related_entity_id=transaction_id,
    )


def notify_dispute_update(db: Session, user_id: int, dispute_id: int, message: str):
    """Notify about dispute status changes."""
    create_notification(
        db,
        user_id=user_id,
        notification_type=NotificationType.dispute_update,
        title="Dispute update",
        body=message,
        related_entity_type="dispute",
        related_entity_id=dispute_id,
    )


def notify_price_alert(db: Session, user_id: int, commodity: str, price: float, alert_id: int):
    """Notify when a price alert condition is met."""
    create_notification(
        db,
        user_id=user_id,
        notification_type=NotificationType.price_alert,
        title=f"Price alert: {commodity}",
        body=f"{commodity} modal price is now ₹{price:.2f}/quintal",
        related_entity_type="price_alert",
        related_entity_id=alert_id,
    )


def notify_verification_update(db: Session, user_id: int, approved: bool, reason: str = None):
    """Notify buyer about verification result."""
    if approved:
        title = "Verification approved ✓"
        body = "Your buyer verification has been approved. You now have a verified badge."
    else:
        title = "Verification not approved"
        body = f"Your verification was not approved. Reason: {reason}" if reason else "Your verification was not approved."

    create_notification(
        db,
        user_id=user_id,
        notification_type=NotificationType.verification_update,
        title=title,
        body=body,
    )
