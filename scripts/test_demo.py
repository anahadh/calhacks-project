"""Tests for scripts/demo.py, with fake pieces: tiny Python HTTP servers as child processes.

    python -m unittest scripts/test_demo.py -v        (or: python -m pytest scripts/test_demo.py)

Covers start order and waiting on health, a piece that never gets healthy, crash
detection with the last log lines, port clashes (held ports and two pieces on one
port), clean shutdown of a whole process group (grandchildren too), restart, and that
no secret value is ever printed or logged. Standard library only.
"""

import io
import json
import os
import signal
import socket
import sys
import tempfile
import textwrap
import time
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import demo  # noqa: E402

# A fake piece: serves GET /health on --port after --delay seconds, prints a few lines,
# can exit after --exit-after seconds, can start a grandchild, can print an env variable.
FAKE = textwrap.dedent('''
    import argparse, http.server, os, subprocess, sys, threading, time
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=0)
    ap.add_argument("--delay", type=float, default=0)
    ap.add_argument("--exit-after", type=float, default=0)
    ap.add_argument("--code", type=int, default=3)
    ap.add_argument("--grandchild", default="")
    ap.add_argument("--print-env", default="")
    ap.add_argument("--marker", default="")
    a = ap.parse_args()
    if a.marker:
        with open(a.marker, "a") as f:
            f.write(f"start {time.time()}\\n")
    for i in range(25):
        print(f"line {i}", flush=True)
    if a.print_env:
        print(f"my {a.print_env} is {os.environ.get(a.print_env, '')}", flush=True)
    if a.grandchild:
        p = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(600)"])
        open(a.grandchild, "w").write(str(p.pid))
    if a.exit_after:
        def bye():
            time.sleep(a.exit_after)
            print("fatal: fake crash", flush=True)
            os._exit(a.code)
        threading.Thread(target=bye, daemon=True).start()
    time.sleep(a.delay)
    class H(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            self.send_response(200); self.end_headers(); self.wfile.write(b'{"ok": true}')
        def log_message(self, *args): pass
    if a.port:
        if a.marker:
            with open(a.marker, "a") as f:
                f.write(f"healthy {time.time()}\\n")
        http.server.HTTPServer(("127.0.0.1", a.port), H).serve_forever()
    else:
        time.sleep(600)
''')


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    # A zombie (exited, not yet reaped) still "exists": read its state where we can.
    try:
        return Path(f"/proc/{pid}/stat").read_text().split(")")[-1].split()[0] != "Z"
    except OSError:
        return True


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.fake = self.tmp / "fake.py"
        self.fake.write_text(FAKE)
        self.out = io.StringIO()
        self.launchers = []

    def tearDown(self):
        for l in self.launchers:
            l.stop_all()

    def piece(self, name, port=None, timeout=10.0, **flags) -> demo.Piece:
        cmd = [sys.executable, "-u", str(self.fake)]
        if port:
            cmd += ["--port", str(port)]
        for k, v in flags.items():
            cmd += [f"--{k.replace('_', '-')}", str(v)]
        health = (lambda: demo._ok(f"http://127.0.0.1:{port}/health", lambda s, _: s == 200, "ok", 0.5)) \
            if port else (lambda: (True, "no port"))
        return demo.Piece(name, cmd, self.tmp, [port] if port else [], health, timeout=timeout)

    def launcher(self, pieces, secrets=()) -> demo.Launcher:
        l = demo.Launcher(pieces, log_dir=self.tmp / "logs", out=self.out, color=False, secrets=list(secrets))
        self.launchers.append(l)
        return l


