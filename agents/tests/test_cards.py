"""cards.py: ASI:One cards built in code. Allowed primitives only, nesting depth <= 8,
no forbidden words, and every number from the round's messages. No network."""

import json

import pytest

import cards
import chat
from llm import FORBIDDEN
from logic import clinical, coordinator
from logic import hospital as hospital_mod
from protocol import Policy, Proposal, RunResult
from tests_paths import FIXTURES

H = hospital_mod.load()
ON = chat.devices_on_network(H)
ALLOWED = {"section", "group", "divider", "text", "heading", "image", "badge", "button", "input", "list", "choice_grid"}


def result(name):
    return RunResult.parse_file(FIXTURES / "results" / f"{name}.json")


def candidate(name):
    return Policy.parse_obj(json.loads((FIXTURES / "candidates" / f"{name}.json").read_text())["policy"])


def round_events():
    iso = Proposal(sessionId="chat-1", round=1, policyId="cand_isolate_imaging", testResult=result("cand_isolate_imaging"),
                   reason="Isolate imaging.", reasonSource="asi1", **candidate("cand_isolate_imaging").dict())
    rej = clinical.check("chat-1", 1, iso.policyId, iso.testResult, H)
    ok = clinical.check("chat-1", 2, "cand_keep_scans", result("cand_keep_scans"), H)
    rec = coordinator.Recommendation(policy=candidate("cand_keep_scans"), testResult=result("cand_keep_scans"), verdicts=[ok, ok],
                                     explanation="It holds the attack to 1 infected device.",
                                     requiredRoles=["security", "clinical_engineering"], explanationSource="asi1")
    return [("proposal", iso), ("verdict", rej), ("verdict", ok), ("recommendation", rec)]


def payload(msg):
    (meta,) = [c for c in msg.content if c.type == "metadata"]
    assert meta.metadata["card_kind"] == "custom" and meta.metadata["card_protocol_version"] == "1"
    return json.loads(meta.metadata["card_payload"])


def walk(node):
    yield node
    for c in node.get("children", []):
        yield from walk(c)
    for i in node.get("items", []):
        assert set(i) <= {"children", "action"}
        for c in i["children"]:
            yield from walk(c)


ALL = {
    "help": lambda: cards.help_card(H, ON),
    "devices": lambda: cards.devices_card(H, ON),
    "protected": lambda: cards.protected_card(H),
    "device": lambda: cards.device_card(H, "mri_2"),
    "started": lambda: cards.started_card("mri_2", "MRI 2", "chat-1", "http://x/room/chat-1", True),
    "summary": lambda: cards.summary_card(H, "chat-1", "MRI 2", round_events(), "done", 2, True, "http://x/room/chat-1"),
    "no agreement": lambda: cards.summary_card(H, "chat-2", "MRI 2", [], "done", 4, False, "http://x/room/chat-2"),
    "progress": lambda: cards.progress_card("chat-4", "MRI 2", round_events()[:2], "running", 1, "http://x/room/chat-4"),
    "waiting": lambda: cards.progress_card("chat-4", "MRI 2", [], "waiting_for_human", 1, "http://x/room/chat-4"),
}


@pytest.mark.parametrize("name", ALL)
def test_cards_use_allowed_primitives_within_depth(name):
    msg = ALL[name]()
    root = payload(msg)["root"]
    assert cards.depth(root) <= 8
    for node in walk(root):
        assert node["type"] in ALLOWED, node
        if node["type"] == "button":
            sel = node["action"]["selection"]
            assert sel["action"] in chat.ACTIONS
            assert chat.parse(json.dumps(sel)) == chat.Command(sel["action"], sel.get("device"))  # the click comes back
        if node["type"] == "group":
            assert node["direction"] in ("row", "column")
        if node["type"] == "badge":
            assert node["variant"] in ("info", "success", "warning")
    assert not FORBIDDEN.search(msg.text() + json.dumps(root))


