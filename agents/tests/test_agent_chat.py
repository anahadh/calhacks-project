"""The specialists' chat replies: built from the profile files and the last thing each said, in code."""

import agent_chat
from llm import FORBIDDEN


def test_intro_comes_from_the_profile_without_markdown():
    for name in ("inventory", "flow", "clinical_workflow"):
        text = agent_chat.intro(name)
        assert "Hippocra.tech" in text and "stall" not in text.lower()[:0]
        assert not any(ch in text for ch in "#*`>")
        assert "Specialist agent" not in text  # the blockquote is skipped


def test_reply_text_names_the_coordinator_and_the_last_verdict():
    agent_chat.last_said.clear()
    before = agent_chat.reply_text("clinical_workflow")
    assert "haven't spoken" in before and "@hippocratech-coordinator" in before and "simulate ransomware from MRI 2" in before
    agent_chat.note("clinical_workflow", "reject: it breaks 4 protected flows.")
    after = agent_chat.reply_text("clinical_workflow")
    assert 'Last round, I said: "reject: it breaks 4 protected flows."' in after
    assert "only humans sign off" in after
    assert not FORBIDDEN.search(after) and not any(w in after.lower() for w in ("approved", "safe to deploy"))
