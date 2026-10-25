"""The reasoning loop behind every agent's ASI:One chat (rule 8: a model picks tools and
writes prose; code runs the tools and has already made every decision).

respond() sends the sender's history, the system prompt and the user's text to ASI:One
(`asi1`, OpenAI-style function calling) or, when only ANTHROPIC_API_KEY is set, to Claude,
runs each tool the model asks for (up to MAX_TOOL_ROUNDS), and checks the final text the
way llm.py checks a worded message: no forbidden words, and every number in it appears in
this turn's tool results or the user's text. One retry with the errors, then BrainError:
the agent replies with the error (rule 14, no fallback prose).
"""

import json
import os
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable

import anthropic
import httpx

import llm

MAX_TOOL_ROUNDS = 6
HISTORY_TURNS = 20
TIMEOUT_S = 30.0
CLAUDE_MAX_TOKENS = 600
ASI1_CHAT_MODEL = "asi1"  # the tool-calling model for chat; ASI1_CHAT_MODEL overrides. Round wording keeps llm.py's model.


def chat_model() -> str:
    return os.environ.get("ASI1_CHAT_MODEL", "").strip() or ASI1_CHAT_MODEL


class BrainError(Exception):
    """No usable reply. The chat handler sends the error text."""


@dataclass
class Tool:
    name: str
    description: str
    parameters: dict  # JSON schema, type object
    call: Callable[[dict], Awaitable[Any]]  # returns something JSON-serialisable


@dataclass
class Turn:
    text: str
    tools_called: list[str] = field(default_factory=list)
    results: dict[str, Any] = field(default_factory=dict)  # tool name → its last result, this turn
    source: str = "asi1"


def history_key(sender: str) -> str:
    return "chat:" + sender


# --- transports ---


async def _asi1_post(body: dict, session_id: str | None = None) -> dict:
    key = os.environ.get("ASI1_API_KEY", "").strip()
    headers = {"Authorization": f"Bearer {key}"}
    if session_id:
        headers["x-session-id"] = session_id
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT_S) as client:
            resp = await client.post(llm.ASI1_URL, json=body, headers=headers)
    except httpx.HTTPError as e:
        raise BrainError(f"could not reach ASI:One: {e}") from e
    if resp.status_code != 200:
        raise BrainError(f"ASI:One error {resp.status_code}: {resp.text[:200]}")
    return resp.json()


async def _claude(system: str, messages: list[dict], tools: list[dict]) -> dict:
    """One Claude call; messages and tools in Claude's shape. Returns response.model_dump()."""
    params: dict[str, Any] = dict(model=llm._model(), max_tokens=CLAUDE_MAX_TOKENS, system=system, messages=messages)
    if tools:
        params["tools"] = tools
    try:
        response = await llm._make_client().messages.create(**params)
    except anthropic.APIError as e:
        raise BrainError(f"Claude error: {e}") from e
    return response.model_dump()


# --- checks ---


def problems(text: str, allowed: set[str]) -> list[str]:
    errors = []
    invented = sorted({n for n in llm.NUMBER.findall(text) if llm._norm(n) not in allowed})
    if invented:
        errors.append(f"uses numbers that no tool returned this turn: {', '.join(invented)}")
    words = sorted({m.group(0).lower() for m in llm.FORBIDDEN.finditer(text)})
    if words:
        errors.append(f"uses forbidden words: {', '.join(words)}")
    if not text.strip():
        errors.append("is empty")
    return errors


def _retry_prompt(errors: list[str]) -> str:
    return "That reply can't be used: it " + "; it ".join(errors) + ". Write it again, following every rule."


# --- the loop ---


