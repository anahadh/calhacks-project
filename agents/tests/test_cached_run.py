"""The cached demo run (record, replay through the relay) and the demo-day check.

All inputs are TEST DATA written below: a small standalone-round log in the format
agents/tools.py writes. Nothing here records or writes agents/cache/demo_round.json.
Replayed rows are checked with the watcher relay's own code (apps/watcher/src/relay.ts,
through tests/relay_check.mjs) when Node and the watcher's zod are installed.
"""

import json
import shutil
import subprocess
import sys
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

import pytest

AGENTS_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(AGENTS_DIR / "scripts"))
import cached_run  # noqa: E402
import demo_check  # noqa: E402
import record_round  # noqa: E402
import replay_cached  # noqa: E402

REPO = AGENTS_DIR.parent
RELAY_TS = REPO / "apps" / "watcher" / "src" / "relay.ts"
RELAY_CHECK = Path(__file__).parent / "relay_check.mjs"

# --- TEST DATA: one finished round as agents/tools.py logs it (WATCHER_RELAY_URL unset) ---

TEST_SESSION = "test-session"
VERDICT_REJECT = {"sessionId": TEST_SESSION, "round": 1, "policyId": "cand_a", "agent": "clinical_workflow",
                  "decision": "reject", "reason": "I can't accept this: it breaks MRI 2 → PACS.",
                  "constraint": {"kind": "keep_flow", "targetIds": ["fl_2"], "limit": None}, "reasonSource": "asi1"}
VERDICT_ACCEPT = {**VERDICT_REJECT, "round": 2, "policyId": "cand_b", "decision": "accept",
                  "reason": "I accept this: no protected flow breaks.", "constraint": None}


def _msg(t, frm, to, type, payload, reason=None, source=None, direction="sent", fixture=False, round=1):
    return {"table": "agent_message", "sessionId": TEST_SESSION, "round": round, "seq": None, "from": frm, "to": to,
            "type": type, "payload": payload, "reason": reason, "reasonSource": source,
            "createdAt": f"2026-10-25T10:00:{t:06.3f}+00:00", "direction": direction, "fixture": fixture}


def _status(t, agent, status, fixture=False):
    return {"table": "agent_status", "sessionId": TEST_SESSION, "agent": agent, "status": status,
            "updatedAt": f"2026-10-25T10:00:{t:06.3f}+00:00", "fixture": fixture}


def sample_log_rows():
    """TEST DATA. Sent and received copies, status changes (and a repeat), one question, a
    rejection, a revision, both accepts, the recommendation and round_state done."""
    rs = lambda state, rnd, detail=None: {"sessionId": TEST_SESSION, "round": rnd, "state": state, "detail": detail}
    question = {"sessionId": TEST_SESSION, "id": "q-r1-dev_unknown_7", "round": 1, "agent": "inventory",
                "targetId": "dev_unknown_7", "text": "What kind of device is the Unidentified device?",
                "choices": ["workstation", "ct"], "allowedRoles": ["clinical_engineering", "security"], "textSource": "asi1"}
    proposal = {"sessionId": TEST_SESSION, "round": 1, "policyId": "cand_a", "name": "Isolate imaging",
                "reason": "Isolate imaging: 1 infected device instead of 16.", "reasonSource": "asi1"}
    revision = {"sessionId": TEST_SESSION, "round": 2, "policyId": "cand_b", "diff": {"added": [], "removed": []},
                "reason": "Revised to keep scans flowing.", "reasonSource": "asi1"}
    rec = {"policy": {"name": "Keep scans"}, "testResult": {"infectedCount": 1}, "verdicts": [VERDICT_ACCEPT, VERDICT_ACCEPT],
           "explanation": "Keep scans holds the attack to 1 infected device.", "requiredRoles": ["security", "clinical_engineering"],
           "explanationSource": "asi1"}
    rows = [
        _status(0.0, "coordinator", "thinking"),
        _msg(0.1, "coordinator", "relay", "round_state", rs("running", 1)),
        _msg(0.2, "coordinator", "flow", "proposal_request", {"sessionId": TEST_SESSION, "round": 1, "patientZero": "mri_2"}),
        _msg(0.3, "coordinator", "flow", "proposal_request", {"sessionId": TEST_SESSION, "round": 1, "patientZero": "mri_2"},
             direction="received"),
        _status(0.4, "flow", "thinking"),
        _status(0.5, "flow", "thinking"),  # a repeat: not a change, not kept
        _msg(1.5, "flow", "coordinator", "proposal", proposal, proposal["reason"], "asi1"),
        _msg(1.6, "flow", "coordinator", "proposal", proposal, proposal["reason"], "asi1", direction="received"),
        _msg(1.7, "coordinator", "humans", "question", question, question["text"], "asi1"),
        _msg(2.5, "clinical_workflow", "coordinator", "verdict", VERDICT_REJECT, VERDICT_REJECT["reason"], "asi1"),
        _msg(2.6, "coordinator", "relay", "round_state", rs("running", 2), round=2),
        _msg(3.5, "flow", "coordinator", "revision", revision, revision["reason"], "asi1", round=2),
        _msg(4.5, "clinical_workflow", "coordinator", "verdict", VERDICT_ACCEPT, VERDICT_ACCEPT["reason"], "asi1", round=2),
        _msg(4.6, "inventory", "coordinator", "verdict", {**VERDICT_ACCEPT, "agent": "inventory"}, VERDICT_ACCEPT["reason"],
             "asi1", round=2),
        _msg(5.0, "coordinator", "relay", "recommendation", rec, rec["explanation"], "asi1", round=2),
        _msg(5.1, "coordinator", "relay", "round_state", rs("done", 2), round=2),
        _status(5.2, "coordinator", "idle"),
    ]
    return rows


