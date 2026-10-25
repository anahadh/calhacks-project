"""The Scorekeeper (SCOREKEEPER=1): the pure ranking, the Coordinator's fire-and-forget
copies, the agent's own failure handling, and its config, address and profile. No network.

All RunResults here are hand-built over agents/fixtures/hospital.json."""

import asyncio
import json
import os
import re
import subprocess
import sys
from pathlib import Path

import pytest

import addresses
import config
from logic import hospital as hospital_mod
from logic import scorekeeper as sk
from protocol import (
    Alternative, Constraint, PolicyRule, Proposal, Revision, RuleDiff, RunResult, ScoreCandidate, ScoreInput, Scorecard,
    StartRound, Verdict,
)

AGENTS_DIR = Path(__file__).parent.parent
H = hospital_mod.load()
SESSION = "sk_test"


def run(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


def result(infected=4, affected=10, down=(), removed=()) -> RunResult:
    """infected devices (patient zero mri_2 first), patients affected (all `disrupted`),
    services down as (id, ticksDown)."""
    devices = ["mri_2", "ws_img_1", "srv_pacs", "mri_1", "mri_3", "srv_ehr", "ws_reg", "ws_er_1", "ns_icu"][:infected]
    return RunResult(
        ticks=48, infectedCount=len(devices), infectedDevices=[{"id": d, "tick": i} for i, d in enumerate(devices)],
        servicesDown=[{"id": s, "downSinceTick": 48 - t + 1, "ticksDown": t} for s, t in down],
        patientCounts={"ok": 100 - affected, "delayed": 0, "disrupted": affected, "diverted": 0},
        protectedBroken=[], removedFlows=list(removed),
    )


def verdict(agent, decision, policy_id, round=1, constraint=None) -> Verdict:
    return Verdict(sessionId=SESSION, round=round, policyId=policy_id, agent=agent, decision=decision,
                   reason=f"[{decision}]", constraint=constraint)


def cand(policy_id, name=None, round=1, rules=3, inv="accept", clin="accept", constraint=None, **numbers) -> ScoreCandidate:
    con = constraint if constraint is not None else Constraint(kind="keep_flow", targetIds=["fl_1"])
    return ScoreCandidate(
        policyId=policy_id, name=name or policy_id, round=round, ruleCount=rules, testResult=result(**numbers),
        inventory=verdict("inventory", inv, policy_id, round, con if inv == "reject" else None),
        clinicalWorkflow=verdict("clinical_workflow", clin, policy_id, round, con if clin == "reject" else None),
    )


# --- the ranking ---


def test_ranking_order_with_ties():
    cands = [
        cand("a_plan", infected=4, affected=5),
        cand("b_plan", infected=9, affected=3),  # fewer patients beats fewer devices
        cand("c_plan", infected=1, affected=0, clin="reject"),  # rejected: after every accepted plan
        cand("d_plan", infected=9, affected=3, rules=2),  # ties b_plan until rules
        cand("f_plan", infected=4, affected=5, rules=3),  # ties a_plan exactly: id decides
        cand("e_plan", infected=4, affected=5, down=[("svc_reading", 5)]),  # a service down too long
        cand("g_plan", infected=2, affected=0, inv="reject", clin="reject"),
    ]
    card = sk.scorecard(SESSION, cands, H)
    assert [r.policyId for r in card.rows] == ["d_plan", "b_plan", "a_plan", "f_plan", "e_plan", "c_plan", "g_plan"]
    assert [r.rank for r in card.rows] == list(range(1, 8))
    assert card.rankedBy == list(sk.RANKING) and len(sk.RANKING) == 6
    e = next(r for r in card.rows if r.policyId == "e_plan")
    assert e.servicesDownTooLong == 1
    # svc_mri depends on patient zero (mri_2), so it is never held against a plan.
    assert sk.scorecard(SESSION, [cand("x", down=[("svc_mri", 48)])], H).rows[0].servicesDownTooLong == 0
    # Input order doesn't matter, and a later copy of the same (round, plan) replaces the earlier one.
    assert sk.scorecard(SESSION, list(reversed(cands)), H) == card
    again = sk.scorecard(SESSION, [*cands, cand("a_plan", infected=4, affected=1)], H)
    assert again.rows[0].policyId == "a_plan" and len(again.rows) == 7


def test_the_same_plan_in_two_rounds_keeps_both_rows():
    card = sk.scorecard(SESSION, [cand("lead", "Plan B", round=1, clin="reject"), cand("lead", "Plan B", round=2)], H)
    assert [(r.round, r.rank) for r in card.rows] == [(2, 1), (1, 2)]
    assert card.round == 2
    assert card.why == "Plan B (round 2) leads: accepted by both, while Plan B (round 1) was rejected by Clinical Workflow."


def test_rejected_plans_name_their_constraint():
    rows = sk.scorecard(SESSION, [
        cand("flow_cut", clin="reject", constraint=Constraint(kind="keep_flow", targetIds=["fl_1"])),
        cand("svc_cut", clin="reject", constraint=Constraint(kind="keep_service", targetIds=["svc_reading"])),
        cand("unknown", inv="reject", constraint=Constraint(kind="confirm_device", targetIds=["mri_2"])),
        cand("ok"),
    ], H).rows
    by = {r.policyId: r for r in rows}
    assert by["ok"].broken == []
    [b] = by["flow_cut"].broken
    assert (b.agent, b.kind, b.targetIds, b.targetNames) == ("clinical_workflow", "keep_flow", ["fl_1"], ["MRI 1 → PACS"])
    assert by["svc_cut"].broken[0].targetNames == [H.services["svc_reading"]["name"]]
    assert (by["unknown"].broken[0].agent, by["unknown"].broken[0].targetNames) == ("inventory", ["MRI 2"])


NUMBER = re.compile(r"\d+")


def input_numbers(cands: list[ScoreCandidate]) -> set[str]:
    """Every number the inputs carry: the RunResults, rule counts, rounds, and digits in names."""
    text = json.dumps([json.loads(c.json()) for c in cands]) + " ".join(H.devices[d]["name"] for d in H.devices)
    nums = set(NUMBER.findall(text))
    for c in cands:  # the counts the rows are made of
        nums |= {str(sk.patients_affected(c.testResult)), str(c.testResult.infectedCount),
                 str(len(sk.services_down_too_long(c.testResult, H)))}
    return nums


WHY_CASES = {
    "only": [cand("Plan A", infected=4, affected=1)],
    "verdict": [cand("Plan A", affected=9), cand("Plan B", affected=1, clin="reject")],
    "patients": [cand("Plan A", affected=5), cand("Plan B", affected=3)],
    "devices": [cand("Plan A", infected=6, affected=3), cand("Plan B", infected=5, affected=3)],
    "services": [cand("Plan A", affected=3, down=[("svc_reading", 9)]), cand("Plan B", affected=3)],
    "rules": [cand("Plan A", affected=3, rules=7), cand("Plan B", affected=3, rules=2)],
    "tie": [cand("plan_y", affected=3), cand("plan_x", affected=3)],
}


@pytest.mark.parametrize("case", WHY_CASES)
def test_why_uses_only_input_numbers_and_no_forbidden_words(case):
    cands = WHY_CASES[case]
    card = sk.scorecard(SESSION, cands, H)
    assert set(NUMBER.findall(card.why)) <= input_numbers(cands), card.why
    assert not sk.FORBIDDEN.search(card.why) and not sk.FORBIDDEN.search(sk.card_text(card))
    assert card.why.count(".") == 1 and card.why.endswith(".") and len(card.why) <= 280
    assert card.whySource == "template"


def test_why_sentences():
    w = {k: sk.scorecard(SESSION, v, H).why for k, v in WHY_CASES.items()}
    assert w["patients"] == "Plan B leads: accepted by both, 3 patients affected vs 5 for Plan A."
    assert w["verdict"] == "Plan A leads: accepted by both, while Plan B was rejected by Clinical Workflow."
    assert w["devices"] == "Plan B leads: accepted by both, the same 3 patients affected, 5 devices infected vs 6 for Plan A."
    assert w["services"] == "Plan B leads: accepted by both, the same 3 patients affected, 0 services down too long vs 1 for Plan A."
    assert w["rules"] == "Plan B leads: accepted by both, the same 3 patients affected, 2 rules vs 7 for Plan A."
    assert w["tie"] == "plan_x and plan_y tie on every count; plan_x comes first by candidate id."
    assert w["only"] == "Plan A is the only plan scored so far: accepted by both, 1 patient affected, 4 devices infected."


def test_forbidden_words_are_refused():
    with pytest.raises(sk.ScorekeeperError):
        sk.scorecard(SESSION, [cand("plan_ready", name="Ready plan")], H)
    assert sk.FORBIDDEN.search("safe to deploy") and not sk.FORBIDDEN.search("already")


# --- determinism ---

SCRIPT = """
import json, sys
sys.path.insert(0, ".")
from tests.test_scorekeeper import H, WHY_CASES, cand, sk
cards = [sk.scorecard("s", v, H).json() for v in WHY_CASES.values()]
cards.append(sk.scorecard("s", [c for v in WHY_CASES.values() for c in v], H).json())
print(json.dumps(cards))
"""


def test_identical_json_twice_and_across_hash_seeds():
    here = [sk.scorecard("s", v, H).json() for v in WHY_CASES.values()]
    here.append(sk.scorecard("s", [c for v in WHY_CASES.values() for c in v], H).json())
    assert here == [sk.scorecard("s", v, H).json() for v in WHY_CASES.values()] + [here[-1]]
    outs = []
    for hash_seed in ("0", "4242"):
        env = {**os.environ, "PYTHONHASHSEED": hash_seed}
        proc = subprocess.run([sys.executable, "-c", SCRIPT], cwd=AGENTS_DIR, env=env, capture_output=True, text=True,
                              timeout=120)
        assert proc.returncode == 0, proc.stderr[-2000:]
        outs.append(proc.stdout.strip().splitlines()[-1])
    assert outs[0] == outs[1] == json.dumps(here)


def test_chat_replies_are_templates():
    card = sk.scorecard(SESSION, WHY_CASES["patients"], H)
    assert sk.chat_reply("what's the ranking?", card) == sk.card_text(card)
    assert sk.chat_reply("what's the ranking?", card).startswith("Ranking after round 1, best first:\n1. Plan B")
    assert sk.chat_reply("how do you rank?", card) == sk.ORDER_TEXT
    assert "No plans scored yet" in sk.chat_reply("show me the scorecard", None)
    assert sk.chat_reply("hello", None).startswith(sk.INTRO)
    for text in (sk.INTRO, sk.ORDER_TEXT, sk.card_text(card)):
        assert not sk.FORBIDDEN.search(text)


# --- the Coordinator's copies ---

RULE = lambda i: PolicyRule.parse_obj({"id": f"r{i}", "from": {"vlan": 10}, "to": {"vlan": 20 + i}, "plain": f"rule {i}"})


def proposal(round=1, alts=()) -> Proposal:
    return Proposal(sessionId=SESSION, round=round, policyId="p_lead", strategy="max_containment", name="Lead plan",
                    rules=[RULE(1), RULE(2), RULE(3)], rationale="r", tradeoff="t", testResult=result(5, 20),
                    alternatives=list(alts))


def alt(policy_id, rules=2, **numbers) -> Alternative:
    return Alternative(policyId=policy_id, strategy="least_disruption", name=f"Alt {policy_id}",
                       rules=[RULE(i) for i in range(rules)], rationale="r", tradeoff="t", testResult=result(**numbers))


def revision(alts=()) -> Revision:
    return Revision(sessionId=SESSION, round=2, policyId="p_lead", diff=RuleDiff(added=[RULE(9)], removed=["r1"]),
                    testResult=result(3, 8), alternatives=list(alts))


def test_copy_tracker_sends_one_cumulative_copy_per_judged_round():
    t = sk.CopyTracker(SESSION)
    t.on_plan(proposal(alts=[alt("p_alt", infected=3, affected=4), alt("p_x"), alt("p_y")]))
    assert t.on_verdict(verdict("inventory", "accept", "p_lead")) is None
    assert t.on_verdict(verdict("clinical_workflow", "reject", "p_lead", constraint=Constraint(kind="keep_flow", targetIds=["fl_1"]))) is None
    for pid in ("p_alt", "p_x"):  # two alternatives at most (as Round._forward)
        t.on_verdict(verdict("inventory", "accept", pid))
    assert t.on_verdict(verdict("clinical_workflow", "accept", "p_alt")) is None
    assert t.on_verdict(verdict("clinical_workflow", "accept", "p_y")) is None  # not on the table
    copy1 = t.on_verdict(verdict("clinical_workflow", "accept", "p_x"))
    assert [c.policyId for c in copy1.candidates] == ["p_lead", "p_alt", "p_x"]
    assert copy1.candidates[0].ruleCount == 3 and copy1.round == 1
    assert t.on_verdict(verdict("clinical_workflow", "accept", "p_x")) is None  # nothing changed: no second copy
    t.on_plan(revision())
    t.on_verdict(verdict("inventory", "accept", "p_lead", round=2))
    copy2 = t.on_verdict(verdict("clinical_workflow", "accept", "p_lead", round=2))
    assert [(c.round, c.policyId) for c in copy2.candidates] == [(1, "p_lead"), (1, "p_alt"), (1, "p_x"), (2, "p_lead")]
    assert copy2.candidates[-1].ruleCount == 3 and copy2.candidates[-1].name == "Lead plan"  # 3 − r1 + r9
    t2 = sk.CopyTracker(SESSION)  # an alternative with the lead's own id is not a second plan
    t2.on_plan(proposal(alts=[alt("p_lead")]))
    t2.on_verdict(verdict("inventory", "accept", "p_lead"))
    assert len(t2.on_verdict(verdict("clinical_workflow", "accept", "p_lead")).candidates) == 1


@pytest.fixture
def coord(monkeypatch, tmp_path):
    """coordinator.py in-process: the engine, the model and the other agents replaced."""
    monkeypatch.setenv("RELAY_LOG_DIR", str(tmp_path))
    monkeypatch.delenv("WATCHER_RELAY_URL", raising=False)
    monkeypatch.setenv("HIPPO_SIM_FIXTURES", "1")
    import coordinator

    async def worded(msg, kind, facts):
        return msg.copy(update={"explanation": f"[{msg.policy.name}]", "explanationSource": "asi1"})

    monkeypatch.setattr(coordinator, "run_sim", lambda *a, **k: result(9, 40))
    monkeypatch.setattr(coordinator.llm, "worded", worded)
    for d in (coordinator.rounds, coordinator.chats, coordinator.events, coordinator.score_tracks):
        d.clear()
    return coordinator


def full_round(c, monkeypatch, scorekeeper: str | None, tmp_path) -> dict:
    """One whole negotiation through the Coordinator's real handlers: round 1's lead is
    rejected and its alternative accepted, round 2's revision and alternative are accepted.
    scorekeeper: None (SCOREKEEPER off), "ok", "raise" (down) or "hang" (never answers)."""
    monkeypatch.setenv("SCOREKEEPER", "0" if scorekeeper is None else "1")
    monkeypatch.setattr(c, "SCOREKEEPER", scorekeeper is not None)
    sent, copies = [], []
    never = asyncio.Event()

    async def send(ctx, me, to, type, msg, status=True):
        if to != "scorekeeper":
            sent.append((to, type, msg.json()))
            return
        assert status is False  # copies leave the Coordinator's status alone
        if scorekeeper == "raise":
            raise runtime.DeliveryError("score_input to scorekeeper not delivered: failed")  # as runtime.send would
        if scorekeeper == "hang":
            await never.wait()
        copies.append(msg)

    import runtime
    monkeypatch.setattr(c, "send", send)
    addr = addresses.address
    ctx = c.ctx_stub()

    async def go():
        ack = await c.begin(ctx, StartRound(sessionId=SESSION, runId="run_sk", patientZero="mri_2", seed=1337))
        assert ack.ok, ack.detail
        await c.on_proposal(ctx, addr("flow"), proposal(alts=[alt("p_alt", infected=3, affected=4)]))
        no = Constraint(kind="keep_flow", targetIds=["fl_1"])
        for v in (verdict("inventory", "accept", "p_lead"), verdict("clinical_workflow", "reject", "p_lead", constraint=no),
                  verdict("inventory", "accept", "p_alt"), verdict("clinical_workflow", "accept", "p_alt")):
            await c.on_verdict(ctx, addr(v.agent), v)
        await c.on_revision(ctx, addr("flow"), revision(alts=[alt("p_alt2", infected=4, affected=6)]))
        for pid in ("p_lead", "p_alt2"):
            for g in ("inventory", "clinical_workflow"):
                await c.on_verdict(ctx, addr(g), verdict(g, "accept", pid, round=2))
        await asyncio.sleep(0)  # let the background copies run (a hung one stays pending)
        await asyncio.sleep(0)
        pending = [t for t in c.score_tasks if not t.done()]
        for t in pending:
            t.cancel()
        return len(pending)

    pending = run(go())
    rnd = c.rounds[SESSION]
    rows = [json.loads(l) for f in tmp_path.glob("*.jsonl") for l in f.read_text().splitlines()]
    states = [r["payload"] for r in rows if r.get("type") == "round_state"]
    return {"state": rnd.state, "recs": [r.json() for r in rnd.recommendations], "sent": sent, "copies": copies,
            "pending": pending, "states": states}


def test_full_round_gives_identical_recommendations_with_and_without_the_scorekeeper(coord, monkeypatch, tmp_path):
    out = {}
    for mode in (None, "ok", "raise", "hang"):
        d = tmp_path / str(mode)
        d.mkdir()
        monkeypatch.setenv("RELAY_LOG_DIR", str(d))
        for x in (coord.rounds, coord.events, coord.score_tracks):
            x.clear()
        out[mode] = full_round(coord, monkeypatch, mode, d)
    base = out[None]
    assert base["state"] == "done" and len(base["recs"]) == 2 and base["copies"] == []
    for mode in ("ok", "raise", "hang"):
        assert out[mode]["state"] == "done"
        assert out[mode]["recs"] == base["recs"], mode  # same plans, same order, same numbers
        assert out[mode]["sent"] == base["sent"], mode  # the other agents saw exactly the same messages
        assert out[mode]["states"] == base["states"], mode  # no error status, same round states
        assert not any((s.get("detail") or "").startswith("The coordinator agent failed") for s in out[mode]["states"])
    assert [len(c.candidates) for c in out["ok"]["copies"]] == [2, 4]  # one copy per judged round, cumulative
    assert out["hang"]["pending"] == 2  # never awaited: the round finished while both copies hung
    card = sk.scorecard(SESSION, out["ok"]["copies"][-1].candidates, H)
    assert {r.policyId for r in card.rows} == {"p_lead", "p_alt", "p_alt2"} and len(card.rows) == 4


def test_scorecards_are_relayed_and_go_nowhere_else(coord, monkeypatch, tmp_path):
    monkeypatch.setenv("SCOREKEEPER", "1")
    card = sk.scorecard(SESSION, [cand("p_lead")], H)
    run(coord.on_scorecard(coord.ctx_stub(), addresses.address("scorekeeper"), card))
    rows = [json.loads(l) for l in (tmp_path / f"{SESSION}.jsonl").read_text().splitlines()]
    assert [(r["table"], r["from"], r["to"], r["type"], r["direction"], r["reasonSource"]) for r in rows] == [
        ("agent_message", "scorekeeper", "coordinator", "scorecard", "received", "template")]
    assert rows[0]["reason"] == card.why and SESSION not in coord.rounds  # no status row, no round touched


def test_the_scorekeeper_agent_fails_quietly(monkeypatch, tmp_path):
    """An error in the Scorekeeper is logged and it goes idle: no round_state, no stopped round."""
    monkeypatch.setenv("SCOREKEEPER", "1")
    monkeypatch.setenv("RELAY_LOG_DIR", str(tmp_path))
    monkeypatch.delenv("WATCHER_RELAY_URL", raising=False)
    import scorekeeper

    replies = []

    async def send(ctx, me, to, type, msg, status=True):
        replies.append((to, type, msg))

    monkeypatch.setattr(scorekeeper, "send", send)
    copy = ScoreInput(sessionId=SESSION, round=1, candidates=[cand("p_lead"), cand("p_alt", affected=1)])
    ctx = scorekeeper.agent_chat.ctx_stub()
    card = run(scorekeeper.score(ctx, addresses.address("coordinator"), copy))
    assert replies == [("coordinator", "scorecard", card)] and card.rows[0].policyId == "p_alt"
    assert scorekeeper.chat_answer("what's the ranking?") == sk.card_text(card)

    def boom(*a):
        raise RuntimeError("bad input")

    monkeypatch.setattr(scorekeeper.logic, "scorecard", boom)
    assert run(scorekeeper.score(ctx, addresses.address("coordinator"), copy)) is None
    assert run(scorekeeper.score(ctx, addresses.address("flow"), copy)) is None  # only the Coordinator sends copies
    rows = [json.loads(l) for l in (tmp_path / f"{SESSION}.jsonl").read_text().splitlines()]
    assert not [r for r in rows if r.get("type") == "round_state"]
    assert [r["status"] for r in rows if r["table"] == "agent_status"][-1] == "idle"
    assert len(replies) == 1


# --- config, address, profile ---


def test_flag_off_changes_nothing(monkeypatch):
    monkeypatch.setenv("SCOREKEEPER", "0")
    assert config.agents() == config.CORE_AGENTS == ("inventory", "flow", "clinical_workflow", "coordinator")
    assert [config.PORTS[a] for a in config.agents()] == [8001, 8002, 8003, 8004]
    assert config.AGENTS == config.CORE_AGENTS  # what run_all.py starts, as this process began
    assert addresses.endpoint("scorekeeper") not in addresses.local_rules().values()
    monkeypatch.delenv("SCOREKEEPER")
    assert config.scorekeeper_enabled() is False  # off by default


def test_flag_on_adds_the_fifth_agent(monkeypatch):
    monkeypatch.setenv("SCOREKEEPER", "1")
    assert config.agents() == (*config.CORE_AGENTS, "scorekeeper")
    assert config.PORTS["scorekeeper"] == 8005
    rules = addresses.local_rules()
    assert rules[addresses.address("scorekeeper")] == "http://127.0.0.1:8005/submit"
    resolver = addresses.local_resolver()
    assert run(resolver.resolve(addresses.address("scorekeeper")))[1] == ["http://127.0.0.1:8005/submit"]
    monkeypatch.setenv("SCOREKEEPER", "yes")
    with pytest.raises(config.ConfigError, match="SCOREKEEPER must be 0 or 1"):
        config.agents()


def test_address_derives_from_the_seed_and_is_stable(monkeypatch):
    from uagents.crypto import Identity

    monkeypatch.setenv("SCOREKEEPER_AGENT_SEED", "hippocratech scorekeeper address test")
    addresses.address.cache_clear()
    try:
        a = addresses.address("scorekeeper")
        assert a == Identity.from_seed("hippocratech scorekeeper address test", 0).address and a.startswith("agent1q")
        addresses.address.cache_clear()
        assert addresses.address("scorekeeper") == a
        other = subprocess.run([sys.executable, "-c", "import addresses; print(addresses.address('scorekeeper'))"],
                               cwd=AGENTS_DIR, env={**os.environ, "PYTHONHASHSEED": "7"}, capture_output=True, text=True)
        assert other.stdout.strip().splitlines()[-1] == a
    finally:
        addresses.address.cache_clear()


def test_missing_seed_with_the_flag_on_is_a_clear_config_error(monkeypatch, capsys):
    import run_all

    monkeypatch.setenv("SCOREKEEPER", "1")
    monkeypatch.setenv("SCOREKEEPER_AGENT_SEED", "")
    with pytest.raises(config.ConfigError, match="SCOREKEEPER_AGENT_SEED is not set. Put one seed phrase per agent"):
        config.seed("scorekeeper")
    monkeypatch.setattr(run_all, "AGENTS", config.agents())
    assert run_all.main() == 2 and "SCOREKEEPER_AGENT_SEED is not set" in capsys.readouterr().err
    monkeypatch.setenv("SCOREKEEPER", "0")
    monkeypatch.setattr(run_all, "AGENTS", config.agents())
    assert all(config.seed(a) for a in run_all.AGENTS)  # off: no Scorekeeper seed needed


def test_demo_checks_unchanged_with_the_flag_off(monkeypatch, tmp_path):
    sys.path.insert(0, str(AGENTS_DIR / "scripts"))
    sys.path.insert(0, str(AGENTS_DIR.parent / "scripts"))
    import demo  # scripts/demo.py
    import demo_check  # agents/scripts/demo_check.py

    four = "".join(f"{config.SEED_VARS[a]}=x\n" for a in config.CORE_AGENTS)
    env = tmp_path / ".env"
    env.write_text(four)
    monkeypatch.setenv("SCOREKEEPER", "0")
    c = demo_check.check_env(env)
    assert c.ok and c.detail == "present, all four seeds set"
    monkeypatch.delenv("SCOREKEEPER")
    env.write_text(four + "SCOREKEEPER=1\n")
    c = demo_check.check_env(env)
    assert not c.ok and "SCOREKEEPER_AGENT_SEED" in c.detail
    env.write_text(four + "SCOREKEEPER=1\nSCOREKEEPER_AGENT_SEED=y\n")
    assert demo_check.check_env(env).detail == "present, all five seeds set"

    monkeypatch.delenv("SCOREKEEPER_AGENT_SEED")  # demo.py also counts seeds set in the shell
    (tmp_path / "agents").mkdir()
    (tmp_path / "agents" / ".env").write_text(four)
    assert demo.agent_ports(tmp_path) == demo.AGENT_PORTS == {
        "inventory": 8001, "flow": 8002, "clinical_workflow": 8003, "coordinator": 8004}
    assert not [m for m in demo.check_env(tmp_path).missing if "SEED" in m]
    (tmp_path / "agents" / ".env").write_text(four + "SCOREKEEPER=1\n")
    assert demo.agent_ports(tmp_path)["scorekeeper"] == 8005
    assert "agents/.env: SCOREKEEPER_AGENT_SEED" in demo.check_env(tmp_path).missing


def test_profile():
    import runtime

    p = runtime.PROFILES["scorekeeper"]
    assert (p.name, p.handle) == ("Hippocratech Scorekeeper", "hippocratech-scorekeeper")
    for must in ("rank", "no AI model", "never votes", "Simulation only"):
        assert must in p.description, must
    assert all(len(x.description) <= 300 for x in runtime.PROFILES.values())  # Agentverse's AgentProfile limit
    readme = Path(p.readme_path("scorekeeper"))
    assert readme == AGENTS_DIR / "profiles" / "scorekeeper.md" and readme.is_file()
    text = readme.read_text()
    flow = (AGENTS_DIR / "profiles" / "flow.md").read_text()
    assert text.splitlines()[2] == flow.splitlines()[2]  # the same tag badges
    for must in ("> **Specialist agent.**", "`@hippocratech-coordinator`", "## How I rank", "## Messages",
                 "`Scorecard`", "## I have no decision power", "synthetic"):
        assert must in text, must
    for step in sk.RANKING:
        assert step.split(",")[0].split(" (")[0] in text.replace("both guardians (Inventory and Clinical Workflow)", "both guardians")
    assert "`@hippocratech-scorekeeper`" in (AGENTS_DIR / "profiles" / "coordinator.md").read_text()
    assert "@hippocratech-scorekeeper" in runtime.PROFILES["coordinator"].description


@pytest.mark.parametrize("mailbox,local", [("0", "1"), ("1", "1"), ("0", "0"), ("1", "0")])
def test_make_agent_in_every_mode(monkeypatch, mailbox, local):
    import runtime

    monkeypatch.setenv("SCOREKEEPER", "1")
    monkeypatch.setenv("AGENT_MAILBOX", mailbox)
    monkeypatch.setenv("LOCAL_RESOLVE", local)
    agent, _ = runtime.make_agent("scorekeeper")
    assert agent.address == addresses.address("scorekeeper") and agent._port == 8005
    assert agent._publish_agent_details and agent._handle == "hippocratech-scorekeeper"
    assert agent._readme == (AGENTS_DIR / "profiles" / "scorekeeper.md").read_text()
    assert ("GET", "/health") in agent._rest_handlers
    body = agent._loop.run_until_complete(agent.handle_rest("GET", "/health", None))
    assert body.dict() == {"agent": "scorekeeper", "address": agent.address, "mailbox": mailbox == "1",
                           "localResolve": local == "1"}
    assert (agent.mailbox_client is not None) == (mailbox == "1")
    assert isinstance(agent, runtime.LocalAgent) == (mailbox == "0" and local == "1")


def test_check_agentverse_lists_the_fifth_agent_only_with_the_flag(monkeypatch, capsys):
    sys.path.insert(0, str(AGENTS_DIR / "scripts"))
    import check_agentverse

    for flag, n in (("0", 4), ("1", 5)):
        monkeypatch.setenv("SCOREKEEPER", flag)
        monkeypatch.setattr(check_agentverse, "AGENTS", config.agents())
        monkeypatch.setattr(check_agentverse, "check", lambda agent: "not listening (start run_all.py)")
        check_agentverse.main()
        out = capsys.readouterr().out
        assert out.count("  inspector  ") == n
        assert ("@hippocratech-scorekeeper" in out) == (flag == "1")
        if flag == "1":
            assert "127.0.0.1%3A8005" in out
