"""POST /start_round to the Coordinator, the way the round watcher will.

    .venv/bin/python scripts/start_round.py                  # session dev, run run_dev, patient zero mri_2
    .venv/bin/python scripts/start_round.py --challenge unknown_device_imaging
"""

import argparse
import json
import sys
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).parent.parent))
from config import PORTS  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--session", default="dev")
    ap.add_argument("--run", default="run_dev")
    ap.add_argument("--patient-zero", default="mri_2")
    ap.add_argument("--seed", type=int, default=1337)
    ap.add_argument("--challenge", action="append", default=[])
    a = ap.parse_args()
    body = {"sessionId": a.session, "runId": a.run, "patientZero": a.patient_zero, "seed": a.seed, "challenges": a.challenge}
    r = httpx.post(f"http://127.0.0.1:{PORTS['coordinator']}/start_round", json=body, timeout=60)
    print(f"POST /start_round {json.dumps(body)}\n→ HTTP {r.status_code} {r.text}")
    return 0 if r.status_code == 200 and r.json().get("ok") else 1


if __name__ == "__main__":
    sys.exit(main())
