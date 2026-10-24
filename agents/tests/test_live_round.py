"""The four uAgents as real processes (run_all.py), messaging over uAgents with local
resolution and fixture results: one full round, read back from the relay log."""

import json
import os
import signal
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

from contextlib import contextmanager

import httpx
import pytest
from uagents.crypto import Identity

from config import PORTS, SEED_VARS
from llm import FORBIDDEN

AGENTS_DIR = Path(__file__).parent.parent
SESSION = "live-test"
CHALLENGE_SESSION = "live-challenge"
TIMEOUT_S = 60


def wait_until(check, timeout, what):
    deadline = time.time() + timeout
    while time.time() < deadline:
        if check():
            return
        time.sleep(0.3)
    raise AssertionError(f"timed out after {timeout} s waiting for {what}")


def listening(port):
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/agent_info", timeout=1) as r:
            return r.status == 200
    except OSError:
        return False


def messages(log: Path) -> list[dict]:
    if not log.exists():
        return []
    return [json.loads(line) for line in log.read_text().splitlines()]


CHAT_SENDER_SEED = "live test seed for the chat sender"
CHAT_SENDER_PORT = 8010


def env_for(tmp_path, **extra):
    return {
        **os.environ,
        **{var: f"live test seed for {agent}" for agent, var in SEED_VARS.items()},
        "LOCAL_RESOLVE": "1", "AGENT_MAILBOX": "0", "HIPPO_SIM_FIXTURES": "1",
        "WATCHER_RELAY_URL": "", "RELAY_TOKEN": "", "HIPPO_SIM_BIN": "", "HIPPO_OPT_BIN": "",
        "RELAY_LOG_DIR": str(tmp_path),
        "ANTHROPIC_API_KEY": "",  # never call the real API from tests: llm.py uses its templates
        "AGENTVERSE_API_KEY": "",  # nor Agentverse
        # The fake ASI:One user (tests/chat_sender.py), so the Coordinator can reply to it.
        "LOCAL_PEERS": f"{Identity.from_seed(CHAT_SENDER_SEED, 0).address}=http://127.0.0.1:{CHAT_SENDER_PORT}/submit",
        **extra,
    }


