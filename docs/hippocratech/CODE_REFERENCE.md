# Code reference

A map of the repo and who owns each part. Update the matching row in the same change that adds, renames, or deletes a file. Every path is **planned** until it exists.

**Owner key:** **Base** = the lead, frozen once the base app works on two laptops. **F1** = Teammate 1. **F2** = Teammate 2. **F3** = Teammate 3. **F4** = the lead.

## Repo shape

```
spacetime/               SpacetimeDB module (TypeScript, spacetimedb 2.13): tables, reducers, the live simulation
packages/sim-core/       Spread engine (TypeScript), shared by the module and hippo-sim
packages/hippo-sim/      CLI built from sim-core, for fast test runs (planned)
packages/optimizer/      Graph optimizer + hippo-opt CLI (planned)
packages/schema/         zod schemas and shared TypeScript types (planned)
apps/web/                Next.js app: scene, panels, Agent Room, solution view, server routes
apps/watcher/            Watchers: SpacetimeDB subscription clients that connect the agents (planned)
agents/                  Fetch.ai uAgents (Python)
data/hospitals/          demo.json, template.json, invalid/
```

Every export from `spacetime/src/index.ts` must be a table, reducer or lifecycle hook, or the module won't load. Constants live in `spacetime/src/constants.ts`. Feature reducers go in their own `spacetime/src/<feature>.ts` files, re-exported from `index.ts`.

## Simulation (SpacetimeDB and sim-core)

