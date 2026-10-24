"""Config, addresses and local resolution, tools, and the relay. No network."""

import asyncio
import json

import pytest

import addresses
import config
import tools
from protocol import Candidate, RunResult, Verdict

def run(coro):
    """Run on a private loop. run() would clear the current loop, and Agent()
    needs one at construction (AGENT_NOTES.md, "Event loops in tests")."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


SEEDS = {var: f"test seed for {agent}" for agent, var in config.SEED_VARS.items()}


@pytest.fixture(autouse=True)
def env(monkeypatch, tmp_path):
    for var, value in SEEDS.items():
        monkeypatch.setenv(var, value)
    for var in ("WATCHER_RELAY_URL", "RELAY_TOKEN", "HIPPO_SIM_BIN", "HIPPO_OPT_BIN"):
        monkeypatch.setenv(var, "")
    monkeypatch.setenv("HIPPO_SIM_FIXTURES", "1")
    monkeypatch.setenv("LOCAL_RESOLVE", "1")
    monkeypatch.setenv("AGENT_MAILBOX", "0")
    monkeypatch.setenv("RELAY_LOG_DIR", str(tmp_path))
    addresses.address.cache_clear()
    yield
    addresses.address.cache_clear()


def test_settings_defaults_and_errors(monkeypatch):
    monkeypatch.delenv("LOCAL_RESOLVE")
    monkeypatch.delenv("AGENT_MAILBOX")
    s = config.settings()
    assert s.local_resolve is True and s.mailbox is False and s.hippo_sim_fixtures is True
    monkeypatch.setenv("AGENT_MAILBOX", "yes")
    with pytest.raises(config.ConfigError, match="AGENT_MAILBOX must be 0 or 1"):
        config.settings()
    monkeypatch.setenv("AGENT_MAILBOX", "0")
    monkeypatch.setenv("WATCHER_RELAY_URL", "http://127.0.0.1:9")
    with pytest.raises(config.ConfigError, match="RELAY_TOKEN"):
        config.settings()
    monkeypatch.setenv("FLOW_AGENT_SEED", "")
    with pytest.raises(config.ConfigError, match="FLOW_AGENT_SEED is not set"):
        config.seed("flow")


def test_local_resolver_maps_every_address_to_its_port():
    resolver = addresses.local_resolver()
    for agent in config.AGENTS:
        addr, endpoints = run(resolver.resolve(addresses.address(agent)))
        assert addr == addresses.address(agent)
        assert endpoints == [f"http://127.0.0.1:{config.PORTS[agent]}/submit"]
    assert run(resolver.resolve("agent1qunknown"))[1] == []  # unknown → no endpoint, send fails


def test_make_agent_uses_local_resolution():
    import runtime

    # The private method LocalAgent overrides must still exist in uagents.
    assert hasattr(runtime.Agent, "_update_agent_status")
    agent, protocol = runtime.make_agent("flow")
    assert isinstance(agent, runtime.LocalAgent)
    assert agent.address == addresses.address("flow")
    assert agent._resolver.__class__.__name__ == "RulesBasedResolver"
    assert isinstance(agent._registration_policy, runtime.NoRegistration)
    assert [e.url for e in agent._endpoints] == ["http://127.0.0.1:8002/submit"]
    assert agent.mailbox_client is None


def test_run_sim_fixtures_and_errors(monkeypatch):
    base = tools.run_sim(None, "mri_2", 1337)
    assert isinstance(base, RunResult) and base.removedFlows == []
    cand = Candidate.parse_file(tools.FIXTURES / "candidates" / "cand_keep_scans.json")
    assert tools.run_sim(cand, "mri_2", 1337).removedFlows == ["fl_8", "fl_9", "fl_10"]
    with pytest.raises(tools.ToolError, match="no fixture"):
        tools.run_sim(cand, "mri_2", 1337, ["vendor_link_mri3"])
    monkeypatch.setenv("HIPPO_SIM_FIXTURES", "0")
    with pytest.raises(tools.ToolError, match="No simulator"):
        tools.run_sim(None, "mri_2", 1337)
    monkeypatch.setenv("HIPPO_SIM_BIN", "/nonexistent/hippo-sim")
    with pytest.raises(tools.ToolError, match="failed to run"):
        tools.run_sim(None, "mri_2", 1337)


def test_optimize_falls_back_to_fixture_candidates():
    cands = tools.optimize({}, tools.run_sim(None, "mri_2", 1337), [])
    assert [c.id for c in cands] == ["cand_isolate_imaging", "cand_keep_scans", "cand_unknown_cut"]


def test_runtime_fixtures_are_consistent():
    """Every runtime result: a service is down while any device it depends on is infected."""
    from logic import hospital as hospital_mod

    H = hospital_mod.load()
    total = sum(g["count"] for g in json.loads((tools.FIXTURES / "hospital.json").read_text())["hospital"]["patients"])
    for path in sorted((tools.FIXTURES / "results").glob("*.json")):
        r = RunResult.parse_file(path)
        infected = {d.id: d.tick for d in r.infectedDevices}
        assert r.infectedCount == len(infected), path.name
        assert sum(r.patientCounts.dict().values()) == total, path.name
        down = {s.id: s for s in r.servicesDown}
        for sid, svc in H.services.items():
            ticks = [infected[d] for d in svc["dependsOnDevices"] if d in infected]
            assert (sid in down) == bool(ticks), (path.name, sid)
            if ticks:
                assert down[sid].downSinceTick == min(ticks) and down[sid].ticksDown == r.ticks - min(ticks), (path.name, sid)
        assert set(r.protectedBroken) <= set(r.removedFlows), path.name
        if "@unknown_device_imaging" not in path.name:  # inactive flows aren't on the network to remove
            assert all(H.flows[f].get("active", True) for f in r.removedFlows), path.name
            assert "dev_unknown_7" not in infected, path.name
        assert all(H.flows[f]["protected"] for f in r.protectedBroken), path.name
    for path in sorted((tools.FIXTURES / "candidates").glob("*.json")):
        c = Candidate.parse_file(path)
        assert c.id == path.stem and (tools.FIXTURES / "results" / f"{c.id}.json").exists()


def test_relay_writes_jsonl_rows(tmp_path, capsys):
    v = Verdict(sessionId="s1", round=1, policyId="cand_keep_scans", agent="clinical_workflow", decision="accept", reason="[reason]")
    run(tools.relay.post("s1", 1, "clinical_workflow", "coordinator", "verdict", v, v.reason, reason_source="template"))
    run(tools.relay.post("s1", 1, "clinical_workflow", "coordinator", "verdict", v, v.reason, direction="received"))
    run(tools.relay.status("s1", "clinical_workflow", "idle"))
    rows = [json.loads(line) for line in (tmp_path / "s1.jsonl").read_text().splitlines()]
    assert [r["table"] for r in rows] == ["agent_message", "agent_message", "agent_status"]
    m = rows[0]
    assert set(m) == {"table", "sessionId", "round", "seq", "from", "to", "type", "payload", "reason", "reasonSource",
                      "createdAt", "direction", "fixture"}
    assert (m["seq"], rows[1]["seq"]) == (1, 2)
    assert m["payload"]["decision"] == "accept" and m["reason"] == "[reason]" and m["fixture"] is True
    assert set(rows[2]) == {"table", "sessionId", "agent", "status", "updatedAt", "fixture"}
    out = capsys.readouterr().out.splitlines()
    printed = [line for line in out if line.startswith("#")]
    assert len(printed) == 1 and "ACCEPT cand_keep_scans" in printed[0]  # sent lines print; received don't
    assert "“[reason]” (template)" in out[1]  # the worded reason, labeled with who wrote it
    with pytest.raises(AssertionError):
        run(tools.relay.status("s1", "flow", "approved"))


# --- mailbox mode, profiles, /health, AGENTVERSE_API_KEY ---


def _asgi_get(agent, path):
    """GET a path from the agent's own ASGI server, the way uAgents' tests do."""
    from unittest.mock import AsyncMock, patch

    send = AsyncMock()
    with patch("uagents.asgi._read_asgi_body", return_value=b""):
        agent._loop.run_until_complete(agent._server(
            scope={"type": "http", "method": "GET", "path": path, "client": ("127.0.0.1", 1)}, receive=None, send=send))
    start, payload = (c.args[0] for c in send.call_args_list)
    return start["status"], json.loads(payload["body"])


@pytest.mark.parametrize("name", config.AGENTS)
def test_mailbox_agents_keep_their_local_server(monkeypatch, name):
    import runtime

    monkeypatch.setenv("AGENT_MAILBOX", "1")
    agent, _ = runtime.make_agent(name)
    assert agent.mailbox_client is not None  # an Agentverse mailbox...
    assert type(agent) is runtime.Agent and not isinstance(agent, runtime.LocalAgent)  # ...and real registration
    assert isinstance(agent._resolver, addresses.LocalFirstResolver)  # ...but the other three stay local
    # run_async() drops the local server only for a mailbox agent with no REST handlers.
    assert ("GET", "/health") in agent._rest_handlers
    # uAgents dispatches REST by address through one process-wide dispatcher, so an earlier
    # test's agent with the same seed could answer the ASGI call: ask this agent directly.
    body = agent._loop.run_until_complete(agent.handle_rest("GET", "/health", None))
    assert body.dict() == {"agent": name, "address": agent.address, "mailbox": True, "localResolve": True}
    status, _ = _asgi_get(agent, "/health")  # and the local server routes /health
    assert status == 200


@pytest.mark.parametrize("name", config.AGENTS)
def test_profiles(name):
    import runtime

    agent, _ = runtime.make_agent(name)
    p = runtime.PROFILES[name]
    assert agent.name == p.name and p.handle == f"hippocratech-{name.replace('_', '-')}"
    assert agent._handle == p.handle and agent._description == p.description and agent._publish_agent_details
    # Agentverse refuses the mailbox connect when these are over its limits.
    from uagents_core.registration import RegistrationRequest
    limit = lambda field: next(m.max_length for m in RegistrationRequest.model_fields[field].metadata if hasattr(m, "max_length"))
    assert len(p.name) <= limit("name") and len(p.handle) <= limit("handle"), (p.name, p.handle)
    readme = agent._readme
    for must in ("## Messages", "Code decides", "Claude (Anthropic) writes only", "## Humans decide", "synthetic"):
        assert must in readme, (name, must)
    assert not llm_forbidden(readme)
    if name == "coordinator":
        assert "ASI:One" in readme and "simulate ransomware from MRI 2" in readme


def llm_forbidden(text):
    import llm

    return llm.FORBIDDEN.findall(text.replace("not approval", "").replace("cannot approve", ""))


def test_local_first_resolver_falls_back_for_strangers():
    class Fallback(addresses.Resolver):
        async def resolve(self, destination):
            return destination, ["https://agentverse.example/mailbox"]

    r = addresses.LocalFirstResolver(addresses.local_rules(), Fallback())
    flow = addresses.address("flow")
    assert run(r.resolve(flow)) == (flow, ["http://127.0.0.1:8002/submit"])
    assert run(r.resolve("agent1qsomeoneonasione"))[1] == ["https://agentverse.example/mailbox"]


def test_local_peers(monkeypatch):
    monkeypatch.setenv("LOCAL_PEERS", "agent1qpeer=http://127.0.0.1:8010/submit")
    assert addresses.local_rules()["agent1qpeer"] == "http://127.0.0.1:8010/submit"
    monkeypatch.setenv("LOCAL_PEERS", "nonsense")
    with pytest.raises(config.ConfigError, match="LOCAL_PEERS"):
        config.settings()


def test_agentverse_api_key_connects_through_our_own_connect_endpoint(monkeypatch, caplog):
    import logging

    import runtime

    posts = []

    class FakeResponse:
        status_code = 200

        def json(self):
            return {"success": True, "detail": None}

    class FakeClient:
        def __init__(self, **kw):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def post(self, url, json):
            posts.append((url, json))
            return FakeResponse()

    monkeypatch.setattr(runtime.httpx, "AsyncClient", FakeClient)
    ctx = type("Ctx", (), {"logger": logging.getLogger("test-connect")})()
    with caplog.at_level(logging.INFO):
        assert run(runtime.connect_mailbox(ctx, "inventory", "av-secret-key")) is True
    assert posts == [("http://127.0.0.1:8001/connect", {"user_token": "av-secret-key", "agent_type": "mailbox"})]
    assert "av-secret-key" not in caplog.text


def test_api_key_hook_only_in_mailbox_mode(monkeypatch):
    import runtime

    monkeypatch.setenv("AGENTVERSE_API_KEY", "av-secret-key")
    local, _ = runtime.make_agent("flow")
    assert local._on_startup == []  # no mailbox: nothing to connect
    monkeypatch.setenv("AGENT_MAILBOX", "1")
    boxed, _ = runtime.make_agent("flow")
    assert [f.__name__ for f in boxed._on_startup] == ["connect"]


def test_fixtures_refuse_another_patient_zero():
    with pytest.raises(tools.ToolError, match="only for an attack starting at MRI 2"):
        tools.run_sim(None, "ct_1", 1337)
