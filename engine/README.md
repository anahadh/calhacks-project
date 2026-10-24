# Propagation research core

The implemented portion of `claude_instructions/IMPLEMENTATION.md`: strict causal
inputs, a layered graph, deterministic R1–R6/D1–D3 transitions, adaptive targeting,
transitive service dependencies, paired plan attribution, sensitivity generation,
and evaluation/freeze protocols. Python 3.11; NetworkX; Pydantic.

Research judgment lives here; transport, UI integration and routine runners were
the handoff, and are now implemented as thin adapters around this frozen core:
a `hippo-backtest` CLI, a content-addressed cache, a FastAPI/WebSocket server, the
planner input boundary, the research and freeze runners, and a render-only browser
adapter. No adapter computes a transition. See [HANDOFF.md](HANDOFF.md) for the
item list and status, and [RESEARCH_DECISIONS.md](RESEARCH_DECISIONS.md) for every
design decision.

For a paper-style explanation with diagrams, equations, current results, oral
explanation scripts, and an artifact for each claim, read
[ENGINE_RESEARCH_PAPER.md](ENGINE_RESEARCH_PAPER.md).

From this directory:

```sh
uv sync --python 3.11 --group dev
uv run pytest -q
```

The Python interface is already usable:

```python
from pathlib import Path
from sim_core.adapters import load_cuh
from sim_core.replay import replay, compare_plan
from sim_core.schema import Campaign, Plan

scenario = load_cuh("../claude_instructions/data/scenarios/cuh_hospital.json")
campaign = Campaign.model_validate_json(Path("examples/cuh_campaign.json").read_text())
plan = Plan.model_validate_json(Path("examples/cuh_plan.json").read_text())
result = replay(scenario, campaign, plan)
wire_payload = result.model_dump(mode="json")
comparison = compare_plan(scenario, campaign, plan)
```

`examples/cuh_campaign.json` is an explicitly reconstructed, exploratory campaign.
It is separate from the planner-visible snapshot. Its authored clock times and
credential boundary are disclosed assumptions. `examples/cuh_plan.json` is a
local illustrative plan, not a recommendation or deployment artifact.

## Command line and server

The `hippo-backtest` CLI and the FastAPI transport export the same deterministic
replay as the Python API: the CLI, a direct call, the cache file, and the cached
and uncached WebSocket streams all produce byte-identical `ReplayResult` JSON.

```sh
# One replay to stdout (JSON only; errors go to stderr with a nonzero exit).
# The CUH inventory dialect is auto-detected; a canonical scenario is parsed by
# the strict Pydantic models, which reject an embedded campaign or expected block.
uv run hippo-backtest replay \
  --scenario ../claude_instructions/data/scenarios/cuh_hospital.json \
  --campaign examples/cuh_campaign.json --plan examples/cuh_plan.json

uv run hippo-backtest replay --scenario SCN --campaign CMP --plan PLN --compare      # leave-one-lever-out
uv run hippo-backtest replay --scenario SCN --campaign CMP --cache-dir .hippo_cache  # served from cache
uv run hippo-backtest sensitivity --scenario SCN --seed 17  # separate command; the seed is the generator's only

# Freeze an attack into a self-contained, deterministic, tamper-evident bundle, then
# replay it offline; --verify re-runs the frozen inputs and refuses an edited bundle.
uv run hippo-backtest freeze --scenario SCN --campaign CMP --plan PLN --output attack.json
uv run hippo-backtest replay --bundle attack.json --verify

# HTTP + WebSocket transport (the `api` extra is installed by the dev group):
uv run uvicorn sim_core.api:app
#   POST /replay            {scenario, campaign, plan?}  -> ReplayResult body + X-Cache-Key header
#   WS   /replay/{key}/trace                             -> streamed records that rebuild the same result
```

Routine research and freeze runs (the second needs the `research` extra, in dev):

```python
from sim_core.research_runner import run_default
report = run_default(seeds=range(100))   # CUH checks run exploratory; HSE/BL reported unsupported, never fitted

from sim_core.freeze_runner import run_exploratory_study
run_exploratory_study("study-id", ledger_dir=".ledger", report_dir=".reports")  # one-use ledger; exploratory label
```

A render-only browser view lives at `apps/web/app/replay` (route `/replay`), mapping
replay output to colour and label without collapsing the five-level state into the
app's existing boolean rows. It is a separate screen; the demo session is untouched.

To run it: `pnpm --filter web dev`, then open `/replay`. **Offline mode** (default)
reads the deterministic run grid in `apps/web/public/propagation-runs/` — toggle plans
and single levers with no server. Regenerate that grid after a rules change with
`uv run python scripts/build_runs.py`. **Live mode** posts the chosen levers to a
running server (`uv run uvicorn sim_core.api:app`, which registers the CUH demo under
server-owned IDs) and renders the fresh result; the browser never simulates.

Tests exercise invented networks and inventory normalization. No incident
hold-out validation is claimed. Supplied national/BL snapshots are causally
incomplete; see the evidence ledger in the research decisions. The supplied
hold-out descriptions/outcomes were inspected during implementation, so future
use of those labels must be declared exploratory, not unseen validation.

Verification: 113 pytest cases pass on Python 3.11 (the original causal/protocol
tests plus cache, CLI, planner-boundary, HTTP/WebSocket, runner, freeze, and a
cross-transport identity suite). The CUH example replays identically across the
CLI, the direct call, the cache file and both WebSocket paths, and across separate
interpreter processes with different `PYTHONHASHSEED`. It encrypts 14 goal-related
hosts at baseline and zero with the illustrative plan; all services start up under
that plan, and radiology/email still fail after the national cut. These are
outputs under disclosed assumptions, not a calibrated real-incident prediction;
the research runner reports the CUH press comparison as exploratory and the HSE
and British Library checks as unsupported.

