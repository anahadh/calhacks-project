# Code reference

A map of the repo and who owns each part. Update the matching row in the same change that adds, renames, or deletes a file. Every path is **planned** until it exists.

**Owner key:** **Base** = the lead, frozen once the base app works on two laptops. **F1** = Teammate 1. **F2** = Teammate 2. **F3** = Teammate 3. **F4** = the lead.

## Repo shape

**The engine (`engine/`, package `sim_core`):** the one deterministic Python engine.
It is the only thing that computes spread, impact, patient states and policy effects
(hard rule 3). It drives visible runs — the run watcher calls `POST /app/session` and
feeds the engine's per-tick frames into SpacetimeDB through `run_frames_apply` — and
the agents' test runs, through its `hippo-sim` CLI. The same package also backtests a
segmentation plan against the real 2021 campaign
(`claude_instructions/IMPLEMENTATION.md`) through a separate CLI, `hippo-backtest`, on
canonical `Scenario`/`Campaign`/`Plan` inputs. Run from `engine/`
(`uv sync --python 3.11 --group dev && uv run pytest -q`); see
[`docs/engine.md`](../engine.md),
[`engine/README.md`](../../engine/README.md),
[`engine/RESEARCH_DECISIONS.md`](../../engine/RESEARCH_DECISIONS.md) and
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
| `engine/sim_core/cli.py` | Base | `hippo-backtest` CLI: deterministic `replay` and separate `sensitivity` command |
| `engine/sim_core/planner.py` | Base | Planner input boundary: exposes only Scenario + Plan schema; rejects embedded campaign/expected |
| `engine/sim_core/app_bridge.py` | Base | Translate the app `hospital.json` ⇄ the engine (console split, SMB/RDP lateral, synthesized identity); `run_session` emits the UI sim rows with a per-tick `frames[]` timeline; `to_run_result(session, hospital)` and `run_result` give the agents' `RunResult`; `entry_points` lists legal patient zeros |
| `engine/sim_core/app_policy.py` | Base | Apply the agents' `Policy` to an app hospital: kept/removed/protected-broken flows and challenge activation (a line-for-line port of the retired `sim-core` `policy.ts`); `SUPPORTED_CHALLENGES`, strict `AppPolicy` |
| `engine/sim_core/app_cli.py` | Base | `hippo-sim` CLI (`[project.scripts]`): one engine test run over an app hospital → one `RunResult` on stdout; what the uAgents call |
| `engine/sim_core/api.py` | Base | FastAPI `POST /replay`, `POST /app/session` (live UI run + frames), `POST /app/run_result`, `POST /app/entry_points`, WebSocket trace stream; CUH demo registry (`demo=True`), CORS for the dev origin; see [`docs/engine.md`](../engine.md) |
| `engine/sim_core/research_runner.py` | Base | Runs `calibration.yaml` checks; CUH exploratory, HSE/BL reported unsupported (never fitted) |
| `engine/sim_core/freeze_runner.py` | Base | Repo-root content freeze + one-use exploratory study ledger |
| `engine/scripts/build_runs.py` | Base | Generates the deterministic CUH run grid into `apps/web/public/propagation-runs/` for the offline UI |
| `engine/scripts/build_frames_fixture.py` | Base | Writes the app run's frames fixture (`spacetime/test/fixtures/frames.demo.mri_2.json`) to stdout from the engine |
| `engine/tests/` | Base | Causal/research-protocol checks plus cache, CLI, planner, API, runner, freeze, bundle and cross-transport identity suites; the app path: `test_app_bridge.py`, `test_app_policy.py`, `test_app_determinism.py` (byte identity + `run_result`/`to_run_result` parity), `test_api.py` (`/app/session`, `/app/run_result`, `/app/entry_points`) |
| `engine/examples/` | Base | Disclosed exploratory CUH campaign and local illustrative plan |
| `engine/README.md`, `RESEARCH_DECISIONS.md`, `HANDOFF.md` | Base | Usage, research rationale/evidence limits and remaining adapter work |
| `engine/ENGINE_RESEARCH_PAPER.md` | Base | Paper-style explanation, exhibits, results, validity limits and presentation script |