def recorded():
    return cached_run.record(sample_log_rows(), engine="hippo-sim (test)", recorded_at="2026-10-25T10:05:00+00:00",
                             commit="0123456789abcdef")


def replayed(cache=None, session="live-session", speed=1000.0):
    posts, waits = [], []
    cache = cache or recorded()
    n = replay_cached.replay(cache, session, "http://relay.test", "test-token", speed=speed,
                             post=lambda url, json, headers: posts.append((url, json, headers)) or (200, '{"ok":true}'),
                             sleep=waits.append, now=lambda: "2026-10-25T18:00:00.000+00:00", log=lambda *_: None)
    return n, posts, waits


# --- record_round ---


def test_record_keeps_sent_rows_and_status_changes_in_order():
    cache = recorded()
    kinds = [(r["table"], r["row"].get("type") or r["row"]["status"]) for r in cache["rows"]]
    assert kinds == [
        ("agent_status", "thinking"), ("agent_message", "round_state"), ("agent_message", "proposal_request"),
        ("agent_status", "thinking"), ("agent_message", "proposal"), ("agent_message", "question"),
        ("agent_message", "verdict"), ("agent_message", "round_state"), ("agent_message", "revision"),
        ("agent_message", "verdict"), ("agent_message", "verdict"), ("agent_message", "recommendation"),
        ("agent_message", "round_state"), ("agent_status", "idle"),
    ]
    assert all(r["row"].get("direction", "sent") == "sent" for r in cache["rows"])
    assert [r["offsetMs"] for r in cache["rows"]][:5] == [0, 100, 200, 400, 1500]
    assert all("table" not in r["row"] and "seq" not in r["row"] for r in cache["rows"])  # relay-shaped rows
    assert (cache["patientZero"], cache["modelSources"], cache["rowCount"], cache["sourceSessionId"]) == (
        "mri_2", ["asi1"], 14, TEST_SESSION)
    assert cache["engine"] == "hippo-sim (test)" and cache["gitCommit"] == "0123456789abcdef"
    cached_run.validate(cache)


def test_record_refuses_fixture_rows():
    rows = sample_log_rows()
    rows[6]["fixture"] = True
    with pytest.raises(cached_run.CacheError, match="fixture=True: a cached run must come from the real engine"):
        cached_run.record(rows, engine="x")
    rows = sample_log_rows()
    rows[0]["fixture"] = True  # a status row counts too
    with pytest.raises(cached_run.CacheError, match="fixture"):
        cached_run.record(rows, engine="x")


