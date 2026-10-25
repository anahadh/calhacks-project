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
    assert "@hippocratech-flow" in s and str(baseline.infectedCount) in s and str(baseline.ticks) in s and "Without any segmentation" in s


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


class Ctx:
    """A context stand-in: records every send_raw with the session it carried."""

    def __init__(self, session=None, fail_times=0):
        import uuid
        self._session = session or uuid.uuid4()
        self.sent = []
        self.fail_times = fail_times
        self.logger = __import__("logging").getLogger("test")

    @property
    def session(self):
        return self._session

    async def send_raw(self, **kw):
        self.sent.append((self._session, kw))
        ok = len(self.sent) > self.fail_times
        return type("S", (), {"status": type("V", (), {"value": "delivered" if ok else "failed"})(), "detail": "429" if not ok else ""})()


def body_text(kw) -> str:
    import json
    return " ".join(c["text"] for c in json.loads(kw["message_body"])["content"] if c.get("type") == "text")


def has_card(kw) -> bool:
    import json
    return any(c.get("type") == "metadata" for c in json.loads(kw["message_body"])["content"])


def chat_rows(path):
    return [json.loads(l) for l in path.read_text().splitlines() if '"agent_message"' in l and '"chat"' in l]


def test_narration_accumulates_into_one_message_with_a_trace_card(monkeypatch, tmp_path):
    """ASI:One shows one message per agent turn and rate-limits bursts, so every update
    carries the whole trace so far, with a live trace card, and updates are coalesced."""
    import uuid
    monkeypatch.setenv("RELAY_LOG_DIR", str(tmp_path))
    monkeypatch.delenv("WATCHER_RELAY_URL", raising=False)
    monkeypatch.setenv("HIPPO_SIM_FIXTURES", "1")
    import coordinator
    monkeypatch.setattr(coordinator, "NARRATE_INTERVAL_S", 0.05)
    chat_session = uuid.uuid4()
    coordinator.chats["s1"] = coordinator.ChatRound(sender="agent1qsender", device_name="MRI 2", session=chat_session)
    ctx = Ctx(uuid.uuid4())

    async def go():
        await coordinator.narrate_chat(ctx, "s1", "[ a ] first")
        await coordinator.narrate_chat(ctx, "s1", "[ b ] second")
        await coordinator.narrate_chat(ctx, "nochat", "[ x ] ignored")
        await asyncio.sleep(0.2)

    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(go())
    finally:
        loop.close()
    assert len(ctx.sent) == 1, "two lines within the interval coalesce into one send"
    session, kw = ctx.sent[0]
    assert session == chat_session
    assert body_text(kw) == "[ b ] second" and has_card(kw)  # the newest move; the card holds the rest
    rows = chat_rows(tmp_path / "s1.jsonl")
    assert len(rows) == 1 and rows[0]["payload"]["text"] == "[ b ] second" and rows[0]["payload"]["card"]
    assert coordinator.chats["s1"].trace == ["[ a ] first", "[ b ] second"]
    assert not (tmp_path / "nochat.jsonl").exists()


def test_narration_after_the_interval_sends_again_with_the_full_trace(monkeypatch, tmp_path):
    monkeypatch.setenv("RELAY_LOG_DIR", str(tmp_path))
    monkeypatch.delenv("WATCHER_RELAY_URL", raising=False)
    import coordinator
    monkeypatch.setattr(coordinator, "NARRATE_INTERVAL_S", 0.05)
    coordinator.chats["s3"] = coordinator.ChatRound(sender="agent1qsender", device_name="MRI 2")
    ctx = Ctx()

    async def go():
        await coordinator.narrate_chat(ctx, "s3", "one")
        await asyncio.sleep(0.15)
        await coordinator.narrate_chat(ctx, "s3", "two")
        await asyncio.sleep(0.15)

    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(go())
    finally:
        loop.close()
    assert [body_text(kw) for _, kw in ctx.sent] == ["one", "two"]


def test_chat_send_retries_a_failed_delivery(monkeypatch, tmp_path):
    monkeypatch.setenv("RELAY_LOG_DIR", str(tmp_path))
    monkeypatch.delenv("WATCHER_RELAY_URL", raising=False)
    import coordinator
    monkeypatch.setattr(coordinator, "SEND_BACKOFF_S", 0.01)
    from uagents_core.contrib.protocols.chat import ChatMessage, TextContent
    ctx = Ctx(fail_times=2)
    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(coordinator.chat_send(ctx, "agent1qto", ChatMessage(content=[TextContent(text="hi")]), "asi1-chat", "hi"))
    finally:
        loop.close()
    assert len(ctx.sent) == 3


def test_handoff_lines_name_both_agents():
    s = narrate.handoff("flow", "proposal_request", 1)
    assert s.startswith("[ @hippocratech-coordinator ]") and "@hippocratech-flow" in s and "round 1" in s
    s = narrate.handoff("clinical_workflow", "proposal", 2)
    assert "@hippocratech-clinical-workflow" in s and "verdict" in s
    assert "@hippocratech-inventory" in narrate.handoff("inventory", "answer", 2)
    assert not FORBIDDEN.search(narrate.handoff("flow", "revision", 3))


def test_render_separates_lines_into_paragraphs():
    assert narrate.render(["a", "b"]) == "a\n\nb"
    assert narrate.render([]) == ""


def test_revision_line_says_why_and_the_counts_not_rule_arithmetic():
    from protocol import Revision, RuleDiff
    r = Revision(sessionId="s", round=2, policyId="p", diff=RuleDiff(added=[], removed=["r1"]), name="Critical Care Shield",
                 testResult=cand, reason="Keeps MRI and CT scans flowing to PACS.")
    s = narrate.line(H, "revision", r, baseline=baseline)
    assert s.startswith('[ @hippocratech-flow · round 2 ] revised the plan, now "Critical Care Shield": Keeps MRI and CT scans flowing to PACS.')
    assert f"{cand.infectedCount} devices infected with it, {baseline.infectedCount} without" in s
    assert "rules added" not in s
    unnamed = Revision(sessionId="s", round=3, policyId="p", diff=RuleDiff(added=[], removed=[]), testResult=cand)
    assert narrate.line(H, "revision", unnamed).startswith("[ @hippocratech-flow · round 3 ] revised the plan:")


def test_pretty_lines_are_plain_english_with_a_marker_per_agent():
    s = narrate.pretty('[ @hippocratech-flow · round 1 ] proposed "Wall off imaging": 5 devices infected with it, 9 without.')
    assert s.startswith("🟦 **Flow** · round 1 —") and "Wall off imaging" in s
    assert narrate.pretty("[ @hippocratech-clinical-workflow · round 2 ] accepted.").startswith("🟩 **Clinical Workflow** · round 2 —")
    assert narrate.pretty("[ @hippocratech-inventory · round 1 ] accepted.").startswith("🟨 **Inventory** · round 1 —")
    assert narrate.pretty("[ a ] first") == "[ a ] first"  # unknown tags pass through


def test_bubble_drops_handoffs_but_keeps_mcp_calls():
    lines = ["[ @hippocratech-coordinator ] asked @hippocratech-flow for a plan (round 1).",
             "[ @hippocratech-coordinator ] MCP hospital.test_run(mri_2) → 9 devices infected over 9 ticks.",
             "[ @hippocratech-inventory · round 1 ] accepted."]
    out = narrate.render(lines)
    assert "asked @hippocratech-flow" not in out and "🔧 **MCP**" in out and "**Inventory**" in out
