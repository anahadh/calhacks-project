"""mcp_server.py: the hospital and the simulator as MCP tools, listed and called over an
in-process MCP client session. No network."""

import asyncio

import mcp_server
from logic import hospital as hospital_mod
from logic.inventory import dormant

H = hospital_mod.load()


def run(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


def tools():
    return {t.name: t for t in run(mcp_server.as_brain_tools())}


def test_tools_are_listed_over_mcp_with_schemas():
    t = tools()
    assert set(t) == {"list_devices", "lookup_device", "protected_flows", "test_run"}
    assert "query" in t["lookup_device"].parameters["properties"]
    assert t["lookup_device"].description.strip()


def test_list_devices_excludes_dormant():
    out = run(tools()["list_devices"].call({}))
    ids = {d["id"] for d in out}
    assert "mri_2" in ids and not any(dormant(H, i) for i in ids)
    assert {"id", "name", "zone", "type"} <= set(out[0])


def test_lookup_by_name_and_id_and_unknown():
    look = tools()["lookup_device"]
    assert run(look.call({"query": "MRI 2"}))["id"] == "mri_2"
    assert run(look.call({"query": "mri2"}))["id"] == "mri_2"
    assert "error" in run(look.call({"query": "toaster"}))
    assert isinstance(run(look.call({"query": "MRI 2"}))["flows_out"], list)


def test_protected_flows_have_names():
    out = run(tools()["protected_flows"].call({}))
    assert out and all({"id", "from", "to", "purpose"} <= set(f) for f in out)
    assert all(H.flows[f["id"]]["protected"] for f in out)


def test_test_run_parity_with_run_sim(monkeypatch):
    monkeypatch.setenv("HIPPO_SIM_FIXTURES", "1")
    from chat import DEMO_SEED
    from tools import run_sim
    want = run_sim(None, "mri_2", DEMO_SEED, []).dict()
    got = run(tools()["test_run"].call({"patient_zero": "mri_2"}))
    assert got["infectedCount"] == want["infectedCount"] and got["ticks"] == want["ticks"]


def test_test_run_error_is_returned_not_raised(monkeypatch):
    monkeypatch.setenv("HIPPO_SIM_FIXTURES", "1")
    assert "error" in run(tools()["test_run"].call({"patient_zero": "ct_1"}))
    assert "error" in run(tools()["test_run"].call({"patient_zero": "mri_2", "policy": {"bad": 1}}))
