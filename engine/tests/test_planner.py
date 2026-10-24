"""Planner boundary: canonical scenario + Plan schema only; reject held-out data."""

import json
from pathlib import Path

import pytest

from sim_core.adapters import load_cuh
from sim_core.planner import (
    PlannerBoundaryError,
    guard_scenario_upload,
    parse_scenario_upload,
    planner_scenario_payload,
)

ROOT = Path(__file__).resolve().parents[2]
CUH = ROOT / "claude_instructions/data/scenarios/cuh_hospital.json"
BL = ROOT / "claude_instructions/data/scenarios/british_library_2023.json"


def test_payload_exposes_only_scenario_and_plan_schema():
    payload = planner_scenario_payload(load_cuh(CUH))
    assert set(payload) == {"scenario", "plan_schema"}
    assert "levers" in payload["plan_schema"]["properties"]
    # No campaign, ground truth, or campaign-derived cache key may leak.
    assert "campaign" not in payload and "cache_key" not in payload
    assert "cache_key" not in payload["scenario"]


def test_clean_canonical_scenario_round_trips():
    canonical = load_cuh(CUH).model_dump(mode="json")
    scenario = parse_scenario_upload(canonical)
    assert scenario.scenario_id == "cuh_hospital"


def test_real_british_library_upload_is_rejected_for_embedded_campaign_and_expected():
    with pytest.raises(PlannerBoundaryError) as exc:
        parse_scenario_upload(BL.read_text())
    message = str(exc.value)
    assert "campaign" in message and "expected" in message


@pytest.mark.parametrize("field", ["campaign", "expected", "ground_truth", "historical_defender_actions"])
def test_each_server_owned_field_is_rejected_not_stripped(field):
    with pytest.raises(PlannerBoundaryError, match=field):
        guard_scenario_upload({"scenario_id": "x", field: {"anything": 1}})


def test_unknown_extra_field_still_fails_strictly():
    canonical = load_cuh(CUH).model_dump(mode="json")
    canonical["surprise"] = True
    with pytest.raises(Exception):  # pydantic ValidationError: extra_forbidden
        parse_scenario_upload(canonical)