@contextmanager
def running_agents(tmp_path, **extra_env):
    busy = [p for p in [*PORTS.values(), CHAT_SENDER_PORT] if listening(p)]
    if busy:
        pytest.fail(f"ports {busy} are already in use; stop run_all.py first")
    out = open(tmp_path / "run_all.out", "w")
    proc = subprocess.Popen([sys.executable, "-u", "run_all.py"], cwd=AGENTS_DIR, env=env_for(tmp_path, **extra_env),
                            stdout=out, stderr=subprocess.STDOUT, start_new_session=True)
    try:
        wait_until(lambda: all(listening(p) for p in PORTS.values()) or proc.poll() is not None, 30, "the agents to listen")
        assert proc.poll() is None, (tmp_path / "run_all.out").read_text()
        yield tmp_path
    finally:
        # Kill the whole process group (run_all and its four children), even on failure.
        try:
            os.killpg(proc.pid, signal.SIGINT)
            proc.wait(timeout=15)
        except (ProcessLookupError, subprocess.TimeoutExpired):
            pass
        try:
            os.killpg(proc.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        proc.wait()
        out.close()
        print((tmp_path / "run_all.out").read_text()[-4000:])


@pytest.fixture
def agents(tmp_path):
    with running_agents(tmp_path) as d:
        yield d


def start_round(session, challenges=()):
    body = {"sessionId": session, "runId": "run_dev", "patientZero": "mri_2", "seed": 1337, "challenges": list(challenges)}
    r = httpx.post(f"http://127.0.0.1:{PORTS['coordinator']}/start_round", json=body, timeout=30)
    assert r.status_code == 200 and r.json()["ok"] is True, r.text


def round_state(log, state):
    return lambda: any(m.get("type") == "round_state" and m["payload"]["state"] == state for m in messages(log))


def test_live_round(agents):
    log = agents / f"{SESSION}.jsonl"
    start_round(SESSION)
    wait_until(round_state(log, "done"), TIMEOUT_S, "the round to finish")
    rows = messages(log)
    assert rows and all(row["fixture"] is True for row in rows)
    sent = [m for m in rows if m["table"] == "agent_message" and m["direction"] == "sent"]
    assert not [m for m in sent if m["type"] == "question"]  # no challenge: no unidentified device
    assert_worded(rows)

    expected = [
        ("proposal", lambda m: m["from"] == "flow" and m["payload"]["policyId"] == "cand_isolate_imaging"),
        ("clinical reject keep_flow", lambda m: m["type"] == "verdict" and m["from"] == "clinical_workflow"
            and m["payload"]["decision"] == "reject" and m["payload"]["constraint"]["kind"] == "keep_flow"),
        ("revision", lambda m: m["type"] == "revision" and m["from"] == "flow"),
        ("first accept", lambda m: m["type"] == "verdict" and m["payload"]["decision"] == "accept" and m["round"] == 2),
        ("second accept", lambda m: m["type"] == "verdict" and m["payload"]["decision"] == "accept" and m["round"] == 2),
        ("recommendation", lambda m: m["type"] == "recommendation"
            and m["payload"]["requiredRoles"] == ["security", "clinical_engineering"]),
    ]
    it = iter(sent)
    for name, match in expected:
        assert any(match(m) for m in it), f"missing, in order: {name}"
    accepts = {m["from"] for m in sent if m["type"] == "verdict" and m["round"] == 2}
    assert accepts == {"inventory", "clinical_workflow"}

    # Rule 9: every message sent was also relayed by its receiver (humans and relay aside).
    received = {(m["from"], m["to"], m["type"], json.dumps(m["payload"], sort_keys=True))
                for m in rows if m["table"] == "agent_message" and m["direction"] == "received"}
    for m in sent:
        if m["to"] not in ("humans", "relay"):
            assert (m["from"], m["to"], m["type"], json.dumps(m["payload"], sort_keys=True)) in received, m


def test_live_challenge_pauses_for_a_human_and_resumes(agents):
    """unknown_device_imaging: Inventory's question pauses the round; /resume resumes it."""
    log = agents / f"{CHALLENGE_SESSION}.jsonl"
    start_round(CHALLENGE_SESSION, ["unknown_device_imaging"])
    wait_until(round_state(log, "waiting_for_human"), TIMEOUT_S, "the round to pause")
    # Let anything in flight land. Flow's proposal may reach the Coordinator before
    # Inventory's preflight question; verdicts that arrive while paused must decide nothing.
    time.sleep(1.5)
    sent = [m for m in messages(log) if m["table"] == "agent_message" and m["direction"] == "sent"]
    (q,) = [m["payload"] for m in sent if m["type"] == "question" and m["to"] == "humans"]  # asked once
    assert q["targetId"] == "dev_unknown_7"
    assert not [m for m in sent if m["type"] in ("recommendation", "proposal_request") and m["round"] > 1 or m["type"] == "recommendation"]
    assert [m["payload"]["state"] for m in sent if m["type"] == "round_state"] == ["running", "waiting_for_human"]
    judged_before = len([m for m in sent if m["type"] in ("proposal", "revision") and m["from"] == "coordinator"])
    status = [m for m in messages(log) if m["table"] == "agent_status" and m["agent"] == "coordinator"]
    assert status[-1]["status"] == "waiting"

    wrong = {"sessionId": CHALLENGE_SESSION, "questionId": q["id"], "choice": "workstation", "author": "Kai", "role": "operations"}
    r = httpx.post(f"http://127.0.0.1:{PORTS['coordinator']}/resume", json=wrong, timeout=30)
    assert r.json()["ok"] is False and "may not answer" in r.json()["detail"]

    answer = {**wrong, "author": "Dev", "role": "clinical_engineering"}
    r = httpx.post(f"http://127.0.0.1:{PORTS['coordinator']}/resume", json=answer, timeout=30)
    assert r.json()["ok"] is True, r.text
    wait_until(round_state(log, "done"), TIMEOUT_S, "the round to finish")

    rows = messages(log)
    assert all(row["fixture"] is True for row in rows)
    sent = [m for m in rows if m["table"] == "agent_message" and m["direction"] == "sent"]
    types = [(m["type"], m["payload"].get("state")) for m in sent]
    paused, resumed = types.index(("round_state", "waiting_for_human")), types.index(("round_state", "running"), 2)
    answer_row = next(i for i, m in enumerate(rows) if m.get("type") == "answer" and m["from"] == "humans")
    assert rows.index(sent[paused]) < answer_row < rows.index(sent[resumed])
    # Nothing was decided while paused: the first constraint-bearing request comes after resume,
    # and the paused candidate went back to both guardians.
    assert all(i > resumed for i, m in enumerate(sent) if m["type"] == "proposal_request" and m["round"] > 1)
    rejudged = [m["to"] for m in sent[resumed:] if m["type"] in ("proposal", "revision") and m["from"] == "coordinator"]
    assert rejudged[:2] == ["inventory", "clinical_workflow"] or judged_before == 0
    (rec,) = [m["payload"] for m in sent if m["type"] == "recommendation"]
    assert "fl_unknown_7_smb" in rec["testResult"]["removedFlows"]  # touches the device, now named
    assert rec["requiredRoles"] == ["security", "clinical_engineering"]
    assert_worded(rows)
    # After the answer, Inventory accepts every candidate that touches dev_unknown_7.
    after = [m["payload"]["decision"] for m in sent[resumed:] if m["type"] == "verdict" and m["from"] == "inventory"]
    assert after and set(after) == {"accept"}


WORDED = {"verdict": "reason", "proposal": "reason", "revision": "reason", "question": "text", "recommendation": "explanation"}


def assert_worded(rows):
    """Every worded message carries a real sentence and says a template wrote it (no key here)."""
    for m in rows:
        if m.get("table") == "agent_message" and m["type"] in WORDED:
            text = m["payload"][WORDED[m["type"]]]
            assert text and not text.startswith("["), m
            assert m["reason"] == text and m["reasonSource"] == "template", m


def health(port):
    r = httpx.get(f"http://127.0.0.1:{port}/health", timeout=5)
    assert r.status_code == 200, r.text
    return r.json()


def test_live_mailbox_mode_keeps_local_delivery(tmp_path):
    """AGENT_MAILBOX=1 with LOCAL_RESOLVE=1: each agent has an Agentverse mailbox client
    (which can't connect here) and still serves /health and /submit at 127.0.0.1, so a
    whole round runs over direct local messages."""
    with running_agents(tmp_path, AGENT_MAILBOX="1") as d:
        for agent, port in PORTS.items():
            h = health(port)
            assert h["agent"] == agent and h["mailbox"] is True and h["localResolve"] is True
        log = d / f"{SESSION}.jsonl"
        start_round(SESSION)
        wait_until(round_state(log, "done"), TIMEOUT_S, "the mailbox-mode round to finish")
        sent = [m for m in messages(log) if m["table"] == "agent_message" and m["direction"] == "sent"]
        (rec,) = [m["payload"] for m in sent if m["type"] == "recommendation"]
        assert rec["requiredRoles"] == ["security", "clinical_engineering"]
        received = [m for m in messages(log) if m["table"] == "agent_message" and m["direction"] == "received"]
        assert {m["to"] for m in received} == {"inventory", "flow", "clinical_workflow", "coordinator"}


def chat_replies(out: Path) -> list[dict]:
    return [json.loads(line) for line in out.read_text().splitlines()] if out.exists() else []


def test_live_chat_starts_a_round_and_sends_the_summary(agents):
    out = agents / "chat_replies.jsonl"
    texts = ["hello", "simulate ransomware from Toaster 9", "simulate ransomware from MRI 2"]
    sender = subprocess.Popen(
        [sys.executable, "-u", "tests/chat_sender.py", "--out", str(out), *[x for t in texts for x in ("--text", t)]],
        cwd=AGENTS_DIR, env=env_for(agents), stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT, start_new_session=True,
    )
    try:
        chats = lambda: [r for r in chat_replies(out) if r["type"] == "chat"]
        wait_until(lambda: len(chats()) >= 4, TIMEOUT_S, "4 chat replies (help, unknown device, started, summary)")
        rows = chat_replies(out)
        assert [r["status"] for r in rows if r["type"] == "sent"] == ["delivered"] * 3
        acked = {r["acknowledged"] for r in rows if r["type"] == "ack"}
        assert {r["msg_id"] for r in rows if r["type"] == "sent"} <= acked  # every message acknowledged
        help_, unknown, started, summary = [r["text"] for r in chats()]
        assert all(r["from_coordinator"] for r in chats())
        assert "simulate ransomware from MRI 2" in help_ and "status" in help_
        assert 'I don\'t know a device called "Toaster 9"' in unknown and "MRI 2" in unknown
        assert started.startswith("Started a round from MRI 2") and "fixture" in started
        assert "the Flow Agent proposed \"Isolate imaging\"" in summary
        assert "✕ Clinical Workflow Agent rejected" in summary and "keep flow fl_1, fl_2, fl_3, fl_4" in summary
        assert "Result: the agents agree on \"Contain imaging, keep scans flowing\"" in summary
        assert "Security, Clinical engineering must sign off" in summary
        assert "(template)" in summary and "fixture files" in summary
        for text in (help_, unknown, started, summary):
            assert not FORBIDDEN.search(text), text
        # The chat round went through the same code path as /start_round, and was relayed.
        logs = list(agents.glob("chat-*.jsonl"))
        assert len(logs) == 1
        relayed = [m for m in messages(logs[0]) if m.get("type") == "recommendation"]
        assert relayed and relayed[0]["payload"]["requiredRoles"] == ["security", "clinical_engineering"]
        chat_rows = [m for m in messages(agents / "asi1-chat.jsonl") if m.get("type") == "chat"]
        assert [m["payload"]["text"] for m in chat_rows if m["direction"] == "received"] == texts
    finally:
        os.killpg(sender.pid, signal.SIGKILL)
        sender.wait()
