"""Record a real round as the cached demo run (agents/cache/demo_round.json).

    .venv/bin/python scripts/record_round.py logs/<sessionId>.jsonl

The log must come from a real standalone round: agents started with WATCHER_RELAY_URL
unset, HIPPO_SIM_FIXTURES=0 with HIPPO_SIM_BIN pointing at the engine's hippo-sim, a
model key set, and the round started with scripts/start_round.py. The script refuses
fixture rows, worded messages without a model's text, and unfinished rounds.
See docs/hippocratech/CACHED_RUN.md.
"""

import argparse
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
import cached_run  # noqa: E402
import config  # noqa: E402,F401  (loads agents/.env, for HIPPO_SIM_BIN)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("log", type=Path, help="agents/logs/<sessionId>.jsonl from a real standalone round")
    ap.add_argument("--out", type=Path, default=cached_run.CACHE_PATH)
    ap.add_argument("--force", action="store_true", help="replace an existing cache")
    a = ap.parse_args(argv)

    if not a.log.exists():
        print(f"record_round: no log at {a.log}", file=sys.stderr)
        return 2
    if a.out.exists() and not a.force:
        print(f"record_round: {a.out} exists; pass --force to replace it", file=sys.stderr)
        return 2
    sim = os.environ.get("HIPPO_SIM_BIN", "").strip()
    engine = f"hippo-sim ({Path(sim).name})" if sim else "hippo-sim (HIPPO_SIM_BIN not set in this shell)"
    try:
        cache = cached_run.record(cached_run.read_log(a.log), engine=engine)
        cached_run.validate(cache)
    except cached_run.CacheError as e:
        print(f"record_round: {e}", file=sys.stderr)
        return 1
    a.out.parent.mkdir(parents=True, exist_ok=True)
    a.out.write_text(json.dumps(cache, indent=1) + "\n", encoding="utf-8")
    messages = sum(r["table"] == "agent_message" for r in cache["rows"])
    print(f"recorded {cache['rowCount']} rows ({messages} messages) from session {cache['sourceSessionId']}, "
          f"patient zero {cache['patientZero']}, model {', '.join(cache['modelSources'])}, "
          f"{cache['rows'][-1]['offsetMs'] / 1000:.1f} s, commit {cache['gitCommit'][:10]} → {a.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
