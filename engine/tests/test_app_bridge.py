"""Bridge the live app's demo hospital onto the engine and back to RunResult."""

import json
from pathlib import Path

import pytest

from sim_core.app_bridge import run, to_run_result, to_scenario
from sim_core.schema import Level

ROOT = Path(__file__).resolve().parents[2]
DEMO = ROOT / "data" / "hospitals" / "demo.json"


def demo() -> dict:
    return json.loads(DEMO.read_text())["hospital"]


def test_demo_hospital_runs_from_the_mri_console_and_spreads():
    hospital = demo()
    result, bridge = run(hospital, "mri_2")

    # It spreads, and the MRI console being patient zero is allowed.
    assert len(result.summary["encrypted_hosts"]) > 5
    # Vendor scanners never encrypt, even though the Windows console did.
    assert result.summary["medical_devices_encrypted"] == 0
    assert any("synthesized" in note for note in bridge.notes)  # identity layer disclosed


def test_run_result_matches_the_agents_contract():
    hospital = demo()
    result, bridge = run(hospital, "mri_2")
    rr = to_run_result(hospital, result, bridge)

    assert set(rr) == {"ticks", "infectedCount", "infectedDevices", "servicesDown", "patientCounts", "protectedBroken", "removedFlows"}
    assert rr["infectedCount"] == len(rr["infectedDevices"]) > 0
    # servicesDown references real app service ids, and MRI imaging is hit.
    service_ids = {s["id"] for s in hospital["services"]}
    assert {s["id"] for s in rr["servicesDown"]} <= service_ids
    assert "svc_mri" in {s["id"] for s in rr["servicesDown"]}
    # Patient counts conserve the total patient population.
    assert sum(rr["patientCounts"].values()) == sum(g["count"] for g in hospital["patients"])


def test_a_non_windows_medical_device_cannot_be_patient_zero():
    hospital = demo()
    # mri_1 is a linux scanner (no Windows console), so it can't originate a run.
    with pytest.raises(ValueError, match="executing Windows host"):
        run(hospital, "mri_1")


def test_a_supplied_identity_layer_is_used_verbatim():
    hospital = demo()
    hospital["accounts"] = [{"id": "H\\real", "domain": "H", "tier": "administrator", "admin_to": ["srv_dc"], "sessions_on": []}]
    bridge = to_scenario(hospital)
    assert [a.id for a in bridge.scenario.accounts] == ["H\\real"]
    assert any("supplied identity layer" in note for note in bridge.notes)
