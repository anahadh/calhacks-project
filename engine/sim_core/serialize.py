"""One canonical JSON form for replay outputs, shared by every transport.

The CLI's stdout, the cache file, the HTTP response body and the reassembled
WebSocket stream must all be byte-identical for identical inputs. That canonical
form is ``ReplayResult.model_dump_json()``: Pydantic emits fields in declared
order, and sets only reach replay output after being ``sorted()``, so the bytes
are stable across processes and hash seeds. No transport re-derives a trace; they
all serialize the same model, so none can disagree about the result.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel

from .replay import canonical_json
from .schema import ReplayResult

CONTENT_TYPE = "application/json"


def result_bytes(result: ReplayResult) -> str:
    """The canonical serialization every transport must reproduce exactly."""
    return result.model_dump_json()


def _plain(value: Any) -> Any:
    """Recursively turn Pydantic models into JSON-ready plain data."""
    if isinstance(value, BaseModel):
        return value.model_dump(mode="json")
    if isinstance(value, dict):
        return {key: _plain(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_plain(item) for item in value]
    return value


def comparison_bytes(comparison: dict[str, Any]) -> str:
    """Serialize a ``compare_plan`` bundle, whose values include ReplayResult models.

    ``json.dumps`` on the raw bundle raises because baseline/defended are models;
    key-sorted canonical JSON keeps the output deterministic across processes.
    """
    return canonical_json(_plain(comparison))