The tree below is the rest of the product. The `engine/` package above is the one
engine; nothing here computes spread.

```
spacetime/               SpacetimeDB module (TypeScript, spacetimedb 2.13): tables and reducers, a pure state bus
packages/optimizer/      Graph optimizer + hippo-opt CLI (planned)
packages/schema/         zod schemas and shared TypeScript types (planned)
apps/web/                Next.js app: scene, panels, Agent Room, solution view, server routes
apps/watcher/            Watchers: SpacetimeDB subscription clients (run driver, relay, round, answer, entry points)
agents/                  Fetch.ai uAgents (Python)
data/hospitals/          demo.json, template.json, invalid/
```

Every export from `spacetime/src/index.ts` must be a table, reducer or lifecycle hook, or the module won't load. Tables live in `spacetime/src/schema.ts`, with the helpers reducer files share (`fail`, `isServer`, `requireServer`, `getSession`). Constants live in `spacetime/src/constants.ts`. Feature reducers go in their own `spacetime/src/<feature>.ts` files, re-exported from `index.ts`.

## Simulation (SpacetimeDB module)

The module is a pure state bus: the Python engine computes every run, the run watcher
feeds its frames in through `run_frames_apply`, and clients subscribe. Nothing here
computes spread (hard rules 3, 4). `packages/sim-core` is retired.

