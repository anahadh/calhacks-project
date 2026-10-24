"""Check the four agents on a laptop: name, handle, address, port, Inspector URL, and
whether each is listening locally (GET /health).

    .venv/bin/python scripts/check_agentverse.py

The Inspector URL is what run_all.py logs at startup: open it in Chrome, signed in to
Agentverse, and choose Connect → Mailbox (docs/hippocratech/AGENTVERSE_SETUP.md).
"""

import sys
import urllib.parse
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).parent.parent))
import addresses  # noqa: E402
from config import AGENTS, PORTS, ConfigError, settings  # noqa: E402
from runtime import PROFILES  # noqa: E402


def inspector_url(agent: str) -> str:
    uri = urllib.parse.quote(f"http://127.0.0.1:{PORTS[agent]}")
    return f"https://agentverse.ai/inspect/?uri={uri}&address={addresses.address(agent)}"


def check(agent: str) -> str:
    try:
        r = httpx.get(f"http://127.0.0.1:{PORTS[agent]}/health", timeout=2)
    except httpx.HTTPError:
        return "not listening (start run_all.py)"
    if r.status_code != 200:
        return f"answered HTTP {r.status_code} (an old build without /health?)"
    h = r.json()
    if h["address"] != addresses.address(agent):
        return f"listening, but as {h['address']}: another seed is running on this port"
    return f"listening, mailbox={'on' if h['mailbox'] else 'off'}, local resolve={'on' if h['localResolve'] else 'off'}"


def main() -> int:
    try:
        s = settings()
        rows = [(a, PROFILES[a], addresses.address(a)) for a in AGENTS]
    except ConfigError as e:
        print(f"check_agentverse: {e}", file=sys.stderr)
        return 2
    print(f"AGENT_MAILBOX={int(s.mailbox)}  LOCAL_RESOLVE={int(s.local_resolve)}  "
          f"AGENTVERSE_API_KEY={'set' if s.agentverse_api_key else 'not set'}\n")
    ok, boxed = True, 0
    for agent, p, addr in rows:
        state = check(agent)
        ok &= state.startswith("listening,")
        boxed += "mailbox=on" in state
        print(f"{p.name}  (@{p.handle})")
        print(f"  address    {addr}")
        print(f"  port       {PORTS[agent]}  →  {state}")
        print(f"  inspector  {inspector_url(agent)}\n")
    if ok and boxed < len(rows):
        print("Some agents run without a mailbox: set AGENT_MAILBOX=1 in agents/.env (or the shell) and restart run_all.py.")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
