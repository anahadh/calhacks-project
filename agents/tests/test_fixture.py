import json
from pathlib import Path

import pytest

FIXTURE = Path(__file__).parent.parent / "fixtures" / "hospital.json"


@pytest.fixture(scope="module")
def hospital():
    data = json.loads(FIXTURE.read_text())
    assert data["schemaVersion"] == 1
    return data["hospital"]


def test_loads(hospital):
    for key in ("floors", "rooms", "devices", "flows", "services", "patients"):
        assert hospital[key], key


def test_ids_are_unique(hospital):
    for key in ("floors", "rooms", "devices", "flows", "services"):
        ids = [x["id"] for x in hospital[key]]
        assert len(ids) == len(set(ids)), key


def test_flows_reference_existing_devices(hospital):
    devices = {d["id"] for d in hospital["devices"]}
    for f in hospital["flows"]:
        assert f["from"] in devices, f["id"]
        assert f["to"] in devices, f["id"]
        assert f["from"] != f["to"], f["id"]


def test_other_references_exist(hospital):
    floors = {f["id"] for f in hospital["floors"]}
    rooms = {r["id"] for r in hospital["rooms"]}
    devices = {d["id"] for d in hospital["devices"]}
    services = {s["id"] for s in hospital["services"]}
    assert all(r["floorId"] in floors for r in hospital["rooms"])
    assert all(d["roomId"] in rooms for d in hospital["devices"])
    assert all(set(s["dependsOnDevices"]) <= devices for s in hospital["services"])
    assert all(g["roomId"] in rooms for g in hospital["patients"])
    assert all(set(g["dependsOnServices"]) <= services for g in hospital["patients"])


def test_one_unidentified_device_in_imaging(hospital):
    rooms = {r["id"]: r for r in hospital["rooms"]}
    unknown = [d for d in hospital["devices"] if d["type"] == "unknown"]
    assert [d["id"] for d in unknown] == ["dev_unknown_7"]
    dev = unknown[0]
    assert rooms[dev["roomId"]]["type"] == "imaging"
    assert dev["vulnerable"] is True and dev["criticality"] == "medium"
    flows = [f for f in hospital["flows"] if "dev_unknown_7" in (f["from"], f["to"])]
    assert len(flows) == 1
    assert flows[0]["protocol"] == "smb"
    other = flows[0]["to"] if flows[0]["from"] == "dev_unknown_7" else flows[0]["from"]
    peer = next(d for d in hospital["devices"] if d["id"] == other)
    assert peer["type"] == "workstation" and rooms[peer["roomId"]]["type"] == "imaging"


def test_synthetic_patients_are_counts(hospital):
    allowed = {"id", "roomId", "type", "count", "dependsOnServices"}
    for g in hospital["patients"]:
        assert set(g) <= allowed
