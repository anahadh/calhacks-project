# Code reference

A map of the repo and who owns each part. Update the matching row in the same change that adds, renames, or deletes a file. Every path is **planned** until it exists.

**Owner key:** **Base** = the lead, frozen once the base app works on two laptops. **F1** = Teammate 1. **F2** = Teammate 2. **F3** = Teammate 3. **F4** = the lead.

## Repo shape

**Current propagation-engine implementation:** the user-requested
`claude_instructions/IMPLEMENTATION.md` supersedes the older planned stochastic
Rust engine for this standalone backtest. Implemented code is in `engine/`;
transport and UI integration remain a handoff task. See
[`engine/HANDOFF.md`](../../engine/HANDOFF.md).

| Path | Owner | Role |
|---|---|---|
| `engine/pyproject.toml`, `uv.lock` | Base | Python 3.11 package and locked dependencies |
| `engine/sim_core/__init__.py` | Base | Package identity and rules version for cache invalidation |
| `engine/sim_core/schema.py` | Base | Strict scenario/campaign/plan and replay output contracts |
| `engine/sim_core/adapters.py` | Base | Explicit CUH inventory reconstruction and incomplete-data audit |
| `engine/sim_core/topology.py` | Base | Network, identity, trust and dependency graph; reachability and ranking |
| `engine/sim_core/engine.py` | Base | Deterministic rule transitions, defenses and service availability |
| `engine/sim_core/replay.py` | Base | Authored replay, cache key, event effects, counterfactual attribution |
| `engine/sim_core/generator.py` | Base | Sole seeded synthetic-interior generator |
| `engine/sim_core/research.py`, `protocols.py` | Base | Sensitivity, ablations, scoring, freeze and one-use hold-out protocols |
| `engine/sim_core/serialize.py` | Base | One canonical JSON form (`model_dump_json`) shared by every transport |
| `engine/sim_core/bundle.py` | Base | Freeze an attack (scenario+campaign+plan) into a deterministic, tamper-evident, replayable bundle; `verify` re-runs the frozen inputs |
| `engine/sim_core/cache.py` | Base | Content-addressed result store keyed by the replay fingerprint; atomic writes, validate-on-read |
| `engine/sim_core/cli.py` | Base | `hippo-sim` CLI: deterministic `replay` and separate `sensitivity` command |
| `engine/sim_core/planner.py` | Base | Planner input boundary: exposes only Scenario + Plan schema; rejects embedded campaign/expected |
| `engine/sim_core/api.py` | Base | FastAPI `POST /replay` + WebSocket trace stream; optional CUH demo registry (`demo=True`) and CORS for the dev origin; no transport computes a transition |
| `engine/sim_core/research_runner.py` | Base | Runs `calibration.yaml` checks; CUH exploratory, HSE/BL reported unsupported (never fitted) |
| `engine/sim_core/freeze_runner.py` | Base | Repo-root content freeze + one-use exploratory study ledger |
| `engine/scripts/build_runs.py` | Base | Generates the deterministic CUH run grid into `apps/web/public/propagation-runs/` for the offline UI |
| `engine/tests/` | Base | Causal/research-protocol checks plus cache, CLI, planner, API, runner, freeze, bundle and cross-transport identity suites |
| `engine/examples/` | Base | Disclosed exploratory CUH campaign and local illustrative plan |
| `engine/README.md`, `RESEARCH_DECISIONS.md`, `HANDOFF.md` | Base | Usage, research rationale/evidence limits and remaining adapter work |

The tree and Rust paths below describe the earlier product plan, not an existing
second simulation backend.

```
spacetime/               SpacetimeDB module: tables, reducers, the live simulation
crates/sim-core/         Spread engine (shared by the module and hippo-sim)
crates/hippo-sim/        CLI built from sim-core, for fast test runs
packages/optimizer/      Graph optimizer + hippo-opt CLI
packages/schema/         zod schemas and shared TypeScript types
apps/web/                Next.js app: scene, panels, Agent Room, solution view, server routes
apps/watcher/            Watchers: SpacetimeDB subscription clients that connect the agents
agents/                  Fetch.ai uAgents (Python)
data/hospitals/          demo.json, template.json, invalid/
```

If the SpacetimeDB starter pack confirms TypeScript modules, `sim-core` and `hippo-sim` become TypeScript packages instead, with the same split.

