"""A model writes the words; code has already decided (AGENTS.md rule 7).

explain(kind, facts) and question_text(facts) return (text, source). The facts come
from code (facts.py). Claude's answer must be JSON {"text": ...} and pass three
checks: every number in it appears in the facts, none of the forbidden words, and
1-2 sentences of at most 280 characters. On a failure it gets one retry with the
errors listed. If that fails too, or the API errors or times out, or there is no
key, explain() raises LlmError: there is no fallback text. The agent's step fails and
the error is shown (rule 14).

The writer is ASI:One (asi1-mini, OpenAI-style API at api.asi1.ai) when ASI1_API_KEY is
set, else Claude when ANTHROPIC_API_KEY is set; source names which one wrote the text.

with_text() puts the text on a message and refuses to change anything else.
"""

import asyncio
import json
import logging
import os
import re
from typing import Any, Literal

import anthropic
import httpx
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from protocol import Alternative, Proposal, Question, Recommendation, Revision, Strict, Verdict

log = logging.getLogger("llm")

DEFAULT_MODEL = "claude-haiku-5-5"
ASI1_DEFAULT_MODEL = "asi1-mini"
ASI1_URL = os.environ.get("ASI1_BASE_URL", "https://api.asi1.ai/v1").rstrip("/") + "/chat/completions"
MAX_TOKENS = 200
TIMEOUT_S = 20.0
MAX_CHARS = 280
Kind = Literal["verdict_accept", "verdict_reject", "proposal", "revision", "recommendation", "question"]
Source = Literal["claude", "asi1"]

# Prompt rules: no "approved", "ready" or "safe to deploy" for agent output (humans approve),
# and no outcome language. Whole words, so "already" is fine.
FORBIDDEN = re.compile(r"\b(approved|ready|safe to deploy|deaths?|died|fatal|mortality)\b", re.IGNORECASE)
NUMBER = re.compile(r"\d+(?:[.,]\d+)?")
SENTENCE_END = re.compile(r"[.!?](?=\s|$)")


class Answer(BaseModel):
    """What Claude must return. Unknown fields are rejected (AGENTS.md rule 11)."""

    model_config = ConfigDict(extra="forbid")
    text: str = Field(min_length=1)


ANSWER_SCHEMA = {
    "type": "object",
    "properties": {"text": {"type": "string"}},
    "required": ["text"],
    "additionalProperties": False,
}

VOICE = {
    "verdict_accept": "Write as the agent named in the facts, in the first person, accepting the plan. Start with \"I accept this:\" and say why, from the facts.",
    "verdict_reject": "Write as the agent named in the facts, in the first person, rejecting the plan. Start with \"I can't accept this:\" and name what breaks, from the facts (the constraint added says what it needs instead).",
    "proposal": "Write as the Flow Agent, in the first person: why this plan, comparing infected devices with and without it.",
    "revision": "Write as the Flow Agent, in the first person: what the revision changes and which constraint it meets.",
    "recommendation": "Write as the Sign-off Coordinator: why the plan works, from the numbers, and which roles must sign off. Agents agreeing is not approval; humans decide.",
    "question": "Write as the Inventory Agent, asking a human what this device is. Name the device, its room and what it connects to. End with a question mark.",
}

SYSTEM = (
    "You write one chat message for an agent in a hospital network-segmentation simulator. "
    "Code has already made every decision; you only put it into words, and you never change it. "
    "Use only the facts given. Do not use any number that is not in the facts. "
    "Use the human names from the facts, never ids. "
    "Say what each number counts exactly as its fact name does: patients with care delayed or disrupted are harmed, "
    "not protected; do not do arithmetic, use the differences given. "
    "1 or 2 sentences, at most 280 characters, plain language, no markdown, readable in a chat bubble. "
    "Never write approved, ready, or safe to deploy: humans approve. "
    "Never mention deaths or clinical outcomes. "
    'Reply with JSON only: {"text": "..."}'
)


# --- checks ---


def fact_numbers(facts: Any) -> set[str]:
    """Every number in any fact value, including those inside names ("MRI 2" → "2")."""
    out: set[str] = set()
    if isinstance(facts, dict):
        for v in facts.values():
            out |= fact_numbers(v)
    elif isinstance(facts, (list, tuple)):
        for v in facts:
            out |= fact_numbers(v)
    elif isinstance(facts, bool):
        pass
    elif facts is not None:
        out |= {_norm(n) for n in NUMBER.findall(str(facts))}
    return out


