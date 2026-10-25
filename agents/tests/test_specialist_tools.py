"""The specialists' chat tools answer from the state each agent keeps per session. No network."""

import asyncio
import json

from protocol import Candidate, Proposal, RunResult, Verdict
from tests_paths import FIXTURES

cand = RunResult.parse_file(FIXTURES / "results" / "cand_isolate_imaging.json")
base = RunResult.parse_file(FIXTURES / "results" / "baseline.json")


def run(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


def candidate() -> Candidate:
    return Candidate.parse_obj(json.loads((FIXTURES / "candidates" / "cand_isolate_imaging.json").read_text()))


def proposal(c: Candidate) -> Proposal:
    fields = c.policy.dict(include={"strategy", "name", "rules", "rationale", "tradeoff"})
    return Proposal(sessionId="s", round=1, policyId=c.id, testResult=cand, reason="Cuts the path.", **fields)


def test_clinical_remembers_judged_policies():
    import clinical_workflow as cw
    c = candidate()
    cw.remember("s", proposal(c), Verdict(sessionId="s", round=1, policyId=c.id, agent="clinical_workflow",
                                          decision="reject", reason="It cuts imaging."))
    t = {x.name: x for x in cw.tools()}
    last = run(t["last_verdict"].call({}))
    assert last["decision"] == "reject" and last["reason"] == "It cuts imaging." and last["round"] == 1
    broken = run(t["flows_broken_by"].call({"policy_name": c.policy.name}))
    assert isinstance(broken, list) and all({"flow", "purpose"} <= set(b) for b in broken)
    assert "error" in run(t["flows_broken_by"].call({"policy_name": "nope"}))


def test_clinical_without_a_round_says_none():
    import clinical_workflow as cw
    cw.judged.clear()
    t = {x.name: x for x in cw.tools()}
    assert run(t["last_verdict"].call({})).get("none") is True


def test_inventory_lists_unconfirmed_and_questions():
    import inventory
    from logic.inventory import question
    s = inventory.sessions.setdefault("s", inventory.Session())
    s.challenges = ["unknown_device_imaging"]
    s.baseline = base
    q = question("s", 1, "dev_unknown_7")
    s.questions.append(q)
    inventory.last_session[:] = ["s"]
    t = {x.name: x for x in inventory.tools()}
    assert any(d["id"] == "dev_unknown_7" for d in run(t["unconfirmed_devices"].call({})))
    assert run(t["last_question"].call({}))["device"] == inventory.H.devices["dev_unknown_7"]["name"]
    assert run(t["device_owner"].call({"query": "dev_unknown_7"}))["confirmed_as"] is None
    s.confirmed["dev_unknown_7"] = "patient_monitor"
    assert run(t["device_owner"].call({"query": "dev_unknown_7"}))["confirmed_as"] == "patient_monitor"


def test_flow_reports_candidates_and_last_proposal():
    import flow
    c = candidate()
    flow.history["s"] = flow.FlowSession(tested=[(c, cand)], last=proposal(c), baseline=base, reason=None)
    flow.last_session[:] = ["s"]
    t = {x.name: x for x in flow.tools()}
    assert run(t["candidates"].call({}))[0]["id"] == c.id
    last = run(t["last_proposal"].call({}))
    assert last["infected_without"] == base.infectedCount and last["infected_with"] == cand.infectedCount
    assert last["policy_name"] == c.policy.name
    assert run(t["why_revised"].call({})).get("none") is True