## Simulation (SpacetimeDB and sim-core)

| Path | Owner | Role |
|---|---|---|
| `crates/sim-core/src/lib.rs` | Base | `step(state, hospital, policy, rng) → TickResult`, spread, services, patients, choke points |
| `crates/sim-core/src/policy.rs` | Base | Apply allow rules, report `protected_broken` |
| `crates/sim-core/tests/determinism.rs` | Base | The same inputs give identical ticks. Never skip |
| `crates/hippo-sim/src/main.rs` | Base | `hippo-sim --hospital --policy --patient-zero --seed [--challenge]` → RunResult JSON |
| `spacetime/src/tables.rs` | Base | All tables from the spec's Data Model, plus `config` (server identity) |
| `spacetime/src/session.rs` | Base | `session_create`, `set_presenter`, `challenge_add` |
| `spacetime/src/run.rs` | Base | `run_start`, scheduled `run_tick`, `run_pause`, `run_resume`, `run_set_speed`, `run_step`, `run_reset`, `run_seek` |
| `spacetime/src/solution.rs` | F4 | `solution_start`: two runs with a shared `pair_id`, advanced in lockstep |
| `spacetime/src/agents.rs` | F1 | `defend_request`, `agent_message_add`, `agent_status_set`, `round_state_set` (server identity) |
| `spacetime/src/question.rs` | F1 | `question_add` (server identity), `question_answer` (allowed roles only) |
| `spacetime/src/recommendation.rs` | F2 | `recommendation_upsert` (server identity) |
| `spacetime/src/presence.rs` | F3 | `presence_heartbeat` |
| `spacetime/src/review.rs` | F3 | `review_submit`, the only writer of `recommendation.status` |
| `spacetime/src/memo.rs` | F3 | `memo_save_draft` (server identity), `memo_approve` |
| `apps/web/lib/stdb/` | Base | Generated bindings (`spacetime generate`) and a `useSession(id)` subscription hook |
| `apps/web/lib/stdb/types.ts`, `mock-session.ts` | Base | Row shapes and a fixed mid-run demo snapshot that `useSession` returns until the module exists |

## Watchers

| Path | Owner | Role |
|---|---|---|
| `apps/watcher/src/index.ts` | F1 | Connects as the server identity and starts every watcher |
| `apps/watcher/src/round.ts` | F1 | On `run` done, `defend_request`, or `challenge`: wakes the Sign-off Coordinator (`start_round` or `reassess`) |
| `apps/watcher/src/answer.ts` | F1 | On a `question` answer: calls the Coordinator's `resume` |
| `apps/watcher/src/relay.ts` | F1 | HTTP endpoint the agents post to. Writes `agent_message_add` and `agent_status_set`, and serves live state reads |

## Agents (Python, Fetch.ai uAgents)

| Path | Owner | Role |
|---|---|---|
| `agents/protocol.py` | F1 | `Proposal`, `Verdict`, `Constraint`, `Revision`, `Question`, `Answer`, `Recommendation` |
| `agents/inventory.py` | F1 | Unidentified-device check, `confirm_device`, sends `Question`s |
| `agents/flow.py` | F1 | `hippo-opt` candidates, `llm.propose()` fallback, `hippo-sim` testing and revision |
| `agents/clinical_workflow.py` | F1 | Protected-flow and service-loss checks, `keep_flow`, `keep_service` |
| `agents/coordinator.py` | F1 | Rounds, `waiting_for_human`, required roles; `start_round`, `reassess`, `resume` handlers |
| `agents/tools.py` | F1 | Wrappers for `hippo-sim`, `hippo-opt`, and the watcher relay |
| `agents/llm.py` | F2 | Claude `propose()` and `explain()`, with number and word checks |
| `agents/cache/demo_round.json` | F1 | Cached demo-seed conversation, question and answer included |
| `agents/run_all.py` | F1 | Starts all four agents |

## Optimizer

| Path | Owner | Role |
|---|---|---|
| `packages/optimizer/src/optimize.ts` | F2 | Zone graph, constrained cut, candidate policy |
| `packages/optimizer/src/cli.ts` | F2 | `hippo-opt` |

## Web app