def _norm(n: str) -> str:
    n = n.replace(",", "")
    return str(int(float(n))) if float(n).is_integer() else str(float(n))


def problems(text: str, facts: dict) -> list[str]:
    """Why a text can't be used. Empty means it passes."""
    errors = []
    allowed = fact_numbers(facts)
    invented = sorted({n for n in NUMBER.findall(text) if _norm(n) not in allowed})
    if invented:
        errors.append(f"uses numbers that are not in the facts: {', '.join(invented)}")
    words = sorted({m.group(0).lower() for m in FORBIDDEN.finditer(text)})
    if words:
        errors.append(f"uses forbidden words: {', '.join(words)}")
    if len(text) > MAX_CHARS:
        errors.append(f"is {len(text)} characters; the limit is {MAX_CHARS}")
    sentences = len(SENTENCE_END.findall(text.strip())) or 1
    if sentences > 2:
        errors.append(f"has {sentences} sentences; write 1 or 2")
    return errors


# --- Claude ---


def _make_client() -> anthropic.AsyncAnthropic:
    # The SDK's own retries would multiply the 10 s budget; we retry once, ourselves, on bad output.
    return anthropic.AsyncAnthropic(timeout=TIMEOUT_S, max_retries=0)


def _model() -> str:
    return os.environ.get("ANTHROPIC_MODEL", "").strip() or DEFAULT_MODEL


def _request(model: str, messages: list[dict]) -> dict:
    params: dict[str, Any] = dict(
        model=model,
        max_tokens=MAX_TOKENS,
        system=SYSTEM,
        messages=messages,
        output_config={"effort": "low", "format": {"type": "json_schema", "schema": ANSWER_SCHEMA}},
    )
    if model.startswith("claude-haiku"):
        # Haiku 5.5 thinks by default; a 200-token answer has no room for it.
        params["thinking"] = {"type": "disabled"}
    return params


def _text_of(response) -> str:
    if getattr(response, "stop_reason", None) == "refusal":
        raise _BadAnswer("the model declined")
    raw = next((b.text for b in response.content if getattr(b, "type", None) == "text"), None)
    if raw is None:
        raise _BadAnswer("no text in the response")
    try:
        return Answer.model_validate_json(raw).text.strip()
    except ValidationError as e:
        raise _BadAnswer(f"not the JSON asked for: {e.errors()[0]['msg']}") from e


class _BadAnswer(Exception):
    pass


class LlmError(Exception):
    """No model could word this message. Never replaced by a template."""


class _ApiFailed(Exception):
    def __init__(self, message: str, transient: bool = True):
        super().__init__(message)
        self.transient = transient  # a timeout, connection error, 429 or 5xx: worth asking again


API_TRIES = 3  # the same model call, asked again after a transient error; never a fallback
API_BACKOFF_S = 1.0


async def _ask_with_retries(ask, messages: list[dict]) -> str:
    for attempt in range(1, API_TRIES + 1):
        try:
            return await ask(messages)
        except _ApiFailed as e:
            if not e.transient or attempt == API_TRIES:
                raise
            log.warning(f"llm: {e}; asking again ({attempt + 1}/{API_TRIES})")
            await asyncio.sleep(API_BACKOFF_S * attempt)
    raise AssertionError("unreachable")


def _transient(status: int) -> bool:
    return status == 429 or status >= 500


async def _ask_claude(messages: list[dict]) -> str:
    try:
        return _text_of(await _make_client().messages.create(**_request(_model(), messages)))
    except anthropic.APITimeoutError as e:
        raise _ApiFailed(f"timed out after {TIMEOUT_S:.0f} s") from e
    except anthropic.APIConnectionError as e:
        raise _ApiFailed(f"could not reach the API: {e}") from e
    except anthropic.APIStatusError as e:
        raise _ApiFailed(f"API error {e.status_code}: {e.message}", _transient(e.status_code)) from e


# --- ASI:One ---


async def _asi1_post(body: dict) -> httpx.Response:
    """One ASI:One chat completion (OpenAI-style). Tests replace this. Longer answers get longer to arrive."""
    key = os.environ.get("ASI1_API_KEY", "").strip()
    async with httpx.AsyncClient(timeout=TIMEOUT_S * (3 if body.get("max_tokens", 0) > MAX_TOKENS else 1)) as client:
        return await client.post(ASI1_URL, json=body, headers={"Authorization": f"Bearer {key}"})