@pytest.mark.parametrize("field, value, message", [
    ("reason", None, "has no reason"),
    ("reason", "", "has no reason"),
    ("reasonSource", None, "reasonSource None"),
    ("reasonSource", "template", "reasonSource 'template'"),
])
def test_record_refuses_missing_reasons(field, value, message):
    rows = sample_log_rows()
    rows[9][field] = value  # Clinical's rejection
    with pytest.raises(cached_run.CacheError, match=message):
        cached_run.record(rows, engine="x")


def test_record_refuses_an_unfinished_round_or_a_mixed_log():
    with pytest.raises(cached_run.CacheError, match="no finished round"):
        cached_run.record(sample_log_rows()[:-2], engine="x")
    rows = sample_log_rows()
    rows[3]["sessionId"] = "another"
    with pytest.raises(cached_run.CacheError, match="mixes sessions"):
        cached_run.record(rows, engine="x")


def test_record_round_cli(tmp_path, capsys):
    log = tmp_path / "test-session.jsonl"
    log.write_text("\n".join(json.dumps(r) for r in sample_log_rows()) + "\n")
    out = tmp_path / "cache" / "demo_round.json"
    assert record_round.main([str(log), "--out", str(out)]) == 0
    assert json.loads(out.read_text())["rowCount"] == 14
    assert record_round.main([str(log), "--out", str(out)]) == 2  # won't overwrite without --force
    bad = tmp_path / "bad.jsonl"
    rows = sample_log_rows()
    rows[6]["fixture"] = True
    bad.write_text("\n".join(json.dumps(r) for r in rows))
    assert record_round.main([str(bad), "--out", str(tmp_path / "other.json")]) == 1
    assert "refusing to record" in capsys.readouterr().err
    assert not (tmp_path / "other.json").exists()


# --- replay_cached ---


def test_every_replayed_row_carries_the_cached_run_label():
    n, posts, _ = replayed()
    assert n == len(posts) == 14
    for url, row, headers in posts:
        table = url.rsplit("/", 1)[1]
        assert headers == {"Authorization": "Bearer test-token"}
        assert cached_run.is_labeled(table, row), row
        assert row["sessionId"] == "live-session"
        if table == "agent_message":
            assert row["createdAt"] == "2026-10-25T18:00:00.000+00:00" and row["fixture"] is False
            if row["reason"] is not None:
                assert row["reason"].startswith("Cached run · ")
            if row["type"] == "round_state":
                assert row["payload"]["detail"].startswith("Cached run (recorded 2026-10-25)")
            assert ("cached" in row["payload"]) == (row["type"] not in ("question", "round_state", "recommendation"))
        else:
            assert row["updatedAt"] == "2026-10-25T18:00:00.000+00:00"
    rec = next(row for _, row, _ in posts if row.get("type") == "recommendation")
    assert all(v["sessionId"] == "live-session" for v in rec["payload"]["verdicts"])  # nested ids too
    assert rec["payload"]["requiredRoles"] == ["security", "clinical_engineering"]  # everything else as recorded
    reject = next(row for _, row, _ in posts if row.get("type") == "verdict")
    assert reject["payload"]["constraint"] == VERDICT_REJECT["constraint"] and reject["payload"]["decision"] == "reject"


def test_replay_keeps_the_recorded_timing_scaled_by_speed():
    _, _, waits = replayed(speed=2.0)
    assert waits[:5] == [0.0, 0.05, 0.05, 0.1, 0.55]  # offsets 0,100,200,400,1500 ms at 2x
    with pytest.raises(replay_cached.ReplayError, match="--speed"):
        replayed(speed=0)


def test_replay_stops_on_the_first_relay_error():
    posts = []

    def post(url, json, headers):
        posts.append(json)
        return (400, '{"ok":false,"error":"Invalid round_state payload: nope"}') if len(posts) == 3 else (200, "{}")

    with pytest.raises(replay_cached.ReplayError, match=r"row 3/14 .*HTTP 400: .*Invalid round_state payload: nope"):
        replay_cached.replay(recorded(), "s", "http://relay.test", "t", speed=1000, post=post, sleep=lambda _: None,
                             log=lambda *_: None)
    assert len(posts) == 3  # nothing after the rejected row


