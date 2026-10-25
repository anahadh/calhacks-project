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


def test_coordinator_as_sender_is_not_relayed_as_a_human(monkeypatch, tmp_path):
    """The Coordinator's ask_agent already relays both ends; the specialist must not add
    humans→agent rows for a question no human typed (rule 10 attribution)."""
    import addresses
    monkeypatch.setenv("RELAY_LOG_DIR", str(tmp_path))
    monkeypatch.delenv("WATCHER_RELAY_URL", raising=False)

    async def fake_respond(storage, who, sender, text, tools, system, session_id=None):
        return brain.Turn(text="Two devices.", source="asi1")

    monkeypatch.setattr(brain, "respond", fake_respond)

    async def fake_send(ctx, to, message):
        pass

    monkeypatch.setattr(agent_chat, "send_chat", fake_send)
    from uagents_core.contrib.protocols.chat import ChatMessage, TextContent
    run(agent_chat.handle_chat(agent_chat.ctx_stub(), "inventory", addresses.address("coordinator"),
                               ChatMessage(content=[TextContent(text="which devices?")]), lambda: []))
    assert not (tmp_path / "asi1-chat.jsonl").exists()


def test_handler_reports_any_failure_as_the_reply(monkeypatch, tmp_path):
    monkeypatch.setenv("RELAY_LOG_DIR", str(tmp_path))
    monkeypatch.delenv("WATCHER_RELAY_URL", raising=False)

    async def boom(*a, **k):
        raise RuntimeError("relay down")

    monkeypatch.setattr(agent_chat.mcp_server, "as_brain_tools", boom)
    sent = []

    async def fake_send(ctx, to, message):
        sent.append(message)

    monkeypatch.setattr(agent_chat, "send_chat", fake_send)
    from uagents_core.contrib.protocols.chat import ChatMessage, TextContent
    run(agent_chat.handle_chat(agent_chat.ctx_stub(), "flow", "agent1qjudge",
                               ChatMessage(content=[TextContent(text="hi")]), lambda: []))
    assert any(isinstance(m, ChatMessage) and "RuntimeError: relay down" in m.text() for m in sent)


def test_on_chat_does_not_block_the_message_queue(monkeypatch):
    """A judge's chat must not hold the specialist's inbound queue for the model's round trips."""
    started = asyncio.Event()
    release = asyncio.Event()

    async def slow_handle(ctx, name, sender, msg, tools):
        started.set()
        await release.wait()

    monkeypatch.setattr(agent_chat, "handle_chat", slow_handle)

    async def scenario():
        from uagents_core.contrib.protocols.chat import ChatMessage, TextContent
        on_chat = agent_chat.chat_handler("flow", lambda: [])
        await on_chat(agent_chat.ctx_stub(), "agent1qjudge", ChatMessage(content=[TextContent(text="hi")]))
        await asyncio.sleep(0)
        assert started.is_set() and not release.is_set()  # the handler returned while the turn is still running
        release.set()
        await asyncio.sleep(0)

    run(scenario())
