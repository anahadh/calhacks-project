"""``hippo-sim`` — the app-hospital CLI the uAgents call (agents/tools.py).

One test run of the engine over the app's hospital format, printed as exactly one
RunResult JSON object on stdout. This is the engine's edge to the agents: the same
``app_bridge.run_result`` the visible rerun uses, so the agents' numbers are the
screen's numbers. Distinct from ``hippo-backtest`` (the CUH causal backtest CLI).

    hippo-sim --hospital FILE --patient-zero ID [--seed N] [--policy FILE] [--challenge C]...

``--hospital`` is an app hospital file (``{schemaVersion, hospital}`` or a bare
hospital). ``--policy`` is a by-alias Policy JSON (agents/protocol.py). ``--seed`` is
accepted and ignored (the engine is deterministic; rule 6). Errors exit 2 with one
line on stderr.
"""

from __future__ import annotations

import argparse
import json
import sys

from .app_bridge import run_result
from .app_policy import PolicyError


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="hippo-sim", description="One engine test run over an app hospital.")
    parser.add_argument("--hospital", required=True)
    parser.add_argument("--patient-zero", required=True, dest="patient_zero")
    parser.add_argument("--seed", type=int, default=0)  # accepted, ignored (deterministic)
    parser.add_argument("--policy")
    parser.add_argument("--challenge", action="append", default=[], dest="challenges")
    args = parser.parse_args(argv)

    try:
        raw = json.loads(open(args.hospital, encoding="utf-8").read())
    except (OSError, ValueError) as exc:
        print(f"hippo-sim: cannot read --hospital: {exc}", file=sys.stderr)
        return 2
    hospital = raw.get("hospital", raw) if isinstance(raw, dict) else raw

    policy = None
    if args.policy:
        try:
            policy = json.loads(open(args.policy, encoding="utf-8").read())
        except (OSError, ValueError) as exc:
            print(f"hippo-sim: cannot read --policy: {exc}", file=sys.stderr)
            return 2

    try:
        result = run_result(hospital, args.patient_zero, policy=policy, challenges=args.challenges)
    except PolicyError as exc:
        print(f"hippo-sim: {exc}", file=sys.stderr)
        return 2
    except (ValueError, KeyError, TypeError) as exc:
        print(f"hippo-sim: {exc}", file=sys.stderr)
        return 2

    json.dump(result, sys.stdout, separators=(",", ":"))
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