def test_summary_card_shows_each_verdict_and_the_recommendation():
    msg = ALL["summary"]()
    s = json.dumps(payload(msg), ensure_ascii=False)
    assert "Round 1 · Isolate imaging" in s
    assert "✕ Clinical Workflow Agent" in s and "Flow Agent · proposed" in s
    assert "Option 1: Contain imaging, keep scans flowing" in s
    assert "Security signs off" in s and "Clinical engineering signs off" in s
    rec = round_events()[-1][1]
    c = rec.testResult.patientCounts
    assert f"{c.delayed + c.disrupted + c.diverted} patients affected" in s
    # All four agents have a lane, with badges rather than prose.
    for name in ("Sign-off Coordinator", "Flow Agent", "Inventory Agent", "Clinical Workflow Agent"):
        assert f'"value": "{name}"' in s
    assert "✓ accepted 1" in s and "✕ rejected 1" in s and "tested 1 plan" in s


def test_summary_card_decision_strip_compares_to_the_baseline():
    base = result("baseline") if (FIXTURES / "results" / "baseline.json").exists() else round_events()[0][1].testResult
    msg = cards.summary_card(H, "chat-1", "MRI 2", round_events(), "done", 2, True, "http://x/room/chat-1", base)
    root = payload(msg)["root"]
    best = round_events()[-1][1].testResult.infectedCount
    assert root["children"][0] == {"type": "heading", "value": f"{base.infectedCount} → {best} devices compromised", "level": 2}


def test_progress_card_marks_whose_turn_it_is():
    s = json.dumps(payload(ALL["progress"]()), ensure_ascii=False)
    assert "In progress: attack from MRI 2" in s and '"label": "running"' in s
    assert "✕ rejected 1" in s and '"label": "working"' in s  # Flow is revising after the rejection
    s = json.dumps(payload(ALL["waiting"]()), ensure_ascii=False)
    assert "waiting for a human" in s


def test_device_card_has_its_flows_and_a_simulate_button():
    s = json.dumps(payload(ALL["device"]()), ensure_ascii=False)
    assert '"title": "MRI 2"' in s and "PACS" in s and '"device": "mri_2"' in s


def test_started_card_links_the_live_room():
    msg = ALL["started"]()
    assert "http://x/room/chat-1" in msg.text()


def test_summary_card_keeps_each_option_s_verdicts_apart():
    """Round 1 put a lead plan and an alternative on the table; each guardian judged both.
    Each plan block gets its own two badges and reasons, not one pile of four."""
    from protocol import Alternative
    lead = candidate("cand_isolate_imaging")
    alt = candidate("cand_keep_scans")
    prop = Proposal(sessionId="chat-3", round=1, policyId="cand_isolate_imaging",
                    testResult=result("cand_isolate_imaging"), reason="Smallest blast radius.", reasonSource="asi1",
                    alternatives=[Alternative(policyId="cand_keep_scans", testResult=result("cand_keep_scans"), reason="Keeps scans.",
                                              **alt.dict(include={"strategy", "name", "rules", "rationale", "tradeoff"}))],
                    **lead.dict(include={"strategy", "name", "rules", "rationale", "tradeoff"}))
    rej = clinical.check("chat-3", 1, "cand_isolate_imaging", result("cand_isolate_imaging"), H)
    ok = clinical.check("chat-3", 1, "cand_keep_scans", result("cand_keep_scans"), H)
    card = payload(cards.summary_card(H, "chat-3", "MRI 2", [("proposal", prop), ("verdict", rej), ("verdict", ok)],
                                      "in_progress", 1, False, "http://x/room/chat-3"))
    kids = card["root"]["children"]
    items = kids[kids.index({"type": "heading", "value": "Plans tested", "level": 3}) + 1]["items"]
    assert len(items) == 2
    rows = [[c for c in i["children"] if c["type"] == "group"][-1] for i in items]  # the verdict row is the last group
    assert [b["label"] for b in rows[0]["children"]] == ["Flow Agent · proposed", "✕ Clinical Workflow Agent"]
    assert [b["label"] for b in rows[1]["children"]] == ["Flow Agent · proposed", "✓ Clinical Workflow Agent"]
    s = json.dumps(card, ensure_ascii=False)
    assert "also tested: " in s
    assert "4 agents · 5 messages over Agentverse · 1 round" in s
    # A long "needs" list is cut to a count and two names.
    needs = next(c["value"] for c in items[0]["children"] if c["type"] == "text" and "needs:" in c["value"])
    assert "protected flows, including" in needs and needs.count("→") == 2
