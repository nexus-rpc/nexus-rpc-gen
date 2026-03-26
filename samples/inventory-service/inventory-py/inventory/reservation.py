from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class ReservationStatus(Enum):
    """Status of a stock reservation."""

    PENDING = "pending"
    CONFIRMED = "confirmed"
    EXPIRED = "expired"


@dataclass
class ReservationRequest:
    """A request to hold inventory for an order."""

    sku: str
    quantity: int
    order_id: str


@dataclass
class ReservationResult:
    """Outcome of a reservation attempt."""

    reservation_id: str
    status: ReservationStatus
    expires_at: str
