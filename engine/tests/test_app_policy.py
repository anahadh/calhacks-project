"""The agents-Policy adapter (sim_core.app_policy): a port of the retired sim-core
policy.ts. These cases pin it to the agents' own fixtures — the removed and
protected-broken flows the three candidate policies produce on the demo hospital —
so the engine and the agents agree on what a plan cuts, without importing agent code.
"""

import json
from pathlib import Path

import pytest

from sim_core.app_policy import PolicyError, apply_policy, parse_policy

ROOT = Path(__file__).resolve().parents[2]
DEMO = ROOT / "data" / "hospitals" / "demo.json"


def demo() -> dict:
    return json.loads(DEMO.read_text())["hospital"]


def _candidate(name: str) -> dict:
    return json.loads((ROOT / "agents/fixtures/candidates" / f"{name}.json").read_text())["policy"]


def _expected(name: str) -> dict:
    return json.loads((ROOT / "agents/fixtures/results" / f"{name}.json").read_text())


def test_no_policy_keeps_every_active_flow():
    hospital = demo()
    applied = apply_policy(hospital, None)
    active = [f for f in hospital["flows"] if f.get("active") is not False]
    assert len(applied.hospital["flows"]) == len(active)
    assert applied.removed_flows == [] and applied.protected_broken == []


@pytest.mark.parametrize("name", ["cand_isolate_imaging", "cand_keep_scans", "cand_unknown_cut"])
def test_candidate_cuts_match_the_agents_fixtures(name):
    hospital = demo()
    applied = apply_policy(hospital, _candidate(name))
    exp = _expected(name)
    assert sorted(applied.removed_flows) == sorted(exp["removedFlows"])
    assert sorted(applied.protected_broken) == sorted(exp["protectedBroken"])
    # removed ∩ kept is empty, and order is hospital file order
    kept = {f["id"] for f in applied.hospital["flows"]}
    assert kept.isdisjoint(applied.removed_flows)
    assert applied.protected_broken == [f for f in applied.removed_flows if f in set(applied.protected_broken)]


def test_unknown_selector_value_is_rejected():
    hospital = demo()
    bad = {"strategy": "least_disruption", "name": "x",
           "rules": [{"id": "r1", "from": {"zone": "no_such_zone"}, "to": {}, "plain": "p"}],
           "rationale": "", "tradeoff": ""}
    with pytest.raises(PolicyError, match="unknown zone"):
        apply_policy(hospital, bad)


def test_fastest_deploy_may_select_only_by_vlan_and_port():
    bad = {"strategy": "fastest_deploy", "name": "x",
           "rules": [{"id": "r1", "from": {"zone": "imaging"}, "to": {}, "plain": "p"}],
           "rationale": "", "tradeoff": ""}
    with pytest.raises(PolicyError):
        parse_policy(bad)


def test_unsupported_challenge_is_rejected():
    with pytest.raises(PolicyError, match="unsupported challenge"):
        apply_policy(demo(), None, challenges=["asteroid"])


def test_unknown_device_imaging_activates_the_inactive_flow():
    # The agents' hospital carries dev_unknown_7 with an inactive SMB flow; the
    # challenge switches it on (sim-core extraActiveFlowIds).
    raw = json.loads((ROOT / "agents/fixtures/hospital.json").read_text())
    hospital = raw.get("hospital", raw)
    if not any(d.get("type") == "unknown" for d in hospital["devices"]):
        pytest.skip("this hospital has no unknown device")
    base = apply_policy(hospital, None)
    with_challenge = apply_policy(hospital, None, challenges=["unknown_device_imaging"])
    assert len(with_challenge.hospital["flows"]) > len(base.hospital["flows"])
