#!/usr/bin/env python3
"""One command for the whole demo: start it, check it, stop it.

    python scripts/demo.py up [--keep-going] [--ignore-env] [--web-port 3001]
    python scripts/demo.py status
    python scripts/demo.py down
    python scripts/demo.py restart <piece>     # spacetimedb, publish, engine, watcher, web, agents

`up` runs the steps of docs/README.md "Run it" in order, waits for each piece's health
check before the next, prefixes every log line with a colored [piece], and writes
logs/demo/<piece>.log. Then it keeps watching: a piece that exits gets a banner with
its last 20 log lines, and the rest keep running. Ctrl-C (or `down` from another
shell) stops everything it started, children included, and confirms the ports are free.

Ports come from the same settings the pieces read: SpacetimeDB from STDB_URI (:3000),
the engine from ENGINE_URL (:8000), the watcher relay from RELAY_PORT (:8010), the
agents from agents/config.py PORTS (8001-8004, plus 8005 for the Scorekeeper with SCOREKEEPER=1),
and the web on :3001, because Next.js also defaults to :3000 (docs/hippocratech/INTEGRATION.md §10, item 2).

Never prints a secret: env checks list variable names only, and any value of a
*KEY/*TOKEN/*SEED/*SECRET variable is replaced with <redacted> in every log line.
Standard library only (Python 3.11). See docs/hippocratech/DEMO_RUNBOOK.md.
"""

from __future__ import annotations

import argparse
import collections
import json
import os
import re
import shutil
import signal
import socket
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

ROOT = Path(__file__).resolve().parent.parent
LOG_DIR = ROOT / "logs" / "demo"
ORDER = ("spacetimedb", "publish", "engine", "watcher", "web", "agents")
# agents/config.py PORTS (read as text, not imported: this script needs no agent deps).
AGENT_PORTS = {"inventory": 8001, "flow": 8002, "clinical_workflow": 8003, "coordinator": 8004}
SCOREKEEPER_PORT = 8005  # PORTS["scorekeeper"]: only with SCOREKEEPER=1
WEB_PORT = 3001
TAIL = 20

COLORS = {"spacetimedb": "\033[32m", "publish": "\033[92m", "engine": "\033[36m", "watcher": "\033[35m",
          "web": "\033[34m", "agents": "\033[33m"}
RED, BOLD, RESET = "\033[31m", "\033[1m", "\033[0m"
SECRET_NAME = re.compile(r"(KEY|TOKEN|SEED|SECRET|PASSWORD)", re.I)


# ----------------------------------------------------------------------------- env files
def scorekeeper_on(agents_env: dict[str, str]) -> bool:
    """SCOREKEEPER=1 in the shell, or else in agents/.env (the shell wins, as in agents/config.py)."""
    value = os.environ["SCOREKEEPER"] if "SCOREKEEPER" in os.environ else agents_env.get("SCOREKEEPER", "")
    return value.strip() == "1"


def agent_ports(root: Path = ROOT) -> dict[str, int]:
    """The agents run_all.py starts: the four, plus the Scorekeeper with SCOREKEEPER=1."""
    on = scorekeeper_on(read_env(root / "agents" / ".env"))
    return {**AGENT_PORTS, **({"scorekeeper": SCOREKEEPER_PORT} if on else {})}



def read_env(path: Path) -> dict[str, str]:
    """A .env file as {name: value}: KEY=VALUE lines, # comments, optional quotes, `export`."""
    out: dict[str, str] = {}
    if not path.exists():
        return out
    for raw in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, _, value = line.removeprefix("export ").partition("=")
        value = value.strip()
        if value[:1] in "\"'" and value[-1:] == value[:1] and len(value) >= 2:
            value = value[1:-1]
        else:
            value = value.split(" #", 1)[0].strip()
        out[name.strip()] = value
    return out


def port_of(url: str, default: int) -> int:
    try:
        return urllib.parse.urlsplit(url).port or default
    except ValueError:
        return default


def host_of(url: str) -> str:
    try:
        return urllib.parse.urlsplit(url).hostname or ""
    except ValueError:
        return ""


@dataclass
class EnvReport:
    missing: list[str] = field(default_factory=list)   # "file: NAME" lines; names only
    warnings: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.missing