def _asi1_model() -> str:
    return os.environ.get("ASI1_MODEL", "").strip() or ASI1_DEFAULT_MODEL


async def _ask_asi1(messages: list[dict]) -> str:
    body = {"model": _asi1_model(), "max_tokens": MAX_TOKENS, "temperature": 0,
            "messages": [{"role": "system", "content": SYSTEM}, *messages]}
    try:
        resp = await _asi1_post(body)
    except httpx.TimeoutException as e:
        raise _ApiFailed(f"ASI:One timed out after {TIMEOUT_S:.0f} s") from e
    except httpx.HTTPError as e:
        raise _ApiFailed(f"could not reach ASI:One: {e}") from e
    if resp.status_code != 200:
        raise _ApiFailed(f"ASI:One error {resp.status_code}: {resp.text[:200]}", _transient(resp.status_code))
    try:
        raw = resp.json()["choices"][0]["message"]["content"] or ""
    except (ValueError, KeyError, IndexError, TypeError) as e:
        raise _BadAnswer("no text in the response") from e
    raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw.strip())  # some answers come fenced
    try:
        return Answer.model_validate_json(raw).text.strip()
    except ValidationError as e:
        raise _BadAnswer(f"not the JSON asked for: {e.errors()[0]['msg']}") from e


def _writer() -> tuple[Any, Source] | None:
    if os.environ.get("ASI1_API_KEY", "").strip():
        return _ask_asi1, "asi1"
    if os.environ.get("ANTHROPIC_API_KEY", "").strip():
        return _ask_claude, "claude"
    return None


async def explain(kind: Kind, facts: dict) -> tuple[str, Source]:
    writer = _writer()
    if writer is None:
        raise LlmError("neither ASI1_API_KEY nor ANTHROPIC_API_KEY is set, so no model can word the agents' messages")

    ask, source = writer
    prompt = f"{VOICE[kind]}\n\nFacts (JSON):\n{json.dumps(facts, ensure_ascii=False, indent=1)}"
    messages = [{"role": "user", "content": prompt}]
    last = ""
    for attempt in (1, 2):
        try:
            text = await _ask_with_retries(ask, messages)
            errors = problems(text, facts)
            last = text
        except _BadAnswer as e:
            errors, text = [str(e)], last
        except _ApiFailed as e:
            raise LlmError(f"{source} could not word the {kind} message: {e}") from e
        if not errors:
            return text, source
        if attempt == 1:
            messages += [
                {"role": "assistant", "content": json.dumps({"text": text})},
                {"role": "user", "content": "That text can't be used: it " + "; it ".join(errors)
                 + ". Write it again, following every rule, as JSON {\"text\": \"...\"}."},
            ]
    raise LlmError(f"{source}'s {kind} text was rejected twice: " + "; ".join(errors))


async def question_text(facts: dict) -> tuple[str, Source]:
    return await explain("question", facts)


# --- putting text on a message, and nothing else ---

TEXT_FIELDS: dict[type, tuple[str, str]] = {
    Alternative: ("reason", "reasonSource"),
    Verdict: ("reason", "reasonSource"),
    Proposal: ("reason", "reasonSource"),
    Revision: ("reason", "reasonSource"),
    Question: ("text", "textSource"),
    Recommendation: ("explanation", "explanationSource"),
}


class DecisionChanged(AssertionError):
    pass


def with_text(msg: Strict, text: str, source: Source) -> Strict:
    """The same message with its text field set. Raises if anything else would change
    (rule 7: model output never sets a decision, constraint, role, choice or number)."""
    field, source_field = TEXT_FIELDS[type(msg)]
    new = type(msg).parse_obj({**msg.dict(), field: text, source_field: source})
    before, after = msg.dict(), new.dict()
    for d in (before, after):
        d.pop(field)
        d.pop(source_field)
    if before != after:
        raise DecisionChanged(f"setting {type(msg).__name__}.{field} changed other fields")
    return new


async def worded(msg: Strict, kind: Kind, facts: dict) -> Strict:
    text, source = await explain(kind, facts)
    return with_text(msg, text, source)


# --- propose(): the Flow Agent's strategies, from the model; code tests and decides ---

