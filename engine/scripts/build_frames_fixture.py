"""Print a run_session output (frames included) as canonical JSON, for the backend
and watcher fixtures. Usage:

    uv run python scripts/build_frames_fixture.py HOSPITAL_FILE PATIENT_ZERO [--policy POLICY_FILE]
"""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sim_core.app_bridge import run_session  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("hospital")
    ap.add_argument("patient_zero")
    ap.add_argument("--policy")
    args = ap.parse_args()
    raw = json.loads(Path(args.hospital).read_text())
    hospital = raw.get("hospital", raw) if isinstance(raw, dict) else raw
    policy = json.loads(Path(args.policy).read_text()) if args.policy else None
    session = run_session(hospital, args.patient_zero, policy=policy)
    json.dump(session, sys.stdout, indent=2)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
