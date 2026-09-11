"""
Delivery Status State Machine
==============================
Standalone, reusable module that governs every delivery-status transition.

NO endpoint should set ``Transaction.delivery_status`` directly — they all
call ``transition()`` instead.

The full graph is encoded in ``TRANSITION_TABLE`` so it can be reviewed
(or shown to a judge) in one place.

States
------
Listed → Hub Check-in Pending → Verified at Hub → Dispatched → In Transit → Delivered

Side-branch (reachable from Verified at Hub, Dispatched, or In Transit):
  → Disputed  (creates a Dispute record; no separate "Rejected" state)

Events
------
HUB_CHECKIN  – farmer drops produce at hub
VERIFY       – hub operator confirms grade/weight
DISPATCH     – produce is dispatched (requires delivery_method string)
IN_TRANSIT   – shipment is en route
DELIVER      – buyer confirms receipt
DISPUTE      – buyer (or farmer) raises a dispute (requires reason + raised_by_id)
"""

from __future__ import annotations

import enum
from typing import Any

from sqlalchemy.orm import Session

from app.models import (
    DeliveryStatus,
    Dispute,
    DisputeStatus,
    Transaction,
)


# ── Events ───────────────────────────────────────────────────────────────────


class DeliveryEvent(str, enum.Enum):
    """Actions that can be applied to a transaction's delivery lifecycle."""

    HUB_CHECKIN = "hub_checkin"
    VERIFY = "verify"
    DISPATCH = "dispatch"
    IN_TRANSIT = "in_transit"
    DELIVER = "deliver"
    DISPUTE = "dispute"


# ── Transition Table ─────────────────────────────────────────────────────────
#
# {current_state: {event: next_state}}
#
# Easy to audit: every legal move is a single entry here.

TRANSITION_TABLE: dict[DeliveryStatus, dict[DeliveryEvent, DeliveryStatus]] = {
    DeliveryStatus.listed: {
        DeliveryEvent.HUB_CHECKIN: DeliveryStatus.hub_checkin_pending,
    },
    DeliveryStatus.hub_checkin_pending: {
        DeliveryEvent.VERIFY: DeliveryStatus.verified_at_hub,
    },
    DeliveryStatus.verified_at_hub: {
        DeliveryEvent.DISPATCH: DeliveryStatus.dispatched,
        DeliveryEvent.DISPUTE: DeliveryStatus.disputed,
    },
    DeliveryStatus.dispatched: {
        DeliveryEvent.IN_TRANSIT: DeliveryStatus.in_transit,
        DeliveryEvent.DISPUTE: DeliveryStatus.disputed,
    },
    DeliveryStatus.in_transit: {
        DeliveryEvent.DELIVER: DeliveryStatus.delivered,
        DeliveryEvent.DISPUTE: DeliveryStatus.disputed,
    },
    # Terminal states — no outgoing edges
    DeliveryStatus.delivered: {},
    DeliveryStatus.disputed: {},
}

# Human-friendly labels for error messages
_STATE_LABELS: dict[DeliveryStatus, str] = {
    DeliveryStatus.listed: "Listed",
    DeliveryStatus.hub_checkin_pending: "Hub Check-in Pending",
    DeliveryStatus.verified_at_hub: "Verified at Hub",
    DeliveryStatus.dispatched: "Dispatched",
    DeliveryStatus.in_transit: "In Transit",
    DeliveryStatus.delivered: "Delivered",
    DeliveryStatus.disputed: "Disputed",
}


# ── Errors ───────────────────────────────────────────────────────────────────


class DeliveryTransitionError(Exception):
    """Raised when a requested state transition is illegal."""

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


# ── Core transition function ─────────────────────────────────────────────────


def transition(
    db: Session,
    transaction: Transaction,
    event: DeliveryEvent,
    **kwargs: Any,
) -> Transaction:
    """Apply *event* to *transaction*, mutate its delivery_status, and return it.

    Parameters
    ----------
    db : Session
        Active SQLAlchemy session (caller is responsible for commit).
    transaction : Transaction
        The ORM object whose delivery_status will be updated.
    event : DeliveryEvent
        The event to apply.
    **kwargs :
        Extra data required by certain events:
        - ``DISPATCH`` requires ``delivery_method: str``
        - ``DISPUTE`` requires ``reason: str`` and ``raised_by_id: int``

    Returns
    -------
    Transaction
        The same *transaction* object with its ``delivery_status``
        (and possibly ``delivery_method``) updated.

    Raises
    ------
    DeliveryTransitionError
        If the transition is illegal (wrong current state, missing params, etc.)
    """
    current = transaction.delivery_status

    # Normalise enum — SQLite may return the raw string value
    if isinstance(current, str):
        try:
            current = DeliveryStatus(current)
        except ValueError:
            raise DeliveryTransitionError(
                f"Transaction has unknown delivery_status '{current}'."
            )

    # Look up allowed transitions from the current state
    allowed = TRANSITION_TABLE.get(current)
    if allowed is None:
        raise DeliveryTransitionError(
            f"No transitions defined for state '{_STATE_LABELS.get(current, current.value)}'."
        )

    next_state = allowed.get(event)
    if next_state is None:
        allowed_events = ", ".join(
            e.value for e in allowed
        ) or "none (terminal state)"
        raise DeliveryTransitionError(
            f"Cannot apply event '{event.value}' in state "
            f"'{_STATE_LABELS.get(current, current.value)}'. "
            f"Allowed events from this state: {allowed_events}."
        )

    # ── Event-specific validations / side-effects ────────────────────────

    if event == DeliveryEvent.DISPATCH:
        delivery_method = kwargs.get("delivery_method")
        if not delivery_method or not str(delivery_method).strip():
            raise DeliveryTransitionError(
                "DISPATCH event requires a non-empty 'delivery_method' string."
            )
        transaction.delivery_method = str(delivery_method).strip()

    if event == DeliveryEvent.DISPUTE:
        reason = kwargs.get("reason")
        raised_by_id = kwargs.get("raised_by_id")
        if not reason or not str(reason).strip():
            raise DeliveryTransitionError(
                "DISPUTE event requires a non-empty 'reason'."
            )
        if raised_by_id is None:
            raise DeliveryTransitionError(
                "DISPUTE event requires 'raised_by_id'."
            )
        # Create the dispute record (reuses existing disputes table)
        dispute = Dispute(
            transaction_id=transaction.id,
            raised_by_id=int(raised_by_id),
            reason=str(reason).strip(),
            status=DisputeStatus.open,
        )
        db.add(dispute)

    # ── Apply the state change ───────────────────────────────────────────

    transaction.delivery_status = next_state
    return transaction
