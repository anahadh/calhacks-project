"""Replay the cached demo run through the watcher relay, labeled "Cached run".

    .venv/bin/python scripts/replay_cached.py --session <sessionId> [--speed 1.0]

For judging when the live round can't run (AGENTS.md rule 14 allows exactly this). Posts
agents/cache/demo_round.json's rows to $WATCHER_RELAY_URL with $RELAY_TOKEN, in order and
with the recorded timing scaled by --speed (2.0 = twice as fast). Each row gets the
target sessionId and a fresh createdAt/updatedAt; everything else is as recorded, plus
the "Cached run" label (cached_run.label_message). The first row the relay rejects
stops the replay, with the relay's error. See docs/hippocratech/CACHED_RUN.md.
"""

import argparse
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).parent.parent))
import cached_run  # noqa: E402
from config import ConfigError, settings  # noqa: E402


class ReplayError(RuntimeError):
    pass


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds")


def replay(cache: dict, session_id: str, relay_url: str, token: str, speed: float = 1.0,
           post=None, sleep=time.sleep, now=_now, log=print) -> int:
    """Post every cached row, in order; returns how many were posted. Raises ReplayError on
    the first rejected row. post(url, json, headers) → (status, text) can be swapped in tests."""
    if speed <= 0:
        raise ReplayError("--speed must be above 0")
    if post is None:
        client = httpx.Client(timeout=10)

        def post(url, json, headers):
            r = client.post(url, json=json, headers=headers)
            return r.status_code, r.text

    old = cache["sourceSessionId"]
    recorded = cache["recordedAt"][:10]
    headers = {"Authorization": f"Bearer {token}"}
    base = relay_url.rstrip("/")
    previous = 0
    for n, entry in enumerate(cache["rows"], 1):
        sleep(max(0, entry["offsetMs"] - previous) / 1000 / speed)
        previous = entry["offsetMs"]
        t = now()
        if entry["table"] == "agent_message":
            row = cached_run.label_message(entry["row"], old, session_id, t, recorded)
        else:
            row = cached_run.label_status(entry["row"], session_id, t)
        assert cached_run.is_labeled(entry["table"], row), row
        try:
            status, text = post(f"{base}/{entry['table']}", row, headers)
        except httpx.HTTPError as e:
            raise ReplayError(f"row {n}/{len(cache['rows'])} ({entry['table']}): relay unreachable: {e}") from e
        if status >= 300:
            raise ReplayError(f"row {n}/{len(cache['rows'])} ({entry['table']} {row.get('type', row.get('status'))}) "
                              f"rejected by the relay, HTTP {status}: {text[:500]}")
        if entry["table"] == "agent_message":
            log(f"[cached] {n:>3}/{len(cache['rows'])} {row['from']:>17} → {row['to']:<17} {row['type']}")
    return len(cache["rows"])


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--session", required=True, help="the session on screen (its id from the app's URL)")
    ap.add_argument("--speed", type=float, default=1.0)
    ap.add_argument("--cache", type=Path, default=cached_run.CACHE_PATH)
    a = ap.parse_args(argv)
    try:
        s = settings()
        cache = cached_run.load(a.cache)
        if not s.relay_url:
            raise ReplayError("WATCHER_RELAY_URL is not set (agents/.env or the shell): it's where the rows go")
        if not s.relay_token:
            raise ReplayError("RELAY_TOKEN is not set: the relay refuses rows without it")
        print(f"Replaying the cached run recorded {cache['recordedAt']} (patient zero {cache['patientZero']}, "
              f"model {', '.join(cache['modelSources'])}) into session {a.session} at {a.speed}x")
        n = replay(cache, a.session, s.relay_url, s.relay_token, a.speed)
    except (cached_run.CacheError, ReplayError, ConfigError) as e:
        print(f"replay_cached: {e}", file=sys.stderr)
        return 1
    print(f"replay_cached: posted all {n} rows, labeled \"{cached_run.LABEL}\"")
    return 0


if __name__ == "__main__":
    sys.exit(main())
