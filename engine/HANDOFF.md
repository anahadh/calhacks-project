# Handoff: finish adapters around the implemented model

The user asked the primary model to implement research judgment and leave routine
plumbing to a handoff model. The causal core and study protocols are implemented;
do not replace them with stubs or a second spread model. Read
[RESEARCH_DECISIONS.md](RESEARCH_DECISIONS.md) before extending the package.

## Implemented contracts

| Module | Entry points / role |
|---|---|
| `sim_core/schema.py` | Strict `Scenario`, `Campaign`, `Plan`; typed `ReplayResult`, trace, frames, per-event effects |
| `sim_core/adapters.py` | `load_cuh(path)`; `audit_raw_snapshot(data)` identifies missing HSE/BL causal inputs without reading labels |
| `sim_core/topology.py` | Four graph layers; directed zone/port paths; explicit rights and trust; pivot-aware ranking |
| `sim_core/engine.py` | `Engine`, R1–R6/D1–D3, `tick`, alternate doors, dependency fixed point |
| `sim_core/replay.py` | `replay`, `compare_plan`, strict authored scheduling, content cache keys |
| `sim_core/generator.py` | `generate_trial`, strict `GeneratorConfig`; sole RNG |
| `sim_core/research.py` | Robustness, baselines, defender ablations, conditional scoring, freeze and one-use ledger |
| `sim_core/protocols.py` | CUH press comparisons; library cohort/service comparisons; calibration comparator with evidence sufficiency |
| `examples/cuh_campaign.json` | Explicit reconstructed gateway/trust context, bounded window, fixed national R6/D3 |
| `examples/cuh_plan.json` | Illustrative layered plan with required functional flows |

`uv sync --python 3.11 --group dev` and `uv run pytest -q` run from `engine/`.
Python dependencies are locked in `uv.lock`. The Python APIs work now; no CLI,
FastAPI server, trace cache storage or browser integration has been implemented.

## Straightforward remaining implementation

1. **File I/O and CLI.** Add `sim_core/cli.py` and a `hippo-backtest` project script.
   Load canonical JSON via the Pydantic models; accept the supplied CUH dialect
   only through `load_cuh`. Flags: `--scenario`, `--campaign`, optional `--plan`,
   optional `--output`. Print only `ReplayResult.model_dump_json()` to stdout;
   validation errors belong on stderr with nonzero status. Do not accept a seed
   as replay randomness. Sensitivity generation is a separate command.
   `--compare` can serialize `compare_plan` results with a JSON-mode Pydantic
   encoder. Preserve trace/frame array order and event indices.

2. **Trace cache.** Add `sim_core/cache.py`: use `fingerprint` as the filename,
   validate cached bytes as `ReplayResult`, and write with temp file + atomic
   replace. Never key only on scenario or plan. Store the complete result so an
   offline replay never recomputes a different trace. Bump `RULES_VERSION` for
   semantic changes and include the dependency lock in study freezes.

3. **FastAPI and WebSocket.** Add `sim_core/api.py` plus FastAPI/Uvicorn dependencies.
   Expose POST `/replay` with distinct strict `scenario`, `campaign`, `plan`
   objects (or server-owned scenario/campaign identifiers). Return the replay
   result/cache ID. A WebSocket `/replay/{cache_key}/trace` streams existing
   trace/frame records in order, followed by summary. Run blocking replay in a
   worker thread. Validate IDs, handle disconnects, and keep invalid data errors
   distinct from rule blockers. Use an explicit request size/node/event bound.
   No transport function may implement a transition. Add HTTP/WebSocket tests
   and a test proving cached stream bytes represent the same result.

4. **Planner boundary.** Give planners only serialized canonical `Scenario` plus
   `Plan.model_json_schema()`. Do not send `Campaign`, ground truth, research
   results, or a cache key derived from the campaign. Server-owned campaign
   selection is outside the planner API. Strictly reject embedded `expected` or
   `campaign` fields in uploads; never merely strip and retain the rest.

5. **Console adapter.** Add a render-only adapter under
   `apps/web/lib/propagation/` and wire an explicitly selected replay view. Map
   controlled→amber, encrypted→red, device dependency_outage→violet; keep labels
   as well as color. Preserve paper/up/down. Show `pre_attack` plan loss, causes,
   actual blocked preconditions, cached status and disclosed reconstruction.
   The existing app is a fixed `mockSession` and does not yet subscribe to any
   backend. Do not silently coerce the richer state into its infected boolean,
   call it live, or fabricate events for animations. Keep existing screens
   working. Add a subscription adapter when the backend exists; no browser ticks.

6. **Research runners.** Add a wrapper that reads `calibration.yaml` and CSVs,
   invokes the existing comparators and returns JSON per check: passed, failed,
   unsupported/insufficient-evidence, or not-run. Reuse the fixed press aliases
   and outcome mapping from `protocols.py`; do not invent service mappings.
   Use explicit defender ablations. Classify org outcomes with the declared
   majority threshold and always show actual encrypted/eligible host counts.
   For robustness, serialize all 100 seeds, config, assumptions, shares, and
   trial keys from `robustness`; don't report only a favorable seed or round a
   minority failure into universal success. Additional seeds are sensitivity,
   not new validation data.

