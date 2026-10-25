"""chat.py: reading chat messages and building replies, in code. No network."""

import pytest

import chat
from llm import FORBIDDEN
from logic import clinical, coordinator
from logic import hospital as hospital_mod
from protocol import Policy, Proposal, RunResult
from tests_paths import FIXTURES

H = hospital_mod.load()


@pytest.mark.parametrize("text, kind, device", [
    ("simulate ransomware from MRI 2", "simulate", "MRI 2"),
    ("Simulate ransomware from mri_2.", "simulate", "mri_2"),
    ("please start a round from the File server!", "simulate", "File server"),
    ("run an attack on CT 1", "simulate", "CT 1"),
    ("infect PACS", "simulate", "PACS"),
    ("patient zero: ER WS 1", "simulate", "ER WS 1"),
    ("status", "status", None),
    ("What's the status?", "status", None),
    ("hi there", "help", None),
    ("", "help", None),
    ("what is PACS?", "lookup", "PACS"),
    ("tell me about the ER WS 1", "lookup", "ER WS 1"),
    ("devices", "devices", None),
    ("where can an attack start?", "devices", None),
    ("protected flows", "protected", None),
    ("MRI 2", "lookup", "MRI 2"),
    ("PACS?", "lookup", "PACS"),
    ("ct1", "lookup", "ct1"),
    ("hello", "help", None),
    # card button clicks: JSON from a direct chat, prose through ASI:One's planner
    ('{"action": "simulate", "device": "mri_2", "source": "hippocratech"}', "simulate", "mri_2"),
    ('{"action": "status", "source": "hippocratech"}', "status", None),
    ("The user picked action lookup for device srv_pacs", "lookup", "srv_pacs"),
    ('{"action": "rm -rf", "device": "x"}', "help", None),
])
def test_parse(text, kind, device):
    c = chat.parse(text)
    assert (c.kind, c.device) == (kind, device)


@pytest.mark.parametrize("query, device", [
    ("MRI 2", "mri_2"), ("mri2", "mri_2"), ("mri_2", "mri_2"), ("pacs", "srv_pacs"), ("file server", "srv_file"),
    ("mri machine 1", "mri_1"), ("the MRI 2 scanner", "mri_2"), ("mri mchine 1", "mri_1"), ("PACS server", "srv_pacs"),
    ("Toaster 9", None),
    ("dev_unknown_7", None),  # off the network until its challenge is applied
])
def test_resolve_device(query, device):
    assert chat.resolve_device(H, query) == device


def test_unknown_device_lists_valid_names():
    text = chat.unknown_device(H, "MRI 9")
    assert 'I don\'t know a device called "MRI 9"' in text and "MRI 2" in text
    text = chat.unknown_device(H, "Toaster")
    assert all(n in text for n in ("MRI 2", "PACS")) and "simulate ransomware from MRI 2" in text


def result(name):
    return RunResult.parse_file(FIXTURES / "results" / f"{name}.json")


def candidate(name):
    import json

    return Policy.parse_obj(json.loads((FIXTURES / "candidates" / f"{name}.json").read_text())["policy"])


def test_summary_of_a_round_with_a_rejection_and_a_recommendation():
    iso = Proposal(sessionId="chat-1", round=1, policyId="cand_isolate_imaging", testResult=result("cand_isolate_imaging"),
                   reason="Isolate imaging: 1 infected device instead of 16.", reasonSource="asi1",
                   **candidate("cand_isolate_imaging").dict())
    rej = clinical.check("chat-1", 1, iso.policyId, iso.testResult, H).copy(update={"reason": "I can't accept this: it breaks 4 protected flows.", "reasonSource": "claude"})
    ok = clinical.check("chat-1", 2, "cand_keep_scans", result("cand_keep_scans"), H)
    rec = coordinator.Recommendation(policy=candidate("cand_keep_scans"), testResult=result("cand_keep_scans"), verdicts=[ok, ok],
                                     explanation="It holds the attack to 1 infected device.", requiredRoles=["security", "clinical_engineering"],
                                     explanationSource="claude")
    text = chat.summary(H, "chat-1", "MRI 2", [("proposal", iso), ("verdict", rej), ("verdict", ok), ("recommendation", rec)],
                        "done", 2, fixture=True)
    assert "attack starting at MRI 2" in text
    assert 'the Flow Agent proposed "Isolate imaging": "Isolate imaging: 1 infected device instead of 16."' in text
    assert "✕ Clinical Workflow Agent rejected: \"I can't accept this: it breaks 4 protected flows.\" It needs: keep flow fl_1, fl_2, fl_3, fl_4." in text
    assert 'agree on "Contain imaging, keep scans flowing": "It holds the attack to 1 infected device."' in text
    assert "not a decision: Security, Clinical engineering must sign off" in text
    assert "fixture files" in text and "Nothing is applied to any real network." in text
    assert not FORBIDDEN.search(text)


def test_summary_with_no_agreement():
    text = chat.summary(H, "chat-2", "MRI 2", [], "done", 4, fixture=False)
    assert "no agreement after 4 rounds" in text and "fixture" not in text


def test_status_and_help():
    assert chat.status(None).startswith("No round has run yet")
    assert "round 2, done. The agents agreed on a recommendation; humans must sign off." in chat.status(("chat-1", "MRI 2", "done", 2, True))
    assert "ended with no agreement" in chat.status(("chat-1", "MRI 2", "done", 4, False))
    assert "waiting for human" in chat.status(("chat-1", "MRI 2", "waiting_for_human", 1, False))
    for text in (chat.help_text(), chat.started("MRI 2", "chat-1", True), chat.could_not_start("CT 1", "no fixture")):
        assert not FORBIDDEN.search(text)
