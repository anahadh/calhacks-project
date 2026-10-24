"""The planner-facing boundary: canonical scenario out, plan in, nothing else.

A planner may see only the serialized canonical ``Scenario`` and the JSON schema of
``Plan``. It must never receive the ``Campaign``, ground truth, research results, or
a cache key derived from the campaign — campaign selection is server-owned. In the
other direction, a scenario upload that embeds a campaign or an ``expected`` block
is rejected outright, not stripped and partially retained, so a held-out answer can
never ride in through the planner surface.
"""

from __future__ import annotations

import json

from .schema import Plan, Scenario

# Top-level keys that belong to the server-owned replay/ground-truth side and must
# never appear in a planner-visible scenario upload. Presence is a hard rejection.
SERVER_OWNED_KEYS = ("campaign", "expected", "ground_truth", "steps", "historical_defender_actions", "cache_key", "outcomes")


class PlannerBoundaryError(ValueError):
    """A planner-visible payload tried to carry server-owned/ground-truth data."""


def guard_scenario_upload(data: object) -> None:
    if not isinstance(data, dict):
        raise PlannerBoundaryError("scenario upload must be a JSON object")
    embedded = sorted(key for key in SERVER_OWNED_KEYS if key in data)
    if embedded:
        raise PlannerBoundaryError(f"scenario upload embeds server-owned fields {embedded}; rejected, not stripped")


def parse_scenario_upload(raw: str | bytes | dict) -> Scenario:
    """Validate a planner-side scenario upload. Rejects embedded campaign/expected."""
    data = raw if isinstance(raw, dict) else json.loads(raw)
    guard_scenario_upload(data)
    # Strict model still forbids any other extra field; the guard only gives the
    # leakage-specific keys a precise, non-generic error first.
    return Scenario.model_validate(data)


def planner_scenario_payload(scenario: Scenario) -> dict:
    """Everything a planner is allowed to see: the scenario and the Plan schema."""
    return {"scenario": scenario.model_dump(mode="json"), "plan_schema": Plan.model_json_schema()}


__all__ = ["SERVER_OWNED_KEYS", "PlannerBoundaryError", "guard_scenario_upload", "parse_scenario_upload", "planner_scenario_payload"]