class _FakeRelay(BaseHTTPRequestHandler):
    """A real HTTP relay that accepts two rows, then refuses one (like relay.ts's 400)."""
    seen: list = []

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["content-length"])))
        type(self).seen.append((self.path, self.headers["authorization"], body))
        ok = len(type(self).seen) < 3
        self.send_response(200 if ok else 400)
        self.end_headers()
        self.wfile.write(json.dumps({"ok": ok} if ok else {"ok": False, "error": "Missing or wrong RELAY_TOKEN."}).encode())

    def log_message(self, *a):
        pass


def test_replay_over_http_shows_the_relays_error(monkeypatch, tmp_path, capsys):
    _FakeRelay.seen = []
    server = HTTPServer(("127.0.0.1", 0), _FakeRelay)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    cache = tmp_path / "demo_round.json"
    cache.write_text(json.dumps(recorded()))
    monkeypatch.setenv("WATCHER_RELAY_URL", f"http://127.0.0.1:{server.server_port}")
    monkeypatch.setenv("RELAY_TOKEN", "test-token")
    try:
        assert replay_cached.main(["--session", "s", "--speed", "1000", "--cache", str(cache)]) == 1
    finally:
        server.shutdown()
    err = capsys.readouterr().err
    assert "row 3/14" in err and "HTTP 400" in err and "Missing or wrong RELAY_TOKEN." in err
    assert [p for p, _, _ in _FakeRelay.seen] == ["/agent_status", "/agent_message", "/agent_message"]
    assert all(a == "Bearer test-token" for _, a, _ in _FakeRelay.seen)


def test_replay_cli_needs_cache_url_and_token(monkeypatch, tmp_path, capsys):
    monkeypatch.setenv("WATCHER_RELAY_URL", "")
    monkeypatch.setenv("RELAY_TOKEN", "")
    assert replay_cached.main(["--session", "s", "--cache", str(tmp_path / "none.json")]) == 1
    assert "no cached run at" in capsys.readouterr().err
    cache = tmp_path / "demo_round.json"
    cache.write_text(json.dumps(recorded()))
    assert replay_cached.main(["--session", "s", "--cache", str(cache)]) == 1
    assert "WATCHER_RELAY_URL is not set" in capsys.readouterr().err
    monkeypatch.setenv("WATCHER_RELAY_URL", "http://127.0.0.1:9")
    assert replay_cached.main(["--session", "s", "--cache", str(cache)]) == 1
    assert "RELAY_TOKEN" in capsys.readouterr().err


def _relay_ts_runs() -> str | None:
    if not shutil.which("node"):
        return "node is not installed"
    if not ((REPO / "node_modules" / "zod").exists() or (REPO / "apps" / "watcher" / "node_modules" / "zod").exists()):
        return "the watcher's zod isn't installed (npm ci -w watcher)"
    return None


def relay_ts(rows: list[tuple[str, dict]], tmp_path) -> list[dict]:
    path = tmp_path / "rows.json"
    path.write_text(json.dumps([{"table": t, "row": r} for t, r in rows]))
    out = subprocess.run(["node", "--experimental-transform-types", "--no-warnings", str(RELAY_CHECK), str(RELAY_TS), str(path)],
                         capture_output=True, text=True, timeout=60, check=True)
    return json.loads(out.stdout)


@pytest.mark.skipif(_relay_ts_runs() is not None, reason=str(_relay_ts_runs()))
def test_replayed_rows_pass_the_watcher_relays_own_schemas(tmp_path):
    _, posts, _ = replayed()
    rows = [(url.rsplit("/", 1)[1], row) for url, row, _ in posts]
    results = relay_ts(rows, tmp_path)
    bad = [(rows[i][1].get("type") or rows[i][0], r["error"]) for i, r in enumerate(results) if not r["ok"]]
    assert not bad, bad
    # The check has teeth: the relay refuses "cached" on its strict payloads, and a logged row's extra fields.
    rs = next(r for t, r in rows if r.get("type") == "round_state")
    q = next(r for t, r in rows if r.get("type") == "question")
    logged = sample_log_rows()[1]  # still has "table" and "seq"
    refused = relay_ts([("agent_message", {**rs, "payload": {**rs["payload"], "cached": True}}),
                        ("agent_message", {**q, "payload": {**q["payload"], "cached": True}}),
                        ("agent_message", logged)], tmp_path)
    assert [r["ok"] for r in refused] == [False, False, False]
    assert "Unrecognized key" in refused[0]["error"] and "cached" in refused[0]["error"]


