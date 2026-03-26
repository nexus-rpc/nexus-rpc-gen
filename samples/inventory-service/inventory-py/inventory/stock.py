from __future__ import annotations

from dataclasses import dataclass


@dataclass
class StockQuery:
    """Parameters for a stock-level lookup."""

    sku: str
    include_reserved: bool = False


@dataclass
class StockLevel:
    """Current stock counts for a single item."""

    sku: str
    available: int
    reserved: int
    last_updated: str
