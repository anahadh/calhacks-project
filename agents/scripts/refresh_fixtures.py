"""Record fixtures/results/*.json from the engine's hippo-sim, so fixture mode
(HIPPO_SIM_FIXTURES=1) gives the engine's numbers.

    HIPPO_SIM_BIN=../engine/.venv/bin/hippo-sim .venv/bin/python scripts/refresh_fixtures.py
    HIPPO_SIM_BIN=../engine/.venv/bin/hippo-sim .venv/bin/python scripts/refresh_fixtures.py --check

One run per file: the baseline and each fixtures/candidates/*.json, with no challenge
and with each challenge the engine supports, from MRI 2 against fixtures/hospital.json
(the hospital the agents' tests index). Every run goes through tools.run_sim, so the
files come from the same argv and the same strict RunResult parse the agents use.
--check writes nothing and exits 1 if any file differs from the engine's output.
"""

import argparse
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
import config  # noqa: E402  (loads agents/.env; variables already set win)
import tools  # noqa: E402
from protocol import Candidate, RunResult  # noqa: E402

# The challenges the engine supports (engine/sim_core/app_policy.py SUPPORTED_CHALLENGES).
CHALLENGES = ("unknown_device_imaging",)
SEED = 1337  # the visible run's default; the engine accepts it and ignores it
RESULTS = tools.FIXTURES / "results"


def runs() -> dict[str, RunResult]:
    """File name → the engine's result, in a stable order."""
    candidates = [None] + [Candidate.parse_file(p) for p in sorted((tools.FIXTURES / "candidates").glob("*.json"))]
    out = {}
    for cand in candidates:
        for challenges in ([], *([c] for c in CHALLENGES)):
            name = tools.fixture_name(cand.id if cand else None, challenges)
            out[name] = tools.run_sim(cand, tools.FIXTURE_PATIENT_ZERO, SEED, challenges)
    return out


def text(result: RunResult) -> str:
    """The file format of fixtures/results/: RunResult field order, indent 2, final newline."""
    return json.dumps(json.loads(result.json()), indent=2) + "\n"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--check", action="store_true", help="compare only; exit 1 if any file is stale")
    a = ap.parse_args()
    # Real runs, against the fixture hospital, whatever agents/.env says.
    os.environ["HIPPO_SIM_FIXTURES"] = "0"
    os.environ["HOSPITAL_PATH"] = str(tools.FIXTURES / "hospital.json")
    if not config.settings().hippo_sim_bin:
        print("refresh_fixtures: set HIPPO_SIM_BIN to the engine's hippo-sim (engine/.venv/bin/hippo-sim)", file=sys.stderr)
        return 2
    try:
        fresh = runs()
    except tools.ToolError as e:
        print(f"refresh_fixtures: {e}", file=sys.stderr)
        return 1

    stale = []
    for name, result in fresh.items():
        path = RESULTS / name
        new = text(result)
        if path.exists() and path.read_text() == new:
            print(f"  same   {name}")
            continue
        stale.append(name)
        if a.check:
            print(f"  stale  {name}")
        else:
            path.write_text(new)
            print(f"  wrote  {name}: {result.infectedCount} infected, removes {result.removedFlows or 'nothing'}")
    for path in sorted(RESULTS.glob("*.json")):
        if path.name not in fresh:
            print(f"  extra  {path.name} (no engine run writes it; left as it is)")
    if a.check and stale:
        print(f"refresh_fixtures: {len(stale)} of {len(fresh)} files differ from hippo-sim; run without --check")
        return 1
    print(f"refresh_fixtures: {len(fresh)} files, {len(stale)} {'stale' if a.check else 'rewritten'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