| Path | Owner | Role |
|---|---|---|
| `spacetime/src/schema.ts` | Base | All tables: `config` (server identity), `session` (round state + `entry_points_json`, `solution_pair_id`), `run` (status `requested\|running\|paused\|done\|error`, engine columns), `device_state`/`service_state`/`patient_state`/`spread_attempt`/`sim_event`/`tick_snapshot`, `defend_request_log`, `agent_message`, `agent_status`, `question`, `recommendation`, plus run/auth helpers. (`run_state` and `tick_timer` are gone.) |
| `spacetime/src/ingest.ts` | Base | `run_frames_apply` (server only): checks each `TickFrame` against the run and the session's hospital, then writes the six per-tick row sets and the `run` row, one transaction per call; `run_fail` (server only): `status:'error'` + `detail` |
| `spacetime/src/hospital.ts` | Base | Hospital file types and `validateHospital`/`hospitalOf`/`hospitalIndex`; types and validation only (not re-exported, so it may export helpers) |
| `spacetime/src/index.ts` | Base | Default-exports the schema and re-exports the feature reducers (`ingest`, `solution`, `agents`, `question`, `recommendation`). Reducers here: `config_set_server`, `session_create`, `session_entry_points_set` (server), `presence_join`, `presence_heartbeat`, `set_presenter`, `run_start`, `run_pause`, `run_resume`, `run_set_speed`, `run_step`, `run_reset`, `annotation_add`, `annotation_clear`. Still to add: `challenge_add` |
| `spacetime/src/constants.ts` | Base | `TICK_MS`, `SPEEDS`, `RUN_STATUSES`, `EVENT_TARGETS`, `PATIENT_STATES`, `FRAMES_MAX`, `KEEP_ATTEMPT_TICKS` and other module constants |
| `spacetime/test/module.test.ts` | Base | Module unit tests; the oracle is the checked-in engine frames fixture |
| `spacetime/test/fixtures/frames.demo.mri_2.json` | Base | Engine frames for the demo attack (patient zero `mri_2`); feeds the module and live tests in place of the retired `sim-core` oracle |
| `spacetime/test/live.integration.test.ts` | Base | Two live clients against a running server (`STDB_URI=ws://127.0.0.1:3000`); frames from the fixture |
| `spacetime/src/solution.ts` | F4 | `solution_start`: two `requested` runs with a shared `pair_id` (no segmentation vs the plan), `active_run_id` untouched; `solution_close` clears `session.solution_pair_id` |
| `spacetime/src/agents.ts` | F1 | `defend_request` (any joined human; refused while any run in the session is `requested` or `running`, or a round is open; writes `defend_request_log`), `agent_message_add`, `agent_status_set`, `round_state_set` (server identity) |
| `spacetime/src/question.ts` | F1 | `question_add` (server identity), `question_answer` (allowed roles only, from the caller's presence; never the server) |
| `spacetime/src/role_views.ts` | F3 | Role views: each role's card lines (`deviceCards`, at most `MAX_LINES` = 3) and how a hovered device's connections look (`ARC_MODE`, `roleArcs`), as pure functions over the hospital file. Tune roles here only. Also imported by the web app for the offline demo |
| `spacetime/src/views.ts` | F3 | Per-caller views `my_device_card` (one row per device, `lines_json`) and `my_arcs`: read the caller's presence row (`ctx.sender`) and apply `role_views.ts` for their role; empty before joining |
| `spacetime/test/views.test.ts` | F3 | Role views: each role gets only its fields and arcs, infected-by from the active run, follows a role change, nothing before joining |
| `spacetime/src/recommendation.ts` | F2 | `recommendation_upsert` (server identity): keyed by session, round and option (`s:round` for option 1, `s:round:2`, `s:round:3` for alternatives); inserts as `draft` and never changes `status` |
| `spacetime/src/review.ts` (planned) | F3 | `review_submit`, the only writer of `recommendation.status` |
| `spacetime/src/memo.ts` (planned) | F3 | `memo_save_draft` (server identity), `memo_approve` |
| `apps/web/lib/stdb/module_bindings/` | Base | Generated with `npm run generate -w hippocratech-module`. Never edit by hand |
| `apps/web/lib/stdb/connection.ts`, `live-session.ts` | Base | The live subscription (session-scoped and run-scoped rows); `useLiveSession` and `useLiveRunRows` (a run's rows by id, e.g. each side of a solution pair) |
| `apps/web/lib/stdb/snapshot.ts`, `run-status.ts`, `actions.ts` | Base | `snapshotOf(rows)`/`runViewOf` map the generated bindings onto the UI row shapes (no computation); run status helpers; the reducer-calling `SessionActions` |
| `apps/web/lib/stdb/use-session.ts` | Base | `useSession(id)`/`useRunRows(id)`: live rows when `NEXT_PUBLIC_STDB_URI` is set; the explicit mock only with `NEXT_PUBLIC_MOCK=1`; otherwise `source:'error'` ("Not connected"). No silent fallback (rule 14) |
| `apps/web/lib/stdb/agent-rows.ts` | Base | Reshapes `agent_message`, `agent_status`, `question`, `recommendation` and the session's round state for the Agent Room (sender's copy of each message, plus humans' answers; ASI:One chat rows as messages to/from `asi1`). For rounds with no session row, the round state and recommendation come from their relayed messages |
| `apps/web/lib/stdb/room.ts` | F1 | Subscribes to one ASI:One round's `agent_message` and `agent_status` rows (session ids `chat-…`, which have no session row) |
| `apps/web/lib/stdb/types.ts`, `mock-session.ts` | Base | Row shapes (incl. the new `RunRow` columns and `SessionActions`) and a fixed mid-run demo snapshot (with a sample agent round) for working without a server |

## Watchers

| Path | Owner | Role |
|---|---|---|
| `apps/watcher/src/index.ts` | F1 | Connects as the server identity and starts every watcher (relay, round, answer, run driver, entry points). `npm run dev -w watcher`; reads `.env.local` |
| `apps/watcher/src/config.ts`, `stdb.ts`, `coordinator.ts` | F1 | Settings (`STDB_URI`, `STDB_SERVER_TOKEN`, `COORDINATOR_URL`, `ENGINE_URL` default `http://127.0.0.1:8000`, `RELAY_PORT` default 8010, `RELAY_TOKEN`); the connection and subscription (`session`, `defend_request_log`, `question`, `run`); `ServerReducers` (now incl. `runFramesApply`, `runFail`, `sessionEntryPointsSet`); Coordinator REST calls. Failures are written to `session.round_detail` |
| `apps/watcher/src/cached.ts` | F1 | The cached demo round (rule 14's one exception): with `CACHED_ROUND=1` (or a speed, e.g. `4`) in `.env.local`, Create aggregate fix spawns `agents/scripts/replay_cached.py` on `agents/cache/demo_round.json` instead of waking the Coordinator; rows still go through the relay, labeled "Cached run"; the answer watcher does not resume anything. See `CACHED_RUN.md` |
| `apps/watcher/src/engine.ts` | F1 | Engine HTTP client: `callEngine` (`POST /app/session` → strict-parsed `AppSession`/`TickFrame`), `callEntryPoints` (`POST /app/entry_points`); maps the engine's error envelope to a readable detail; never throws |
| `apps/watcher/src/run.ts` | F1 | Run driver: on a `requested` run calls the engine, applies frame 0 through `run_frames_apply`, then sends one frame per beat at `TICK_MS / speed`; obeys pause/resume/step/speed/reset; a pair's frames go in one call; engine/module refusals become `run_fail` (never `session.round_detail`); recomputes in-flight runs after a restart |
| `apps/watcher/src/entry.ts` | F1 | Entry-point watcher: for each new session calls `POST /app/entry_points` and writes `session_entry_points_set`; failures go to `session.round_detail` |
| `apps/watcher/src/round.ts` | F1 | On `defend_request` only: wakes the Sign-off Coordinator (`POST /start_round`; `reassess` is a stub). Never on `run` completion or `challenge` alone. Guards `JSON.parse(challengesJson)` |
| `apps/watcher/src/answer.ts` | F1 | On a `question` answer: calls the Coordinator's `resume` |
| `apps/watcher/src/relay.ts` | F1 | HTTP endpoint the agents post to (`POST /agent_message`, `/agent_status`, bearer `RELAY_TOKEN`, strict zod). Writes `agent_message_add` and `agent_status_set`; from the sender's copy, also `question_add` (questions to humans), `round_state_set` and `recommendation_upsert`. A reducer's refusal returns HTTP 502, so the agent doesn't send. Live state reads: not built yet |
| `apps/watcher/test/relay.test.ts` | F1 | Relay contract with fake reducers |
| `apps/watcher/test/run.test.ts`, `entry.test.ts` | F1 | Run driver and entry-point watcher with fake reducers, a fake engine and fake timers: the exact reducer call sequence, pause/resume/speed/step, reset → recompute, a pair in one call, and an engine 422 becoming `run_fail` |
| `apps/watcher/test/engine.test.ts`, `engine.contract.test.ts` | F1 | The engine client against fixture replies and the `AppSession`/`TickFrame` contract |
| `apps/watcher/test/live.integration.test.ts` | F1 | Two clients against the running stack (`E2E_STDB_URI`): no agent traffic while running, a full round after Create aggregate fix, and a question answered by an allowed role |

## Agents (Python, Fetch.ai uAgents)

| Path | Owner | Role |
|---|---|---|
| `agents/protocol.py` | F1 | `Proposal`, `Verdict`, `Constraint`, `Revision`, `Question`, `Answer`, `Recommendation`; `Policy`/`PolicyRule`; draft `RunResult`; `Candidate`; REST requests `StartRound`, `Reassess`, `Resume`; Coordinator messages `ProposalRequest`, `RoundState`. All reject extra fields |
| `agents/inventory.py` | F1 | Inventory uAgent: preflight on round 1's request, `check` on each candidate (Question before Verdict), applies Answers |
| `agents/flow.py` | F1 | Flow uAgent: `optimize()` without protected-flow info, `run_sim` per candidate, `logic.flow.choose`; Proposal or Revision. `llm.propose()` fallback later |
| `agents/clinical_workflow.py` | F1 | Clinical Workflow uAgent: `logic.clinical.check` on each Proposal/Revision, replies with a Verdict |
| `agents/coordinator.py` | F1 | Coordinator uAgent: one `Round` per session; REST `/start_round`, `/resume`, `/reassess` (not implemented yet); carries out every Action; chat protocol (ASI:One): starts rounds and sends summaries |
| `agents/chat.py` | F1 | The orchestrator's chat in code: parse commands (simulate, lookup, devices, protected flows, status, help) and ASI:One card button clicks, resolve devices by name or id, help, status and round-summary text |
| `agents/logic/candidates.py` | F1 | The Flow Agent's candidate plans, built in code from the baseline attack: cut the attack's path, wall off the zone it starts in, shield the server room, block cross-zone file sharing and remote desktop. Each is an allow-list the engine reads; keep_flow constraints are never cut. Replaces the fixture candidates (no fallback); `HIPPO_OPT_BIN` still overrides |
| `agents/cards.py` | F1 | ASI:One interactive cards (Agentverse element-tree primitives) for the orchestrator's replies: device picker, device, devices, protected flows, round started, round result |
| `agents/profiles/*.md` | F1 | Agentverse README for each agent (`readme_path`): stall point, messages, code vs. Claude, human approval, synthetic data |
| `agents/tools.py` | F1 | `run_sim` (the Python engine's `hippo-sim` via `HIPPO_SIM_BIN`, or `HIPPO_SIM_FIXTURES=1` results), `optimize` (hippo-opt or fixture candidates), `relay` (agent_message/agent_status rows: HTTP or `logs/<session>.jsonl`) |
| `agents/llm.py` | F2 (implemented by F1) | `explain()` and `question_text()`: Claude words verdict reasons, Question text, Flow's "why this plan" and the recommendation's explanation, with number, word and length checks, one retry, and a labeled template fallback; `with_text()` changes only the text. `propose()` still to come (F2) |
| `agents/facts.py` | F1 | The facts each message may state: human names and purposes, and the numbers, built by code from the RunResult, constraint and hospital |
| `agents/cache/demo_round.json` | F1 | Cached demo-seed conversation, question and answer included |
| `agents/run_all.py` | F1 | Starts the four agents as separate processes with `[agent]` prefixes; Ctrl-C stops all |
| `agents/config.py` | F1 | Settings from `agents/.env`: seeds, ports 8001–8004, `AGENT_MAILBOX`, `LOCAL_RESOLVE`, sim/opt/relay settings |
| `agents/agent_chat.py` | F1 | The chat protocol for the three specialists: answers an ASI:One chat with the agent's profile intro and the last thing it said in a round (`note()`); relays both lines (rule 10); never starts a round |
| `agents/addresses.py` | F1 | Addresses from seeds; local resolution (address → `127.0.0.1:<port>/submit`, plus `LOCAL_PEERS`), and `LocalFirstResolver` for mailbox mode |
| `agents/runtime.py` | F1 | Builds each Agent for its mode (`AGENT_MAILBOX` × `LOCAL_RESOLVE`) with its Agentverse profile and `GET /health`; `connect_mailbox` for `AGENTVERSE_API_KEY`; `send`/`received` relay every message and set status |
| `agents/scripts/start_round.py`, `agents/scripts/answer.py` | F1 | POST `/start_round` and `/resume` to the Coordinator, as the watchers will |
| `agents/scripts/check_agentverse.py` | F1 | Laptop check: each agent's name, handle, address, port, Inspector URL, and whether `/health` answers locally |
| `agents/fixtures/candidates/*.json`, `agents/fixtures/results/*.json` | F1 | Runtime fixtures: three candidates and their hand-written results plus `baseline.json`, and `<id>@unknown_device_imaging.json` variants for that challenge; for `HIPPO_SIM_FIXTURES=1` and no `HIPPO_OPT_BIN` |
| `agents/logic/hospital.py` | F1 | Read-only hospital index: devices, rooms, flows, services by id; room type and zone per device; active flows per device |
| `agents/logic/inventory.py` | F1 | `flagged_devices`, `preflight`, `check`: unidentified-device decisions and `Question`s (pure) |
| `agents/logic/clinical.py` | F1 | `check` with `MAX_SERVICE_LOSS`: `keep_flow` and `keep_service` rejections (pure) |
| `agents/logic/flow.py` | F1 | `violates`, `rank`, `diff`/`apply_diff` for candidates (pure) |
| `agents/logic/coordinator.py` | F1 | `Round` state machine (events in, `Action`s out), `MAX_ROUNDS`, `required_roles` (pure) |
| `agents/requirements.txt`, `agents/pytest.ini` | F1 | Python 3.11 deps (venv in `agents/.venv`, gitignored) and pytest config |
| `agents/fixtures/hospital.json` | F1 | The agents' test fixture: `data/hospitals/demo.json` plus `dev_unknown_7` and its inactive `fl_unknown_7_smb` for the challenge tests. At runtime the agents load `data/hospitals/demo.json` via `HOSPITAL_PATH`. Generated, don't edit |
| `agents/scripts/export_fixture.mjs` | F1 | Regenerates `fixtures/hospital.json` from `mock-session.ts` |
| `agents/scripts/refresh_fixtures.py` | F1 | Runs `HIPPO_SIM_BIN` for the baseline and each candidate, with and without each supported challenge, and rewrites `agents/fixtures/results/*.json` from the engine |
| `agents/tests/test_protocol.py` | F1 | Every model round-trips; extra fields and bad values are rejected |
| `agents/tests/test_fixture.py` | F1 | The fixture loads and its references (flows → devices, etc.) exist |
| `agents/tests/test_logic.py` | F1 | Guardians, ranking, and Coordinator scenarios a–g; `pytest -s` prints the a→b transcript |
| `agents/tests/fixtures/results/test_*.json` | F1 | Hand-written RunResults for `test_logic.py`. Test-only, never loaded at runtime |
| `agents/tests/test_runtime.py` | F1 | Config, local resolver, `make_agent`, `run_sim`/`optimize` fixtures and errors, fixture consistency (engine semantics: `infectedCount == len(infectedDevices)`, `ticksDown == ticks - downSinceTick + 1`), relay rows |
| `agents/tests/test_engine_edge.py` | F1 | Runs the real `HIPPO_SIM_BIN` when set (skipped otherwise): `hippo-sim` returns a `RunResult`, and the baseline/candidate numbers match the refreshed fixtures |
| `agents/tests/test_live_round.py` | F1 | Four real agent processes over uAgents, checked from the relay log: a full round with no questions; the challenge round that pauses for a human and resumes on `/resume`; a round in mailbox mode over local `/submit`; a chat that starts a round and gets the summary |
| `agents/tests/test_llm.py` | F1 | `llm.py` with a mocked client: good answer, invented number (retry, template), forbidden words, API errors and timeouts, missing key, and decisions unchanged by model output |
| `agents/tests/test_chat.py` | F1 | Chat parsing, device lookup, help, status and summary text |
| `agents/tests/chat_sender.py`, `agents/tests/tests_paths.py` | F1 | Test helpers: a fake ASI:One user (a real uAgent) for the live chat test; shared paths |
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
| `apps/web/app/s/[sessionId]/page.tsx`, `session-view.tsx` | Base | Session view shell: Simulation tab (rail, one row-driven stepper, scene, side column) and Agents tab |
| `apps/web/app/s/[sessionId]/solution/[recommendationId]/page.tsx` | F4 | The solution rerun route: opens the solution view for a recommendation's pair |
| `apps/web/components/shell/header.tsx` | Base | Hospital name, Simulation / Agents tabs, presence, Log |
| `apps/web/components/shell/badges.tsx` | Base | Patient state badges (color plus glyph) |
| `apps/web/components/panel/impact.tsx`, `services.tsx`, `inspector.tsx` | Base | Simulation side column: patients affected, service tiles, hovered-device record and choke points |
| `apps/web/components/panel/device-card.tsx` | Base | Hovered device, kept short: name, state, type and room, the caller's role lines (at most three) from the role view, and the latest focus pin |
| `apps/web/components/panel/counters.tsx` | Base | Counter strip on the Agents tab |
| `apps/web/components/scene/*` | Base | Floors, rooms, device boxes, patients, arcs, subscribed to live state |
| `apps/web/components/scene/scene-boundary.tsx` | Base | WebGL error boundary: falls back to the 2D plan when the 3D scene can't render |
| `apps/web/components/timeline.tsx` | Base | Timeline rail: playback, speed, follow, scrubber with event markers and heat strip, current beat (reads `tick_snapshot`, `sim_event`) |
| `apps/web/features/scene/spread-fx.tsx` | F4 | Pulses and fizzles from `spread_attempt`, device flashes, room tints |
| `apps/web/features/scene/service-icons.tsx` | F4 | Service icons, "down" badges, event toasts from `sim_event` |
| `apps/web/features/scene/patients-fx.tsx` | F4 | Patient badges, ambulance diversion |
| `apps/web/features/scene/camera.ts` | F4 | Follows the infection front, then a wide shot |
| `apps/web/features/scene/equipment.tsx` | F4 | Key-equipment models |
| `apps/web/features/solution/plan-arcs.tsx` | F4 | The plan's cuts over the building (HospitalScene children): a dashed arc per removed connection, a ✕ "stopped · SMB 445" mark at the peak of each one the infection reached (`cutStops`), thin blue arcs for kept connections that cross a segment wall. The fences (`segment-outlines.tsx`) now follow `planSegmentsOf` (machines still joined after the cuts), not the zone map |
| `apps/web/features/solution/conclusion.tsx`, `estimate.ts` | F4 | The conclusion under the split screen, as cards: the decision card (the option's numbers, verdict badges, who must sign off, **Approve this plan**, a browser-local step that writes nothing) and, once approved, the outcome card: what the plan saved (`savedBy`: machines kept clean, patients kept on normal care, services kept running, protected flows intact, from the two run rows), the money estimate (`moneyOf`: stated unit costs in `UNIT` × those counts, with "How this is estimated"), the segmentation diagram (`diagramOf`: zones on a ring, kept connections solid, cut ones dashed with a ✕ count) and the four agents' part. No outcome language (rule 2) |
| `apps/web/features/solution/solution-view.tsx`, `segment-outlines.tsx`, `pair.ts` (`plan-scene.tsx` retired) | F4 | The solution screen: the plan run drawn by the same `HospitalScene` as the simulation (same camera, walls, furniture, chips), with the plan's segmentation laid over it through the scene's `children` slot (`SegmentOutlines`: each room's floor tinted in its segment's color and a translucent fence on every room edge that does not face a same-segment room, labeled when infected or hovered), a right column with this step's count on both sides, the final before → after grid (`beforeAfter`: devices, patients, services, protected flows, connections) and the segment list (hover lights a fence), under one transport and clock; the conclusion below. `pair.ts` resolves the pair's two runs by `pairId`, `segmentsOf` the zones |
| `apps/web/features/scene/challenge-menu.tsx` | F4 | **Change conditions** presets |
| `apps/web/components/plan/plan-2d.tsx` | F4 | 2D fallback |
| `apps/web/features/agents/agent-room.tsx` | F1 | Agent Room: the orchestrator graph with an ASI:One node and a particle per message, a four-lane strip (one card per agent: live badge and its tallies from `lanesOf`), the negotiation table (one column per plan with its rule chips, one stamp per reviewing agent's verdict with what it needs, a Coordinator row: routed to / published as option N), constraints learned, transcript tab, round chip. `AgentRoom` (session modal) and `AgentRoomFrame` (shared with app/room) |
| `apps/web/features/agents/negotiation.ts` | F1 | Pure: agent_message rows → plan columns (with their rule or diff lines), verdict stamps and constraint chips (met when the same agent accepts a later plan); `lanesOf` (each agent's tallies and live badge) and `coordinatorStamp` (what the Coordinator did with a plan) |
| `apps/web/app/room/[sessionId]/` | F1 | Live, read-only Agent Room for a round started from ASI:One chat; the orchestrator's chat reply links here (`HIPPO_WEB_URL`) |
| `apps/web/features/agents/agents.ts`, `agent-icon.tsx` | F1 | Agent names and objectives, message-type shapes, agent icons |
| `apps/web/features/agents/scene-highlights.tsx` | F1 | Scene highlights driven by each `agent_message` |
| `apps/web/features/agents/question-card.tsx` | F1 | Question banner and answer choices |
| `apps/web/features/agents/defend-button.tsx` | F1 | **Create aggregate fix** — calls `defend_request`; blocked while any session run is `requested` or `running`, or a round is open (mirrors the reducer) |
| `apps/web/features/policy/card-body.tsx` | F2 | Recommendation card: rules, explanation, numbers, verdicts, required roles, and **Show the solution** (`solution_start`) |
| `apps/web/features/review/join-modal.tsx` | F3 | Join modal: name and a required role (Chief Information Security Officer → `security`, Network Engineer → `network`, Clinical IT Team → `clinical_engineering`, Hospital Management → `operations`), who is here with roles, and for the session's creator the invite link; `presence_join`. Remembers name and role per session in localStorage and rejoins after a reload |
| `apps/web/features/review/role-badge.tsx` | F3 | A person's role as a short neutral chip (avatars, the join card, focus pins on the device card) |
| `apps/web/lib/role-views.ts` | F3 | Role names (`ROLE_OPTIONS`, `ROLE_LABEL`, `ROLE_SHORT`), card field labels, and `useRoleView()`: the `my_device_card`/`my_arcs` rows when live, the same `role_views.ts` functions offline (CISO lens) |
| `apps/web/features/review/invite.tsx` | F3 | The session link (`/s/<id>`) with Copy, and the header's Invite button |
| `apps/web/features/review/*` | F3 | Avatars, follow, review row, log drawer, memo editor |
| `apps/web/app/api/memo/route.ts` | F3 | Claude draft, number check, `memo_save_draft` |
| `apps/web/app/api/export/[sessionId]/route.ts` | F3 | Memo plus ruleset |
| `apps/web/server/ruleset.ts` | F3 | Policy → allow-list JSON and ACL text |

## Data

| Path | Owner | Role |
|---|---|---|
| `data/hospitals/demo.json` | Base | Demo hospital: critical services and `observed` flags (48 devices, 55 flows). No unknown device or inactive flow; the agents' challenge fixture adds those in `agents/fixtures/hospital.json` |
| `data/hospitals/template.json`, `invalid/` | Base | Template and validation fixtures |
| `hippocratech/AGENT_NOTES.md` | F1 | uAgents, Agentverse, and watcher notes |
| `hippocratech/AGENTVERSE_SETUP.md` | F1 | Laptop steps: register the four agents on Agentverse (mailbox, profiles) and test the Coordinator on ASI:One |

## Invariants

- Spread, impact and patient numbers come only from the Python engine (`engine/sim_core`): visible runs through the run watcher, the agents' test runs through `hippo-sim`. The module and the browser never compute; the browser renders subscribed rows.
- Visible runs advance only when the run watcher writes the engine's next frame through `run_frames_apply`. Reducers make no network calls.
- Every agent message is in `agent_message`. The Agent Room shows only that table.
- `recommendation.status` is written only by `review_submit`. Agent acceptance never sets it.
- Agents touch no real network.
- No secret is readable from client code.
