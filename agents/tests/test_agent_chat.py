"""The specialists' chat: the profile intro as a tool, and the handler on the reasoning
loop, relaying both lines. brain.respond is replaced; no network."""

import asyncio
import json

import agent_chat
import brain


def run(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


def test_intro_comes_from_the_profile_without_markdown():
    for name in ("inventory", "flow", "clinical_workflow"):
        text = agent_chat.intro(name)
        assert "Hippocra.tech" in text
        assert not any(ch in text for ch in "#*`>")
        assert "Specialist agent" not in text  # the blockquote is skipped


def test_intro_and_last_said_are_tools():
    agent_chat.last_said.clear()
    tools = {t.name: t for t in (agent_chat.intro_tool("flow"), agent_chat.last_said_tool("flow"))}
    assert "Hippocra.tech" in run(tools["who_am_i"].call({}))["intro"]
    assert run(tools["last_said"].call({})).get("none") is True
    agent_chat.note("flow", 'proposal "Isolate imaging": cuts the path.')
    assert run(tools["last_said"].call({}))["said"].startswith("proposal")


def test_handler_relays_in_and_out_and_sends_once(monkeypatch, tmp_path):
    monkeypatch.setenv("RELAY_LOG_DIR", str(tmp_path))
    monkeypatch.delenv("WATCHER_RELAY_URL", raising=False)
    monkeypatch.setenv("ASI1_API_KEY", "k")
    seen = {}

    async def fake_respond(storage, who, sender, text, tools, system, session_id=None):
        seen["who"], seen["text"], seen["tools"] = who, text, {t.name for t in tools}
        return brain.Turn(text="Two devices have no owner on record.", source="asi1")

    monkeypatch.setattr(brain, "respond", fake_respond)
    sent = []

    async def fake_send(ctx, to, message):
        sent.append((to, message))

    monkeypatch.setattr(agent_chat, "send_chat", fake_send)
    from uagents_core.contrib.protocols.chat import ChatMessage, TextContent
    ctx = agent_chat.ctx_stub()
    msg = ChatMessage(content=[TextContent(text="which devices can't you identify?")])
    run(agent_chat.handle_chat(ctx, "inventory", "agent1qjudge", msg, lambda: []))
    assert seen["who"] == "inventory" and seen["text"] == "which devices can't you identify?"
    assert {"who_am_i", "last_said", "lookup_device"} <= seen["tools"]
    rows = [json.loads(l) for l in (tmp_path / "asi1-chat.jsonl").read_text().splitlines()]
    chat = [(r["from"], r["to"], r["payload"]["text"]) for r in rows if r["type"] == "chat"]
    assert chat == [("humans", "inventory", "which devices can't you identify?"),
                    ("inventory", "humans", "Two devices have no owner on record.")]
    texts = [m for to, m in sent if isinstance(m, ChatMessage)]
    assert len(texts) == 1 and texts[0].text() == "Two devices have no owner on record."


def test_handler_sends_the_error_when_the_loop_fails(monkeypatch, tmp_path):
    monkeypatch.setenv("RELAY_LOG_DIR", str(tmp_path))
    monkeypatch.delenv("WATCHER_RELAY_URL", raising=False)

    async def boom(*a, **k):
        raise brain.BrainError("ASI:One error 500")

    monkeypatch.setattr(brain, "respond", boom)
    sent = []

    async def fake_send(ctx, to, message):
        sent.append(message)

    monkeypatch.setattr(agent_chat, "send_chat", fake_send)
    from uagents_core.contrib.protocols.chat import ChatMessage, TextContent
    run(agent_chat.handle_chat(agent_chat.ctx_stub(), "flow", "agent1qjudge",
                               ChatMessage(content=[TextContent(text="hi")]), lambda: []))
    assert any(isinstance(m, ChatMessage) and "ASI:One error 500" in m.text() for m in sent)