def check_env(root: Path = ROOT) -> EnvReport:
    """Which needed variables are missing, by NAME. Never reads a value out loud."""
    r = EnvReport()
    web, agents = root / ".env.local", root / "agents" / ".env"
    w, a = read_env(web), read_env(agents)
    if not web.exists():
        r.missing.append(".env.local: the file is missing (cp docs/.env.example .env.local)")
    if not agents.exists():
        r.missing.append("agents/.env: the file is missing")
    set_ = lambda env, n: bool(env.get(n, "").strip() or os.environ.get(n, "").strip())  # noqa: E731
    for n in ("STDB_URI", "STDB_SERVER_TOKEN", "RELAY_TOKEN", "NEXT_PUBLIC_STDB_URI"):
        if web.exists() and not set_(w, n):
            r.missing.append(f".env.local: {n}")
    if web.exists() and not set_(w, "ANTHROPIC_API_KEY"):
        r.warnings.append(".env.local: ANTHROPIC_API_KEY is not set (the memo route needs it)")
    seeds = ("INVENTORY_AGENT_SEED", "FLOW_AGENT_SEED", "CLINICAL_WORKFLOW_AGENT_SEED", "COORDINATOR_AGENT_SEED")
    if scorekeeper_on(a):
        seeds += ("SCOREKEEPER_AGENT_SEED",)
    for n in (*seeds, "WATCHER_RELAY_URL", "RELAY_TOKEN", "HIPPO_SIM_BIN"):
        if agents.exists() and not set_(a, n):
            r.missing.append(f"agents/.env: {n}")
    if agents.exists() and not (set_(a, "ASI1_API_KEY") or set_(a, "ANTHROPIC_API_KEY")):
        r.missing.append("agents/.env: ASI1_API_KEY or ANTHROPIC_API_KEY (the agents can't word messages)")
    # Cross-file agreement, compared without showing either value.
    if w.get("RELAY_TOKEN") and a.get("RELAY_TOKEN") and w["RELAY_TOKEN"] != a["RELAY_TOKEN"]:
        r.missing.append("RELAY_TOKEN differs between .env.local and agents/.env (the relay will refuse the agents)")
    relay_port = int(w.get("RELAY_PORT") or 8010) if (w.get("RELAY_PORT") or "8010").isdigit() else 8010
    if a.get("WATCHER_RELAY_URL") and port_of(a["WATCHER_RELAY_URL"], 0) != relay_port:
        r.missing.append(f"agents/.env: WATCHER_RELAY_URL's port isn't the watcher's RELAY_PORT ({relay_port})")
    if w.get("STDB_URI") and w.get("NEXT_PUBLIC_STDB_URI") and \
            port_of(w["STDB_URI"], 3000) != port_of(w["NEXT_PUBLIC_STDB_URI"], 3000):
        r.warnings.append(".env.local: STDB_URI and NEXT_PUBLIC_STDB_URI point at different ports")
    if host_of(w.get("NEXT_PUBLIC_STDB_URI", "")) in ("localhost", "127.0.0.1"):
        r.warnings.append(".env.local: NEXT_PUBLIC_STDB_URI is localhost, so a second laptop's browser can't "
                          "reach SpacetimeDB: use this laptop's LAN address")
    if (a.get("HIPPO_SIM_FIXTURES") or "").strip() == "1":
        r.warnings.append("agents/.env: HIPPO_SIM_FIXTURES=1, so the agents' test runs are fixtures, not the engine")
    sim = a.get("HIPPO_SIM_BIN", "").strip()
    if sim and not (Path(sim).is_file() and os.access(sim, os.X_OK)):
        r.missing.append("agents/.env: HIPPO_SIM_BIN doesn't point at an executable (install the engine)")
    return r


def secret_values(root: Path = ROOT) -> list[str]:
    """Every value of a secret-looking variable, longest first, for redaction."""
    vals = set()
    for env in (read_env(root / ".env.local"), read_env(root / "agents" / ".env"), os.environ):
        for k, v in env.items():
            if SECRET_NAME.search(k) and len(v.strip()) >= 6:
                vals.add(v.strip())
    return sorted(vals, key=len, reverse=True)


# ----------------------------------------------------------------------------- probes

def port_in_use(port: int) -> bool:
    with socket.socket() as s:
        s.settimeout(0.3)
        return s.connect_ex(("127.0.0.1", port)) == 0


def http_get(url: str, timeout: float = 2.0):
    """(status, body text, headers) or None if nothing answered."""
    try:
        with urllib.request.urlopen(urllib.request.Request(url), timeout=timeout) as r:
            return r.status, r.read(65536).decode("utf-8", "replace"), dict(r.headers)
    except urllib.error.HTTPError as e:
        return e.code, e.read(65536).decode("utf-8", "replace"), dict(e.headers or {})
    except (OSError, ValueError):
        return None


