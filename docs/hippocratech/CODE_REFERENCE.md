# Code reference

A map of the repo and who owns each part. Update the matching row in the same change that adds, renames, or deletes a file. Every path is **planned** until it exists.

**Owner key:** **Base** = the lead, frozen once the base app works on two laptops. **F1** = Teammate 1. **F2** = Teammate 2. **F3** = Teammate 3. **F4** = the lead.

## Repo shape

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
| `agents/protocol.py` | F1 | `Proposal`, `Verdict`, `Constraint`, `Revision`, `Question`, `Answer`, `Recommendation`; `Policy`/`PolicyRule`; draft `RunResult`; `Candidate`; REST requests `StartRound`, `Reassess`, `Resume`; Coordinator messages `ProposalRequest`, `RoundState`. All reject extra fields |
| `agents/inventory.py` | F1 | Inventory uAgent: preflight on round 1's request, `check` on each candidate (Question before Verdict), applies Answers |
| `agents/flow.py` | F1 | Flow uAgent: `optimize()` without protected-flow info, `run_sim` per candidate, `logic.flow.choose`; Proposal or Revision. `llm.propose()` fallback later |
| `agents/clinical_workflow.py` | F1 | Clinical Workflow uAgent: `logic.clinical.check` on each Proposal/Revision, replies with a Verdict |
| `agents/coordinator.py` | F1 | Coordinator uAgent: one `Round` per session; REST `/start_round`, `/resume`, `/reassess` (not implemented yet); carries out every Action |
| `agents/tools.py` | F1 | `run_sim` (hippo-sim or fixture results), `optimize` (hippo-opt or fixture candidates), `relay` (agent_message/agent_status rows: HTTP or `logs/<session>.jsonl`) |
| `agents/llm.py` | F2 | Claude `propose()` and `explain()`, with number and word checks |
| `agents/cache/demo_round.json` | F1 | Cached demo-seed conversation, question and answer included |
| `agents/run_all.py` | F1 | Starts the four agents as separate processes with `[agent]` prefixes; Ctrl-C stops all |
| `agents/config.py` | F1 | Settings from `agents/.env`: seeds, ports 8001–8004, `AGENT_MAILBOX`, `LOCAL_RESOLVE`, sim/opt/relay settings |
| `agents/addresses.py` | F1 | Addresses from seeds; the local `RulesBasedResolver` (address → `127.0.0.1:<port>/submit`) |
| `agents/runtime.py` | F1 | Builds each Agent (local resolution, no Almanac); `send`/`received` relay every message and set status |
| `agents/scripts/start_round.py`, `agents/scripts/answer.py` | F1 | POST `/start_round` and `/resume` to the Coordinator, as the watchers will |
| `agents/fixtures/candidates/*.json`, `agents/fixtures/results/*.json` | F1 | Runtime fixtures: three candidates and their hand-written results plus `baseline.json`, for `HIPPO_SIM_FIXTURES=1` and no `HIPPO_OPT_BIN` |
| `agents/logic/hospital.py` | F1 | Read-only hospital index: devices, rooms, flows, services by id; room type and zone per device; active flows per device |
| `agents/logic/inventory.py` | F1 | `flagged_devices`, `preflight`, `check`: unidentified-device decisions and `Question`s (pure) |
| `agents/logic/clinical.py` | F1 | `check` with `MAX_SERVICE_LOSS`: `keep_flow` and `keep_service` rejections (pure) |
| `agents/logic/flow.py` | F1 | `violates`, `rank`, `diff`/`apply_diff` for candidates (pure) |
| `agents/logic/coordinator.py` | F1 | `Round` state machine (events in, `Action`s out), `MAX_ROUNDS`, `required_roles` (pure) |
| `agents/requirements.txt`, `agents/pytest.ini` | F1 | Python 3.11 deps (venv in `agents/.venv`, gitignored) and pytest config |
| `agents/fixtures/hospital.json` | F1 | Test hospital until `data/hospitals/demo.json` exists: the mock hospital plus `dev_unknown_7`. Generated, don't edit |
| `agents/scripts/export_fixture.mjs` | F1 | Regenerates `fixtures/hospital.json` from `mock-session.ts` |
| `agents/tests/test_protocol.py` | F1 | Every model round-trips; extra fields and bad values are rejected |
| `agents/tests/test_fixture.py` | F1 | The fixture loads and its references (flows → devices, etc.) exist |
| `agents/tests/test_logic.py` | F1 | Guardians, ranking, and Coordinator scenarios a–g; `pytest -s` prints the a→b transcript |
| `agents/tests/fixtures/results/test_*.json` | F1 | Hand-written RunResults for `test_logic.py`. Test-only, never loaded at runtime |
| `agents/tests/test_runtime.py` | F1 | Config, local resolver, `make_agent`, `run_sim`/`optimize` fixtures and errors, fixture consistency, relay rows |
| `agents/tests/test_live_round.py` | F1 | Four real agent processes, one full round over uAgents, checked from the relay log |
| `agents/tests/test_uagents_api.py` | F1 | Runs the uAgents API snippets in `AGENT_NOTES.md` (seed address, mailbox, REST, chat protocol) |

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
