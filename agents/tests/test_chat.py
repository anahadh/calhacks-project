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
    # card button clicks: JSON from a direct chat, prose through ASI:One's planner
    ('{"action": "simulate", "device": "mri_2", "source": "hippocratech"}', "simulate", "mri_2"),
    ('{"action": "status", "source": "hippocratech"}', "status", None),
    ("The user picked action lookup for device srv_pacs", "lookup", "srv_pacs"),
])
def test_selection(text, kind, device):
    c = chat.selection(text)
    assert (c.kind, c.device) == (kind, device)


@pytest.mark.parametrize("text", ["simulate ransomware from MRI 2", "hi there", '{"action": "rm -rf", "device": "x"}', ""])
def test_free_text_is_not_a_selection(text):
    assert chat.selection(text) is None


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


@pytest.mark.parametrize("text, device", [
    ("what happens malware attack on mri2", "mri2"),
    ("what happens if ransomware starts at the ICU nurse station?", "ICU nurse station"),
    ("simulate ransomware from MRI 2", "MRI 2"),
    ("Simulate an attack from PACS.", "PACS"),
    ("infect CT 1", "CT 1"),
    ("run it from the file server", "file server"),
    ("patient zero: ER WS 1", "ER WS 1"),
])
def test_wants_round_finds_the_device(text, device):
    assert chat.wants_round(text) == device


@pytest.mark.parametrize("text", [
    "what was the final recommendation?", "why did clinical workflow reject the first plan?", "what is PACS?",
    "where can an attack start?", "hello", "ask the flow agent which plans it tested", "status",
])
def test_wants_round_ignores_questions(text):
    assert chat.wants_round(text) is None


def test_ask_selection_carries_the_agent_and_the_line():
    import json
    raw = json.dumps({"action": "ask", "source": "hippocratech", "agent": "flow", "about": '[ @hippocratech-flow · round 1 ] proposed "x".'})
    c = chat.selection(raw)
    assert (c.kind, c.agent, c.about) == ("ask", "flow", '[ @hippocratech-flow · round 1 ] proposed "x".')
    c = chat.selection("The user picked action ask for agent clinical_workflow")
    assert (c.kind, c.agent, c.about) == ("ask", "clinical_workflow", None)
    assert chat.selection("what is PACS?") is None


@pytest.mark.parametrize("text", ["let me view my hospital", "show me the hospital", "view hospital",
                                  "@hippocratech-coordinator support bot, let me view my hospital", "what does my hospital look like?",
                                  "can i view the hopsital", "show me the hosptial", "lemme view my hospital twin"])
def test_wants_hospital(text):
    assert chat.wants_hospital(text)


@pytest.mark.parametrize("text", ["simulate ransomware from MRI 2", "what is PACS?", "why did clinical reject?"])
def test_not_wants_hospital(text):
    assert not chat.wants_hospital(text)
