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

import httpx
import pytest

from config import PORTS, SEED_VARS

AGENTS_DIR = Path(__file__).parent.parent
SESSION = "live-test"
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


@pytest.fixture
def agents(tmp_path):
    busy = [p for p in PORTS.values() if listening(p)]
    if busy:
        pytest.fail(f"ports {busy} are already in use; stop run_all.py first")
    env = {
        **os.environ,
        **{var: f"live test seed for {agent}" for agent, var in SEED_VARS.items()},
        "LOCAL_RESOLVE": "1", "AGENT_MAILBOX": "0", "HIPPO_SIM_FIXTURES": "1",
        "WATCHER_RELAY_URL": "", "RELAY_TOKEN": "", "HIPPO_SIM_BIN": "", "HIPPO_OPT_BIN": "",
        "RELAY_LOG_DIR": str(tmp_path),
    }
    out = open(tmp_path / "run_all.out", "w")
    proc = subprocess.Popen([sys.executable, "-u", "run_all.py"], cwd=AGENTS_DIR, env=env,
                            stdout=out, stderr=subprocess.STDOUT, start_new_session=True)
    try:
        wait_until(lambda: all(listening(p) for p in PORTS.values()) or proc.poll() is not None, 30, "the agents to listen")
        assert proc.poll() is None, (tmp_path / "run_all.out").read_text()
        yield tmp_path / f"{SESSION}.jsonl"
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


def test_live_round(agents):
    log = agents
    body = {"sessionId": SESSION, "runId": "run_dev", "patientZero": "mri_2", "seed": 1337, "challenges": []}
    r = httpx.post(f"http://127.0.0.1:{PORTS['coordinator']}/start_round", json=body, timeout=30)
    assert r.status_code == 200 and r.json()["ok"] is True, r.text

    def done():
        return any(m.get("type") == "round_state" and m["payload"]["state"] == "done" for m in messages(log))

    wait_until(done, TIMEOUT_S, "the round to finish")
    rows = messages(log)
    assert rows and all(row["fixture"] is True for row in rows)
    sent = [m for m in rows if m["table"] == "agent_message" and m["direction"] == "sent"]

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
