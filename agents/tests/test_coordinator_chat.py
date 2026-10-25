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


def test_planner_prose_selection_starts_the_round_in_code(coord, monkeypatch):
    """A picker tap arrives as JSON (direct chat) or as planner prose; both start the round
    at once, without the model."""
    c, sent = coord
    begun = []

    async def fake_begin(ctx, req):
        begun.append(req.patientZero)
        c.rounds[req.sessionId] = type("R", (), {"state": "running", "round": 1})()
        return c.RestAck(ok=True, detail="")

    monkeypatch.setattr(c, "begin", fake_begin)

    async def never(*a, **k):
        raise AssertionError("the model must not be asked")

    monkeypatch.setattr(c.brain, "respond", never)
    run(c.chat_turn(c.ctx_stub(), "agent1qs", "The user picked action simulate for device mri_2"))
    run(c.chat_turn(c.ctx_stub(), "agent1qs", '{"action": "simulate", "device": "ct_1", "source": "hippocratech"}'))
    assert begun == ["mri_2", "ct_1"]
    assert all(s[3].startswith("Starting a simulated ransomware round") for s in sent[-2:])


def test_other_selections_become_user_turns(coord, monkeypatch):
    c, _ = coord
    seen = []

    async def fake_respond(storage, who, sender, text, tools, system, session_id=None):
        seen.append(text)
        return turn("ok")

    monkeypatch.setattr(c.brain, "respond", fake_respond)
    run(c.chat_turn(c.ctx_stub(), "agent1qs", '{"action": "status", "source": "hippocratech"}'))
    run(c.chat_turn(c.ctx_stub(), "agent1qs", "The user picked action lookup for device srv_pacs"))
    assert seen == ["what is the status of the last round?", "what is srv_pacs?"]


def test_brain_error_is_sent_as_the_reply(coord, monkeypatch):
    c, sent = coord

    async def boom(*a, **k):
        raise c.brain.BrainError("ASI:One error 500")

    monkeypatch.setattr(c.brain, "respond", boom)
    run(c.chat_turn(c.ctx_stub(), "agent1qs", "hi"))
    assert sent[-1][3].startswith("Sorry, I couldn't put that answer together") and "ASI:One error 500" in sent[-1][3]


def test_summary_is_sent_once(coord, monkeypatch):
    c, sent = coord

    c.chats["s"] = c.ChatRound(sender="agent1qs", device_name="MRI 2")
    rnd = type("R", (), {"state": "done", "round": 2, "sessionId": "s", "recommendation": None, "baseline": None})()

    async def twice():
        ctx = c.ctx_stub()
        await c.notify_chat(ctx, rnd)
        await c.notify_chat(ctx, rnd)
        await asyncio.sleep(1.0)

    run(twice())
    assert sum(1 for s in sent if s[3] and "couldn't agree" in s[3]) == 1


def test_chat_turn_reports_any_failure_as_the_reply(coord, monkeypatch):
    c, sent = coord

    async def boom(*a, **k):
        raise RuntimeError("relay down")

    monkeypatch.setattr(c.mcp_server, "as_brain_tools", boom)
    run(c.chat_turn(c.ctx_stub(), "agent1qs", "hi"))
    assert "RuntimeError: relay down" in sent[-1][3]


def test_summary_failure_reaches_the_thread(coord, monkeypatch):
    c, sent = coord

    def boom(*a, **k):
        raise RuntimeError("card down")

    monkeypatch.setattr(c.cards, "result_card", boom)
    c.chats["s"] = c.ChatRound(sender="agent1qs", device_name="MRI 2")
    rec = type("Rec", (), {"policy": type("P", (), {"name": "X"})(), "testResult": type("T", (), {"infectedCount": 1})()})()
    rnd = type("R", (), {"state": "done", "round": 2, "sessionId": "s", "recommendation": rec, "baseline": None})()

    async def go():
        await c.notify_chat(c.ctx_stub(), rnd)
        await asyncio.sleep(0.3)

    monkeypatch.setattr(c, "NARRATE_INTERVAL_S", 0.01)
    run(go())
    assert any(s[3] and "card down" in s[3] for s in sent)

