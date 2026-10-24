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
    s = json.dumps(payload(ALL["summary"]()), ensure_ascii=False)
    assert "Round 1 · Isolate imaging" in s
    assert "✕ Clinical Workflow Agent" in s and "MRI 1 → PACS (Scans to radiologists)" in s
    assert "Option 1: Contain imaging, keep scans flowing" in s
    assert "Security must sign off" in s and "Clinical engineering must sign off" in s
    r = result("cand_keep_scans")
    c = r.patientCounts
    assert f"{c.delayed + c.disrupted + c.diverted} patients affected" in s


def test_device_card_has_its_flows_and_a_simulate_button():
    s = json.dumps(payload(ALL["device"]()), ensure_ascii=False)
    assert '"title": "MRI 2"' in s and "PACS" in s and '"device": "mri_2"' in s


def test_started_card_links_the_live_room():
    msg = ALL["started"]()
    assert "http://x/room/chat-1" in msg.text()