def json_of(text: str):
    try:
        return json.loads(text)
    except ValueError:
        return None


def identify(port: int) -> str:
    """A guess at what holds a port, from what it answers."""
    base = f"http://127.0.0.1:{port}"
    h = http_get(f"{base}/v1/ping", 1)
    if h and h[0] == 200:
        return "SpacetimeDB"
    h = http_get(f"{base}/healthz", 1)
    if h and h[0] == 200 and (json_of(h[1]) or {}).get("status") == "ok":
        return "the engine (/healthz)"
    h = http_get(f"{base}/health", 1)
    if h and h[0] == 200:
        j = json_of(h[1]) or {}
        if j.get("agent"):
            return f"the {j['agent']} agent"
        if j.get("ok") is True:
            return "the watcher relay"
    h = http_get(base + "/", 1)
    if h and "next.js" in str(h[2].get("X-Powered-By", h[2].get("x-powered-by", ""))).lower():
        return "a Next.js dev server"
    pid = ""
    if shutil.which("lsof"):
        try:
            pid = subprocess.run(["lsof", "-nP", f"-iTCP:{port}", "-sTCP:LISTEN", "-t"], capture_output=True,
                                 text=True, timeout=3).stdout.split()[0:1]
            pid = f" (pid {pid[0]})" if pid else ""
        except (OSError, subprocess.SubprocessError):
            pid = ""
    return f"another program{pid}"


# ----------------------------------------------------------------------------- pieces

@dataclass
class Piece:
    name: str
    cmd: list[str] | None
    cwd: Path
    ports: list[int]
    health: Callable[[], tuple[bool, str]]
    timeout: float = 60.0
    oneshot: bool = False          # runs to completion (publish), then its health check
    reuse: bool = False            # an already-running healthy copy is reused, never stopped (SpacetimeDB)
    env: dict[str, str] | None = None
    missing: str = ""              # why it can't be started on this machine


@dataclass
class Config:
    stdb_url: str
    module: str
    engine_url: str
    relay_port: int
    web_port: int


def load_config(root: Path = ROOT, web_port: int = WEB_PORT) -> Config:
    w = {**read_env(root / ".env.local"), **{k: v for k, v in os.environ.items() if k in (
        "STDB_URI", "STDB_MODULE", "NEXT_PUBLIC_STDB_MODULE", "ENGINE_URL", "RELAY_PORT")}}
    stdb = (w.get("STDB_URI") or "ws://127.0.0.1:3000").strip()
    stdb_port = port_of(stdb, 3000)
    rp = (w.get("RELAY_PORT") or "8010").strip()
    return Config(
        stdb_url=f"http://127.0.0.1:{stdb_port}",
        module=(w.get("STDB_MODULE") or w.get("NEXT_PUBLIC_STDB_MODULE") or "hippocratech").strip(),
        engine_url=(w.get("ENGINE_URL") or "http://127.0.0.1:8000").strip().rstrip("/"),
        relay_port=int(rp) if rp.isdigit() else 8010,
        web_port=web_port,
    )


def _ok(url: str, test: Callable[[int, str], bool], good: str, timeout: float = 2.0) -> tuple[bool, str]:
    h = http_get(url, timeout)
    if h is None:
        return False, f"no answer at {url}"
    return (True, good) if test(h[0], h[1]) else (False, f"{url} answered HTTP {h[0]}")


