"""coordinator.py's ASI:One chat on the reasoning loop: local tools, the turn, cards and
the once-only summary. brain.respond is replaced; no network."""

import asyncio

import pytest

import brain


def run(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@pytest.fixture
def coord(monkeypatch, tmp_path):
    monkeypatch.setenv("RELAY_LOG_DIR", str(tmp_path))
    monkeypatch.delenv("WATCHER_RELAY_URL", raising=False)
    monkeypatch.setenv("HIPPO_SIM_FIXTURES", "1")
    monkeypatch.setenv("ASI1_API_KEY", "k")
    import coordinator
    sent = []

    async def fake_send(ctx, to, message, session_id, text=None, card=None):
        sent.append((to, message, session_id, text, card))

    monkeypatch.setattr(coordinator, "chat_send", fake_send)
    coordinator.rounds.clear()
    coordinator.chats.clear()
    coordinator.last_session.clear()
    coordinator.picked.clear()
    return coordinator, sent


def names(tools):
    return {t.name for t in tools}


def turn(text, called=()):
    return brain.Turn(text=text, tools_called=list(called), results={}, source="asi1")


def test_local_tools_exist(coord):
    c, _ = coord
    assert {"start_round", "round_status", "recommendation", "show_device_picker", "ask_agent"} <= names(c.local_tools(c.ctx_stub(), "agent1qs"))


def test_start_round_tool_resolves_and_registers_chat(coord, monkeypatch):
    c, _ = coord

    async def fake_begin(ctx, req):
        c.rounds[req.sessionId] = type("R", (), {"state": "running", "round": 1})()
        return c.RestAck(ok=True, detail="")

    monkeypatch.setattr(c, "begin", fake_begin)
    tool = {t.name: t for t in c.local_tools(c.ctx_stub(), "agent1qs")}["start_round"]
    out = run(tool.call({"device_query": "mri 2"}))
    assert out["device"] == "MRI 2" and c.chats[out["session_id"]].sender == "agent1qs"
    assert "error" in run(tool.call({"device_query": "toaster"}))


def test_start_round_failure_forgets_the_chat(coord, monkeypatch):
    c, _ = coord

    async def fake_begin(ctx, req):
        return c.RestAck(ok=False, detail="a round is already running")

    monkeypatch.setattr(c, "begin", fake_begin)
    tool = {t.name: t for t in c.local_tools(c.ctx_stub(), "agent1qs")}["start_round"]
    out = run(tool.call({"device_query": "MRI 2"}))
    assert "already running" in out["error"] and not c.chats


def test_round_status_and_recommendation_tools_report_none_without_a_round(coord):
    c, _ = coord
    t = {x.name: x for x in c.local_tools(c.ctx_stub(), "agent1qs")}
    assert "none" in run(t["round_status"].call({})) and run(t["recommendation"].call({})).get("none") is True


def test_chat_turn_sends_text_and_picker_card(coord, monkeypatch):
    c, sent = coord

    async def fake_respond(storage, who, sender, text, tools, system, session_id=None):
        await {t.name: t for t in tools}["show_device_picker"].call({})
        return turn("Pick one.", ["show_device_picker"])

    monkeypatch.setattr(c.brain, "respond", fake_respond)
    run(c.chat_turn(c.ctx_stub(), "agent1qs", "where can an attack start?"))
    assert sent[-1][3] == "Pick one." and sent[-1][4] is not None


def test_chat_turn_without_a_card_sends_plain_text(coord, monkeypatch):
    c, sent = coord

    async def fake_respond(storage, who, sender, text, tools, system, session_id=None):
        return turn("Hello.")

    monkeypatch.setattr(c.brain, "respond", fake_respond)
    run(c.chat_turn(c.ctx_stub(), "agent1qs", "hi"))
    assert sent[-1][3] == "Hello." and sent[-1][4] is None


def test_planner_prose_selection_becomes_a_user_turn(coord, monkeypatch):
    c, _ = coord
    seen = []

    async def fake_respond(storage, who, sender, text, tools, system, session_id=None):
        seen.append(text)
        return turn("ok")

    monkeypatch.setattr(c.brain, "respond", fake_respond)
    run(c.chat_turn(c.ctx_stub(), "agent1qs", "The user picked action simulate for device mri_2"))
    run(c.chat_turn(c.ctx_stub(), "agent1qs", '{"action": "simulate", "device": "ct_1", "source": "hippocratech"}'))
    assert seen == ["simulate ransomware from mri_2", "simulate ransomware from ct_1"]


def test_brain_error_is_sent_as_the_reply(coord, monkeypatch):
    c, sent = coord

    async def boom(*a, **k):
        raise c.brain.BrainError("ASI:One error 500")

    monkeypatch.setattr(c.brain, "respond", boom)
    run(c.chat_turn(c.ctx_stub(), "agent1qs", "hi"))
    assert "ASI:One error 500" in sent[-1][3]


def test_summary_is_sent_once(coord, monkeypatch):
    c, sent = coord

    async def fake_respond(*a, **k):
        return turn("Done.")

    monkeypatch.setattr(c.brain, "respond", fake_respond)
    c.chats["s"] = c.ChatRound(sender="agent1qs", device_name="MRI 2")
    rnd = type("R", (), {"state": "done", "round": 2, "sessionId": "s", "recommendation": None, "baseline": None})()

    async def twice():
        ctx = c.ctx_stub()
        await c.notify_chat(ctx, rnd)
        await c.notify_chat(ctx, rnd)
        await asyncio.sleep(0.05)

    run(twice())
    assert sum(1 for s in sent if s[3] == "Done.") == 1
