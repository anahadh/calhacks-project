"""Content-addressed store for complete replay results.

The filename is ``replay.fingerprint`` (scenario + campaign + plan + rules
version), never scenario or plan alone, so a cached trace can never be served
for a different campaign. Writes go through a temp file and an atomic
``os.replace``; reads validate the bytes as a whole ``ReplayResult`` before
returning, so a truncated, foreign or stale-schema file is a cache miss rather
than a corrupt replay. The complete result is stored, so an offline reader
never recomputes a different trace.
"""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

from pydantic import ValidationError

from .replay import RULES_VERSION, fingerprint, replay
from .schema import Campaign, Plan, ReplayResult, Scenario


def cache_path(cache_dir: Path | str, key: str) -> Path:
    if not key or any(sep in key for sep in ("/", "\\", "..")) or not key.isalnum():
        # fingerprint() is a hex digest; anything else is not a valid cache key.
        raise ValueError(f"invalid cache key: {key!r}")
    return Path(cache_dir) / f"{key}.json"


def store(cache_dir: Path | str, result: ReplayResult) -> Path:
    """Persist a complete result atomically under its own cache key."""
    directory = Path(cache_dir)
    directory.mkdir(parents=True, exist_ok=True)
    path = cache_path(directory, result.cache_key)
    payload = result.model_dump_json()
    handle, tmp = tempfile.mkstemp(dir=directory, prefix=".tmp-", suffix=".json")
    try:
        with os.fdopen(handle, "w", encoding="utf-8") as stream:
            stream.write(payload)
        os.replace(tmp, path)
    except BaseException:
        Path(tmp).unlink(missing_ok=True)
        raise
    return path


def load(cache_dir: Path | str, key: str) -> ReplayResult | None:
    """Return the cached result, or None on any miss/corruption/key mismatch."""
    path = cache_path(cache_dir, key)
    if not path.is_file():
        return None
    try:
        result = ReplayResult.model_validate_json(path.read_text(encoding="utf-8"))
    except (ValidationError, ValueError, OSError):
        return None
    # A file whose stored key disagrees with its name is not trustworthy.
    if result.cache_key != key:
        return None
    return result


def load_or_compute(cache_dir: Path | str, scenario: Scenario, campaign: Campaign, plan: Plan | None = None) -> tuple[ReplayResult, bool]:
    """Return (result, cached). A hit never recomputes; a miss stores before returning."""
    plan = plan or Plan()
    key = fingerprint(scenario, campaign, plan)
    hit = load(cache_dir, key)
    if hit is not None:
        return hit, True
    result = replay(scenario, campaign, plan)
    store(cache_dir, result)
    return result, False


__all__ = ["RULES_VERSION", "cache_path", "store", "load", "load_or_compute"]
