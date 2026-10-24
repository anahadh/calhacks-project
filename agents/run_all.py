"""Start the four uAgents as separate processes, with colored [agent] prefixes.

    cd agents && .venv/bin/python run_all.py          # HIPPO_SIM_FIXTURES=1 for fixture results

Ctrl-C (or SIGTERM) stops all four. If one exits on its own, the others are stopped too.
"""

import os
import signal
import subprocess
import sys
import threading
import time
import urllib.request
from pathlib import Path

from config import AGENTS, PORTS, ConfigError, seed

HERE = Path(__file__).parent
COLORS = {"inventory": "\033[36m", "flow": "\033[35m", "clinical_workflow": "\033[34m", "coordinator": "\033[33m"}
RESET = "\033[0m"
COLOR = sys.stdout.isatty() or bool(os.environ.get("FORCE_COLOR"))
print_lock = threading.Lock()


def say(agent: str, line: str):
    tag = f"[{agent}]".ljust(20)
    with print_lock:
        print(f"{COLORS[agent]}{tag}{RESET} {line}" if COLOR else f"{tag} {line}", flush=True)


def pump(agent: str, proc: subprocess.Popen):
    for line in proc.stdout:
        say(agent, line.rstrip("\n"))


def listening(port: int) -> bool:
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/agent_info", timeout=1) as r:
            return r.status == 200
    except OSError:
        return False


def main() -> int:
    try:
        for a in AGENTS:
            seed(a)  # fail here, once, rather than in four processes
    except ConfigError as e:
        print(f"run_all: {e}", file=sys.stderr)
        return 2

    # GRPC_VERBOSITY: the unused ledger client logs gRPC proxy errors when offline.
    env = {"GRPC_VERBOSITY": "NONE", **os.environ, "PYTHONUNBUFFERED": "1"}
    if COLOR:
        env["FORCE_COLOR"] = "1"
    procs: dict[str, subprocess.Popen] = {}
    for a in AGENTS:
        procs[a] = subprocess.Popen(
            [sys.executable, "-u", f"{a}.py"], cwd=HERE, env=env,
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1,
        )
        threading.Thread(target=pump, args=(a, procs[a]), daemon=True).start()

    def stop(*_):
        raise KeyboardInterrupt

    signal.signal(signal.SIGTERM, stop)
    try:
        deadline, ready = time.time() + 30, set()
        while True:
            for a, p in procs.items():
                if p.poll() is not None:
                    say(a, f"exited with code {p.returncode}; stopping the others")
                    return 1
            if len(ready) < len(AGENTS):
                ready |= {a for a in AGENTS if a not in ready and listening(PORTS[a])}
                if len(ready) == len(AGENTS):
                    with print_lock:
                        print(f"run_all: all four agents are listening on ports {', '.join(str(PORTS[a]) for a in AGENTS)}", flush=True)
                elif time.time() > deadline:
                    print(f"run_all: not listening after 30 s: {sorted(set(AGENTS) - ready)}", flush=True)
                    return 1
            time.sleep(0.3)
    except KeyboardInterrupt:
        print("\nrun_all: stopping the agents", flush=True)
    finally:
        for p in procs.values():
            if p.poll() is None:
                p.send_signal(signal.SIGINT)
        for a, p in procs.items():
            try:
                p.wait(timeout=10)
            except subprocess.TimeoutExpired:
                say(a, "did not stop in 10 s; killing")
                p.kill()
                p.wait()
    return 0


if __name__ == "__main__":
    sys.exit(main())
