"""narrate.py: one status line per negotiation event, built in code for the ASI:One thread."""

import asyncio
import json

import narrate
from llm import FORBIDDEN, NUMBER, fact_numbers
from logic import hospital as hospital_mod
from protocol import Constraint, Proposal, Question, RunResult, Verdict
from tests_paths import FIXTURES

H = hospital_mod.load()
baseline = RunResult.parse_file(FIXTURES / "results" / "baseline.json")
cand = RunResult.parse_file(FIXTURES / "results" / "cand_isolate_imaging.json")


def proposal():
    p = json.loads((FIXTURES / "candidates" / "cand_isolate_imaging.json").read_text())["policy"]
    return Proposal(sessionId="s", round=1, policyId="cand_isolate_imaging", testResult=cand, reason="Cuts the path.", **p)


def test_started_names_flow_and_baseline_numbers():
    s = narrate.started(H, baseline)
    assert "@hippocratech-flow" in s and str(baseline.infectedCount) in s and str(baseline.ticks) in s


def test_proposal_line_has_handle_round_name_and_both_counts():
    s = narrate.line(H, "proposal", proposal(), baseline=baseline)
    assert s.startswith("[ @hippocratech-flow · round 1 ]") and '"' in s
    assert str(cand.infectedCount) in s and str(baseline.infectedCount) in s


def test_reject_line_names_the_constraint():
    v = Verdict(sessionId="s", round=1, policyId="p", agent="clinical_workflow", decision="reject",
                reason="It cuts imaging.", constraint=Constraint(kind="keep_flow", targetIds=["fl_mri2_pacs"]))
    s = narrate.line(H, "verdict", v)
    assert s.startswith("[ @hippocratech-clinical-workflow · round 1 ] rejected:") and "keep" in s


def test_accept_line_is_short():
    v = Verdict(sessionId="s", round=2, policyId="p", agent="inventory", decision="accept", reason="Fine.")
    assert narrate.line(H, "verdict", v) == "[ @hippocratech-inventory · round 2 ] accepted."


def test_question_line_names_the_device():
    q = Question(sessionId="s", id="q1", round=1, agent="inventory", targetId="dev_unknown_7", text="What is it?",
                 choices=["a", "b"], allowedRoles=["security"])
    assert H.devices["dev_unknown_7"]["name"] in narrate.line(H, "question", q)


def test_every_number_comes_from_the_message_and_no_forbidden_words():
    s = narrate.line(H, "proposal", proposal(), baseline=baseline)
    assert {narrate_norm(n) for n in NUMBER.findall(s)} <= fact_numbers({"m": proposal().dict(), "b": baseline.dict()})
    assert not FORBIDDEN.search(s)
    assert not FORBIDDEN.search(narrate.failed("flow", "boom"))


def narrate_norm(n: str) -> str:
    from llm import _norm
    return _norm(n)


def test_narrate_chat_relays_one_row_and_sends_once(monkeypatch, tmp_path):
    monkeypatch.setenv("RELAY_LOG_DIR", str(tmp_path))
    monkeypatch.delenv("WATCHER_RELAY_URL", raising=False)
    monkeypatch.setenv("HIPPO_SIM_FIXTURES", "1")
    import coordinator
    sent = []

    async def fake_send_raw(**kw):
        sent.append(kw)
        return type("S", (), {"status": type("V", (), {"value": "delivered"})(), "detail": ""})()

    ctx = type("Ctx", (), {"send_raw": staticmethod(fake_send_raw)})()
    coordinator.chats["s1"] = coordinator.ChatRound(sender="agent1qsender", device_name="MRI 2")
    loop = asyncio.new_event_loop()  # asyncio.run() would close the loop later Agent() calls need
    try:
        loop.run_until_complete(coordinator.narrate_chat(ctx, "s1", "[ x ] y"))
        loop.run_until_complete(coordinator.narrate_chat(ctx, "nochat", "[ x ] z"))
    finally:
        loop.close()
    rows = [json.loads(l) for l in (tmp_path / "s1.jsonl").read_text().splitlines()]
    chat_rows = [r for r in rows if r["table"] == "agent_message" and r["type"] == "chat"]
    assert len(chat_rows) == 1 and chat_rows[0]["from"] == "coordinator" and chat_rows[0]["to"] == "humans"
    assert chat_rows[0]["payload"]["text"] == "[ x ] y"
    assert len(sent) == 1 and sent[0]["destination"] == "agent1qsender"
    assert not (tmp_path / "nochat.jsonl").exists()


def test_narration_goes_out_under_the_chat_session(monkeypatch, tmp_path):
    """ASI:One ties a message to a thread by the envelope session, which uAgents takes from
    the sending handler's context. Narration is sent from round handlers, so it must be
    re-stamped with the session the chat message arrived in."""
    import uuid
    monkeypatch.setenv("RELAY_LOG_DIR", str(tmp_path))
    monkeypatch.delenv("WATCHER_RELAY_URL", raising=False)
    monkeypatch.setenv("HIPPO_SIM_FIXTURES", "1")
    import coordinator
    seen = []

    class Ctx:
        def __init__(self, session):
            self._session = session

        @property
        def session(self):
            return self._session

        async def send_raw(self, **kw):
            seen.append(self._session)
            return type("S", (), {"status": type("V", (), {"value": "delivered"})(), "detail": ""})()

    chat_session = uuid.uuid4()
    round_session = uuid.uuid4()
    coordinator.chats["s2"] = coordinator.ChatRound(sender="agent1qsender", device_name="MRI 2", session=chat_session)
    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(coordinator.narrate_chat(Ctx(round_session), "s2", "[ x ] y"))
    finally:
        loop.close()
    assert seen == [chat_session]


def test_handoff_lines_name_both_agents():
    s = narrate.handoff("flow", "proposal_request", 1)
    assert s.startswith("[ @hippocratech-coordinator ]") and "@hippocratech-flow" in s and "round 1" in s
    s = narrate.handoff("clinical_workflow", "proposal", 2)
    assert "@hippocratech-clinical-workflow" in s and "verdict" in s
    assert "@hippocratech-inventory" in narrate.handoff("inventory", "answer", 2)
    assert not FORBIDDEN.search(narrate.handoff("flow", "revision", 3))
