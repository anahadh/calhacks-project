"""HTTP + WebSocket transport contract, including cached-stream == same result."""

import pytest
from fastapi.testclient import TestClient

from sim_core.api import create_app
from sim_core.replay import replay
from sim_core.schema import (
    Account,
    Campaign,
    Domain,
    Event,
    HostProfile,
    Link,
    Node,
    Plan,
    ReplayResult,
    Scenario,
)


def case():
    scenario = Scenario(
        scenario_id="invented-api",
        snapshot_date="2030-01-01",
        nodes=[
            Node(id="entry", dept="clinical", org="invented-org", domain="d", kind="ws", mail_client=True,
                 host=HostProfile(os_family="windows", domain_joined=True)),
            Node(id="target", dept="servers", org="invented-org", domain="d", kind="srv",
                 host=HostProfile(os_family="windows", domain_joined=True)),
        ],
        links=[Link(a="entry", b="target")],
        domains=[Domain(id="d")],
        accounts=[Account(id="admin", domain="d", tier="administrator", admin_to=["target"], sessions_on=["entry"])],
    )
    campaign = Campaign(campaign_id="invented-api", events=[
        Event(t="2030-01-02T09:00:00", order=0, rule="R1", target="entry", mode="phishing"),
        Event(t="2030-01-02T09:00:00", order=1, rule="tick", budget=5),
        Event(t="2030-01-02T11:00:00", order=0, rule="R6"),
    ])
    return scenario, campaign


def body(scenario, campaign, plan=None):
    payload = {"scenario": scenario.model_dump(mode="json"), "campaign": campaign.model_dump(mode="json")}
    if plan is not None:
        payload["plan"] = plan.model_dump(mode="json")
    return payload


def test_post_replay_returns_result_and_cache_headers(tmp_path):
    scenario, campaign = case()
    client = TestClient(create_app(tmp_path))
    first = client.post("/replay", json=body(scenario, campaign))
    assert first.status_code == 200
    assert first.headers["X-Cache"] == "miss"
    # HTTP body is byte-identical to a direct in-process replay.
    assert first.text == replay(scenario, campaign).model_dump_json()
    assert first.headers["X-Cache-Key"] == ReplayResult.model_validate_json(first.text).cache_key
    second = client.post("/replay", json=body(scenario, campaign))
    assert second.headers["X-Cache"] == "hit"
    assert second.text == first.text


def test_websocket_stream_reconstructs_the_same_result(tmp_path):
    scenario, campaign = case()
    client = TestClient(create_app(tmp_path))
    posted = client.post("/replay", json=body(scenario, campaign))
    key = posted.headers["X-Cache-Key"]

    rebuilt = {"cache_key": key, "trace": [], "services": [], "event_effects": [], "levels": {}, "summary": {}}
    with client.websocket_connect(f"/replay/{key}/trace") as ws:
        while True:
            msg = ws.receive_json()
            kind = msg["kind"]
            if kind == "trace":
                rebuilt["trace"].append(msg["entry"])
            elif kind == "service_frame":
                rebuilt["services"].append(msg["frame"])
            elif kind == "event_effect":
                rebuilt["event_effects"].append(msg["effect"])
            elif kind == "summary":
                rebuilt["levels"] = msg["levels"]
                rebuilt["summary"] = msg["summary"]
                rebuilt["cache_key"] = msg["cache_key"]
                break
    reassembled = ReplayResult.model_validate(rebuilt)
    assert reassembled.model_dump_json() == posted.text


def test_websocket_unknown_key_errors_and_closes(tmp_path):
    client = TestClient(create_app(tmp_path))
    with client.websocket_connect(f"/replay/{'a' * 64}/trace") as ws:
        msg = ws.receive_json()
    assert msg == {"kind": "error", "detail": "no cached replay for this key"}


def test_websocket_invalid_key_shape_is_rejected(tmp_path):
    client = TestClient(create_app(tmp_path))
    with client.websocket_connect("/replay/not-a-valid-key/trace") as ws:
        msg = ws.receive_json()
    assert msg["kind"] == "error" and "invalid" in msg["detail"]


def test_server_owned_identifiers(tmp_path):
    scenario, campaign = case()
    client = TestClient(create_app(tmp_path, scenarios={"cuh": scenario}, campaigns={"c": campaign}))
    resp = client.post("/replay", json={"scenario_id": "cuh", "campaign_id": "c"})
    assert resp.status_code == 200
    assert resp.text == replay(scenario, campaign).model_dump_json()