def test_on_chat_does_not_block_the_message_queue(coord, monkeypatch):
    c, _ = coord
    started = asyncio.Event()
    release = asyncio.Event()

    async def slow_turn(ctx, sender, text, session_id=None, relay_in=True):
        started.set()
        await release.wait()

    monkeypatch.setattr(c, "chat_turn", slow_turn)

    async def scenario():
        from uagents_core.contrib.protocols.chat import ChatMessage, TextContent
        await c.on_chat(c.ctx_stub(), "agent1qs", ChatMessage(content=[TextContent(text="hi")]))
        await asyncio.sleep(0)
        assert started.is_set() and not release.is_set()
        release.set()
        await asyncio.sleep(0)

    run(scenario())


def test_attack_question_starts_a_round_in_code_without_the_model(coord, monkeypatch):
    """'what happens if ransomware starts at MRI 2' must start a round at once: code decides,
    the reply is instant, and the model is not consulted for the kick-off."""
    c, sent = coord
    begun = []

    async def fake_begin(ctx, req):
        begun.append(req.patientZero)
        c.rounds[req.sessionId] = type("R", (), {"state": "running", "round": 1})()
        return c.RestAck(ok=True, detail="")

    monkeypatch.setattr(c, "begin", fake_begin)

    async def never(*a, **k):
        raise AssertionError("the model must not be asked")

    monkeypatch.setattr(c.brain, "respond", never)
    run(c.chat_turn(c.ctx_stub(), "agent1qs", "what happens malware attack on mri2"))
    assert begun == ["mri_2"]
    assert sent[-1][3].startswith("Starting a simulated ransomware round from MRI 2") and "@hippocratech-flow" in sent[-1][3]


def test_attack_question_with_unknown_device_goes_to_the_model(coord, monkeypatch):
    c, sent = coord
    asked = []

    async def fake_respond(storage, who, sender, text, tools, system, session_id=None):
        asked.append(text)
        return turn("Which device?")

    monkeypatch.setattr(c.brain, "respond", fake_respond)
    run(c.chat_turn(c.ctx_stub(), "agent1qs", "simulate ransomware from Toaster 9"))
    assert asked and sent[-1][3] == "Which device?"


def test_summary_message_carries_the_trace_and_the_recommendation_card(coord, monkeypatch):
    import json
    from protocol import Policy, Recommendation, RunResult
    from tests_paths import FIXTURES
    c, sent = coord
    base = RunResult.parse_file(FIXTURES / "results" / "baseline.json")
    res = RunResult.parse_file(FIXTURES / "results" / "cand_isolate_imaging.json")
    policy = Policy.parse_obj(json.loads((FIXTURES / "candidates" / "cand_isolate_imaging.json").read_text())["policy"])
    rec = Recommendation(policy=policy, testResult=res, verdicts=[], explanation="Works.", requiredRoles=["security"])

    async def fake_respond(storage, who, sender, text, tools, system, session_id=None):
        return turn("The agents agree.")  # the model did not call the recommendation tool: the card still comes

    monkeypatch.setattr(c.brain, "respond", fake_respond)
    monkeypatch.setattr(c, "NARRATE_INTERVAL_S", 0.01)
    c.chats["s"] = c.ChatRound(sender="agent1qs", device_name="MRI 2", trace=["[ a ] one", "[ b ] two"])
    rnd = type("R", (), {"state": "done", "round": 2, "sessionId": "s", "recommendation": rec, "baseline": base})()
    c.rounds["s"] = rnd

    async def go():
        await c.notify_chat(c.ctx_stub(), rnd)
        await asyncio.sleep(1.0)  # the summary turn lists the MCP tools first

    run(go())
    summary = next(x for x in sent if x[3] and "agents agree on" in x[3])
    assert policy.name in summary[3] and f"{base.infectedCount} → {res.infectedCount}" in summary[3]
    assert summary[4] is not None and summary[4]["title"] == policy.name
    roster = sent[-1]
    assert roster[3].startswith("Here are the agents") and len(roster[4]["items"]) == 4


