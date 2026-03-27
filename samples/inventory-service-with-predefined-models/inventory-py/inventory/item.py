from __future__ import annotations

from dataclasses import dataclass


@dataclass
class AddItemInput:
    """Details of a new item to add to the catalog."""

    sku: str
    name: str
    initial_quantity: int


@dataclass
class AddItemOutput:
    item_id: str
    created_at: str
