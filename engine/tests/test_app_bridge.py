"""Bridge the live app's demo hospital onto the engine and back to RunResult."""

import json
from pathlib import Path

import pytest

from sim_core.app_bridge import run, run_result, run_session, to_run_result, to_scenario
from sim_core.schema import Level

ROOT = Path(__file__).resolve().parents[2]
DEMO = ROOT / "data" / "hospitals" / "demo.json"


def demo() -> dict:
    return json.loads(DEMO.read_text())["hospital"]


def test_demo_hospital_runs_from_the_mri_console_and_spreads():
    hospital = demo()
    result, bridge = run(hospital, "mri_2")

    # It spreads, and the MRI console being patient zero is allowed.
    assert len(result.summary["encrypted_hosts"]) > 1  # spreads past patient zero; the demo identity layer bounds how far
    # Vendor scanners never encrypt, even though the Windows console did.
    assert result.summary["medical_devices_encrypted"] == 0
    assert any("supplied identity layer" in note for note in bridge.notes)  # the demo carries its own accounts


def test_run_result_matches_the_agents_contract():
    hospital = demo()
    session = run_session(hospital, "mri_2")
    rr = to_run_result(session, hospital)

    assert set(rr) == {"ticks", "infectedCount", "infectedDevices", "servicesDown", "patientCounts", "protectedBroken", "removedFlows"}
    assert rr["infectedCount"] == len(rr["infectedDevices"]) > 0
    # the agents' tick axis is the visible run's tick axis
    assert rr["ticks"] == session["finalTick"]
    # servicesDown references real app service ids, and MRI imaging is hit.
    service_ids = {s["id"] for s in hospital["services"]}
    assert {s["id"] for s in rr["servicesDown"]} <= service_ids
    assert "svc_mri" in {s["id"] for s in rr["servicesDown"]}
    # Patient counts conserve the total patient population.
    assert sum(rr["patientCounts"].values()) == sum(g["count"] for g in hospital["patients"])
    # run_result is the same, reduced in one call
    assert run_result(hospital, "mri_2") == rr


def test_frames_are_contiguous_and_honest():
    session = run_session(demo(), "mri_2")
    frames = session["frames"]
    assert [f["tick"] for f in frames] == list(range(session["finalTick"] + 1))
    assert all("run" not in f for f in frames[1:]) and "run" in frames[0]
    # tick 0 lists every device/service/group; patient zero only, no self-attempt
    assert len(frames[0]["devices"]) == len(demo()["devices"])
    assert not any(a["from"] == a["to"] for f in frames for a in f["attempts"])
    # every successful attempt rides a real flow that joins from->to
    flows = {f["id"]: (f["from"], f["to"]) for f in demo()["flows"]}
    for f in frames:
        for a in f["attempts"]:
            if a["success"]:
                assert a["flowId"] in flows and {a["from"], a["to"]} == set(flows[a["flowId"]])


def test_a_diversion_names_the_room_it_targets():
    hospital = demo()
    session = run_session(hospital, "mri_2")
    rooms = {r["id"]: r["name"] for r in hospital["rooms"]}
    diversions = [e for f in session["frames"] for e in f["events"] if e["kind"] == "diversion"]
    assert diversions  # the ER group diverts at detonation on the demo
    for e in diversions:
        assert e["targetId"] in rooms and e["text"] == f"Ambulances diverted from {rooms[e['targetId']]}"


def test_a_policy_contains_the_attack_and_fizzles_at_the_cut():
    hospital = demo()
    policy = json.loads((ROOT / "agents/fixtures/candidates/cand_keep_scans.json").read_text())["policy"]
    base = run_session(hospital, "mri_2")
    kept = run_session(hospital, "mri_2", policy=policy)
    assert sum(d["infected"] for d in kept["devices"]) < sum(d["infected"] for d in base["devices"])
    assert kept["removedFlows"] and any(not a["success"] for a in kept["attempts"])  # a blocked attempt at the cut


def test_a_non_windows_medical_device_cannot_be_patient_zero():
    hospital = demo()
    # mri_1 is a linux scanner (no Windows console), so it can't originate a run.
    with pytest.raises(ValueError, match="executing Windows host"):
        run(hospital, "mri_1")


def test_run_session_emits_ui_rows_with_a_timeline():
    from sim_core.app_bridge import run_session

    session = run_session(demo(), "mri_2")
    assert session["patientZero"] == "mri_2"
    assert sum(d["infected"] for d in session["devices"]) > 1  # spreads past patient zero; the demo identity layer bounds how far
    assert any(s["down"] for s in session["services"])
    # a per-tick timeline the scene can animate
    assert len(session["attempts"]) > 0 and len(session["snapshots"]) == session["finalTick"] + 1
    assert len(session["frames"]) == session["finalTick"] + 1
    assert session["snapshots"][-1]["infectedCount"] >= session["snapshots"][0]["infectedCount"]
    # patient groups cover every group; medical scanners never encrypt
    assert {p["groupId"] for p in session["patients"]} == {g["id"] for g in demo()["patients"]}
    assert session["medicalDevicesEncrypted"] == 0


def test_a_supplied_identity_layer_is_used_verbatim():
    hospital = demo()
    hospital["accounts"] = [{"id": "H\\real", "domain": "H", "tier": "administrator", "admin_to": ["srv_dc"], "sessions_on": []}]
    bridge = to_scenario(hospital)
    assert [a.id for a in bridge.scenario.accounts] == ["H\\real"]
    assert any("supplied identity layer" in note for note in bridge.notes)