def test_providing_both_inline_and_identifier_is_422(tmp_path):
    scenario, campaign = case()
    client = TestClient(create_app(tmp_path, scenarios={"cuh": scenario}))
    payload = body(scenario, campaign)
    payload["scenario_id"] = "cuh"
    resp = client.post("/replay", json=payload)
    assert resp.status_code == 422
    assert resp.json()["error"]["type"] == "resolution"


def test_unknown_identifier_is_404(tmp_path):
    scenario, campaign = case()
    client = TestClient(create_app(tmp_path, campaigns={"c": campaign}))
    resp = client.post("/replay", json={"scenario_id": "missing", "campaign_id": "c"})
    assert resp.status_code == 404


def test_oversized_body_is_413(tmp_path):
    scenario, campaign = case()
    client = TestClient(create_app(tmp_path, max_body_bytes=50))
    resp = client.post("/replay", json=body(scenario, campaign))
    assert resp.status_code == 413
    assert resp.json()["error"]["type"] == "body_too_large"


def test_too_many_nodes_is_413(tmp_path):
    scenario, campaign = case()
    client = TestClient(create_app(tmp_path, max_nodes=1))
    resp = client.post("/replay", json=body(scenario, campaign))
    assert resp.status_code == 413
    assert resp.json()["error"]["type"] == "too_many_nodes"


def test_malformed_scenario_is_422_not_500(tmp_path):
    scenario, campaign = case()
    client = TestClient(create_app(tmp_path))
    payload = body(scenario, campaign)
    del payload["scenario"]["domains"]  # required field
    resp = client.post("/replay", json=payload)
    assert resp.status_code == 422
    assert resp.json()["error"]["type"] == "invalid_request"


def test_fully_blocked_campaign_is_a_200_result_not_an_error(tmp_path):
    # A campaign the engine cannot advance is valid input: a 200 with blocked steps.
    scenario, _ = case()
    blocked = Campaign(campaign_id="blocked", events=[Event(t="2030-01-02T09:00:00", order=0, rule="R4", target="target")])
    client = TestClient(create_app(tmp_path))
    resp = client.post("/replay", json=body(scenario, blocked))
    assert resp.status_code == 200
    result = ReplayResult.model_validate_json(resp.text)
    assert result.summary["encrypted_hosts"] == []
    assert any(entry.status == "blocked" for entry in result.trace)


def test_demo_registry_serves_cuh_by_id(tmp_path):
    # The browser UI's live mode posts only the plan against server-owned IDs.
    client = TestClient(create_app(tmp_path, demo=True))
    resp = client.post("/replay", json={"scenario_id": "cuh", "campaign_id": "cuh-campaign", "plan": {"levers": []}})
    assert resp.status_code == 200
    result = ReplayResult.model_validate_json(resp.text)
    assert len(result.summary["encrypted_hosts"]) == 14  # undefended CUH


def test_cors_allows_the_dev_origin(tmp_path):
    client = TestClient(create_app(tmp_path))
    resp = client.get("/healthz", headers={"origin": "http://localhost:3000"})
    assert resp.headers.get("access-control-allow-origin") == "http://localhost:3000"


def _demo_hospital():
    import json
    from pathlib import Path
    return json.loads((Path(__file__).resolve().parents[2] / "data/hospitals/demo.json").read_text())["hospital"]


def test_app_run_executes_a_hospital_live(tmp_path):
    client = TestClient(create_app(tmp_path))
    resp = client.post("/app/run", json={"hospital": _demo_hospital(), "patient_zero": "mri_2"})
    assert resp.status_code == 200
    sim = resp.json()
    assert sum(d["infected"] for d in sim["devices"]) > 5
    assert sim["medicalDevicesEncrypted"] == 0
    assert len(sim["snapshots"]) == sim["finalTick"] + 1


def test_app_run_rejects_a_bad_patient_zero(tmp_path):
    client = TestClient(create_app(tmp_path))
    resp = client.post("/app/run", json={"hospital": _demo_hospital(), "patient_zero": "mri_1"})
    assert resp.status_code == 422
    assert resp.json()["error"]["type"] == "invalid_app_input"


def test_planner_endpoint_excludes_campaign(tmp_path):
    scenario, campaign = case()
    client = TestClient(create_app(tmp_path, scenarios={"cuh": scenario}))
    resp = client.get("/planner/scenario/cuh")
    assert resp.status_code == 200
    payload = resp.json()
    assert set(payload) == {"scenario", "plan_schema"}
    assert "campaign" not in payload