# --- demo_check ---


def test_demo_check_env(tmp_path):
    assert not demo_check.check_env(tmp_path / ".env").ok
    env = tmp_path / ".env"
    env.write_text("INVENTORY_AGENT_SEED=a\nFLOW_AGENT_SEED=b\n")
    c = demo_check.check_env(env)
    assert not c.ok and "CLINICAL_WORKFLOW_AGENT_SEED" in c.detail and "=a" not in c.detail
    env.write_text("".join(f"{v}=secret-{v}\n" for v in demo_check.SEED_VARS.values()))
    c = demo_check.check_env(env)
    assert c.ok and "secret" not in c.detail


def test_demo_check_fails_cleanly_when_things_are_missing(monkeypatch, tmp_path):
    monkeypatch.delenv("HIPPO_SIM_BIN", raising=False)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.setenv("WATCHER_RELAY_URL", "")
    monkeypatch.setenv("RELAY_TOKEN", "")
    assert "HIPPO_SIM_BIN is not set" in demo_check.check_engine().detail
    monkeypatch.setenv("HIPPO_SIM_BIN", str(tmp_path / "no-such-hippo-sim"))
    assert "not an executable file" in demo_check.check_engine().detail
    assert "neither ASI1_API_KEY nor ANTHROPIC_API_KEY" in demo_check.check_model().detail
    assert "WATCHER_RELAY_URL is not set" in demo_check.check_relay().detail
    assert "no cached run at" in demo_check.check_cache(tmp_path / "demo_round.json").detail
    good = tmp_path / "demo_round.json"
    good.write_text(json.dumps(recorded()))
    assert demo_check.check_cache(good).ok
    bad = tmp_path / "bad.json"
    bad.write_text(json.dumps({**recorded(), "rowCount": 99}))
    assert not demo_check.check_cache(bad).ok


def test_demo_check_relay_token(monkeypatch):
    class Relay(BaseHTTPRequestHandler):
        def do_GET(self):
            self.send_response(200), self.end_headers(), self.wfile.write(b'{"ok":true}')

        def do_POST(self):
            self.rfile.read(int(self.headers["content-length"]))
            good = self.headers["authorization"] == "Bearer right"
            self.send_response(400 if good else 401), self.end_headers(), self.wfile.write(b"{}")

        def log_message(self, *a):
            pass

    server = HTTPServer(("127.0.0.1", 0), Relay)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    monkeypatch.setenv("WATCHER_RELAY_URL", f"http://127.0.0.1:{server.server_port}")
    try:
        monkeypatch.setenv("RELAY_TOKEN", "wrong")
        c = demo_check.check_relay()
        assert not c.ok and "refuses RELAY_TOKEN" in c.detail and "wrong" not in c.detail
        monkeypatch.setenv("RELAY_TOKEN", "right")
        c = demo_check.check_relay()
        assert c.ok and "right" not in c.detail
    finally:
        server.shutdown()


def test_demo_check_table_and_exit_code(monkeypatch, capsys):
    def crashes():
        raise RuntimeError("boom")

    ok = lambda: demo_check.Check("Fine", True, "ok")
    monkeypatch.setattr(demo_check, "ALL", (ok, crashes))
    assert demo_check.main([]) == 1
    out = capsys.readouterr().out
    assert "Fine" in out and "PASS" in out and "FAIL" in out and "crashed: RuntimeError: boom" in out
    assert "1 of 2 checks failed." in out
    monkeypatch.setattr(demo_check, "ALL", (ok,))
    assert demo_check.main([]) == 0 and "All checks passed." in capsys.readouterr().out