class StartOrder(Base):
    def test_starts_in_order_and_waits_for_each_health_check(self):
        pa, pb, pc = free_port(), free_port(), free_port()
        ma, mb = self.tmp / "a.marker", self.tmp / "b.marker"
        l = self.launcher([self.piece("a", pa, delay=1.0, marker=ma), self.piece("b", pb, marker=mb),
                           self.piece("c", pc)])
        self.assertTrue(l.up())
        self.assertEqual(l.events, [("start", "a"), ("healthy", "a"), ("start", "b"), ("healthy", "b"),
                                    ("start", "c"), ("healthy", "c")])
        a_healthy = float(ma.read_text().split("healthy ")[1])
        b_start = float(mb.read_text().split("start ")[1].split()[0])
        self.assertGreater(b_start, a_healthy, "b started before a was healthy")
        self.assertEqual(l.status, {"a": "up", "b": "up", "c": "up"})
        # Prefixed console lines, and a log file per piece.
        self.assertIn("[a]", self.out.getvalue())
        self.assertIn("line 24", (self.tmp / "logs" / "b.log").read_text())

    def test_a_piece_that_never_gets_healthy_stops_up(self):
        port = free_port()
        never = self.piece("never", port, timeout=1.5, delay=30)
        l = self.launcher([never, self.piece("after", free_port())])
        self.assertFalse(l.up())
        self.assertEqual(l.status["never"], "failed")
        self.assertNotIn(("start", "after"), l.events)
        self.assertIn("NEVER DID NOT COME UP", self.out.getvalue())
        self.assertFalse(l.running)  # the unhealthy one was stopped

    def test_keep_going_starts_the_rest(self):
        bad = self.piece("bad", free_port(), exit_after=0.2, delay=5)
        good = self.piece("good", free_port())
        l = self.launcher([bad, good])
        self.assertFalse(l.up(keep_going=True))
        self.assertEqual(l.status["bad"], "failed")
        self.assertEqual(l.status["good"], "up")

    def test_a_piece_that_cannot_start_here_says_why(self):
        p = self.piece("tool", free_port())
        p.missing = "the spacetime CLI isn't installed"
        l = self.launcher([p])
        self.assertFalse(l.up())
        self.assertIn("can't start: the spacetime CLI isn't installed", self.out.getvalue())

    def test_oneshot_waits_for_exit_then_checks(self):
        port = free_port()
        server = self.piece("server", port)
        once = demo.Piece("once", [sys.executable, "-c", "print('published')"], self.tmp, [],
                          lambda: (True, "published"), oneshot=True)
        fail = demo.Piece("fail", [sys.executable, "-c", "import sys; print('nope'); sys.exit(4)"], self.tmp, [],
                          lambda: (True, "-"), oneshot=True)
        l = self.launcher([server, once, fail])
        self.assertFalse(l.up())
        self.assertEqual(l.status["once"], "done")
        self.assertEqual(l.status["fail"], "failed")
        self.assertIn("exited with code 4", l.detail["fail"])


class Crashes(Base):
    def test_a_crash_gets_a_banner_with_the_last_20_lines_and_the_rest_keep_running(self):
        l = self.launcher([self.piece("steady", free_port()), self.piece("crashy", free_port(), exit_after=1.0)])
        self.assertTrue(l.up())
        deadline = time.monotonic() + 10
        gone = []
        while not gone and time.monotonic() < deadline:
            gone = l.check_exits()
            time.sleep(0.1)
        self.assertEqual(gone, ["crashy"])
        out = self.out.getvalue()
        self.assertIn("CRASHY EXITED (code 3)", out)
        self.assertIn("restart crashy", out)
        banner = out[out.index("CRASHY EXITED"):]
        self.assertIn("| fatal: fake crash", banner)
        self.assertIn("| line 6", banner)        # 25 lines + the crash line: the last 20 start at line 6
        self.assertNotIn("| line 5\n", banner)
        self.assertEqual(l.status["crashy"], "exited")
        self.assertIsNone(l.running["steady"].proc.poll())
        self.assertEqual(l.check_exits(), [])  # reported once


