"""brain.py: the tool-calling loop behind every agent's ASI:One chat. No network: ASI:One
and Claude are replaced by scripted replies."""

import asyncio
import json

import pytest

import brain


class Store(dict):
    def get(self, k):
        return super().get(k)

    def set(self, k, v):
        self[k] = v


def scripted(*replies):
    """Each reply is an assistant message: {"tool_calls": [...]} or {"content": "..."}."""
    it = iter(replies)
    seen = []

    async def post(body):
        seen.append(body)
        msg = {"role": "assistant", "content": None, **next(it)}
        return {"choices": [{"message": msg, "finish_reason": "tool_calls" if msg.get("tool_calls") else "stop"}]}

    return post, seen


def call(name, args, id="c1"):
    return {"id": id, "type": "function", "function": {"name": name, "arguments": json.dumps(args)}}


async def lookup(args):
    return {"name": "MRI 2", "zone": "imaging", "flows": 3}


TOOLS = [brain.Tool("lookup_device", "look up", {"type": "object", "properties": {"query": {"type": "string"}}}, lookup)]


def run(post, text, store=None, tools=TOOLS):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(
            brain.respond(store if store is not None else Store(), "coordinator", "agent1qs", text, tools, "sys", _post=post))
    finally:
        loop.close()


def test_tool_call_then_text(monkeypatch):
    monkeypatch.setenv("ASI1_API_KEY", "k")
    post, seen = scripted({"tool_calls": [call("lookup_device", {"query": "MRI 2"})]},
                          {"content": "MRI 2 is in imaging with 3 flows."})
    t = run(post, "what is MRI 2?")
    assert t.text == "MRI 2 is in imaging with 3 flows." and t.tools_called == ["lookup_device"] and t.source == "asi1"
    assert seen[1]["messages"][-1]["role"] == "tool"
    assert json.loads(seen[1]["messages"][-1]["content"])["zone"] == "imaging"
    assert seen[0]["tools"][0]["function"]["name"] == "lookup_device"
    assert seen[0]["messages"][0] == {"role": "system", "content": "sys"}


def test_invented_number_is_retried_once_then_error(monkeypatch):
    monkeypatch.setenv("ASI1_API_KEY", "k")
    post, seen = scripted({"content": "There are 99 devices."}, {"content": "There are 99 devices."})
    with pytest.raises(brain.BrainError, match="99"):
        run(post, "how many devices?")
    assert len(seen) == 2 and "99" in seen[1]["messages"][-1]["content"]


def test_number_from_the_users_text_is_allowed(monkeypatch):
    monkeypatch.setenv("ASI1_API_KEY", "k")
    post, _ = scripted({"content": "Starting from MRI 2."})
    assert run(post, "simulate from MRI 2").text == "Starting from MRI 2."


def test_number_from_a_previous_turn_is_not_allowed(monkeypatch):
    monkeypatch.setenv("ASI1_API_KEY", "k")
    store = Store()
    post, _ = scripted({"tool_calls": [call("lookup_device", {"query": "MRI 2"})]}, {"content": "3 flows."})
    run(post, "what is MRI?", store)
    post, _ = scripted({"content": "Still 3 flows."}, {"content": "Still 3 flows."})
    with pytest.raises(brain.BrainError):
        run(post, "and now?", store)


def test_forbidden_word_is_rejected(monkeypatch):
    monkeypatch.setenv("ASI1_API_KEY", "k")
    post, _ = scripted({"content": "The plan is approved."}, {"content": "The plan is approved."})
    with pytest.raises(brain.BrainError, match="approved"):
        run(post, "is it done?")


def test_history_is_kept_per_sender_and_capped(monkeypatch):
    monkeypatch.setenv("ASI1_API_KEY", "k")
    store = Store()
    for _ in range(25):
        post, seen = scripted({"content": "ok"})
        run(post, "hi", store)
    hist = store.get(brain.history_key("agent1qs"))
    assert len(hist) == 2 * brain.HISTORY_TURNS
    assert hist[-1] == {"role": "assistant", "content": "ok"}
    assert seen[0]["messages"][1]["role"] == "user"  # history follows the system prompt


def test_tool_loop_is_capped(monkeypatch):
    monkeypatch.setenv("ASI1_API_KEY", "k")
    post, seen = scripted(*([{"tool_calls": [call("lookup_device", {"query": "x"})]}] * 10))
    with pytest.raises(brain.BrainError, match="tool"):
        run(post, "loop")
    assert len(seen) == brain.MAX_TOOL_ROUNDS


def test_unknown_tool_returns_an_error_result(monkeypatch):
    monkeypatch.setenv("ASI1_API_KEY", "k")
    post, seen = scripted({"tool_calls": [call("nope", {})]}, {"content": "I can't."})
    assert run(post, "x").text == "I can't."
    assert "unknown tool" in json.loads(seen[1]["messages"][-1]["content"])["error"]


def test_claude_is_used_when_only_its_key_is_set(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "k")
    calls = []

    async def fake_claude(system, messages, tools):
        calls.append(messages)
        return {"content": [{"type": "text", "text": "hello"}], "stop_reason": "end_turn"}

    monkeypatch.setattr(brain, "_claude", fake_claude)
    t = run(None, "hi")
    assert t.text == "hello" and t.source == "claude" and calls


def test_claude_tool_use_round_trip(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "k")
    replies = iter([
        {"content": [{"type": "tool_use", "id": "t1", "name": "lookup_device", "input": {"query": "MRI 2"}}], "stop_reason": "tool_use"},
        {"content": [{"type": "text", "text": "3 flows."}], "stop_reason": "end_turn"},
    ])
    seen = []

    async def fake_claude(system, messages, tools):
        seen.append(messages)
        return next(replies)

    monkeypatch.setattr(brain, "_claude", fake_claude)
    t = run(None, "what is MRI 2?")
    assert t.text == "3 flows." and t.tools_called == ["lookup_device"]
    last = seen[1][-1]
    assert last["role"] == "user" and last["content"][0]["type"] == "tool_result" and last["content"][0]["tool_use_id"] == "t1"


def test_no_key_is_an_error(monkeypatch):
    with pytest.raises(brain.BrainError, match="ASI1_API_KEY"):
        run(None, "hi")