| Path | Owner | Role |
|---|---|---|
| `packages/sim-core/src/engine.ts`, `run.ts` | Base | `step(state, hospital, policy, rng) → TickResult`: spread, services, patients, choke points |
| `packages/sim-core/src/policy.ts` | Base | Apply allow rules, report `protectedBroken` |
| `packages/sim-core/src/rng.ts` | Base | mulberry32, seeded from the run |
| `packages/sim-core/test/engine.test.ts` | Base | The same inputs give identical ticks. Never skip |
| `packages/hippo-sim/` (planned) | Base | `hippo-sim --hospital --policy --patient-zero --seed [--challenge]` → RunResult JSON |
| `spacetime/src/index.ts` | Base | All tables, plus `config` (server identity). Reducers: `config_set_server`, `session_create`, `presence_join`, `presence_heartbeat`, `set_presenter`, `run_start`, scheduled `run_tick`, `run_pause`, `run_resume`, `run_set_speed`, `run_step`, `run_reset`, `annotation_add`, `annotation_clear`. Still to add: `challenge_add`, `run_seek` |
| `spacetime/src/constants.ts` | Base | Tick length and other module constants |
| `spacetime/test/module.test.ts` | Base | Module unit tests |
| `spacetime/test/live.integration.test.ts` | Base | Two live clients against a running server (`STDB_URI=ws://127.0.0.1:3000`) |
| `spacetime/src/solution.ts` (planned) | F4 | `solution_start`: two runs with a shared `pair_id`, advanced in lockstep |
| `spacetime/src/agents.ts` (planned) | F1 | `defend_request`, `agent_message_add`, `agent_status_set`, `round_state_set` (server identity) |
| `spacetime/src/question.ts` (planned) | F1 | `question_add` (server identity), `question_answer` (allowed roles only) |
| `spacetime/src/recommendation.ts` (planned) | F2 | `recommendation_upsert` (server identity) |
| `spacetime/src/review.ts` (planned) | F3 | `review_submit`, the only writer of `recommendation.status` |
| `spacetime/src/memo.ts` (planned) | F3 | `memo_save_draft` (server identity), `memo_approve` |
| `apps/web/lib/stdb/module_bindings/` | Base | Generated with `npm run generate -w hippocratech-module`. Never edit by hand |
| `apps/web/lib/stdb/connection.ts`, `live-session.ts` | Base | The live subscription |
| `apps/web/lib/stdb/use-session.ts` | Base | `useSession(id)`: live rows when `NEXT_PUBLIC_STDB_URI` is set, else the mock |
| `apps/web/lib/stdb/types.ts`, `mock-session.ts` | Base | Row shapes and a fixed mid-run demo snapshot (with a sample agent round) for working without a server |

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
| `agents/coordinator.py` | F1 | Coordinator uAgent: one `Round` per session; REST `/start_round`, `/resume`, `/reassess` (not implemented yet); carries out every Action; chat protocol (ASI:One): starts rounds and sends summaries |
| `agents/chat.py` | F1 | The Coordinator's chat in code: parse commands, resolve devices by name or id, help, status and round-summary text |
| `agents/profiles/*.md` | F1 | Agentverse README for each agent (`readme_path`): stall point, messages, code vs. Claude, human approval, synthetic data |
| `agents/tools.py` | F1 | `run_sim` (hippo-sim or fixture results), `optimize` (hippo-opt or fixture candidates), `relay` (agent_message/agent_status rows: HTTP or `logs/<session>.jsonl`) |
| `agents/llm.py` | F2 (implemented by F1) | `explain()` and `question_text()`: Claude words verdict reasons, Question text, Flow's "why this plan" and the recommendation's explanation, with number, word and length checks, one retry, and a labeled template fallback; `with_text()` changes only the text. `propose()` still to come (F2) |
| `agents/facts.py` | F1 | The facts each message may state: human names and purposes, and the numbers, built by code from the RunResult, constraint and hospital |
| `agents/cache/demo_round.json` | F1 | Cached demo-seed conversation, question and answer included |
| `agents/run_all.py` | F1 | Starts the four agents as separate processes with `[agent]` prefixes; Ctrl-C stops all |
| `agents/config.py` | F1 | Settings from `agents/.env`: seeds, ports 8001–8004, `AGENT_MAILBOX`, `LOCAL_RESOLVE`, sim/opt/relay settings |
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
| `agents/fixtures/hospital.json` | F1 | Test hospital until `data/hospitals/demo.json` exists: the mock hospital plus `dev_unknown_7`, whose flow is inactive until the `unknown_device_imaging` challenge. Generated, don't edit |
| `agents/scripts/export_fixture.mjs` | F1 | Regenerates `fixtures/hospital.json` from `mock-session.ts` |
| `agents/tests/test_protocol.py` | F1 | Every model round-trips; extra fields and bad values are rejected |
| `agents/tests/test_fixture.py` | F1 | The fixture loads and its references (flows → devices, etc.) exist |
| `agents/tests/test_logic.py` | F1 | Guardians, ranking, and Coordinator scenarios a–g; `pytest -s` prints the a→b transcript |
| `agents/tests/fixtures/results/test_*.json` | F1 | Hand-written RunResults for `test_logic.py`. Test-only, never loaded at runtime |
| `agents/tests/test_runtime.py` | F1 | Config, local resolver, `make_agent`, `run_sim`/`optimize` fixtures and errors, fixture consistency, relay rows |
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
| `apps/web/app/s/[sessionId]/page.tsx`, `session-view.tsx` | Base | Session view shell: Simulation tab (rail, demo steps, scene, side column) and Agents tab |
| `apps/web/components/shell/header.tsx` | Base | Hospital name, Simulation / Agents tabs, presence, Log |
| `apps/web/components/shell/badges.tsx` | Base | Patient state badges (color plus glyph) |
| `apps/web/components/panel/impact.tsx`, `services.tsx`, `inspector.tsx` | Base | Simulation side column: patients affected, service tiles, hovered-device record and choke points |
| `apps/web/components/panel/counters.tsx` | Base | Counter strip on the Agents tab |
| `apps/web/components/scene/*` | Base | Floors, rooms, device boxes, patients, arcs, subscribed to live state |
| `apps/web/components/timeline.tsx` | Base | Timeline rail: playback, speed, follow, scrubber with event markers and heat strip, current beat (reads `tick_snapshot`, `sim_event`) |
| `apps/web/features/scene/spread-fx.tsx` | F4 | Pulses and fizzles from `spread_attempt`, device flashes, room tints |
| `apps/web/features/scene/service-icons.tsx` | F4 | Service icons, "down" badges, event toasts from `sim_event` |
| `apps/web/features/scene/patients-fx.tsx` | F4 | Patient badges, ambulance diversion |
| `apps/web/features/scene/camera.ts` | F4 | Follows the infection front, then a wide shot |
| `apps/web/features/scene/equipment.tsx` | F4 | Key-equipment models |
| `apps/web/features/solution/solution-view.tsx` | F4 | Lockstep split screen, plan on the building, before/after strip, what keeps working |
| `apps/web/features/scene/challenge-menu.tsx` | F4 | **Change conditions** presets |
| `apps/web/components/plan/plan-2d.tsx` | F4 | 2D fallback |
| `apps/web/features/agents/agent-room.tsx` | F1 | Agents tab: agent list and status, conversation thread, round header, recommendations column. Still to add: agent map, message particles, readable pace |
| `apps/web/features/agents/agents.ts`, `agent-icon.tsx` | F1 | Agent names and objectives, message-type shapes, agent icons |
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
| `hippocratech/AGENTVERSE_SETUP.md` | F1 | Laptop steps: register the four agents on Agentverse (mailbox, profiles) and test the Coordinator on ASI:One |

## Invariants

- Spread, impact and patient numbers come only from `sim-core` (`packages/sim-core`), in the module or `hippo-sim`. The browser renders subscribed rows.
- Visible runs advance only through `run_tick`. Reducers make no network calls.
- Every agent message is in `agent_message`. The Agent Room shows only that table.
- `recommendation.status` is written only by `review_submit`. Agent acceptance never sets it.
- Agents touch no real network.
- No secret is readable from client code.