class Ports(Base):
    def test_a_held_port_is_a_clash_and_nothing_starts(self):
        port = free_port()
        holder = socket.socket()
        holder.bind(("127.0.0.1", port))
        holder.listen()
        try:
            l = self.launcher([self.piece("engine", free_port()), self.piece("web", port)])
            self.assertFalse(l.up())
        finally:
            holder.close()
        out = self.out.getvalue()
        self.assertIn("Port clash, nothing started", out)
        self.assertIn(f"port {port} (web) is already held by", out)
        self.assertEqual(l.events, [])

    def test_two_pieces_on_one_port_is_a_config_clash(self):
        l = self.launcher([self.piece("spacetimedb", 3000), self.piece("web", 3000)])
        problems = l.port_problems()
        self.assertEqual(len(problems), 1)
        self.assertIn("web and spacetimedb are both set to port 3000", problems[0])
        self.assertIn("run the web on 3001", problems[0])

    def test_the_real_layout_has_no_clash(self):
        cfg = demo.Config("http://127.0.0.1:3000", "hippocratech", "http://127.0.0.1:8000", 8010, demo.WEB_PORT)
        pieces = demo.demo_pieces(cfg)
        self.assertEqual([p.name for p in pieces], list(demo.ORDER))
        ports = [port for p in pieces for port in p.ports]
        self.assertEqual(sorted(ports), [3000, 3001, 8000, 8001, 8002, 8003, 8004, 8010])
        self.assertEqual(pieces[4].cmd[-2:], ["-p", "3001"])

    def test_a_healthy_reusable_piece_is_reused_not_started_or_stopped(self):
        port = free_port()
        outside = self.launcher([self.piece("db", port)])  # "already running", started by someone else
        self.assertTrue(outside.up())
        db = self.piece("db", port)
        db.reuse = True
        l = self.launcher([db, self.piece("app", free_port())])
        self.assertTrue(l.up())
        self.assertEqual(l.status["db"], "reused")
        self.assertNotIn(("start", "db"), l.events)
        l.stop_all()
        self.assertIsNone(outside.running["db"].proc.poll(), "stopped a piece it didn't start")


class Shutdown(Base):
    def test_stop_all_takes_children_and_grandchildren_and_frees_the_ports(self):
        port = free_port()
        pidfile = self.tmp / "grandchild.pid"
        l = self.launcher([self.piece("parent", port, grandchild=pidfile)])
        self.assertTrue(l.up())
        deadline = time.monotonic() + 5
        while not pidfile.exists() and time.monotonic() < deadline:
            time.sleep(0.1)
        grandchild = int(pidfile.read_text())
        child = l.running["parent"].proc.pid
        self.assertTrue(alive(grandchild))
        self.assertTrue(l.stop_all())
        time.sleep(0.3)
        self.assertFalse(alive(child))
        self.assertFalse(alive(grandchild), "the grandchild outlived stop_all")
        self.assertFalse(demo.port_in_use(port))
        self.assertIn("All ports free.", self.out.getvalue())
        self.assertFalse(l.state_file.exists())

    def test_state_file_names_what_down_must_stop(self):
        port = free_port()
        l = self.launcher([self.piece("x", port)])
        self.assertTrue(l.up())
        state = json.loads(l.state_file.read_text())
        self.assertEqual(state["supervisor"], os.getpid())
        self.assertEqual(state["pieces"]["x"]["pid"], l.running["x"].proc.pid)
        self.assertEqual(state["pieces"]["x"]["ports"], [port])

    def test_restart_one_piece(self):
        port = free_port()
        l = self.launcher([self.piece("a", free_port()), self.piece("b", port)])
        self.assertTrue(l.up())
        a_pid, b_pid = l.running["a"].proc.pid, l.running["b"].proc.pid
        self.assertTrue(l.restart("b"))
        self.assertNotEqual(l.running["b"].proc.pid, b_pid)
        self.assertEqual(l.running["a"].proc.pid, a_pid)
        self.assertEqual(l.status["b"], "up")
        self.assertEqual(json.loads(l.state_file.read_text())["restarts"], {"b": 1})

    def test_down_from_another_shell_stops_up(self):
        # A real `demo.py up` process, with a fake piece list injected, stopped by SIGTERM as `down` does.
        port = free_port()
        script = self.tmp / "sup.py"
        script.write_text(textwrap.dedent(f'''
            import sys, signal, time
            sys.path.insert(0, {str(Path(__file__).parent)!r})
            import demo
            from pathlib import Path
            p = demo.Piece("x", [sys.executable, "-u", {str(self.fake)!r}, "--port", "{port}"], Path("."), [{port}],
                           lambda: demo._ok("http://127.0.0.1:{port}/health", lambda s, _: s == 200, "ok", 0.5))
            l = demo.Launcher([p], log_dir=Path({str(self.tmp / "suplogs")!r}), color=False, secrets=[])
            def term(*_): raise KeyboardInterrupt
            signal.signal(signal.SIGTERM, term)
            try:
                l.up()
                print("UP", flush=True)
                while True: time.sleep(0.2)
            except KeyboardInterrupt:
                pass
            finally:
                l.stop_all()
        '''))
        import subprocess
        sup = subprocess.Popen([sys.executable, "-u", str(script)], stdout=subprocess.PIPE, text=True)
        for line in sup.stdout:
            if line.strip() == "UP":
                break
        self.assertTrue(demo.port_in_use(port))
        sup.send_signal(signal.SIGTERM)
        rest = sup.communicate(timeout=30)[0]
        self.assertIn("All ports free.", rest)
        self.assertFalse(demo.port_in_use(port))


