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
        assert all(H.flows[f]["protected"] for f in r.protectedBroken), path.name
    for path in sorted((tools.FIXTURES / "candidates").glob("*.json")):
        c = Candidate.parse_file(path)
        assert c.id == path.stem and (tools.FIXTURES / "results" / f"{c.id}.json").exists()


def test_relay_writes_jsonl_rows(tmp_path, capsys):
    v = Verdict(sessionId="s1", round=1, policyId="cand_keep_scans", agent="clinical_workflow", decision="accept", reason="[reason]")
    run(tools.relay.post("s1", 1, "clinical_workflow", "coordinator", "verdict", v, v.reason))
    run(tools.relay.post("s1", 1, "clinical_workflow", "coordinator", "verdict", v, v.reason, direction="received"))
    run(tools.relay.status("s1", "clinical_workflow", "idle"))
    rows = [json.loads(line) for line in (tmp_path / "s1.jsonl").read_text().splitlines()]
    assert [r["table"] for r in rows] == ["agent_message", "agent_message", "agent_status"]
    m = rows[0]
    assert set(m) == {"table", "sessionId", "round", "seq", "from", "to", "type", "payload", "reason", "createdAt", "direction", "fixture"}
    assert (m["seq"], rows[1]["seq"]) == (1, 2)
    assert m["payload"]["decision"] == "accept" and m["reason"] == "[reason]" and m["fixture"] is True
    assert set(rows[2]) == {"table", "sessionId", "agent", "status", "updatedAt", "fixture"}
    out = capsys.readouterr().out.splitlines()
    assert len(out) == 1 and "ACCEPT cand_keep_scans" in out[0]  # sent lines print; received don't
    with pytest.raises(AssertionError):
        run(tools.relay.status("s1", "flow", "approved"))
