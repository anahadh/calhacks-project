"""Demo-day readiness check: a pass/fail table, exit 1 if anything fails.

    .venv/bin/python scripts/demo_check.py

Checks agents/.env and the four seeds, the engine (hippo-sim answers a test run), the
model that words the agents' messages (one tiny real call), ports 8001-8004, the
watcher relay and its token, Agentverse (mailbox mode), and the cached run. Prints no
secrets: only which variables are set. See docs/hippocratech/CACHED_RUN.md.
"""

import argparse
import asyncio
import os
import socket
import sys
from dataclasses import dataclass
from pathlib import Path

import httpx
from dotenv import dotenv_values

sys.path.insert(0, str(Path(__file__).parent.parent))
import cached_run  # noqa: E402
from config import AGENTS, PORTS, SEED_VARS, ConfigError, settings  # noqa: E402

AGENTS_DIR = Path(__file__).parent.parent
AGENTVERSE_URL = "https://agentverse.ai"


@dataclass
class Check:
    name: str
    ok: bool
    detail: str


def check_env(path: Path = AGENTS_DIR / ".env") -> Check:
    if not path.exists():
        return Check("agents/.env", False, f"missing ({path}): copy the team's seeds and keys into it")
    values = dotenv_values(path)
    missing = [var for var in SEED_VARS.values() if not (values.get(var) or "").strip()]
    if missing:
        return Check("agents/.env", False, f"present, but no {', '.join(missing)}")
    return Check("agents/.env", True, "present, all four seeds set")


def check_engine() -> Check:
    import tools

    sim = os.environ.get("HIPPO_SIM_BIN", "").strip()
    if not sim:
        return Check("Engine (hippo-sim)", False, "HIPPO_SIM_BIN is not set")
    if not (Path(sim).is_file() and os.access(sim, os.X_OK)):
        return Check("Engine (hippo-sim)", False, f"HIPPO_SIM_BIN={sim} is not an executable file")
    saved = os.environ.get("HIPPO_SIM_FIXTURES")
    os.environ["HIPPO_SIM_FIXTURES"] = "0"  # the real engine, whatever .env says
    try:
        r = tools.run_sim(None, "mri_2", 1337)
    except Exception as e:  # tools.ToolError, ConfigError, a bad hospital path…
        return Check("Engine (hippo-sim)", False, f"{type(e).__name__}: {e}")
    finally:
        if saved is None:
            os.environ.pop("HIPPO_SIM_FIXTURES", None)
        else:
            os.environ["HIPPO_SIM_FIXTURES"] = saved
    return Check("Engine (hippo-sim)", True, f"baseline from mri_2: {r.infectedCount} infected over {r.ticks} ticks "
                                             f"({Path(settings().hospital_path).name})")


def check_model() -> Check:
    if os.environ.get("ASI1_API_KEY", "").strip():
        which = "ASI:One (ASI1_API_KEY)"
    elif os.environ.get("ANTHROPIC_API_KEY", "").strip():
        which = "Claude (ANTHROPIC_API_KEY)"
    else:
        return Check("Model", False, "neither ASI1_API_KEY nor ANTHROPIC_API_KEY is set: the agents can't word messages")
    import llm

    facts = {"agent": "Inventory Agent", "decision": "accept", "plan": "Readiness check"}
    try:
        text, source = asyncio.run(llm.explain("verdict_accept", facts))
    except Exception as e:
        return Check("Model", False, f"{which}: the test call failed: {type(e).__name__}: {str(e)[:200]}")
    return Check("Model", True, f"{which} answered (source {source}, {len(text)} characters, passed the checks)")


