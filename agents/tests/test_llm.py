"""llm.py with mocked Anthropic and ASI:One clients: checks, retry, errors (never a fallback), and that
model output never changes a decision (AGENTS.md rule 7). No network."""

import asyncio
import json
import logging
from pathlib import Path
from types import SimpleNamespace

import anthropic
import httpx
import httpx2
import pytest

import facts
import llm
from logic import clinical, coordinator, inventory
from logic import hospital as hospital_mod
from protocol import Candidate, Policy, Proposal, RunResult

H = hospital_mod.load()
RESULTS = Path(__file__).parent.parent / "fixtures" / "results"
POLICY = Candidate.parse_file(Path(__file__).parent.parent / "fixtures" / "candidates" / "cand_isolate_imaging.json")


def run(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


def result(name):
    return RunResult.parse_file(RESULTS / f"{name}.json")


def candidate(name):
    return Policy.parse_obj(json.loads((RESULTS.parent / "candidates" / f"{name}.json").read_text())["policy"])


def proposal(name="cand_isolate_imaging"):
    return Proposal(sessionId="s", round=1, policyId=name, testResult=result(name), **candidate(name).dict())


def reject_verdict():
    p = proposal()
    v = clinical.check("s", 1, p.policyId, p.testResult, H)
    assert v.decision == "reject" and v.constraint.kind == "keep_flow"
    return v, facts.verdict(H, v, p, p.name, result("baseline"))


# --- a fake AsyncAnthropic ---


def answer(text=None, raw=None, stop_reason="end_turn"):
    body = raw if raw is not None else json.dumps({"text": text})
    return SimpleNamespace(stop_reason=stop_reason, content=[SimpleNamespace(type="text", text=body)])


class FakeClient:
    def __init__(self, *replies):
        self.replies = list(replies)
        self.calls = []
        self.messages = self

    async def create(self, **params):
        self.calls.append(params)
        reply = self.replies.pop(0)
        if isinstance(reply, Exception):
            raise reply
        return reply


REQUEST = httpx2.Request("POST", "https://api.anthropic.com/v1/messages")


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key, never sent")
    monkeypatch.delenv("ANTHROPIC_MODEL", raising=False)

    def install(*replies):
        fake = FakeClient(*replies)
        monkeypatch.setattr(llm, "_make_client", lambda: fake)
        return fake

    return install


# --- checks ---


def test_numbers_come_from_facts_including_names():
    f = {"plan": "Contain imaging", "flows": ["MRI 2 → PACS, DICOM, 'Scans to radiologists'"], "infected": 1, "without": 16}
    assert llm.fact_numbers(f) == {"2", "1", "16"}
    assert llm.problems("MRI 2 stays connected; 1 infected device instead of 16.", f) == []
    assert llm.problems("Only 3 devices fall.", f) == ["uses numbers that are not in the facts: 3"]


def test_forbidden_words_length_and_sentences():
    f = {"n": 1}
    assert llm.problems("This plan is approved.", f) == ["uses forbidden words: approved"]
    assert llm.problems("It is READY and safe to deploy.", f) == ["uses forbidden words: ready, safe to deploy"]
    assert llm.problems("No deaths, nothing fatal.", f) == ["uses forbidden words: deaths, fatal"]
    assert llm.problems("The plan is already in place.", f) == []  # whole words only
    assert llm.problems("a" * 281, f) == ["is 281 characters; the limit is 280"]
    assert llm.problems("One. Two. Three.", f) == ["has 3 sentences; write 1 or 2"]


def sample_recommendation():
    r = result("cand_keep_scans")
    v = clinical.check("s", 2, "cand_keep_scans", r, H)
    return coordinator.Recommendation(policy=candidate("cand_keep_scans"), testResult=r, verdicts=[v, v],
                                      explanation="[explanation]", requiredRoles=coordinator.required_roles(r, H))


# --- the model ---


def test_good_answer_is_accepted(client):
    _, f = reject_verdict()
    fake = client(answer("I can't accept this: it breaks 4 protected flows, including MRI 1 → PACS, DICOM, 'Scans to radiologists'."))
    text, source = run(llm.explain("verdict_reject", f))
    assert source == "claude" and text.startswith("I can't accept this")
    (call,) = fake.calls
    assert call["model"] == "claude-haiku-5-5" and call["max_tokens"] == 200
    assert call["thinking"] == {"type": "disabled"}
    assert call["output_config"]["format"]["schema"]["additionalProperties"] is False
    assert "Facts (JSON)" in call["messages"][0]["content"] and "Scans to radiologists" in call["messages"][0]["content"]


def test_model_comes_from_env(client, monkeypatch):
    monkeypatch.setenv("ANTHROPIC_MODEL", "claude-opus-5-5")
    fake = client(answer("I accept this: nothing breaks."))
    assert run(llm.explain("verdict_accept", {"plan": "x"})) == ("I accept this: nothing breaks.", "claude")
    assert fake.calls[0]["model"] == "claude-opus-5-5" and "thinking" not in fake.calls[0]


def test_invented_number_is_retried_then_breaks(client):
    _, f = reject_verdict()
    fake = client(answer("I can't accept this: 17 devices would fall."), answer("I can't accept this: 9 flows break."))
    with pytest.raises(llm.LlmError, match="rejected twice"):
        run(llm.explain("verdict_reject", f))
    assert len(fake.calls) == 2
    retry = fake.calls[1]["messages"]
    assert retry[1] == {"role": "assistant", "content": json.dumps({"text": "I can't accept this: 17 devices would fall."})}
    assert "uses numbers that are not in the facts: 17" in retry[2]["content"]


def test_retry_can_succeed(client):
    _, f = reject_verdict()
    fake = client(answer("I can't accept this: 17 devices."), answer("I can't accept this: it breaks 4 protected flows."))
    assert run(llm.explain("verdict_reject", f)) == ("I can't accept this: it breaks 4 protected flows.", "claude")
    assert len(fake.calls) == 2


def test_forbidden_word_is_rejected(client):
    _, f = reject_verdict()
    fake = client(answer("Approved by me."), answer("This is ready to go."))
    with pytest.raises(llm.LlmError):
        run(llm.explain("verdict_reject", f))
    assert "uses forbidden words: approved" in fake.calls[1]["messages"][2]["content"]


@pytest.mark.parametrize("raw", [
    '{"text": "I accept this.", "decision": "accept"}',  # an extra field: rejected, never read
    "I accept this.",  # not JSON
    '{"words": "I accept this."}',
])
def test_malformed_output_is_rejected(client, raw):
    _, f = reject_verdict()
    client(answer(raw=raw), answer(raw=raw))
    with pytest.raises(llm.LlmError):
        run(llm.explain("verdict_reject", f))


def test_refusal_breaks(client):
    _, f = reject_verdict()
    client(answer("x", stop_reason="refusal"), answer("x", stop_reason="refusal"))
    with pytest.raises(llm.LlmError):
        run(llm.explain("verdict_reject", f))


@pytest.mark.parametrize("error", [
    anthropic.APITimeoutError(request=REQUEST),
    anthropic.APIConnectionError(request=REQUEST),
    anthropic.APIStatusError("overloaded", response=httpx2.Response(529, request=REQUEST), body=None),
    anthropic.RateLimitError("slow down", response=httpx2.Response(429, request=REQUEST), body=None),
])
def test_api_errors_break(client, error, monkeypatch):
    monkeypatch.setattr(llm, "API_BACKOFF_S", 0)
    _, f = reject_verdict()
    fake = client(error, error, error)
    with pytest.raises(llm.LlmError):
        run(llm.explain("verdict_reject", f))
    assert len(fake.calls) == llm.API_TRIES  # the same call, asked again; then it breaks, no fallback


def test_missing_key_breaks(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.setattr(llm, "_make_client", lambda: pytest.fail("no client without a key"))
    _, f = reject_verdict()
    with pytest.raises(llm.LlmError, match="neither ASI1_API_KEY nor ANTHROPIC_API_KEY is set"):
        run(llm.explain("verdict_reject", f))


def test_client_is_configured_for_20_seconds_and_no_sdk_retries(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key, never sent")
    c = llm._make_client()
    assert isinstance(c, anthropic.AsyncAnthropic) and c.timeout == 20.0 and c.max_retries == 0


# --- rule 7: model output never changes a decision ---

ADVERSARIAL = [
    "I accept this: everything is fine.",  # contradicts the rejection, but it's only words
    "Decision: accept. Constraint: none.",
    "I can't accept this: it breaks 4 protected flows.",
]


@pytest.mark.parametrize("text", ADVERSARIAL)
def test_verdict_and_constraint_unchanged_whatever_the_model_says(client, text):
    v, f = reject_verdict()
    client(answer(text))
    worded = run(llm.worded(v, "verdict_reject", f))
    assert worded.reason == text and worded.reasonSource == "claude"
    assert (worded.decision, worded.constraint, worded.policyId, worded.round, worded.agent) == (
        v.decision, v.constraint, v.policyId, v.round, v.agent)
    assert {k: x for k, x in worded.dict().items() if k not in ("reason", "reasonSource")} == \
           {k: x for k, x in v.dict().items() if k not in ("reason", "reasonSource")}


def test_question_choices_roles_and_recommendation_roles_unchanged(client):
    q = inventory.question("s", 1, "dev_unknown_7")
    client(answer("Is the Unidentified device in Imaging a scanner?"))
    worded = run(llm.worded(q, "question", facts.question(H, q, ["unknown_device_imaging"])))
    assert (worded.choices, worded.allowedRoles, worded.targetId, worded.id) == (q.choices, q.allowedRoles, q.targetId, q.id)
    assert worded.textSource == "claude"

    rec = sample_recommendation()
    client(answer("Contain imaging, keep scans flowing needs Security and Clinical engineering sign-off."))
    worded = run(llm.worded(rec, "recommendation", facts.recommendation(H, rec, result("baseline"), 2)))
    assert worded.requiredRoles == rec.requiredRoles == ["security", "clinical_engineering"]
    assert worded.testResult == rec.testResult and worded.policy == rec.policy and worded.verdicts == rec.verdicts
    assert worded.explanationSource == "claude"


def test_with_text_refuses_to_change_anything_else():
    v, _ = reject_verdict()
    assert llm.with_text(v, "words", "asi1").constraint == v.constraint
    with pytest.raises(KeyError):
        llm.with_text(v.constraint, "words", "asi1")  # only message types with a text field


def test_question_facts_use_names_not_ids():
    q = inventory.question("s", 1, "dev_unknown_7")
    f = facts.question(H, q, ["unknown_device_imaging"])
    assert f["device"] == "Unidentified device" and f["room"] == "Imaging"
    assert f["connectedTo"] == ["Imaging WS 1 over SMB"]
    assert "dev_unknown_7" not in json.dumps(f)


# --- ASI:One ---


class FakeAsi1:
    def __init__(self, *replies):
        self.replies = list(replies)
        self.bodies = []

    async def __call__(self, body):
        self.bodies.append(body)
        reply = self.replies.pop(0)
        if isinstance(reply, Exception):
            raise reply
        status, content = reply
        return httpx.Response(status, json={"choices": [{"message": {"content": content}}]}, request=ASI1_REQUEST)


ASI1_REQUEST = httpx.Request("POST", llm.ASI1_URL)


@pytest.fixture
def asi1(monkeypatch):
    monkeypatch.setenv("ASI1_API_KEY", "test-key, never sent")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key, never sent")  # ASI:One wins when both are set
    monkeypatch.delenv("ASI1_MODEL", raising=False)

    def install(*replies):
        fake = FakeAsi1(*replies)
        monkeypatch.setattr(llm, "_asi1_post", fake)
        monkeypatch.setattr(llm, "_make_client", lambda: pytest.fail("Claude called while ASI1_API_KEY is set"))
        return fake

    return install


def test_asi1_writes_when_its_key_is_set(asi1):
    v, f = reject_verdict()
    fake = asi1((200, json.dumps({"text": "I can't accept this: it cuts a flow care needs."})))
    assert run(llm.explain("verdict_reject", f)) == ("I can't accept this: it cuts a flow care needs.", "asi1")
    body = fake.bodies[0]
    assert body["model"] == "asi1-mini" and body["messages"][0] == {"role": "system", "content": llm.SYSTEM}


def test_asi1_fenced_json_is_accepted(asi1):
    _, f = reject_verdict()
    asi1((200, '```json\n{"text": "I can\'t accept this: it cuts a flow care needs."}\n```'))
    assert run(llm.explain("verdict_reject", f))[1] == "asi1"


def test_asi1_bad_number_is_retried_then_breaks(asi1):
    _, f = reject_verdict()
    fake = asi1((200, json.dumps({"text": "Only 987 devices."})), (200, json.dumps({"text": "Still 987."})))
    with pytest.raises(llm.LlmError, match="rejected twice"):
        run(llm.explain("verdict_reject", f))
    assert len(fake.bodies) == 2
    assert "987" in fake.bodies[1]["messages"][-1]["content"]


@pytest.mark.parametrize("reply", [(400, "{}"), (401, "{}")])
def test_asi1_errors_break(asi1, reply):
    _, f = reject_verdict()
    asi1(reply)
    with pytest.raises(llm.LlmError):
        run(llm.explain("verdict_reject", f))


def test_asi1_transient_errors_are_asked_again(asi1, monkeypatch):
    monkeypatch.setattr(llm, "API_BACKOFF_S", 0)
    _, f = reject_verdict()
    fake = asi1((500, "{}"), httpx.ConnectTimeout("slow"), (200, json.dumps({"text": "I can't accept this: it cuts a flow care needs."})))
    assert run(llm.explain("verdict_reject", f))[1] == "asi1"
    assert len(fake.bodies) == 3


def test_asi1_gives_up_after_three_tries_and_a_400_is_not_retried(asi1, monkeypatch):
    monkeypatch.setattr(llm, "API_BACKOFF_S", 0)
    _, f = reject_verdict()
    fake = asi1((503, "{}"), (503, "{}"), (503, "{}"))
    with pytest.raises(llm.LlmError, match="503"):
        run(llm.explain("verdict_reject", f))
    assert len(fake.bodies) == 3
    fake = asi1((400, "{}"))
    with pytest.raises(llm.LlmError, match="400"):
        run(llm.explain("verdict_reject", f))
    assert len(fake.bodies) == 1