def demo_pieces(cfg: Config, root: Path = ROOT) -> list[Piece]:
    """The README's "Run it" steps, in order, with each one's real health check."""
    stdb_port = port_of(cfg.stdb_url, 3000)
    engine_port = port_of(cfg.engine_url, 8000)
    spacetime = shutil.which("spacetime")
    no_spacetime = "" if spacetime else "the spacetime CLI isn't installed (https://spacetimedb.com/install)"
    stdb_cmd = [spacetime or "spacetime", "start"]
    if stdb_port != 3000:
        stdb_cmd += ["--listen-addr", f"0.0.0.0:{stdb_port}"]

    uv = shutil.which("uv")
    venv_uvicorn = root / "engine" / ".venv" / "bin" / "uvicorn"
    serve = ["sim_core.api:app", "--host", "127.0.0.1", "--port", str(engine_port)]
    if uv:
        engine_cmd, no_engine = [uv, "run", "uvicorn", *serve], ""
    elif venv_uvicorn.exists():
        engine_cmd, no_engine = [str(venv_uvicorn), *serve], ""
    else:
        engine_cmd, no_engine = None, "neither uv nor engine/.venv is installed (engine/README.md)"

    npm = shutil.which("npm")
    nm = root / "node_modules"
    no_watcher = "" if npm and (nm / "tsx").exists() else "npm or node_modules is missing (run npm install)"
    no_web = "" if npm and (nm / "next").exists() else "Next.js isn't installed (run npm install)"
    # Next.js reads env files from apps/web, but the team keeps them in the repo's .env.local
    # (README, TEAM_BRIEF). Hand that file to the web process unless apps/web has its own.
    web_env = None if (root / "apps" / "web" / ".env.local").exists() else read_env(root / ".env.local")

    agents_py = root / "agents" / ".venv" / "bin" / "python"
    no_agents = "" if agents_py.exists() else "agents/.venv is missing (python -m venv .venv; pip install -r requirements.txt)"

    ports = agent_ports(root)

    def agents_health() -> tuple[bool, str]:
        bad = []
        for name, port in ports.items():
            h = http_get(f"http://127.0.0.1:{port}/health", 2)
            if not (h and h[0] == 200 and (json_of(h[1]) or {}).get("agent") == name):
                bad.append(f"{port} {name}")
        return (False, "not answering /health: " + ", ".join(bad)) if bad else (
            True, f"all {'five' if len(ports) == 5 else 'four'} answer /health")

    return [
        Piece("spacetimedb", stdb_cmd, root, [stdb_port],
              lambda: _ok(f"{cfg.stdb_url}/v1/ping", lambda s, _: s == 200, "answers /v1/ping"),
              timeout=60, reuse=True, missing=no_spacetime),
        Piece("publish", [spacetime or "spacetime", "publish", "--server", "local", cfg.module], root / "spacetime", [],
              lambda: _ok(f"{cfg.stdb_url}/v1/database/{cfg.module}", lambda s, _: s == 200,
                          f"module {cfg.module} is published"),
              timeout=300, oneshot=True, missing=no_spacetime),
        Piece("engine", engine_cmd, root / "engine", [engine_port],
              lambda: _ok(f"http://127.0.0.1:{engine_port}/healthz",
                          lambda s, b: s == 200 and (json_of(b) or {}).get("status") == "ok", "answers /healthz"),
              timeout=180, missing=no_engine),
        Piece("watcher", [npm or "npm", "run", "dev", "-w", "watcher"], root, [cfg.relay_port],
              lambda: _ok(f"http://127.0.0.1:{cfg.relay_port}/health",
                          lambda s, b: s == 200 and (json_of(b) or {}).get("ok") is True, "relay answers /health"),
              timeout=60, missing=no_watcher),
        Piece("web", [npm or "npm", "run", "dev", "-w", "web", "--", "-p", str(cfg.web_port)], root, [cfg.web_port],
              lambda: _ok(f"http://127.0.0.1:{cfg.web_port}/", lambda s, _: s < 500, "the app answers", timeout=60),
              timeout=240, env=web_env, missing=no_web),
        Piece("agents", [str(agents_py), "run_all.py"], root / "agents", list(ports.values()), agents_health,
              timeout=90, missing=no_agents),
    ]


# ----------------------------------------------------------------------------- the launcher

class Running:
    def __init__(self, proc: subprocess.Popen, log: Path):
        self.proc, self.log = proc, log
        self.tail: collections.deque[str] = collections.deque(maxlen=TAIL)
        self.reader: threading.Thread | None = None


