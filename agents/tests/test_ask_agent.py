"""coordinator.ask_agent: the Coordinator asks a specialist by @handle, visibly and relayed.
The wire call is replaced; no network."""

import asyncio
import json

import pytest


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
    import coordinator
    coordinator.rounds.clear()
    coordinator.chats.clear()
    coordinator.last_session.clear()
    sent = []

    async def fake_send(ctx, to, message, session_id, text=None, card=None):
        sent.append(text)

    monkeypatch.setattr(coordinator, "chat_send", fake_send)
    return coordinator, tmp_path, sent


def rows(path, session):
    return [json.loads(l) for l in (path / f"{session}.jsonl").read_text().splitlines()]


def test_unknown_handle_is_refused_without_sending(coord, monkeypatch):
    c, _, sent = coord
    called = []

    async def wire(ctx, agent, question):
        called.append(agent)

    monkeypatch.setattr(c, "_ask_over_wire", wire)
    out = run(c.ask_agent(c.ctx_stub(), "agent1qs", "hippocratech-nope", "hi"))
    assert "error" in out and "hippocratech-flow" in out["error"] and not called and not sent


def test_refused_while_any_round_is_running(coord, monkeypatch):
    c, _, sent = coord
    called = []

    async def wire(ctx, agent, question):
        called.append(agent)

    monkeypatch.setattr(c, "_ask_over_wire", wire)
    c.rounds["other"] = type("R", (), {"state": "running", "round": 1})()
    assert run(c.ask_agent(c.ctx_stub(), "agent1qs", "hippocratech-flow", "why?")) == {"error": "a round is running"}
    assert not called and not sent


def test_interim_line_question_and_answer_are_relayed_in_order(coord, monkeypatch):
    c, path, sent = coord

    async def wire(ctx, agent, question):
        assert agent == "inventory"
        return "Two devices have no owner on record."

    monkeypatch.setattr(c, "_ask_over_wire", wire)
    out = run(c.ask_agent(c.ctx_stub(), "agent1qs", "hippocratech-inventory", "which devices can't you identify?"))
    assert out == {"agent": "hippocratech-inventory", "said": "Two devices have no owner on record."}
    assert sent == ["Asking @hippocratech-inventory: which devices can't you identify?"]
    r = [(x["from"], x["to"], x["payload"]["text"], x["direction"]) for x in rows(path, "asi1-chat") if x["type"] == "chat"]
    assert r == [("coordinator", "inventory", "which devices can't you identify?", "sent"),
                 ("inventory", "coordinator", "Two devices have no owner on record.", "received")]


def test_rows_go_to_the_senders_last_round_session(coord, monkeypatch):
    c, path, sent = coord
    c.rounds["chat-abc"] = type("R", (), {"state": "done", "round": 2})()
    c.chats["chat-abc"] = c.ChatRound(sender="agent1qs", device_name="MRI 2")

    async def wire(ctx, agent, question):
        return "Because it cut imaging."

    monkeypatch.setattr(c, "_ask_over_wire", wire)
    run(c.ask_agent(c.ctx_stub(), "agent1qs", "hippocratech-clinical-workflow", "why reject?"))
    r = [(x["from"], x["to"], x["round"]) for x in rows(path, "chat-abc") if x["type"] == "chat"]
    assert ("coordinator", "clinical_workflow", 2) in r and ("clinical_workflow", "coordinator", 2) in r


def test_timeout_is_an_error_result(coord, monkeypatch):
    c, _, sent = coord

    async def wire(ctx, agent, question):
        raise TimeoutError()

    monkeypatch.setattr(c, "_ask_over_wire", wire)
    out = run(c.ask_agent(c.ctx_stub(), "agent1qs", "hippocratech-flow", "q"))
    assert "did not answer" in out["error"] and "@hippocratech-flow" in out["error"]