def check_ports() -> Check:
    import addresses

    notes, ok = [], True
    for agent in AGENTS:
        port = PORTS[agent]
        with socket.socket() as s:
            s.settimeout(0.5)
            held = s.connect_ex(("127.0.0.1", port)) == 0
        if not held:
            notes.append(f"{port} free")
            continue
        try:
            h = httpx.get(f"http://127.0.0.1:{port}/health", timeout=2).json()
            ours = h.get("agent") == agent and h.get("address") == addresses.address(agent)
        except (httpx.HTTPError, ValueError, ConfigError):
            ours = False
        ok &= ours
        notes.append(f"{port} {agent} /health ok" if ours else f"{port} held by something else")
    return Check("Ports 8001-8004", ok, "; ".join(notes))


def check_relay() -> Check:
    try:
        s = settings()
    except ConfigError as e:
        return Check("Watcher relay", False, str(e))
    if not s.relay_url:
        return Check("Watcher relay", False, "WATCHER_RELAY_URL is not set")
    base = s.relay_url.rstrip("/")
    try:
        if httpx.get(f"{base}/health", timeout=3).status_code != 200:
            return Check("Watcher relay", False, f"{base}/health didn't answer 200")
        # An empty row with the token: 400 means the token was accepted and nothing was written.
        r = httpx.post(f"{base}/agent_status", json={}, headers={"Authorization": f"Bearer {s.relay_token}"}, timeout=3)
    except httpx.HTTPError as e:
        return Check("Watcher relay", False, f"{base} unreachable: {e}")
    if r.status_code == 401:
        return Check("Watcher relay", False, f"{base} reachable, but it refuses RELAY_TOKEN")
    if r.status_code != 400:
        return Check("Watcher relay", False, f"{base}: unexpected HTTP {r.status_code} to a token check")
    return Check("Watcher relay", True, f"{base} reachable, RELAY_TOKEN accepted")


def check_agentverse() -> Check:
    try:
        mailbox = settings().mailbox
    except ConfigError as e:
        return Check("Agentverse", False, str(e))
    try:
        status = httpx.get(AGENTVERSE_URL, timeout=5).status_code
    except httpx.HTTPError as e:
        return Check("Agentverse", False, f"{AGENTVERSE_URL} unreachable: {type(e).__name__}")
    if status >= 500:
        return Check("Agentverse", False, f"{AGENTVERSE_URL} answered HTTP {status}")
    if not mailbox:
        return Check("Agentverse", False, f"reachable, but AGENT_MAILBOX is not 1: ASI:One can't reach the agents")
    return Check("Agentverse", True, "reachable, mailbox mode on")


def check_cache(path: Path = cached_run.CACHE_PATH) -> Check:
    try:
        c = cached_run.load(path)
    except cached_run.CacheError as e:
        return Check("Cached run", False, str(e))
    return Check("Cached run", True, f"recorded {c['recordedAt']}, {c['rowCount']} rows, patient zero {c['patientZero']}, "
                                     f"model {', '.join(c['modelSources'])}, commit {c['gitCommit'][:10]}")


def run_checks(checks) -> list[Check]:
    results = []
    for fn in checks:
        try:
            results.append(fn())
        except Exception as e:  # a check must never take the table down with it
            results.append(Check(fn.__name__.removeprefix("check_"), False, f"crashed: {type(e).__name__}: {e}"))
    return results


def table(results: list[Check]) -> str:
    width = max(len(r.name) for r in results)
    lines = [f"{'Check':<{width}}  Result  Detail", f"{'-' * width}  ------  ------"]
    lines += [f"{r.name:<{width}}  {'PASS' if r.ok else 'FAIL':<6}  {r.detail}" for r in results]
    failed = sum(not r.ok for r in results)
    lines.append(f"\n{'All checks passed.' if not failed else f'{failed} of {len(results)} checks failed.'}")
    return "\n".join(lines)


ALL = (check_env, check_engine, check_model, check_ports, check_relay, check_agentverse, check_cache)


def main(argv: list[str] | None = None) -> int:
    argparse.ArgumentParser(description=__doc__.splitlines()[0]).parse_args(argv)
    results = run_checks(ALL)
    print(table(results))
    return 0 if all(r.ok for r in results) else 1


if __name__ == "__main__":
    sys.exit(main())
