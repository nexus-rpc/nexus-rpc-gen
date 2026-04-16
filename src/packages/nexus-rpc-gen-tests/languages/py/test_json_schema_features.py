import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from services.json_schema_features_service import (
    Action,
    Breed,
    Cat,
    FixedKind,
    HistoryEvent,
    JSONSchemaFeaturesPayload,
    Kind,
    Manager,
    Method,
    PrimaryContact,
    ShippingAddress,
    Status,
)


def _build_payload() -> JSONSchemaFeaturesPayload:
    return JSONSchemaFeaturesPayload(
        id="RPC-001",
        count=5,
        price=29.5,
        active=True,
        status=Status.ACTIVE,
        tags=["urgent", "reviewed"],
        metadata={"source": "api", "region": "us-east-1"},
        pet=Cat(kind=Kind.DOG, breed=Breed.HERDING),
        contact=PrimaryContact(method=Method.EMAIL, email="alice@example.com"),
        address=ShippingAddress(
            line1="123 Main St",
            city="Springfield",
            country_code="US",
            postal_code="62704",
            residential=True,
            instructions="Leave at front door",
        ),
        history=[
            HistoryEvent(
                at=datetime(2026, 1, 15, 9, 30, tzinfo=timezone.utc),
                action=Action.CREATED,
                actor="alice",
            ),
            HistoryEvent(
                at=datetime(2026, 3, 22, 14, 15, tzinfo=timezone.utc),
                action=Action.UPDATED,
                actor=42,
            ),
        ],
        variant="beta",
        nullable_note=None,
        timestamp=datetime(2026, 4, 9, 12, 0, tzinfo=timezone.utc),
        fixed_kind=FixedKind.PAYLOAD,
        score_matrix=[[1.0, 2.5], [3.0, 4.5], [5.0, 6.5]],
        manager=Manager(
            name="Bob Smith",
            email="bob@example.com",
            department="Engineering",
            reports=8,
        ),
    )


def _read_fixture() -> str:
    fixture_path = (
        Path(__file__).parent
        / ".."
        / ".."
        / "definitions"
        / "json-schema-features-payload.json"
    )
    return fixture_path.read_text()


def test_json_schema_features_round_trip() -> None:
    payload = _build_payload()

    # Serialize, parse both sides, normalize, compare.
    actual = normalize(json.loads(payload.model_dump_json(by_alias=True)))
    expected = normalize(json.loads(_read_fixture()))
    assert actual == expected


def test_json_schema_features_deserialize() -> None:
    # Deserialize fixture JSON and compare against the same payload.
    deserialized = JSONSchemaFeaturesPayload.model_validate_json(_read_fixture())
    assert deserialized == _build_payload()


def normalize(obj: Any) -> Any:
    """Strip None values"""
    if obj is None:
        return None  # caller strips from dict
    if isinstance(obj, dict):
        return {k: normalize(v) for k, v in obj.items() if v is not None}
    return obj