| Path | Owner | Role |
|---|---|---|
| `apps/web/app/page.tsx` | Base | Load screen |
| `apps/web/app/s/[sessionId]/page.tsx`, `session-view.tsx` | Base | Session view shell: header, scene (65%), right panel (35%), timeline |
| `apps/web/app/replay/page.tsx` | Base | Explicitly-selected, render-only propagation replay view; separate route, leaves the live session untouched |
| `apps/web/components/propagation/replay-view.tsx` | Base | Interactive view: offline frozen-run grid + live lever toggles (mode toggle), runs-compare strip, levels/services/devices/blockers/assumptions |
| `apps/web/lib/propagation/` | Base | Render-only adapter + loaders: `ReplayResult` TS types, colour/label mapping (no boolean coercion), offline fetch + live `POST /replay` |
| `apps/web/public/propagation-runs/` | Base | Pre-generated deterministic CUH runs + `index.json` for offline mode (built by `engine/scripts/build_runs.py`) |
| `apps/web/components/shell/header.tsx` | Base | Hospital name, run selector, sim clock, session controls |
| `apps/web/components/shell/badges.tsx` | Base | Patient state badges (color plus glyph) |
| `apps/web/components/panel/side-panel.tsx` | Base | Damage / Agents / Recommendations tabs; F1 and F2 mount their views here |
| `apps/web/components/scene/*` | Base | Floors, rooms, device boxes, patients, arcs, subscribed to live state |
| `apps/web/components/panel/dashboard.tsx` | Base | Live headline, services, procedures, choke points, feed |
| `apps/web/components/timeline.tsx` | Base | Playback controls and scrubber (reads `tick_snapshot`) |
| `apps/web/features/scene/spread-fx.tsx` | F4 | Pulses and fizzles from `spread_attempt`, device flashes, room tints |
| `apps/web/features/scene/service-icons.tsx` | F4 | Service icons, "down" badges, event toasts from `sim_event` |
| `apps/web/features/scene/patients-fx.tsx` | F4 | Patient badges, ambulance diversion |
| `apps/web/features/scene/camera.ts` | F4 | Follows the infection front, then a wide shot |
| `apps/web/features/scene/equipment.tsx` | F4 | Key-equipment models |
| `apps/web/features/solution/solution-view.tsx` | F4 | Lockstep split screen, plan on the building, before/after strip, what keeps working |
| `apps/web/features/scene/challenge-menu.tsx` | F4 | **Change conditions** presets |
| `apps/web/components/plan/plan-2d.tsx` | F4 | 2D fallback |
| `apps/web/features/agents/agent-room.tsx` | F1 | Agent map, message particles, conversation thread, round header, readable pace |
| `apps/web/features/agents/scene-highlights.tsx` | F1 | Scene highlights driven by each `agent_message` |
| `apps/web/features/agents/question-card.tsx` | F1 | Question banner and answer choices |
| `apps/web/features/agents/defend-button.tsx` | F1 | Calls `defend_request` |
| `apps/web/features/policy/card-body.tsx` | F2 | Recommendation card: rules, explanation, numbers, verdicts, required roles |
| `apps/web/features/review/*` | F3 | Join modal, avatars, follow, review row, log drawer, memo editor |
| `apps/web/app/api/memo/route.ts` | F3 | Claude draft, number check, `memo_save_draft` |
| `apps/web/app/api/export/[sessionId]/route.ts` | F3 | Memo plus ruleset |
| `apps/web/server/ruleset.ts` | F3 | Policy → allow-list JSON and ACL text |

## Data

| Path | Owner | Role |
|---|---|---|
| `data/hospitals/demo.json` | Base | Demo hospital: critical services, `observed` flags, an inactive unknown device and vendor link for challenges |
| `data/hospitals/template.json`, `invalid/` | Base | Template and validation fixtures |
| `hippocratech/AGENT_NOTES.md` | F1 | uAgents, Agentverse, and watcher notes |

## Invariants

- Spread, impact and patient numbers come only from `sim-core`, in the module or `hippo-sim`. The browser renders subscribed rows.
- Visible runs advance only through `run_tick`. Reducers make no network calls.
- Every agent message is in `agent_message`. The Agent Room shows only that table.
- `recommendation.status` is written only by `review_submit`. Agent acceptance never sets it.
- Agents touch no real network.
- No secret is readable from client code.