class Secrets(Base):
    def test_a_secret_a_child_prints_is_redacted_on_screen_and_in_the_log(self):
        secret = "sk-test-0123456789abcdef"
        p = self.piece("leaky", free_port(), print_env="FAKE_API_KEY")
        p.env = {"FAKE_API_KEY": secret}
        l = self.launcher([p], secrets=[secret])
        self.assertTrue(l.up())
        l.stop_all()
        log = (self.tmp / "logs" / "leaky.log").read_text()
        for text in (self.out.getvalue(), log):
            self.assertNotIn(secret, text)
            self.assertIn("my FAKE_API_KEY is <redacted>", text)

    def test_secret_values_come_from_both_env_files(self):
        (self.tmp / "agents").mkdir()
        (self.tmp / ".env.local").write_text("STDB_SERVER_TOKEN=tok-abcdef123\nNEXT_PUBLIC_STDB_URI=ws://x:3000\n")
        (self.tmp / "agents" / ".env").write_text('FLOW_AGENT_SEED="seed words here"\nHOSPITAL_PATH=/a/b\n')
        vals = demo.secret_values(self.tmp)
        self.assertIn("tok-abcdef123", vals)
        self.assertIn("seed words here", vals)
        self.assertNotIn("ws://x:3000", vals)
        self.assertNotIn("/a/b", vals)

    def test_env_check_lists_missing_names_and_never_a_value(self):
        (self.tmp / "agents").mkdir()
        (self.tmp / ".env.local").write_text(
            "STDB_URI=ws://127.0.0.1:3000\nSTDB_SERVER_TOKEN=very-secret-server-token\n"
            "RELAY_TOKEN=relay-secret-one\nRELAY_PORT=8010\n")
        (self.tmp / "agents" / ".env").write_text(
            "INVENTORY_AGENT_SEED=inventory secret seed\nRELAY_TOKEN=relay-secret-two\n"
            "WATCHER_RELAY_URL=http://127.0.0.1:9999\nASI1_API_KEY=asi-secret-key\n")
        saved = {k: os.environ.pop(k) for k in list(os.environ) if k in (
            "NEXT_PUBLIC_STDB_URI", "FLOW_AGENT_SEED", "CLINICAL_WORKFLOW_AGENT_SEED", "COORDINATOR_AGENT_SEED",
            "HIPPO_SIM_BIN", "ANTHROPIC_API_KEY")}
        try:
            r = demo.check_env(self.tmp)
        finally:
            os.environ.update(saved)
        self.assertFalse(r.ok)
        text = "\n".join(r.missing + r.warnings)
        for name in ("NEXT_PUBLIC_STDB_URI", "FLOW_AGENT_SEED", "COORDINATOR_AGENT_SEED", "HIPPO_SIM_BIN"):
            self.assertIn(name, text)
        self.assertIn("RELAY_TOKEN differs", text)
        self.assertIn("WATCHER_RELAY_URL's port isn't the watcher's RELAY_PORT (8010)", text)
        for value in ("very-secret-server-token", "relay-secret-one", "relay-secret-two", "inventory secret seed",
                      "asi-secret-key"):
            self.assertNotIn(value, text)

    def test_missing_files_are_named(self):
        r = demo.check_env(self.tmp)
        self.assertIn(".env.local: the file is missing (cp docs/.env.example .env.local)", r.missing)
        self.assertIn("agents/.env: the file is missing", r.missing)


class Misc(unittest.TestCase):
    def test_read_env(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / ".env"
            p.write_text("# c\nA=1\nexport B='two words'\nC=x # note\nD=\"q\"\nnot a line\n")
            self.assertEqual(demo.read_env(p), {"A": "1", "B": "two words", "C": "x", "D": "q"})

    def test_table(self):
        t = demo.table([("engine", "8000", "yes", "answers /healthz", "-")])
        self.assertIn("engine  8000  yes", t)


if __name__ == "__main__":
    unittest.main()