7. **Freeze workflow.** Serialize a `FreezeManifest` before invoking evaluators.
   Freeze every `sim_core/*.py` file, `pyproject.toml`, `uv.lock`, normalized and
   raw inventories, campaigns, plans, generator config, calibration configuration,
   CSVs and the scorer/alias protocol. Require an explicit list of prior exposure;
   supplied CUH/BL hold-outs were already inspected, so mark them exposed.
   Call `run_holdout_once(..., require_unseen=False)` only with an exploratory
   label for these supplied cases. Actual unseen work requires a committed
   freeze and new evidence before labels are opened. Do not claim this change
   committed a pre-inspection freeze. Persist the report and ledger marker.

8. **Integration documentation.** Add exact startup commands after the server
   exists. Update `CODE_REFERENCE.md` and `HOSPITAL_SCHEMA.md` with adapter/API
   files and request contracts. Run package tests; run `pnpm -r typecheck` if
   frontend files change, and exercise the same cached replay in two tabs if a
   shared visualization is added.

## Inputs that must remain explicit

The raw national HSE file is not a canonical host scenario. Do not generate 33
accounts from its calibration target or label organizations encrypted in input.
Accept a separately authored aggregate/host reconstruction, record its cohort
meaning and account ownership, then invoke `compare_calibration`. Until supplied,
emit the `audit_raw_snapshot` gaps and mark the numerical account check unsupported.
An aggregated DoH representative cannot substantiate 90% host-level coverage.

The raw British Library file lacks causal inputs for the full expected spread.
Do not fill links, DA sessions, DC/LMS/backup grants, host protection or initial
credentials from its `expected` object. Accept a separately supplied strict
reconstruction and separate campaign. Until supplied, return evidence gaps;
an unearned passing result is a bug. A canonical event must specify entry mode,
target and authored sub-day ordering. Date-only/timed ambiguity must surface as
an input error, including BL's last date-only R6.

The CUH example is already a usable exploratory reconstruction. It neither
identifies PwC A/B nor fabricates an exposed vendor route. Local plans do not
edit the national D3 event. The example plan is illustrative and must not be
presented as optimizer output, agent agreement or approval for deployment.

## Completion criteria for the handoff

Keep every causal/protocol test passing. A CLI, direct API call, uncached
WebSocket and cached WebSocket must export the same deterministic replay for
identical inputs. Unknown/missing causal facts produce explicit input errors or
unsupported checks. HSE/BL evidence gaps are not instructions to fit the engine.
All live/backend/schema/UI work listed above was pending at the time of handoff.

## Status after implementation

All eight items are implemented around the frozen core; no rule, threshold or
mapping was changed to fit a hold-out. Design decisions are in
[RESEARCH_DECISIONS.md](RESEARCH_DECISIONS.md) ("Adapter decisions").

> Scope note: this engine branch is backend-only. Item 5 (the console adapter and
> `/replay` UI under `apps/web/`) lands on a separate UI branch, not in this PR. The
> CLI is `hippo-backtest`, separate from the agents' `hippo-sim`.

| Item | Module(s) | Notes |
|---|---|---|
| 1 File I/O and CLI | `sim_core/cli.py`, `serialize.py`, `hippo-backtest` script | JSON-only stdout; no seed on replay; CUH via `load_cuh`; `--compare` via a Pydantic encoder |
| 2 Trace cache | `sim_core/cache.py` | keyed on `fingerprint`; temp-file + atomic replace; validate-on-read; complete result stored |
| 3 FastAPI/WebSocket | `sim_core/api.py` | `POST /replay`, WS trace stream; worker-thread replay; bounds; 4xx vs rule-blocker 200 |
| 4 Planner boundary | `sim_core/planner.py` | only Scenario + `Plan` schema out; embedded campaign/expected rejected, not stripped |
| 5 Console adapter | `apps/web/lib/propagation/`, `components/propagation/`, `app/replay/` | render-only; no boolean coercion; no browser ticks; demo session untouched |
| 6 Research runners | `sim_core/research_runner.py` | CUH exploratory; HSE/BL unsupported with audit gaps; full robustness serialization |
| 7 Freeze workflow | `sim_core/freeze_runner.py` | repo-root freeze; CUH/BL prior-exposed; `require_unseen=False`; one-use ledger; not a pre-inspection freeze |
| 8 Integration docs | this file, `README.md`, `CODE_REFERENCE.md`, `HOSPITAL_SCHEMA.md` | startup commands and request contracts |

Completion criteria met: 113 pytest cases pass (Python 3.11). `tests/test_cross_transport_identity.py`
proves the CLI, direct call, cache file, and cached/uncached WebSocket export byte-identical
`ReplayResult` JSON on the real CUH example, and that replay is stable across separate processes with
different `PYTHONHASHSEED`. `apps/web` typechecks and builds. Two additive, test-safe library changes
support items 6 and the leakage architecture (`robustness()` returns config/assumptions;
`audit_raw_snapshot()` advises on an embedded `expected` block); both are documented and change no
transition. The supplied HSE/BL cases remain unsupported/exploratory — not fitted.
