"""Claude writes the words; code has already decided (AGENTS.md rule 7).

explain(kind, facts) and question_text(facts) return (text, source). The facts come
from code (facts.py). Claude's answer must be JSON {"text": ...} and pass three
checks: every number in it appears in the facts, none of the forbidden words, and
1-2 sentences of at most 280 characters. On a failure it gets one retry with the
errors listed. If that fails too, or the API errors or times out, or there is no
ANTHROPIC_API_KEY, the text is a plain template sentence built from the same facts,
and source says "template" (rule 13: never pass a template off as Claude's).

with_text() puts the text on a message and refuses to change anything else.
"""

import json
import logging
import os
import re
from typing import Any, Literal

import anthropic
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from protocol import Proposal, Question, Recommendation, Revision, Strict, Verdict

log = logging.getLogger("llm")

DEFAULT_MODEL = "claude-haiku-5-5"
MAX_TOKENS = 200
TIMEOUT_S = 10.0
MAX_CHARS = 280
Kind = Literal["verdict_accept", "verdict_reject", "proposal", "revision", "recommendation", "question"]
Source = Literal["claude", "template"]

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
    "1 or 2 sentences, at most 280 characters, plain language, no markdown, readable in a chat bubble. "
    "Never write approved, ready, or safe to deploy: humans approve. "
    "Never mention deaths or clinical outcomes. "
    'Reply with JSON only: {"text": "..."}'
)

_warned_no_key = False


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


# --- templates (no model) ---


def _n(count: int, noun: str) -> str:
    return f"{count} {noun}" if count == 1 else f"{count} {noun}s"


def _list(items: list[str], limit: int = 2) -> str:
    return "; ".join(items[:limit]) + (" and others" if len(items) > limit else "")


def template(kind: Kind, f: dict) -> str:
    if kind == "verdict_reject":
        if f.get("unidentifiedDevices"):
            return f"I can't accept this yet: it changes {_list(f['unidentifiedDevices'])}, and nobody has told me what that is."
        if f.get("brokenProtectedFlows"):
            return (f"I can't accept this: it breaks {_n(f['protectedFlowsBroken'], 'protected flow')}, "
                    f"including {f['brokenProtectedFlows'][0]}.")
        if f.get("criticalServicesDownTooLong"):
            return f"I can't accept this: {_list(f['criticalServicesDownTooLong'])} would stay down too long."
        return f"I can't accept {f['plan']}: {f.get('constraintAdded', 'it breaks a constraint')}."
    if kind == "verdict_accept":
        if f["agent"] == "Inventory Agent":
            return f"I accept this: every device {f['plan']} changes is identified."
        return f"I accept this: {f['plan']} breaks no protected flow and keeps critical services up."
    if kind == "proposal":
        base = f.get("infectedDevicesWithoutPlan")
        compare = f" instead of {base} without a plan" if base is not None else ""
        return (f"{f['plan']}: {_n(f['infectedDevicesWithPlan'], 'infected device')}{compare}, "
                f"by cutting {_n(f['connectionsCut'], 'connection')}.")
    if kind == "revision":
        keep = f.get("protectedFlowsToKeep") or []
        if keep:
            more = f" and {f['protectedFlowsToKeepCount'] - 1} more" if len(keep) > 1 else ""
            meets = f", keeping {keep[0]}{more}"
        else:
            meets = f"; it meets: {f['constraintsToMeet'][0]}" if f.get("constraintsToMeet") else ""
        return f"Revised to {f['plan']}{meets}, with {_n(f['infectedDevicesWithPlan'], 'infected device')}."
    if kind == "recommendation":
        base = f.get("infectedDevicesWithoutPlan")
        compare = f" (vs {base} with no plan)" if base is not None else ""
        return (f"{f['plan']} holds the attack to {_n(f['infectedDevicesWithPlan'], 'infected device')}{compare}. "
                f"Sign-off needed from {', '.join(f['requiredSignOff'])}.")
    if kind == "question":
        links = f" It connects to {_list(f['connectedTo'], 1)}." if f.get("connectedTo") else ""
        return f"What kind of device is {f['device']} in {f['room']}?{links}"
    raise ValueError(kind)


def _fallback(kind: Kind, facts: dict, why: str) -> tuple[str, Source]:
    text = template(kind, facts)
    if problems(text, facts):  # a template bug, not a model one: fail loudly in tests
        raise AssertionError(f"template for {kind} fails its own checks: {problems(text, facts)}: {text!r}")
    if why:
        log.warning(f"llm: using the template for {kind}: {why}")
    return text, "template"


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


async def explain(kind: Kind, facts: dict) -> tuple[str, Source]:
    global _warned_no_key
    if not os.environ.get("ANTHROPIC_API_KEY", "").strip():
        if not _warned_no_key:
            log.warning("llm: ANTHROPIC_API_KEY is not set; agents' messages use template sentences (source: template)")
            _warned_no_key = True
        return _fallback(kind, facts, "")

    model = _model()
    prompt = f"{VOICE[kind]}\n\nFacts (JSON):\n{json.dumps(facts, ensure_ascii=False, indent=1)}"
    messages = [{"role": "user", "content": prompt}]
    client = _make_client()
    last = ""
    for attempt in (1, 2):
        try:
            response = await client.messages.create(**_request(model, messages))
            text = _text_of(response)
            errors = problems(text, facts)
            last = text
        except _BadAnswer as e:
            errors, text = [str(e)], last
        except anthropic.APITimeoutError:
            return _fallback(kind, facts, f"timed out after {TIMEOUT_S:.0f} s")
        except anthropic.APIConnectionError as e:
            return _fallback(kind, facts, f"could not reach the API: {e}")
        except anthropic.APIStatusError as e:
            return _fallback(kind, facts, f"API error {e.status_code}: {e.message}")
        if not errors:
            return text, "claude"
        if attempt == 1:
            messages += [
                {"role": "assistant", "content": json.dumps({"text": text})},
                {"role": "user", "content": "That text can't be used: it " + "; it ".join(errors)
                 + ". Write it again, following every rule, as JSON {\"text\": \"...\"}."},
            ]
    return _fallback(kind, facts, "rejected twice: " + "; ".join(errors))


async def question_text(facts: dict) -> tuple[str, Source]:
    return await explain("question", facts)


# --- putting text on a message, and nothing else ---

TEXT_FIELDS: dict[type, tuple[str, str]] = {
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