class Launcher:
    def __init__(self, pieces: list[Piece], log_dir: Path = LOG_DIR, out=None, color: bool | None = None,
                 secrets: list[str] | None = None, state_file: Path | None = None):
        self.pieces = {p.name: p for p in pieces}
        self.order = [p.name for p in pieces]
        self.log_dir = log_dir
        self.out = out or sys.stdout
        if color is None:
            color = (getattr(self.out, "isatty", lambda: False)() or bool(os.environ.get("FORCE_COLOR"))) \
                and not os.environ.get("NO_COLOR")
        self.color = color
        self.secrets = secrets if secrets is not None else secret_values()
        self.state_file = state_file or log_dir / "state.json"
        self.running: dict[str, Running] = {}
        self.reused: set[str] = set()
        self.status: dict[str, str] = {}   # name → up | reused | failed | exited | stopped | done
        self.detail: dict[str, str] = {}
        self.events: list[tuple[str, str]] = []
        self.restarts = collections.Counter()
        self.lock = threading.Lock()
        self.stopping: set[str] = set()

    # --- output
    def redact(self, line: str) -> str:
        for s in self.secrets:
            if s in line:
                line = line.replace(s, "<redacted>")
        return line

    def say(self, text: str, name: str | None = None):
        text = self.redact(text)
        with self.lock:
            if name:
                tag = f"[{name}]".ljust(14)
                tag = f"{COLORS.get(name, '')}{tag}{RESET}" if self.color else tag
                text = f"{tag} {text}"
            self.out.write(text + "\n")
            self.out.flush()

    def banner(self, text: str, lines: list[str]):
        bar = "!" * 72
        head = f"{RED}{BOLD}{bar}\n!!  {text}\n{bar}{RESET}" if self.color else f"{bar}\n!!  {text}\n{bar}"
        body = "\n".join(f"    | {self.redact(l)}" for l in lines) or "    | (no output)"
        self.say(f"\n{head}\n    last {len(lines)} log lines:\n{body}\n{bar}\n")

    # --- state for `down` / `restart` from another shell
    def save_state(self):
        data = {"supervisor": os.getpid(), "pieces": {
            n: {"pid": r.proc.pid, "ports": self.pieces[n].ports, "status": self.status.get(n, ""),
                "restarts": self.restarts[n]}
            for n, r in self.running.items() if r.proc.poll() is None},
            "reused": sorted(self.reused), "status": self.status, "restarts": dict(self.restarts)}
        self.state_file.parent.mkdir(parents=True, exist_ok=True)
        self.state_file.write_text(json.dumps(data, indent=2))

    # --- checks
    def port_problems(self) -> list[str]:
        """Config clashes (two pieces on one port), then ports already held."""
        problems, seen = [], {}
        for n in self.order:
            for port in self.pieces[n].ports:
                if port in seen:
                    problems.append(f"{n} and {seen[port]} are both set to port {port}"
                                    + (" (SpacetimeDB and Next.js both default to 3000: run the web on 3001)"
                                       if port == 3000 else ""))
                seen[port] = n
        if problems:
            return problems
        for n in self.order:
            p = self.pieces[n]
            held = [port for port in p.ports if port_in_use(port)]
            if not held:
                continue
            if p.reuse and p.health()[0]:
                self.reused.add(n)
                continue
            for port in held:
                problems.append(f"port {port} ({n}) is already held by {identify(port)}")
        return problems

    # --- processes
    def _pump(self, name: str, run: Running):
        with open(run.log, "a", encoding="utf-8") as f:
            for raw in run.proc.stdout:
                line = self.redact(raw.rstrip("\n"))
                run.tail.append(line)
                f.write(line + "\n")
                f.flush()
                self.say(line, name)

    def start(self, name: str) -> Running:
        p = self.pieces[name]
        self.log_dir.mkdir(parents=True, exist_ok=True)
        log = self.log_dir / f"{name}.log"
        with open(log, "a", encoding="utf-8") as f:
            f.write(f"\n===== {time.strftime('%Y-%m-%d %H:%M:%S')} start {name} =====\n")
        env = {**os.environ, **(p.env or {}), "PYTHONUNBUFFERED": "1"}
        if self.color:
            env["FORCE_COLOR"] = "1"
        proc = subprocess.Popen(p.cmd, cwd=p.cwd, env=env, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                                stderr=subprocess.STDOUT, text=True, bufsize=1, errors="replace",
                                start_new_session=True)  # its own process group: stopping takes its children too
        run = Running(proc, log)
        run.reader = threading.Thread(target=self._pump, args=(name, run), daemon=True)
        run.reader.start()
        self.running[name] = run
        self.events.append(("start", name))
        self.save_state()
        return run

    def wait_healthy(self, name: str) -> tuple[bool, str]:
        p, run = self.pieces[name], self.running[name]
        deadline = time.monotonic() + p.timeout
        while time.monotonic() < deadline:
            code = run.proc.poll()
            if p.oneshot and code is not None:
                if run.reader:
                    run.reader.join(2)
                if code != 0:
                    return False, f"exited with code {code}"
                return p.health()
            if not p.oneshot and code is not None:
                if run.reader:
                    run.reader.join(2)
                return False, f"exited with code {code} before it was healthy"
            if not p.oneshot:
                ok, detail = p.health()
                if ok:
                    return True, detail
            time.sleep(0.25)
        return False, f"not healthy after {p.timeout:.0f}s: {p.health()[1]}"

    def bring_up(self, name: str) -> bool:
        p = self.pieces[name]
        if name in self.reused:
            self.status[name], self.detail[name] = "reused", "already running: " + p.health()[1]
            self.say(f"reusing the one already running ({self.detail[name]})", name)
            self.events.append(("healthy", name))
            return True
        if p.missing or not p.cmd:
            self.status[name], self.detail[name] = "failed", p.missing or "no command"
            self.say(f"can't start: {self.detail[name]}", name)
            return False
        self.say(f"starting: {' '.join(Path(p.cmd[0]).name if i == 0 else a for i, a in enumerate(p.cmd))}", name)
        try:
            run = self.start(name)
        except OSError as e:
            self.status[name], self.detail[name] = "failed", f"couldn't start: {e}"
            self.say(self.detail[name], name)
            return False
        ok, detail = self.wait_healthy(name)
        self.detail[name] = detail
        if ok:
            self.status[name] = "done" if p.oneshot else "up"
            self.events.append(("healthy", name))
            self.say(f"healthy: {detail}", name)
        else:
            self.status[name] = "failed"
            self.banner(f"{name.upper()} DID NOT COME UP: {detail}", list(run.tail))
            if not p.oneshot:
                self.stop(name)
                self.status[name] = "failed"
        self.save_state()
        return ok

    def up(self, keep_going: bool = False) -> bool:
        problems = self.port_problems()
        if problems:
            self.say("Port clash, nothing started:")
            for pr in problems:
                self.say(f"  - {pr}")
            self.say("Stop the other copy (python scripts/demo.py down, or close it), then run up again.")
            return False
        all_ok = True
        for name in self.order:
            if not self.bring_up(name):
                all_ok = False
                if not keep_going:
                    self.say(f"Stopped at {name}. Fix it and run up again, or pass --keep-going.")
                    return False
        return all_ok

    def stop(self, name: str, grace: float = 8.0):
        run = self.running.get(name)
        if not run:
            return
        self.stopping.add(name)
        try:
            pgid = os.getpgid(run.proc.pid)
        except ProcessLookupError:
            pgid = None
        if pgid is not None:
            try:
                os.killpg(pgid, signal.SIGTERM)
            except ProcessLookupError:
                pass
        try:
            run.proc.wait(grace)
        except subprocess.TimeoutExpired:
            pass
        if pgid is not None:
            # The group leader may be gone while its children aren't: make sure the group is.
            deadline = time.monotonic() + grace
            while group_alive(pgid) and time.monotonic() < deadline:
                time.sleep(0.1)
            if group_alive(pgid):
                try:
                    os.killpg(pgid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
        if run.proc.poll() is None:
            run.proc.kill()
        run.proc.wait()
        if run.reader:
            run.reader.join(2)
        run.proc.stdout.close()
        del self.running[name]
        self.status[name] = "stopped"
        self.stopping.discard(name)
        self.events.append(("stop", name))

    def stop_all(self):
        for name in reversed(self.order):
            if name in self.running:
                self.say("stopping", name)
                self.stop(name)
        held = [f"{port} ({n})" for n in self.order if n not in self.reused
                for port in self.pieces[n].ports if wait_port_free(port)]
        if self.reused:
            self.say(f"Left running (it was already running before up): {', '.join(sorted(self.reused))}")
        self.say("All ports free." if not held else f"Still held: {', '.join(held)}")
        try:
            self.state_file.unlink()
        except FileNotFoundError:
            pass
        return not held

    def restart(self, name: str) -> bool:
        self.say("restarting", name)
        self.stop(name)
        for port in self.pieces[name].ports:
            wait_port_free(port)
        self.reused.discard(name)
        ok = self.bring_up(name)
        self.restarts[name] += 1  # after bring_up, so `restart` in another shell reads the final status
        self.save_state()
        return ok

    def check_exits(self) -> list[str]:
        """Pieces that exited on their own since the last check: banner each, keep the rest."""
        gone = []
        for name, run in list(self.running.items()):
            if name in self.stopping or run.proc.poll() is None:
                continue
            if self.pieces[name].oneshot:
                continue
            if run.reader:
                run.reader.join(2)
            run.proc.stdout.close()
            del self.running[name]
            self.status[name] = "exited"
            self.detail[name] = f"exited with code {run.proc.returncode}"
            self.banner(f"{name.upper()} EXITED (code {run.proc.returncode}). The rest keep running. "
                        f"Fix it, then: python scripts/demo.py restart {name}", list(run.tail))
            gone.append(name)
            self.save_state()
        return gone

    # --- status
    def rows(self) -> list[tuple[str, str, str, str, str]]:
        out = []
        for name in self.order:
            p = self.pieces[name]
            ok, detail = p.health()
            if p.missing and not ok:
                detail = f"{detail}; {p.missing}"
            log = self.log_dir / f"{name}.log"
            out.append((name, ",".join(map(str, p.ports)) or "-", "yes" if ok else "NO", detail,
                        str(log.relative_to(ROOT)) if log.exists() and log.is_relative_to(ROOT)
                        else (str(log) if log.exists() else "-")))
        return out


def group_alive(pgid: int) -> bool:
    try:
        os.killpg(pgid, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        return True


def wait_port_free(port: int, timeout: float = 5.0) -> bool:
    """True if the port is STILL held after the timeout."""
    deadline = time.monotonic() + timeout
    while port_in_use(port) and time.monotonic() < deadline:
        time.sleep(0.2)
    return port_in_use(port)


def table(rows, head=("Piece", "Port", "Healthy", "Detail", "Log")) -> str:
    rows = [head, *rows]
    widths = [max(len(r[i]) for r in rows) for i in range(len(head) - 1)]
    lines = []
    for k, r in enumerate(rows):
        lines.append("  ".join(c.ljust(widths[i]) if i < len(widths) else c for i, c in enumerate(r)))
        if k == 0:
            lines.append("  ".join("-" * w for w in widths) + "  " + "-" * 3)
    return "\n".join(lines)


def lan_address() -> str | None:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("10.255.255.255", 1))  # no packet is sent; it only picks the outgoing interface
            ip = s.getsockname()[0]
        return None if ip.startswith("127.") else ip
    except OSError:
        return None


def print_env(report: EnvReport, say=print):
    if report.ok and not report.warnings:
        say("Env files: .env.local and agents/.env have every needed variable.")
    for m in report.missing:
        say(f"  missing: {m}")
    for w in report.warnings:
        say(f"  warning: {w}")


# ----------------------------------------------------------------------------- commands

def read_state(path: Path = LOG_DIR / "state.json") -> dict:
    try:
        return json.loads(path.read_text())
    except (OSError, ValueError):
        return {}


def alive(pid: int | None) -> bool:
    if not pid:
        return False
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        return True


def cmd_up(a) -> int:
    state = read_state()
    if alive(state.get("supervisor")) and state.get("supervisor") != os.getpid():
        print(f"demo.py up is already running (pid {state['supervisor']}). Use status, restart or down.")
        return 2
    report = check_env()
    print_env(report)
    if not report.ok and not a.ignore_env:
        print("Fill in the missing variables (names above), or pass --ignore-env to start anyway.")
        return 2
    cfg = load_config(web_port=a.web_port)
    launcher = Launcher(demo_pieces(cfg))
    stop = threading.Event()
    restart_req = threading.Event()

    def on_term(*_):
        stop.set()
        raise KeyboardInterrupt

    signal.signal(signal.SIGTERM, on_term)
    signal.signal(signal.SIGUSR1, lambda *_: restart_req.set())
    try:
        launcher.save_state()
        ok = launcher.up(keep_going=a.keep_going)
        launcher.say("")
        launcher.say(table(launcher.rows()))
        url = f"http://localhost:{cfg.web_port}"
        lan = lan_address()
        launcher.say(f"\nOpen {url}" + (f"  (second laptop: http://{lan}:{cfg.web_port})" if lan else ""))
        if not launcher.running:
            launcher.say("Nothing is running." + ("" if ok else " Fix the failures above and run up again."))
            return 1
        launcher.say("Watching. Ctrl-C stops everything. Other shell: demo.py status | restart <piece> | down")
        while not stop.is_set():
            launcher.check_exits()
            if restart_req.is_set():
                restart_req.clear()
                req = LOG_DIR / "restart.request"
                try:
                    name = req.read_text().strip()
                    req.unlink()
                except OSError:
                    name = ""
                if name in launcher.pieces:
                    launcher.restart(name)
                    launcher.say(table([r for r in launcher.rows() if r[0] == name]))
            time.sleep(0.5)
        return 0 if ok else 1
    except KeyboardInterrupt:
        launcher.say("\nStopping everything demo.py started…")
        return 0
    finally:
        # Finish stopping even if a second Ctrl-C or SIGTERM arrives (each stop is time-bounded).
        signal.signal(signal.SIGTERM, signal.SIG_IGN)
        signal.signal(signal.SIGINT, signal.SIG_IGN)
        launcher.stop_all()


def cmd_status(a) -> int:
    report = check_env()
    print_env(report)
    cfg = load_config(web_port=a.web_port)
    launcher = Launcher(demo_pieces(cfg), out=sys.stdout, color=False)
    rows = launcher.rows()
    print()
    print(table(rows))
    state = read_state()
    print(f"\ndemo.py up: {'running, pid ' + str(state['supervisor']) if alive(state.get('supervisor')) else 'not running'}")
    code = 0 if all(r[2] == "yes" for r in rows) and report.ok else 1
    check = ROOT / "agents" / "scripts" / "demo_check.py"
    if check.exists():
        py = ROOT / "agents" / ".venv" / "bin" / "python"
        print(f"\nagents/scripts/demo_check.py:")
        r = subprocess.run([str(py if py.exists() else sys.executable), str(check)], cwd=ROOT / "agents")
        code = code or r.returncode
    else:
        print("\n(agents/scripts/demo_check.py isn't on this branch yet; skipped)")
    return code


def cmd_down(_a) -> int:
    state = read_state()
    sup = state.get("supervisor")
    if alive(sup) and sup != os.getpid():
        print(f"Asking demo.py up (pid {sup}) to stop everything…")
        os.kill(sup, signal.SIGTERM)
        deadline = time.monotonic() + 60
        while alive(sup) and time.monotonic() < deadline:
            time.sleep(0.3)
    # Anything left over (the supervisor was killed, or didn't finish): stop its groups directly.
    left = read_state().get("pieces", {})  # empty once up stopped cleanly (it removes the file)
    for name, info in left.items():
        pid = info.get("pid")
        if not alive(pid):
            continue
        print(f"stopping leftover {name} (pid {pid})")
        try:
            os.killpg(os.getpgid(pid), signal.SIGTERM)
            time.sleep(2)
            if alive(pid):
                os.killpg(os.getpgid(pid), signal.SIGKILL)
        except ProcessLookupError:
            pass
    ports = [(n, port) for n, info in left.items() for port in info.get("ports", [])]
    if not ports:
        cfg = load_config()
        reused = set(state.get("reused", []))
        ports = [(p.name, port) for p in demo_pieces(cfg) if p.name not in reused for port in p.ports]
    held = [f"{port} ({n}: {identify(port)})" for n, port in ports if wait_port_free(port, 5)]
    try:
        (LOG_DIR / "state.json").unlink()
    except FileNotFoundError:
        pass
    if held:
        print("Still held (not started by demo.py, or not stopping): " + ", ".join(held))
        return 1
    print("Stopped. Ports free: " + ", ".join(sorted({str(p) for _, p in ports}, key=int)))
    return 0


def cmd_restart(a) -> int:
    state = read_state()
    sup = state.get("supervisor")
    if not alive(sup):
        print("demo.py up isn't running: start it with python scripts/demo.py up")
        return 2
    before = state.get("restarts", {}).get(a.piece, 0)
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    (LOG_DIR / "restart.request").write_text(a.piece)
    os.kill(sup, signal.SIGUSR1)
    print(f"Asked demo.py up (pid {sup}) to restart {a.piece}; its window shows the logs.")
    deadline = time.monotonic() + 300
    while time.monotonic() < deadline:
        s = read_state()
        if s.get("restarts", {}).get(a.piece, 0) > before:
            st = s.get("status", {}).get(a.piece)
            print(f"{a.piece}: {st}")
            return 0 if st in ("up", "done") else 1
        time.sleep(0.5)
    print(f"{a.piece}: no answer after 300s; check the up window")
    return 1


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    up = sub.add_parser("up", help="start everything, in order, and watch it")
    up.add_argument("--keep-going", action="store_true", help="start the later pieces even if one fails")
    up.add_argument("--ignore-env", action="store_true", help="start even if env variables are missing")
    up.add_argument("--web-port", type=int, default=WEB_PORT)
    st = sub.add_parser("status", help="the health table, without starting anything")
    st.add_argument("--web-port", type=int, default=WEB_PORT)
    sub.add_parser("down", help="stop everything demo.py up started")
    rs = sub.add_parser("restart", help="restart one piece while up is running")
    rs.add_argument("piece", choices=ORDER)
    a = ap.parse_args(argv)
    return {"up": cmd_up, "status": cmd_status, "down": cmd_down, "restart": cmd_restart}[a.cmd](a)


if __name__ == "__main__":
    sys.exit(main())