async def respond(storage, who: str, sender: str, text: str, tools: list[Tool], system: str,
                  session_id: str | None = None, _post=None) -> Turn:
    asi1 = bool(os.environ.get("ASI1_API_KEY", "").strip()) or _post is not None
    if not asi1 and not os.environ.get("ANTHROPIC_API_KEY", "").strip():
        raise BrainError("neither ASI1_API_KEY nor ANTHROPIC_API_KEY is set, so no model can answer the chat")
    history = list(storage.get(history_key(sender)) or [])
    by_name = {t.name: t for t in tools}
    turn = Turn(text="", source="asi1" if asi1 else "claude")
    allowed = llm.fact_numbers(text)

    async def run_tool(name: str, args: dict) -> Any:
        tool = by_name.get(name)
        if tool is None:
            return {"error": f"unknown tool {name}"}
        try:
            result = await tool.call(args)
        except Exception as e:  # a tool's failure is a fact the model may report, never a crash
            result = {"error": f"{e.__class__.__name__}: {e}"}
        turn.tools_called.append(name)
        turn.results[name] = result
        allowed.update(llm.fact_numbers(result))
        return result

    if asi1:
        post = _post or (lambda body: _asi1_post(body, session_id))
        text_out = await _asi1_loop(post, system, history, text, tools, run_tool)
    else:
        text_out = await _claude_loop(system, history, text, tools, run_tool)

    async def check_and_retry(text_out: str, again) -> str:
        errors = problems(text_out, allowed)
        if not errors:
            return text_out
        text_out = await again(text_out, _retry_prompt(errors))
        errors = problems(text_out, allowed)
        if errors:
            raise BrainError(f"{turn.source}'s reply was rejected twice: " + "; ".join(errors))
        return text_out

    if asi1:
        async def again(prev: str, prompt: str) -> str:
            return await _asi1_loop(post, system, history, text, tools, run_tool,
                                    extra=[{"role": "assistant", "content": prev}, {"role": "user", "content": prompt}])
    else:
        async def again(prev: str, prompt: str) -> str:
            return await _claude_loop(system, history, text, tools, run_tool,
                                      extra=[{"role": "assistant", "content": prev}, {"role": "user", "content": prompt}])
    turn.text = await check_and_retry(text_out, again)

    history += [{"role": "user", "content": text}, {"role": "assistant", "content": turn.text}]
    storage.set(history_key(sender), history[-2 * HISTORY_TURNS:])
    return turn


def _openai_tools(tools: list[Tool]) -> list[dict]:
    return [{"type": "function", "function": {"name": t.name, "description": t.description, "parameters": t.parameters}}
            for t in tools]


async def _asi1_loop(post, system: str, history: list[dict], text: str, tools: list[Tool], run_tool,
                     extra: list[dict] | None = None) -> str:
    messages = [{"role": "system", "content": system}, *history, {"role": "user", "content": text}, *(extra or [])]
    body = {"model": chat_model(), "messages": messages, "temperature": 0}
    if tools:
        body["tools"] = _openai_tools(tools)
    for _ in range(MAX_TOOL_ROUNDS):
        try:
            data = await post(body)
        except BrainError:
            raise
        except Exception as e:  # a transport or parsing failure is shown to the user (rule 14)
            raise BrainError(f"ASI:One call failed: {e.__class__.__name__}: {e}") from e
        try:
            msg = data["choices"][0]["message"]
        except (KeyError, IndexError, TypeError) as e:
            raise BrainError("ASI:One sent no message") from e
        calls = msg.get("tool_calls") or []
        if not calls:
            return (msg.get("content") or "").strip()
        messages.append({"role": "assistant", "content": msg.get("content"), "tool_calls": calls})
        for c in calls:
            fn = c.get("function", {})
            try:
                args = json.loads(fn.get("arguments") or "{}")
            except json.JSONDecodeError:
                args = {}
            result = await run_tool(fn.get("name", ""), args if isinstance(args, dict) else {})
            messages.append({"role": "tool", "tool_call_id": c.get("id"), "name": fn.get("name"),
                             "content": json.dumps(result, ensure_ascii=False)})
        body = {**body, "messages": messages}
    raise BrainError(f"the model kept calling tools after {MAX_TOOL_ROUNDS} rounds")


def _claude_tools(tools: list[Tool]) -> list[dict]:
    return [{"name": t.name, "description": t.description, "input_schema": t.parameters} for t in tools]


async def _claude_loop(system: str, history: list[dict], text: str, tools: list[Tool], run_tool,
                       extra: list[dict] | None = None) -> str:
    messages = [*history, {"role": "user", "content": text}, *(extra or [])]
    ctools = _claude_tools(tools)
    for _ in range(MAX_TOOL_ROUNDS):
        data = await _claude(system, messages, ctools)
        blocks = data.get("content") or []
        uses = [b for b in blocks if b.get("type") == "tool_use"]
        if not uses:
            return " ".join(b.get("text", "") for b in blocks if b.get("type") == "text").strip()
        messages.append({"role": "assistant", "content": blocks})
        results = []
        for u in uses:
            result = await run_tool(u.get("name", ""), u.get("input") or {})
            results.append({"type": "tool_result", "tool_use_id": u.get("id"), "content": json.dumps(result, ensure_ascii=False)})
        messages.append({"role": "user", "content": results})
    raise BrainError(f"the model kept calling tools after {MAX_TOOL_ROUNDS} rounds")