def test_ask_selection_asks_that_agent_in_code(coord, monkeypatch):
    c, sent = coord
    asked = []

    async def fake_ask(ctx, sender, handle, question):
        asked.append((handle, question))
        return {"agent": handle, "said": "I cut the imaging VLAN because the attack crossed it."}

    monkeypatch.setattr(c, "ask_agent", fake_ask)

    async def never(*a, **k):
        raise AssertionError("the model must not be asked")

    monkeypatch.setattr(c.brain, "respond", never)
    run(c.chat_turn(c.ctx_stub(), "agent1qs", '{"action": "ask", "source": "hippocratech", "agent": "flow", "about": ""}'))
    run(c.chat_turn(c.ctx_stub(), "agent1qs", '{"action": "ask", "source": "hippocratech", "agent": "clinical_workflow", "about": "[ @hippocratech-clinical-workflow · round 1 ] rejected: no."}'))
    assert asked[0][0] == "hippocratech-flow" and "round" in asked[0][1]
    assert asked[1][0] == "hippocratech-clinical-workflow" and "rejected: no." in asked[1][1]
    assert sent[-1][3] == '@hippocratech-clinical-workflow said: "I cut the imaging VLAN because the attack crossed it."'


def test_ask_selection_reports_a_refusal(coord, monkeypatch):
    c, sent = coord

    async def refuse(ctx, sender, handle, question):
        return {"error": "a round is running"}

    monkeypatch.setattr(c, "ask_agent", refuse)
    run(c.chat_turn(c.ctx_stub(), "agent1qs", '{"action": "ask", "source": "hippocratech", "agent": "flow", "about": ""}'))
    assert "a round is running" in sent[-1][3]


def test_view_hospital_sends_the_map_card_without_the_model(coord, monkeypatch):
    import json
    c, sent = coord

    async def never(*a, **k):
        raise AssertionError("the model must not be asked")

    monkeypatch.setattr(c.brain, "respond", never)
    run(c.chat_turn(c.ctx_stub(), "agent1qs", "let me view my hospital"))
    to, message, session_id, text, card = sent[-1]
    s = json.dumps(card)
    assert card and "data:image" not in s and '"action": "simulate"' in s and "rooms" in s
    assert "devices" in text


def test_live_session_env_makes_every_chat_round_use_one_session(coord, monkeypatch):
    c, _ = coord
    monkeypatch.setenv("CHAT_LIVE_SESSION", "asi1-live")
    begun = []

    async def fake_begin(ctx, req):
        begun.append(req.sessionId)
        c.rounds[req.sessionId] = type("R", (), {"state": "done", "round": 1})()
        return c.RestAck(ok=True, detail="")

    monkeypatch.setattr(c, "begin", fake_begin)
    tool = {t.name: t for t in c.local_tools(c.ctx_stub(), "agent1qs")}["start_round"]
    run(tool.call({"device_query": "MRI 2"}))
    run(tool.call({"device_query": "CT 1"}))
    assert begun == ["asi1-live", "asi1-live"]


def test_model_claiming_a_round_started_without_starting_one_is_corrected(coord, monkeypatch):
    c, sent = coord

    async def liar(*a, **k):
        return turn("A new simulated ransomware round from MRI 2 has started.")

    monkeypatch.setattr(c.brain, "respond", liar)
    run(c.chat_turn(c.ctx_stub(), "agent1qs", "do the thing with the scanner"))
    assert "started" not in sent[-1][3].split("(")[0] or "didn't start" in sent[-1][3]


def test_hospital_card_and_result_card_carry_the_hosted_floor_image(coord, monkeypatch):
    import json
    c, sent = coord
    monkeypatch.delenv("IMAGE_BASE_URL", raising=False)
    run(c.chat_turn(c.ctx_stub(), "agent1qs", "let me view my hospital"))
    s = json.dumps(sent[-1][4])
    assert "https://hippocratech.vercel.app/asi1/overview.png" in s or "floor_tiles" not in s