PROPOSE_SYSTEM = (
    "You are a hospital network security engineer designing ransomware segmentation for the hospital described. "
    "Ransomware spreads from machine to machine over file sharing (smb) and remote desktop (rdp) using stolen admin logins; "
    "clinical traffic (hl7, dicom, https) does not carry it. Design 2 or 3 genuinely different segmentation plans for this "
    "hospital and this attack: for example by department, by device class, around the servers, or around where the attack "
    "started. Keep clinical work running: avoid cutting what departments clearly need. Each plan is a list of connection ids "
    "to cut, chosen only from the ids given. Any numbers you write are ignored: every plan is tested in a simulator, and "
    "humans decide. Never write approved, ready or safe to deploy. "
    'Reply with JSON only: {"plans": [{"name": "...", "strategy": "least_disruption|max_containment|protect_critical_care", '
    '"rationale": "one sentence", "tradeoff": "one sentence", "cut": ["fl_1", ...]}]}'
)
PROPOSE_TOKENS = 1500


class ProposedPlan(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=3, max_length=80)
    strategy: Literal["least_disruption", "max_containment", "protect_critical_care"]
    rationale: str = Field(min_length=1, max_length=300)
    tradeoff: str = Field(min_length=1, max_length=300)
    cut: list[str] = Field(min_length=1, max_length=60)


class ProposedPlans(BaseModel):
    model_config = ConfigDict(extra="forbid")
    plans: list[ProposedPlan] = Field(min_length=1, max_length=3)


async def _raw(messages: list[dict], system: str, max_tokens: int) -> str:
    """One model call returning raw text (ASI:One first, else Claude)."""
    if os.environ.get("ASI1_API_KEY", "").strip():
        body = {"model": _asi1_model(), "max_tokens": max_tokens, "temperature": 0,
                "messages": [{"role": "system", "content": system}, *messages]}
        try:
            resp = await _asi1_post(body)
        except httpx.TimeoutException as e:
            raise _ApiFailed(f"ASI:One timed out after {TIMEOUT_S:.0f} s") from e
        except httpx.HTTPError as e:
            raise _ApiFailed(f"could not reach ASI:One: {e}") from e
        if resp.status_code != 200:
            raise _ApiFailed(f"ASI:One error {resp.status_code}: {resp.text[:200]}", _transient(resp.status_code))
        return (resp.json()["choices"][0]["message"]["content"] or "").strip()
    if os.environ.get("ANTHROPIC_API_KEY", "").strip():
        try:
            r = await _make_client().messages.create(model=_model(), max_tokens=max_tokens, system=system, messages=messages)
        except anthropic.APIStatusError as e:
            raise _ApiFailed(f"API error {e.status_code}: {e.message}", _transient(e.status_code)) from e
        except (anthropic.APITimeoutError, anthropic.APIConnectionError) as e:
            raise _ApiFailed(f"could not reach the API: {e}") from e
        return next((b.text for b in r.content if getattr(b, "type", None) == "text"), "").strip()
    raise LlmError("neither ASI1_API_KEY nor ANTHROPIC_API_KEY is set, so no model can propose plans")


async def propose(facts: dict, valid_ids: set[str]) -> list[ProposedPlan]:
    """2-3 plans from the model for this hospital and attack. Checked: strict JSON, known
    connection ids only, no forbidden words. One retry with the errors, then LlmError (no fallback)."""
    messages = [{"role": "user", "content": "Hospital and attack (JSON):\n" + json.dumps(facts, ensure_ascii=False)}]
    for attempt in (1, 2):
        raw = await _ask_with_retries(lambda m: _raw(m, PROPOSE_SYSTEM, PROPOSE_TOKENS), messages)
        raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw)
        errors: list[str] = []
        try:
            plans = ProposedPlans.model_validate_json(raw).plans
        except ValidationError as e:
            plans, errors = [], [f"not the JSON asked for: {e.errors()[0]['loc']}: {e.errors()[0]['msg']}"]
        for p in plans:
            unknown = sorted(set(p.cut) - valid_ids)
            if unknown:
                errors.append(f"plan {p.name!r} cuts unknown ids {unknown[:5]}")
            if FORBIDDEN.search(" ".join((p.name, p.rationale, p.tradeoff))):
                errors.append(f"plan {p.name!r} uses forbidden words")
        if not errors:
            return plans
        if attempt == 1:
            messages += [{"role": "assistant", "content": raw},
                         {"role": "user", "content": "Fix these and reply with the JSON only: " + "; ".join(errors)}]
    raise LlmError("the model's plans were rejected twice: " + "; ".join(errors))
