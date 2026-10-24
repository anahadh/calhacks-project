# Hippocra.tech integration: Phase 1 analysis

> Written on 2026-10-24, before any code changed, as the record for the `demo-v1` integration. Everything here was read from the code at `base/unified-engine` HEAD `73a101d` (the working tree also had untracked `/replay` files from another session, which stay out of this branch). Where the docs and the code disagree, this document follows the code. Test baselines were recorded by read-only piece mappers. The synthesizer re-checked the engine facts in memory and wrote nothing to disk.
>
> **§9 records the decisions taken for demo-v1.** They are already folded into the contracts in §5, so §5 is the frozen spec every package codes against. Where §8 lists an open question, §9 gives the answer.

**Target flow.** A judge picks patient zero and starts the attack. They watch the whole spread: the Python engine computes it, the run watcher feeds it into SpacetimeDB tick by tick through reducers, and every tab subscribes. They press **Create aggregate fix** (`defend_request`), which wakes the uAgents. The agents test policies through the same engine, decide in code, let Claude write only the words, and log every message in `agent_message`. The judge picks a solution and the attack reruns with the plan through the same path. Two tabs on one session must see the same thing.

**Thesis.** Each piece has one typed contract in, one typed contract out, and tests that pass on their own. Integration happens in adapters at the edges, not by reshaping a piece.

---

## 1. The four pieces

### 1.1 Engine: `engine/` (Python package `sim_core`)

This is a deterministic causal engine. It has no RNG, no clock and no I/O on the replay path. Its levels are `clean < footholded < cred_holder < controlled < encrypted`, and medical devices never encrypt. `sim_core/app_bridge.py` (285 lines) translates the app's `hospital.json` into an engine `Scenario` plus a fixed two-event `Campaign` (a tick window with budget 200, then detonation). It runs the replay and maps the result to two outputs: the UI sim rows (`run_session`, served by `POST /app/run`) and the agents' `RunResult` (`to_run_result`, which no transport exposes). The only live caller today is the browser (`apps/web/lib/stdb/engine-session.ts`). The watcher, SpacetimeDB and the agents never call it.

The output is byte-identical across runs and `PYTHONHASHSEED` values (checked ad hoc). Two contracts do not fit the target yet:

- A non-empty engine `Plan` crashes. `to_scenario` never fills `Scenario.levers`, so any lever raises `ValueError('unavailable lever: <id>')` (verified with `edr_servers`).
- The `RunResult` tick axis does not match the UI rows' tick axis.

Filtering `hospital.flows` before calling the engine already works as a policy rerun. Dropping `fl_8` takes the demo from 14 infected devices to 1 (verified).

| | Contract |
|---|---|
| **IN (Python)** | `to_scenario(hospital: dict) -> BridgeResult(scenario, notes: list[str], service_ids: list[str])` (app_bridge.py:92-142). It reads `devices[].{id,type,roomId,os,role}`, `flows[].{from,to,protocol}`, `services[].{id,dependsOnDevices}` and the optional `hospital.{accounts,domains,trusts}`. It ignores `device.vulnerable/vlan/criticality`, `flow.port/protected/active` and `rooms[].zone`. |
| | `to_campaign(patient_zero: str, scenario, *, window=200) -> Campaign` (145-158). It raises `ValueError` if patient zero is unknown or is not an executing Windows non-medical node (149-150). |
| | `run(hospital: dict, patient_zero: str, plan: Plan \| None = None) -> tuple[ReplayResult, BridgeResult]` (161-164) |
| | `run_session(hospital: dict, patient_zero: str, plan: Plan \| None = None) -> dict` (203-282). Raises `KeyError` without `devices[].name`. |
| | `to_run_result(hospital: dict, result: ReplayResult, bridge: BridgeResult) -> dict` (184-200) |
| | `Plan {plan_id: str='baseline', levers: Lever[]}`, `Lever {id: LeverId, zones: dict[str, list[str]], allow: list[(src_zone, dst_zone, port_class)]}` (schema.py:106-132). A Plan never names device or flow ids. |
| **IN (HTTP)** | `POST /app/run` body `AppRunRequest(StrictModel){hospital: dict, patient_zero: str}` (api.py:63-67). Extra keys get 422, so a `plan` field is rejected. Limits: 4,000,000 body bytes, 5,000 devices. |
| | `POST /replay {scenario?|scenario_id?, campaign?|campaign_id?, plan?}` (CUH backtest path), `WS /replay/{cache_key}/trace`, `GET /healthz`, `GET /planner/scenario/{id}` |
| **IN (CLI)** | `hippo-backtest replay|freeze|sensitivity` (canonical Scenario/Campaign/Plan files only; no hospital input) |
| **OUT** | `run_session` returns `{patientZero, finalTick, devices[], services[], patients[], attempts[], events[], snapshots[], chokePoints[], delayedProcedures, assumptions[], encryptedHosts, medicalDevicesEncrypted}`. `devices`: `{deviceId, infected:true, infectedAtTick, infectedBy}` or `{deviceId, infected:false}`. `services`: `{serviceId, down:true, downSinceTick}` or `{serviceId, down:false}`. `patients`: `{groupId, state}`, final state only. `attempts`: `{tick, from, to, flowId, success:true}`. `events`: `{tick, kind: patient_zero\|device_infected\|service_down, targetId, text}`. `snapshots`: `{tick, infectedCount}` for ticks 0..finalTick. |
| | `to_run_result` returns `{ticks, infectedCount, infectedDevices:[{id,tick}], servicesDown:[{id,downSinceTick,ticksDown}], patientCounts:{ok,delayed,disrupted,diverted}, protectedBroken:[], removedFlows:[]}`. It validates against `agents/protocol.py RunResult`. |
| | Errors use one envelope, `{error:{type, detail}}`: 413 `body_too_large`/`too_many_nodes`; 422 `invalid_request`/`invalid_hospital`/`invalid_app_input` |

Demo facts (`data/hospitals/demo.json`, patient zero `mri_2`, re-verified):

- `finalTick` 15, 14 attempts, 20 events, 16 snapshots.
- Attempt 2 is a self-loop, `mri_2 -> mri_2`, and comes with a duplicate `device_infected` event.
- Every attempt's `from` is `mri_2`, and most `flowId`s are `''`.
- The trace has 0 `blocked` entries, so there are no fizzle rows to map.
- Every service goes down at tick 15. `service_down` text uses the id (`svc_mri offline`).
- Patients are `{pg_er: diverted, all others: disrupted}`.
- `to_run_result.ticks` is 28 while `finalTick` is 15. `infectedDevices[].tick` is a trace index (`mri_2` gets 4, not 0). `servicesDown` holds `{downSinceTick:0, ticksDown:1}` placeholders.

| Tests | Command | Baseline |
|---|---|---|
| Full suite | `cd engine && uv run pytest -q` | **113 passed**, 1 warning, 14.6 s (engine/.venv, Python 3.11) |
| Bridge | `uv run pytest -q tests/test_app_bridge.py` | 5 passed |
| Transport | `uv run pytest -q tests/test_api.py` | 16 passed (2 cover `/app/run`) |

**Coverage gaps:** a non-empty plan or policy, active-flow filtering, tick-axis agreement between `run_session` and `to_run_result`, no self-loop attempts, attempts carrying a `flowId`, per-tick patient and service state, and byte-identity for the app path (`test_cross_transport_identity.py` covers only the CUH replay).

### 1.2 Backend: `spacetime/` (SpacetimeDB 2.13 TypeScript module, workspace `hippocratech-module`)

There are 18 tables (schema.ts:14-267): 15 public, plus the private `config`, `run_state` and `tick_timer`. There are 20 client-callable reducers, plus the scheduled `run_tick` and the lifecycle hooks `init` and `on_disconnect`. Today the module is both the state bus and the compute. `run_start`, `run_tick`, `run_step` and `run_reset` call `@hippo/sim-core` inside the reducer (index.ts:12-15, 85-176) and keep sim-core's `SimState`, including the mulberry32 RNG, in `run_state.state_json`. The agent-side reducers are plain row writers with server-identity checks (`requireServer`, schema.ts:296-298) and already fit the target.

| | Contract |
|---|---|
| **IN (reducers)** | `session_create({session_id, hospital_json})` (index.ts:228-240) · `presence_join({session_id,name,role})` · `presence_heartbeat({following})` · `set_presenter` · `config_set_server({identity})` |
| | `run_start({session_id, run_id, label, patient_zero, seed:u32, speed:f64, policy_json, pair_id, autoplay:bool})` (271-306): presenter only. It inserts the `run` row, calls `writeInitial` (sim-core), sets `session.active_run_id` when `pair_id==''`, and starts `tick_timer`. |
| | `run_tick({arg: tick_timer row})` (309-319): scheduled at `TICK_MS/speed` with `TICK_MS=1000`. The guard at 313 is `ctx.senderAuth.isInternal \|\| ctx.sender.isEqual(ctx.identity)`. It advances every running run under the key (lockstep pairs). |
| | `run_pause`/`run_resume`/`run_set_speed`/`run_step`/`run_reset` (325-366): presenter only. Each applies to every run under `pair_id \|\| id`. |
| | `defend_request({session_id})` (agents.ts:21-35): joined humans only. Refused if there is no active run, if it is `running` (27), or if a round is `running`/`waiting_for_human`. It inserts `defend_request_log` with `challenges_json:"[]"` (32). |
| | Server only: `agent_message_add({session_id, round:u32, from_agent, to_agent, type, payload_json, reason, reason_source, direction, fixture:bool})` (38-61; seq is assigned per session) · `agent_status_set({session_id, agent, status})` · `round_state_set({session_id, round:u32, state, detail})` · `question_add({...})` (question.ts:21-43) · `recommendation_upsert({session_id, round:u32, recommendation_json, fixture})` (recommendation.ts; the JSON may carry `option` 1-3: option 1 is `<session>:<round>`, others `<session>:<round>:<option>`; inserts as `draft` and keeps the status on update) |
| | Humans: `question_answer({session_id, question_id, choice})` (question.ts:46-59) · `annotation_add`/`annotation_clear` |
| **OUT (public rows)** | `run {id PK, session_id, pair_id, label, seed:u32, patient_zero, policy_json, tick:u32, status: running\|paused\|done, speed:f64, patients_affected:u32, devices_compromised:u32, services_down:u32, delayed_procedures:u32, choke_points_json, protected_broken_json, started_at}` (schema.ts:36-57) |
| | `device_state {id "${run}:${dev}", run_id, device_id, infected, infected_at_tick:i32 (-1 = none), infected_by ('' = none)}` · `service_state {…, down, down_since_tick:i32}` · `patient_state {…, state}` · `spread_attempt {id:u64 autoInc, run_id, tick:u32, from_device, to_device, flow_id, success}`, pruned after `KEEP_ATTEMPT_TICKS=2` · `sim_event {id:u64, run_id, tick, kind, target_id, text}` · `tick_snapshot {id "${run}:${tick}", run_id, tick, infected_count, patients_affected, infected_ids_json, services_down_json, patients_json}` |
| | `session {…, hospital_json, presenter, active_run_id, round_state, round, round_detail}` · `defend_request_log` · `agent_message` · `agent_status` · `question` · `recommendation {id "${session}:${round}", policy_json, verified_json, verdicts_json, required_roles_json, fixture, status: draft\|ready}` |
| **Generated bindings** | `apps/web/lib/stdb/module_bindings/` (spacetime CLI 2.13.0): 15 public tables and 20 reducers, in sync with `schema.ts`. **The watcher imports them too** (`apps/watcher/src/stdb.ts:6`). |

Not present in code, although the spec and AGENTS.md name them: `review_submit`, `memo_save_draft`, `memo_approve`, `challenge_add`, `run_seek`, `solution_start`.

| Tests | Command | Baseline |
|---|---|---|
| Typecheck | `npm run typecheck -w hippocratech-module` | exit 0 |
| Unit | `npm run test -w hippocratech-module` | **19 passed, 1 skipped** (`live.integration.test.ts`, which needs `STDB_URI`) |
| sim-core | `npm run typecheck -w @hippo/sim-core`; `npm run test -w @hippo/sim-core` | exit 0; 8 passed |

**Coverage gaps:** the core run test is not contract-only. Its oracle is sim-core `runToEnd` (module.test.ts:64-77). The harness calls reducer functions directly, so BSATN argument serialization is never exercised. Untested: `run_start` validation branches, `sim_event` contents, the JSON columns, `set_presenter`, `config_set_server`.

### 1.3 Agents: `agents/` (Fetch.ai uAgents, Python 3.12.4 in `agents/.venv`)

Four processes: `inventory` on :8001, `flow` on :8002, `clinical_workflow` on :8003 and `coordinator` on :8004 (`agents/run_all.py`). Each round is a pure state machine (`agents/logic/coordinator.py Round`). Every decision is a deterministic function in `agents/logic/`, and those functions read only `RunResult.{removedFlows, protectedBroken, infectedDevices[].tick, servicesDown[].ticksDown, infectedCount, patientCounts.ok}` plus a static hospital index. Claude (`llm.py`) writes only `reason`, `text` and `explanation`; a code check rejects invented numbers and forbidden words, with a labeled template as fallback.

Every message is relayed before it is sent and again when it is received (`runtime.send`/`received` → `tools.relay`). **No engine is connected.** `tools.run_sim` (tools.py:41-73) runs a `hippo-sim` binary that does not exist anywhere in the repo. In practice the numbers come from hand-written sim-core-era fixtures (`HIPPO_SIM_FIXTURES=1`). Candidates come from `fixtures/candidates/*.json` because `hippo-opt` does not exist either.

| | Contract |
|---|---|
| **IN (REST, Coordinator :8004)** | `POST /start_round` with `StartRound {sessionId, runId, patientZero, seed:int, challenges: ChallengeId[] = []}` (protocol.py:264-271), returns `RestAck {ok, detail?}` · `POST /resume` with `Resume {sessionId, questionId, choice, author, role: security\|clinical_engineering\|operations}` · `POST /reassess` (stub that always returns `ok:false`, coordinator.py:119-121) |
| **IN (engine edge)** | `run_sim(candidate: Candidate \| None, patient_zero, seed, challenges=()) -> RunResult` runs `[HIPPO_SIM_BIN, '--hospital', HOSPITAL_PATH, '--patient-zero', pz, '--seed', str(seed), ('--policy', <file>)?, ('--challenge', c)*]` (tools.py:57-63). stdout must be one strict `RunResult`; a non-zero exit raises `ToolError(stderr[:500])`; the timeout is 60 s. `HIPPO_SIM_BIN` must be a single executable path. |
| | `Policy {strategy, name, rules: PolicyRule[<=40], rationale, tradeoff}`, `PolicyRule {id, from: Selector, to: Selector, protocol?, port?, plain}`, `Selector {zone?, deviceType?, role?, vlan?}` (protocol.py:63-100); `Candidate {id: ^[a-z0-9_]{1,60}$, policy}` |
| | `RunResult {ticks, infectedCount, infectedDevices:[{id,tick}], servicesDown:[{id,downSinceTick,ticksDown}], patientCounts:{ok,delayed,disrupted,diverted}, protectedBroken:[str], removedFlows:[str]}`, strict |
| **OUT (relay)** | `POST {WATCHER_RELAY_URL}/agent_message` with `Authorization: Bearer $RELAY_TOKEN` and body `{sessionId, round, from, to, type, payload, reason, reasonSource, createdAt, direction, fixture}` (`seq` is popped, tools.py:190) · `POST …/agent_status {sessionId, agent, status, updatedAt, fixture}`. Without `WATCHER_RELAY_URL` the rows go to `agents/logs/<session>.jsonl`, which is the state today: `agents/.env` sets neither `WATCHER_RELAY_URL` nor `RELAY_TOKEN`. |
| | Payloads: `round_state` (`RoundState`), `question` (`Question`), `recommendation` (`Recommendation {policy, testResult: RunResult, verdicts, explanation, requiredRoles, explanationSource}`). The last carries no patientZero, runId or challenges. |

| Tests | Command | Baseline |
|---|---|---|
| Unit | `cd agents && PYTHONDONTWRITEBYTECODE=1 .venv/bin/python -m pytest -q -p no:cacheprovider --ignore=tests/test_live_round.py` | **155 passed**, 1 warning, 11.5 s |

`test_live_round.py` is not auto-skipped. It binds ports 8001-8004, which other sessions hold, so always pass `--ignore`.

**Coverage gaps:** nothing tests the real `HIPPO_SIM_BIN` subprocess path or the HTTP relay mode. Nothing ties `RunResult` to the engine, or checks that a recommendation's `testResult` equals a rerun of its policy.

### 1.4 UI: `apps/web/` (Next.js 14.2.15, workspace `web`)

There is one real route, `/s/[sessionId]` (`session-view.tsx`, with Simulation and Agents tabs); `/` redirects to `/s/demo`. Data comes from `useSession` (use-session.ts:15), chosen at build time. With `NEXT_PUBLIC_STDB_URI` set, `live-session.ts` subscribes to rows and calls reducers. Without it, `useEngineSession` POSTs `mockSession.hospital` to `/app/run` once, overlays the result on `mockSession` (keeping the mock presence, round and agent messages), and falls back silently to a baked JSON.

The browser never simulates spread. It does recompute headline totals the run row already carries (impact.tsx:10-14, counters.tsx:9-14, agent-room.tsx:25-29). Many demo controls are not wired:

- no patient-zero pick (`components/scene/devices.tsx` has no `onClick`)
- no step or reset button
- `spread_attempt` rows are rendered nowhere, so there are no pulses
- "Show the solution", "Skip to result", "Change conditions", 3D/2D and "Log" do nothing
- there is no solution route

The untracked `/replay` route (`app/replay`, `components/propagation`, `lib/propagation`, `public/propagation-runs`) is a separate CUH backtest viewer that POSTs `/replay` directly. It belongs to another session.

| | Contract |
|---|---|
| **IN** | `SessionSnapshot` (types.ts:135-163): `{hospital, runs: RunRow[], activeRunId, presenterName, devices, services, patients, attempts, events, snapshots, chokePoints, delayedProcedures, presence, roundState, agentStatus, messages, annotations, questions, recommendations, me?, source: 'mock'\|'connecting'\|'live'\|'missing'\|'error', error?, isPresenter, actions}` |
| | `RunRow {id, label, patientZero, seed, tick, status: 'running'\|'paused'\|'done', speed}` (types.ts:86-94). The live mapping drops `pairId`, `policyJson`, `patientsAffected`, `devicesCompromised`, `servicesDown` and `protectedBrokenJson` (live-session.ts:146-149). |
| | Live subscriptions: 8 session-scoped tables `WHERE session_id = '<sid>'` (live-session.ts:91-100), plus 6 sim tables `WHERE run_id = '<active_run_id>'` (123-127). Runs are filtered to `pairId === ''` (145). |
| **OUT** | `runStart({sessionId, runId: run_${Date.now().toString(36)}, label:'Baseline', patientZero, seed:1337, speed, policyJson:'', pairId:'', autoplay:true})` (227-233) · `runResume`/`runPause`/`runStep`/`runReset`/`runSetSpeed` · `presenceJoin` · `annotationAdd`/`annotationClear` · `defendRequest({sessionId})` · `questionAnswer` |
| | Engine mode: `POST ${NEXT_PUBLIC_ENGINE_URL ?? 'http://localhost:8000'}/app/run {hospital: mockSession.hospital, patient_zero:'mri_2'}` (engine-session.ts:50-54) |

| Tests | Command | Baseline |
|---|---|---|
| Typecheck | `cd apps/web && npx tsc --noEmit --incremental false -p tsconfig.json` (same check as `npm run typecheck -w web`) | exit 0, 0 errors |
| Unit | `npm run test -w web --if-present` | none: the workspace has no test script and no test files |

Confirmed bugs:

1. `IDLE_RUN.id === ''` (live-session.ts:21) matches `activeRunId ''` (169). `defendBlocker` (defend-button.tsx:8) then "finds" a paused run before any run exists, so the hint "Click a device…" never shows.
2. `timeline.tsx:35` runs `Math.max(...[])`, which is `-Infinity` before any events.

---

## 2. The edges

### 2.1 Watcher (`apps/watcher`, one Node process, `tsx src/index.ts`)

**Wired today:**

| Edge | Where | What |
|---|---|---|
| SpacetimeDB connection | `stdb.ts:17-31` | Server identity via `withToken(STDB_SERVER_TOKEN)`. `process.exit(1)` on disconnect (25-28), with no reconnect. |
| Subscription | `stdb.ts:40` | Only `SELECT * FROM session`, `defend_request_log` and `question`. **Not `run`.** |
| Reducer surface | `stdb.ts:10-13` | `ServerReducers = Pick<…, "agentMessageAdd" \| "agentStatusSet" \| "questionAdd" \| "recommendationUpsert" \| "roundStateSet">` |
| Round watcher | `round.ts:10-21` | `defendRequestLog.onInsert` → `POST ${COORDINATOR_URL}/start_round {sessionId, runId, patientZero, seed, challenges: JSON.parse(challengesJson)}`. The parse is unguarded (14). |
| Answer watcher | `answer.ts:8-17` | `question.onUpdate`, when `answered` flips false→true → `POST /resume` |
| Coordinator client | `coordinator.ts:13-30` | Never throws; strict zod `RestAck`; 120 s timeout |
| Relay | `relay.ts:90-181` | `POST /agent_message`, `/agent_status` with bearer `RELAY_TOKEN`, on `127.0.0.1:RELAY_PORT` (default 8010). Calls `agentMessageAdd`, then `questionAdd`/`roundStateSet`/`recommendationUpsert` from the sender's copy only. A reducer refusal returns 502. |
| Error surfacing | `stdb.ts:53-62` | `reportError` writes `session.round_detail` through `roundStateSet` and leaves the state as it is |
| Config | `config.ts:19-30` | `STDB_URI`, `STDB_SERVER_TOKEN`, `RELAY_TOKEN` required; `STDB_MODULE`, `COORDINATOR_URL` (default `http://127.0.0.1:8004`) and `RELAY_PORT` optional. **No engine URL.** |

**Not wired:** no run driver exists. No engine client exists. Nothing writes engine output into SpacetimeDB. One known defect: relay.ts:92 calls `agentMessageAdd` *before* the side-effect payload is validated (101/107/110). A bad payload therefore stores the message row, and the agent then receives 400 and believes nothing was sent.

**Tests:** `npm run test -w watcher` gives **7 passed, 2 skipped** (`live.integration.test.ts` needs `E2E_STDB_URI`). `npm run typecheck -w watcher` exits 0. Only the relay is unit-tested; `round.ts`, `answer.ts`, `coordinator.ts` and `config.ts` have no tests.

### 2.2 Web data layer (`apps/web/lib/stdb`)

| Path | Status |
|---|---|
| `use-session.ts:11,15` | `useSession = STDB_URI ? useLiveSession : useMock`, where `useMock = useEngineSession()` |
| `engine-session.ts:46-66` | The direct browser → engine call. Errors are swallowed (59-61) and the baked `engine-demo-session.json` (deep-equal to `run_session(demo,'mri_2')` today) stays on screen. `source` stays `'mock'`, and mock agent rows are shown next to engine rows. This breaks rules 14 and 16. |
| `live-session.ts` | The correct live path. It creates the `demo` session from `data/hospitals/demo.json` on first visit (79), and that visitor becomes the presenter. |
| `connection.ts:9-10` | `NEXT_PUBLIC_STDB_URI`, `NEXT_PUBLIC_STDB_MODULE` (default `hippocratech`); token in localStorage |
| `agent-rows.ts` | Reshapes agent rows. It reads `RunResult.patientCounts` and `verifiedJson`. |

### 2.3 Agents ↔ engine and agents ↔ SpacetimeDB

- **Agents → engine:** not wired (§1.3). `HIPPO_SIM_BIN` is unset and no binary exists.
- **Agents → relay → SpacetimeDB:** the code is wired, but `agents/.env` does not point at the relay, so rows only reach `agents/logs/*.jsonl`. The row shapes match the watcher's strict zod schemas exactly.
- **Hospital parity:** the live session uses `data/hospitals/demo.json` (48 devices, 55 flows). The agents load `agents/fixtures/hospital.json` (49 devices, 56 flows: demo.json plus `dev_unknown_7` and `fl_unknown_7_smb` with `active:false`). Every other id is identical.

---

## 3. sim-core retirement

`packages/sim-core` (`@hippo/sim-core`) is the only code that must leave. `packages/hippo-sim` never existed. Every dependency and its replacement:

| Dependency | Location | Replacement |
|---|---|---|
| Module import of `initialState, isSettled, protectedBroken, step, summarize` and types `Hospital, HospitalFile, Policy, SimState, StepResult` | `spacetime/src/index.ts:12-15` | Removed. The module stores and reveals engine frames (§5b). Types `Hospital`/`HospitalFile` move to a local `spacetime/src/hospital.ts` (types only). |
| `hospitalOf` / `validateHospital` / `annotation_add` typing | index.ts:47-49, 182-206, 377 | `spacetime/src/hospital.ts` |
| `policyOf` (parses `run.policy_json` as a sim-core `Policy`) | index.ts:51-53 | Removed. The module treats `policy_json` as opaque (it only checks that it is valid JSON). |
| `writeInitial` / `writeTickOutputs` / `advance` (sim-core compute) | index.ts:85-176 | `applyFrame(ctx, run, frame)` in a new `spacetime/src/ingest.ts`. It does the same eight writes, but from an engine `TickFrame`. |
| `run_start` → `protectedBroken(h, policy)` | index.ts:282-295 | `protected_broken_json` arrives with frame 0 from the engine |
| `run_reset` → `writeInitial` | index.ts:355-366 | Reset sets status back to `requested`, and the watcher recomputes (the engine is deterministic) |
| Private `run_state` (holds `SimState` and the RNG) | schema.ts:60-63 | Deleted |
| Scheduled `tick_timer` + `run_tick` | schema.ts:66-73, index.ts:59-74, 309-319 | Deleted. The run watcher paces ticks and calls `run_frames_apply` (§5b, §5c). |
| `"@hippo/sim-core": "*"` | spacetime/package.json:14, root package-lock.json | Removed; regenerate the lock |
| Module test oracle `runToEnd` | spacetime/test/module.test.ts:4, 64-77, 115-127 | A checked-in engine frames fixture, `spacetime/test/fixtures/frames.demo.mri_2.json` |
| Live test oracle | spacetime/test/live.integration.test.ts:12, 46, 72 | The same fixture |
| Committed `dist/bundle.js` (inlines sim-core) | spacetime/dist/bundle.js | Rebuilt by `spacetime publish`; until then, stale and flagged |
| Policy semantics (`keptFlowIds`, `protectedBroken`) | packages/sim-core/src/policy.ts:16-43 | `engine/sim_core/app_policy.py` (§5a), a line-for-line port |
| Challenge semantics (`extraActiveFlowIds`, skipping `active:false` flows) | packages/sim-core/src/engine.ts:41-47, 54-56 | `app_policy.apply_policy(..., challenges)` (§5a) |
| `hippo-sim` CLI expected by the agents | agents/tools.py:57 | Console script `hippo-sim = sim_core.app_cli:main` in `engine/pyproject.toml` (§5a). The name passes to the engine. |
| Agent fixture numbers (sim-core semantics: 48 ticks, 16 infected) | agents/fixtures/results/*.json, agents/tests/test_runtime.py:101-126 | Regenerated through the engine `hippo-sim`; the invariant test is rewritten to the engine's semantics |
| `agents/fixtures/hospital.json` generated from `mock-session.ts` | agents/scripts/export_fixture.mjs:19 | Agents point at `data/hospitals/demo.json` instead (§5d). The script and the generated fixture are retired. |
| Patient escalation by duration (`DELAYED_AFTER=1`, `DISRUPTED_AFTER=4`, `DIVERTED_AFTER=6`) and `MAX_TICKS=48` | sim-core engine.ts:21-23, run.ts:7 | No counterpart. Per-tick patient states come from the engine's frames (§5a). Duration escalation is an open question (§8). |
| `seed` (mulberry32) | `run.seed`, `defend_request_log.seed`, `StartRound.seed`, `live-session.ts:21,231` | Kept as accepted and ignored, for contract compatibility (rule 6 rewrite) |
| UI copy "hippo-sim" | features/agents/agents.ts:5, agent-room.tsx:118, features/policy/card-body.tsx:50 | "the engine" |
| UI cadence assumptions (`SPAN_TICKS=48`, `tickClock` at 15 min/tick) | components/timeline.tsx, lib/format.ts | `SPAN_TICKS` = `run.final_tick`; the clock label becomes "step N" (open question §8) |
| Docs (§6) | AGENTS.md, CODE_REFERENCE.md, HOSPITAL_SCHEMA.md, engine.md, TEAM_BRIEF.md, README.md, Hippocratech.md | Rewritten |
| The package itself | packages/sim-core/**, the root workspaces entry, the node_modules symlink | Deleted last (Phase 3, I5), after nothing imports it |

The watcher, the web app and the agents have **no direct import** of sim-core.

---

## 4. Gaps to the target flow

Numbered in flow order. "Owner" names the piece or edge that holds the fix.

| # | Gap | Owner |
|---|---|---|
| G1 | No run driver: nothing calls the engine for a visible run or writes its rows into SpacetimeDB. The watcher does not subscribe to `run` (stdb.ts:40). | Watcher (new `run.ts`, `engine.ts`) |
| G2 | No ingestion reducers. Run rows are produced only by in-module sim-core. | Backend (`ingest.ts`) |
| G3 | The engine has no per-tick frames. `run_session` gives final patient states only, and `tick_snapshot` needs `patients_affected/infected_ids_json/services_down_json/patients_json` per tick. The comment at app_bridge.py:168-170 assigns tick-accurate escalation to the watcher, which would break "one engine". | Engine (`app_bridge.run_session` emits `frames`) |
| G4 | Engine row quality the UI exposes: (a) a self-attempt `mri_2→mri_2` and a duplicate event; (b) attempts with `flowId ''` and every `infectedBy` naming `mri_2`, so no flow can carry a pulse (rule 16) and choke points read `mri_2: 1.0`; (c) no `success:false` rows (the demo trace has 0 blocked entries); (d) `service_down` text uses ids, not names; (e) `delayedProcedures` counts groups that are not ok, while the column has meant patients in delayed procedures. | Engine (app_bridge row mapping only, so `ReplayResult` bytes and the CUH fixtures don't change) |
| G5 | The engine has no app-level policy or challenge input. An engine `Plan` cannot express the agents' deviceType/role/vlan/port selectors, and a non-empty Plan crashes anyway. `active:false` flows are linked (app_bridge.py:98-103). | Engine edge (`app_policy.py`) |
| G6 | The `/app/run` transport has no policy or challenges field, and nothing transports a `RunResult`. | Engine (new endpoints + CLI) |
| G7 | The `RunResult` tick axis disagrees with the visible run (`ticks` 28 vs `finalTick` 15; trace-index ticks; placeholder `servicesDown`), and `protectedBroken`/`removedFlows` are hardcoded `[]` (app_bridge.py:198-199). Under this, Clinical never rejects and the negotiation collapses. | Engine (`to_run_result(session)`) |
| G8 | Run status has no "computing" or "error" states and no place to put an engine refusal (for example a patient zero that is not Windows). | Backend (`requested`/`error`, `run.detail`) + Watcher (`run_fail`) |
| G9 | `defend_request` refuses only `running` (agents.ts:27). It must also refuse `requested`, and refuse when any run in the session, including pair runs, is `requested` or `running` (rule 5). | Backend |
| G10 | The UI's direct `/app/run` call and silent baked fallback (engine-session.ts) break rules 14 and 16. Mock agent, presence and round rows sit next to engine rows. | UI |
| G11 | No patient-zero pick; `IDLE_RUN` matches "no run"; the empty-beat `-Infinity`; no step/reset controls; dead buttons. | UI |
| G12 | No spread visuals: `spread_attempt` is rendered nowhere, so there are no pulses or fizzles. | UI (`features/scene/spread-fx.tsx`) |
| G13 | The browser recomputes totals the run row carries. | UI |
| G14 | Agents are not connected to the engine (`HIPPO_SIM_BIN` unset, no binary). | Engine (CLI) + Agents (config only) |
| G15 | The relay is not pointed at SpacetimeDB (`WATCHER_RELAY_URL`/`RELAY_TOKEN` unset in agents/.env). | Agents (config) |
| G16 | Hospital mismatch between the session (demo.json) and the agents (fixtures/hospital.json). | Agents (config) + data |
| G17 | Agent fixture results are sim-core numbers that disagree with the engine (16 vs 14 infected baseline). | Agents |
| G18 | No "pick solution → rerun" reducer. `solution_start` is planned but missing, `run_start` from the UI hardcodes `policyJson:''`, and a plain rerun would flip `active_run_id` and corrupt the Agent Room's baseline. | Backend (`solution.ts`) + UI |
| G19 | The UI can't show two runs: runs with `pairId !== ''` are dropped, and sim rows are subscribed for `active_run_id` only. | UI (`useRunRows(runId)`) |
| G20 | Questions need a challenge, but `defend_request` hardcodes `challenges_json:"[]"` and there is no `challenge_add`. Without it, Inventory never asks a human on the demo hospital. | Backend (optional for demo-v1, §8) |
| G21 | Docs describe two engines and sim-core rules (§6). | Docs |
| G22 | Rule 6 has no replacement test: nothing tests app-path determinism or agent/screen parity. | Engine (determinism, parity) + Backend (fixture replay) |
| G23 | Two-tab proof is impossible on this machine: the `spacetime` CLI is not installed. | Environment (§8) |

---

## 5. Contract decisions

The common rule for every edge: the engine computes, the module stores and reveals, the watcher forwards, the agents read numbers, and the UI renders. **The watcher computes nothing.** It does not slice rows, escalate patients or translate policies; it moves engine frames into reducers on a clock.

### 5a. Engine (`engine/sim_core`)

**New edge module `sim_core/app_policy.py`.** This is the agents-Policy adapter. It lives in the engine so that removed flows and broken protected flows count as engine output (rule 3), and so the agents' test runs and the visible rerun share one function.

```python
class AppliedPolicy(NamedTuple):
    hospital: dict              # the hospital with only active, kept flows
    removed_flows: list[str]    # active flows the policy removed, in hospital file order
    protected_broken: list[str] # removed ∩ protected, in file order

SUPPORTED_CHALLENGES = ("unknown_device_imaging",)

def apply_policy(hospital: dict, policy: dict | None = None, challenges: Sequence[str] = ()) -> AppliedPolicy: ...
```

- **Active flows:** `active is not False`. With `unknown_device_imaging`, add the inactive flows that touch a device of type `"unknown"`. This mirrors `agents/logic/inventory.py device_flows` and sim-core's `extraActiveFlowIds`.
- **Kept flows:** with `policy is None`, every active flow is kept. Otherwise a flow is kept iff some rule matches: `protocol` (omitted = any), `port` (omitted = any), the `from` selector against `flow.from`, and the `to` selector against `flow.to`. `zone` is `rooms[roomId].zone`, plus `deviceType`, `role` and `vlan`. This is a line-for-line port of `packages/sim-core/src/policy.ts:16-43`.
- **Validation:** `policy` is validated by a strict local pydantic v2 model `AppPolicy`, which mirrors `agents/protocol.py Policy` with `extra="forbid"` and the `from` alias. A selector naming a zone, type, role or vlan the hospital lacks raises `ValueError("unknown <field> '<v>' in rule <id>")`, as HOSPITAL_SCHEMA.md "Policy" requires. An unsupported challenge raises `ValueError`.
- **Already verified in memory:** this reproduces the agents' fixture `removedFlows` and `protectedBroken` exactly for all three candidates (`cand_isolate_imaging`, `cand_keep_scans`, `cand_unknown_cut`).

**`app_bridge` changes.** These are additive. `run(hospital, pz, plan)` and `to_scenario` keep their signatures and stay as the engine-native, lever-based path used for backtests.

```python
def run_session(hospital: dict, patient_zero: str, plan: Plan | None = None, *,
                policy: dict | None = None, challenges: Sequence[str] = ()) -> dict
    # = apply_policy(...) → run(applied.hospital, pz, plan) → one timeline → rows
def to_run_result(session: dict) -> dict         # pure: run_session output → agents' RunResult
def run_result(hospital: dict, patient_zero: str, *, policy: dict | None = None,
               challenges: Sequence[str] = ()) -> dict   # = to_run_result(run_session(...))
```

`to_run_result` keeps its name (it is the user-named contract) but changes signature: it now takes the `run_session` output, so the agents' numbers are derived from exactly the rows the screen shows. The old `to_run_result(hospital, result, bridge)` form is **removed**; keeping a second, inconsistent `RunResult` mapping would be a trap. Its one test moves to the new form.

The `run_session` output keeps every existing key and adds four: `frames`, `removedFlows`, `protectedBroken` and `finalTick` (unchanged meaning). The added top level is:

```jsonc
{
  "patientZero": "mri_2",
  "finalTick": 15,
  "removedFlows": ["fl_8", "…"],       // [] with no policy
  "protectedBroken": [],
  "assumptions": ["[S] …"],
  "frames": [ TickFrame, … ],          // exactly finalTick + 1 entries, ticks 0..finalTick
  // existing keys unchanged: devices, services, patients, attempts, events, snapshots,
  // chokePoints, delayedProcedures, encryptedHosts, medicalDevicesEncrypted
}
```

**`TickFrame`** is the one contract the engine, watcher and module share. It goes into HOSPITAL_SCHEMA.md as "Run frames".

```jsonc
{
  "tick": 3,                          // 0..finalTick, contiguous
  "final": false,                     // true only on tick == finalTick
  "devices":  [ { "deviceId": "ws_lab", "infected": true, "infectedAtTick": 3, "infectedBy": "ws_img_1" } ],
                                      // tick 0: EVERY hospital device; later: only devices that changed this tick
                                      // not infected: { "infected": false, "infectedAtTick": -1, "infectedBy": "" }
  "services": [ { "serviceId": "svc_mri", "down": true, "downSinceTick": 15 } ],   // tick 0: every service; up = down:false, downSinceTick:-1
  "patients": [ { "groupId": "pg_er", "state": "diverted" } ],                    // tick 0: every group; later: changed only
  "attempts": [ { "from": "ws_img_1", "to": "ws_lab", "flowId": "fl_12", "success": true } ],
  "events":   [ { "kind": "device_infected", "targetId": "ws_lab", "text": "Lab workstation compromised" } ],
  "snapshot": { "infectedCount": 4, "patientsAffected": 0,
                "infectedIds": ["…sorted"], "servicesDown": ["…sorted"], "patients": { "pg_er": "ok" } },
  "summary":  { "patientsAffected": 0, "devicesCompromised": 4, "servicesDown": 0,
                "delayedProcedures": 0, "chokePoints": [ { "deviceId": "ws_img_1", "share": 0.5 } ] },
  "run":      { "finalTick": 15, "removedFlows": [], "protectedBroken": [], "assumptions": ["[S] …"] }
                                      // present on tick 0 only
}
```

Frame rules, which are engine-owned and tested in the engine suite:

- A patient's per-tick state comes from that tick's service state, using the same mapping as today's final state. Services fail at detonation, so groups are `ok` before `finalTick` and take their final state at `finalTick`. This replaces the watcher-escalation comment at app_bridge.py:168-170.
- No self-attempts. Patient zero appears only in the tick-0 `patient_zero` event.
- `service_down` text uses `services[].name`. A `diversion` event is emitted at the tick an `er` group becomes `diverted`, with `targetId` set to the group's `roomId`.
- Every successful attempt names a hospital `flowId` that joins `from` and `to`. When the engine's move does not follow a single direct flow, the row mapping emits one attempt per hop along hospital flows, with `infectedBy` set to the adjacent hop. This is done in `app_bridge` only; `engine.py` is untouched.
- `delayedProcedures` = the sum of `count` over groups of type `outpatient_scan`/`surgical` whose state is not `ok`. This matches the column's existing meaning (decided, §9 Q5).
- **Blocked attempts (`success:false`), decided in §9 Q3.** The engine never traverses a connection the policy removed, so it has no native "blocked" step for one. The row mapping in `app_bridge` (the engine's edge, never `engine.py`) emits one `{from, to, flowId, success:false}` attempt for each **removed** flow whose `from` device is compromised in the run and whose protocol is one the engine's lateral reach uses (`smb`/`rdp`, the admin-class links the bridge maps). The tick is the one at which `from` became compromised. Each such row is disclosed by one `[S]` note in `assumptions` ("A blocked attempt marks a connection the plan removed, out of a compromised device"). No policy gives no blocked rows. The UI draws these as fizzles at the cut; it also draws every removed flow from `run.removed_flows_json` as a cut connection.
- `infectedBy` stays the engine's acting device (the trace entry's `source`). When the engine's move reaches a device without a single direct hospital flow, the attempt rows for that tick trace the hop path along real hospital flows (a deterministic shortest path over the links of the port class the move used, ties broken by flow file order), so every pulse runs along a real `flowId`. `chokePoints` are computed from those hop paths (the share of successful infections whose path crosses a device, patient zero excluded), not from `infectedBy` alone.
- **Lever plans.** `run(hospital, pz, plan)` must not crash on a non-empty `Plan`. Either `to_scenario` declares the levers that are meaningful on an app hospital (documented and tested), or `run` rejects a lever plan with a clear `ValueError` naming the lever, which the transports return as `422 invalid_plan`. The app flow uses `policy=`; lever plans stay the backtest path.

**Entry points (decided, §9 Q4).** `entry_points(hospital: dict) -> list[str]` returns, in hospital file order, the device ids the engine accepts as patient zero (the same check `to_campaign` makes). The UI dims every other device, so a judge can only pick an attack the engine will run. Transport: `POST /app/entry_points {hospital}` → `{"entryPoints": [ids]}`.

**Transports.** `/app/run` is not reshaped; it is removed with the browser call in Phase 3 (I2).

| Transport | Contract |
|---|---|
| `POST /app/session` | Request strict `AppSessionRequest {hospital: dict, patient_zero: str, policy: dict \| None = None, challenges: list[str] = []}`. 200 returns the `run_session` output above. Errors use the existing envelope: 413 `body_too_large`/`too_many_nodes`; 422 `invalid_request`, `invalid_hospital`, `invalid_policy` (an `apply_policy` ValueError), `invalid_app_input` (for example a refused patient zero, with the engine's message verbatim). |
| `POST /app/run_result` | Same request. 200 returns `RunResult` exactly (7 keys). This is the HTTP twin of the CLI, for future callers; the agents use the CLI. |
| `POST /app/entry_points` | Request strict `{hospital: dict}`. 200 returns `{"entryPoints": [deviceId, …]}` in file order. Same error envelope. |
| CLI `hippo-sim` | `[project.scripts] hippo-sim = "sim_core.app_cli:main"` in `engine/pyproject.toml`, landing at `engine/.venv/bin/hippo-sim`. Argv matches agents/tools.py:57 exactly: `--hospital PATH` (a `{schemaVersion:1, hospital}` file), `--patient-zero ID`, `--seed N` (accepted and ignored), `[--policy FILE]` (by-alias Policy JSON), `[--challenge ID]*`. stdout carries exactly one `RunResult` JSON object; errors exit 2 with one line on stderr. `hippo-backtest` is unchanged. |
| Server port | The engine server runs on **:8000** (`uv run uvicorn sim_core.api:app --port 8000`); the watcher's `ENGINE_URL` defaults to `http://127.0.0.1:8000`. |

**Determinism contract.** For the same `(hospital, patient_zero, policy, challenges)`, `run_session` and `run_result` are byte-identical (`json.dumps(sort_keys=False)`) across processes, `PYTHONHASHSEED` values, the Python call, `POST /app/session` and `hippo-sim`. **Parity:** `run_result(x) == to_run_result(run_session(x))`, so the agents' numbers equal the visible run's.

### 5b. Backend (`spacetime/src`)

**Decision: the watcher drives tick by tick** (the user's wording). The module stores and reveals; it never computes. `tick_timer`, `run_tick` and `run_state` are deleted.

**`run` table: new columns,** each with a default so an existing database can migrate:

```ts
final_tick:          t.u32().default(0),
detail:              t.string().default(""),     // engine/watcher error (rule 14); never session.round_detail
autoplay:            t.bool().default(false),
step_pending:        t.bool().default(false),    // presenter asked for one step while paused
challenges_json:     t.string().default("[]"),
removed_flows_json:  t.string().default("[]"),
assumptions_json:    t.string().default("[]"),   // engine's [S] notes, shown in the UI
recommendation_id:   t.string().default(""),     // set on a solution rerun
```

`status` takes `requested | running | paused | done | error`.

**`session` table: new columns** (defaults, so an existing database can migrate):

```ts
entry_points_json:   t.string().default("[]"),   // engine-provided legal patient zeros (§5a Entry points)
solution_pair_id:    t.string().default(""),     // the pair the solution view shows; every tab follows it
```

**Status machine**

```
run_start / solution_start / run_reset ──► requested ──(watcher: frame 0 via run_frames_apply)──► running | paused  (by autoplay)
requested ──(watcher: run_fail)──► error
running ──run_pause──► paused ──run_resume──► running
paused ──run_step──► paused + step_pending ──(watcher applies one frame)──► paused
running|paused ──(frame.final)──► done
any (except requested) ──run_reset──► requested (tick 0, rows cleared, autoplay false)
```

**Reducers**

| Reducer | Auth | Args | Behavior |
|---|---|---|---|
| `run_start` | presenter | **unchanged**: `{session_id, run_id, label, patient_zero, seed:u32, speed:f64, policy_json, pair_id, autoplay:bool}` | Validates as today (unique id, speed in `SPEEDS`, patient zero exists, `policy_json` is `''` or valid JSON). Inserts the run with `status:'requested'`, `tick:0`, `autoplay`, `challenges_json:'[]'`. Writes **no** state rows and starts no timer. Sets `session.active_run_id` when `pair_id===''`. |
| `run_frames_apply` *(new, `ingest.ts`)* | **server only** | `{frames_json: t.string()}` holding `[{ "runId": string, "frame": TickFrame }]` | Applied in one transaction, so pairs advance atomically. Checks for each item: the run exists; `frame.tick===0` iff `run.status==='requested'`, and then `frame.run` is required; otherwise `frame.tick===run.tick+1` and (`status==='running'` or `step_pending`); every id exists in `session.hospital_json`; tick 0 covers every device, service and group. Total size ≤ 256 KiB. Writes the same eight outputs as today's `writeTickOutputs` (index.ts:110-165): device/service/patient INSERT at tick 0 or UPDATE later; `spread_attempt` prune (`KEEP_ATTEMPT_TICKS`) + insert; `sim_event` insert; `tick_snapshot` insert; `run` update (`tick`, summary columns, `choke_points_json`, `step_pending:false`, and on tick 0 `final_tick`/`protected_broken_json`/`removed_flows_json`/`assumptions_json` with `status: autoplay?'running':'paused'`; `status:'done'` on `final`). |
| `run_fail` *(new)* | **server only** | `{run_id, detail}` | Sets `status:'error'` and `detail.slice(0,500)`. |
| `run_pause` / `run_resume` / `run_set_speed` | presenter | unchanged | Change only `status`/`speed` across the key `pair_id \|\| id`. `run_resume` refuses `done`, `error` and `requested`. No timer. |
| `run_step` | presenter | unchanged | Refuses unless `paused`; sets `step_pending:true` across the key. |
| `run_reset` | presenter | unchanged | Deletes the 6 public row sets for each run under the key, sets `tick:0, status:'requested', autoplay:false, step_pending:false, detail:''`. The watcher recomputes. |
| `solution_start` *(new, `solution.ts`)* | presenter | `{session_id, recommendation_id, speed:f64}` | Reads `recommendation.policy_json` and the active run's `patient_zero`/`challenges_json`. Inserts **two** runs with `pair_id = "pair_" + recommendation_id-derived id`: label `Baseline` with `policy_json:''`, and label `With plan: <name>` with `policy_json` = the recommendation's and `recommendation_id` set. Both are `requested` with `autoplay:true`. **Does not change `active_run_id`**, so the Agent Room baseline stays put. Not a deployment: rule 9 is untouched, and `recommendation.status` is not written. |
| `defend_request` | joined human | unchanged | Also refuses when the active run is `requested` or `error`, or when **any** run in the session is `requested` or `running` (rule 5). Copies `run.challenges_json` into the log. |
| `session_entry_points_set` *(new)* | **server only** | `{session_id, entry_points_json}` | Validates a JSON array of device ids that all exist in the session's hospital; stores it. |
| `solution_start` (addendum) | presenter | as above | Also sets `session.solution_pair_id` to the new pair id, so every subscribed tab opens the solution view. Refused while any run in the session is `requested` or `running`, or while a round is `running`/`waiting_for_human`. |
| `solution_close` *(new)* | presenter | `{session_id}` | Clears `session.solution_pair_id`; every tab returns to the session view. Runs are kept. |
| `run_start` (addendum) | presenter | unchanged | When `session.entry_points_json` is non-empty, refuses a patient zero that is not in it, with the reason in the error. |

Server-only reducers grow to include `run_frames_apply`, `run_fail` and `session_entry_points_set` (rule 11).

**Deleted:** the `run_state` table, the `tick_timer` table, the `run_tick` reducer, the `@hippo/sim-core` import, and `index.ts` `writeInitial`/`advance`/`policyOf`/the timer helpers. Unchanged: every agent, question and recommendation reducer, and every public column the UI reads today.

**Regeneration:** `npm run generate -w hippocratech-module` (regenerates `apps/web/lib/stdb/module_bindings`, used by both web and watcher) and `npm run publish:local -w hippocratech-module`. Both need the `spacetime` CLI (§8).

### 5c. Watcher (`apps/watcher/src`)

New files sit next to `round.ts`, `answer.ts` and `relay.ts`, in the same style: a deps object, never throwing, strict zod, `[run]` log prefix.

```ts
// engine.ts — engine client, modeled on coordinator.ts
export type AppSessionRequest = { hospital: object; patient_zero: string; policy: object | null; challenges: string[] };
export type EngineReply = { ok: true; session: AppSession } | { ok: false; detail: string };
export async function callEngine(baseUrl: string, body: AppSessionRequest): Promise<EngineReply>;
// POST ${ENGINE_URL}/app/session, AbortSignal.timeout(30_000), strict zod AppSession/TickFrame parse,
// maps {error:{type,detail}} to detail `Engine refused the run (${type}): ${detail}`.

// run.ts — run driver
export type RunReducers = Pick<DbConnection["reducers"], "runFramesApply" | "runFail">;
export type RunDeps = {
  reducers: RunReducers;
  engine: (body: AppSessionRequest) => Promise<EngineReply>;
  runs: () => RunInfo[];                                  // from the subscribed `run` table
  hospital: (sessionId: string) => object | undefined;    // JSON.parse(session.hospitalJson).hospital
  clock?: { setTimeout: typeof setTimeout; clearTimeout: typeof clearTimeout };
};
export function watchRuns(conn: DbConnection, deps: RunDeps): void;
```

- **Subscription:** add `"SELECT * FROM run"` to stdb.ts:40. Extend `ServerReducers` with `runFramesApply | runFail`.
- **Trigger:** `run.onInsert`/`onUpdate` with `status==='requested'` → `callEngine({hospital, patient_zero, policy: policyJson ? JSON.parse(policyJson) : null, challenges: JSON.parse(challengesJson)})`. Cache the `AppSession` by run id. On error, call `runFail({runId, detail})`. On success, call `runFramesApply` with frame 0. For a pair, compute both runs, then apply both frame 0s in **one** call.
- **Pacing:** one chained `setTimeout` per key (`pairId || id`) at `TICK_MS / speed` ms, with `TICK_MS = 1000` mirrored from `spacetime/src/constants.ts`. On each beat, take every `running` run under the key and send each one's frame `run.tick + 1` in one `runFramesApply`. Await the call before scheduling the next beat, so calls never overlap. Stop the chain when no run under the key is `running`. Restart it when `speed` changes or a run becomes `running`. Handle `step_pending` immediately for paused runs.
- **Errors:** a reducer refusal or a missing cached frame triggers `runFail` with the detail. Run failures never go to `session.round_detail`.
- **Restart:** after `subscribe` resolves, every `requested`/`running`/`paused` run is recomputed from its inputs (the engine is deterministic) and continues from `run.tick`. This is deliberately unlike `round.ts`: runs are idempotent state, while defend requests are not.
- **Config:** `config.ts` adds `engineUrl: (ENGINE_URL || "http://127.0.0.1:8000").replace(/\/+$/, "")`. `index.ts` calls `watchRuns(conn, …)` after `watchAnswers`.
- **Entry points:** the same file (or a small `entry.ts`) watches `session`: on insert, and for every session after `subscribe` resolves whose `entry_points_json` is `"[]"`, it calls `POST ${ENGINE_URL}/app/entry_points {hospital}` and writes `session_entry_points_set`. Failures go to `session.round_detail` through the existing `reportError` (they are not run failures). Extend `ServerReducers` with `sessionEntryPointsSet`, and subscribe `SELECT * FROM run`.
- **Tests:** `test/run.test.ts` and `test/engine.test.ts` use vitest fake timers and the `record(name)` fake-reducer pattern from relay.test.ts:21-34. They assert the exact reducer call sequence for a fixture `AppSession`; pause, resume and speed; step; reset leading to recompute; a pair applied in one call; and an engine 422 becoming `runFail`.
- **Small fix in the same package:** guard `JSON.parse(req.challengesJson)` in round.ts:14.

### 5d. Agents (`agents/`), with agent logic untouched

The agent code does not change; this is configuration and fixtures only.

```dotenv
# agents/.env (values local, never committed)
HIPPO_SIM_BIN=/Users/…/calhacks-project/engine/.venv/bin/hippo-sim
HIPPO_SIM_FIXTURES=0
HOSPITAL_PATH=/Users/…/calhacks-project/data/hospitals/demo.json
WATCHER_RELAY_URL=http://127.0.0.1:8010
RELAY_TOKEN=<same as the watcher's>
```

- `tools.run_sim` → the engine's `hippo-sim` → `run_result(hospital, pz, policy, challenges)`. The relay is unchanged; every message lands in `agent_message` through the watcher.
- **Hospital parity:** at runtime the agents load the same file the session is created from (`HOSPITAL_PATH=data/hospitals/demo.json`, live-session.ts:9,79). `agents/fixtures/hospital.json` and `scripts/export_fixture.mjs` stay: the agents' own tests use that fixture (it carries `dev_unknown_7` for the challenge tests), and the piece keeps its tests whole.
- **Config is environment, not code:** `HIPPO_SIM_BIN`, `HOSPITAL_PATH`, `WATCHER_RELAY_URL` and `RELAY_TOKEN` go in `agents/.env` (gitignored) and are documented in `docs/.env.example`. No agent logic changes.
- **Fixtures:** `agents/scripts/refresh_fixtures.py` (new) runs `HIPPO_SIM_BIN` for the baseline and each candidate, with and without each supported challenge, and rewrites `agents/fixtures/results/*.json`. `agents/tests/test_runtime.py:101-126` changes from the sim-core invariant to `infectedCount == len(infectedDevices)` and `ticksDown == ticks - downSinceTick + 1`, with services down from `downSinceTick` to `ticks` inclusive.
- **Demo story check:** under the engine, `cand_isolate_imaging` gives `protectedBroken = [fl_1..fl_4]` (Clinical rejects with `keep_flow`), and `cand_keep_scans` gives `[]` with 1 infected device (both guardians accept). The fixture story holds.
- **Expected consequence (§8):** `keep_service` becomes inert, because services fail only at detonation.

### 5e. UI (`apps/web`)

**One flow, one stepper, driven only by rows.** The stepper replaces `DemoSteps` (session-view.tsx:129-167) and shows on both tabs:

1. **Pick patient zero.** Shown when there is no active run. Clicking a device gives a UI-only selection, then **Start attack** → `runStart({…, label:'Baseline', policyJson:'', autoplay:true})`.
2. **Spread.** Run `requested` shows "Computing…"; `running`/`paused` show `tick / final_tick`; `error` shows `run.detail` verbatim.
3. **Create aggregate fix.** Run `done` and round `idle` → `defendRequest`. When `round_state` becomes `running`, every tab switches to the Agents tab.
4. **Agents negotiating.** `round_state` is `running` or `waiting_for_human`, with question cards.
5. **Pick a solution.** Each recommendation card gets **Show the solution** → `solutionStart({sessionId, recommendationId, speed})`.
6. **Rerun.** Route `/s/[sessionId]/solution/[recommendationId]`: two scenes fed by the pair's rows, one shared timeline, and a before/after strip from the two `run` rows' summary columns.

Stepper additions (decided, §9): in step 1 every device not in `session.entry_points_json` is dimmed and not clickable, and `mri_2` is pre-selected when it is eligible. In step 5, **Show the solution** calls `solution_start`; every tab opens the solution view as soon as `session.solution_pair_id` is set, and **Back to the session** (presenter) calls `solution_close`. The solution view holds on the final frame of each side, with the before/after strip from the two `run` rows.

**Changes**

| File | Change |
|---|---|
| `lib/stdb/use-session.ts` | Live only. Mock only when `NEXT_PUBLIC_MOCK=1`. Otherwise, with no `NEXT_PUBLIC_STDB_URI`, `source:'error'` with "Not connected: set NEXT_PUBLIC_STDB_URI". |
| `lib/stdb/engine-session.ts`, `engine-demo-session.json` | **Deleted** (drops the direct `/app/run` call) |
| `lib/stdb/types.ts` | `RunRow` adds `pairId, policyJson, finalTick, detail, patientsAffected, devicesCompromised, servicesDown, delayedProcedures, removedFlows: string[], assumptions: string[], recommendationId`; `status` adds `'requested' \| 'error'`; `SessionActions` adds `startRun(patientZero)` (already present), `showSolution(recommendationId)` |
| `lib/stdb/live-session.ts` | Maps the new columns. Fixes `IDLE_RUN` (check `activeRow` truthiness rather than `id`). Adds `useRunRows(runId)` for pair runs. Adds a `solutionStart` action. |
| `features/agents/defend-button.tsx` | `defendBlocker` mirrors the reducer: block on `requested`, `error`, or any running session run |
| `components/scene/devices.tsx`, `hospital-scene.tsx`, `session-view.tsx` | `onSelect` for patient zero; stepper |
| `features/scene/spread-fx.tsx` (new, planned in CODE_REFERENCE) | Pulses along `flowId` from `spread_attempt`, a flash on `device_state` change, toasts from `sim_event`, and cut connections from `removed_flows_json` |
| `components/timeline.tsx` | Guard the empty beat; `SPAN_TICKS = run.finalTick`; Step and Reset buttons; hide the static "Following" label |
| `components/panel/impact.tsx`, `counters.tsx`, `features/agents/agent-room.tsx` | Read run-row totals instead of summing in the browser |
| `features/policy/card-body.tsx`, `features/agents/agent-room.tsx`, `features/agents/agents.ts` | Show-the-solution button; copy changes "hippo-sim" to "the engine" |
| `app/s/[sessionId]/solution/[recommendationId]/page.tsx`, `features/solution/solution-view.tsx` (new) | The rerun view |
| Dead controls (`Change conditions`, 3D/2D, `Log`, `Skip to result`) | Hidden for demo-v1 |
| `package.json` + `vitest.config.ts` + `lib/stdb/*.test.ts` (new) | Piece-local tests: `snapshotOf(rows)` extracted from live-session, `agent-rows`, `defendBlocker`, stepper state |

**Offline honesty (rule 14).** No silent fallback remains. The only offline view is the explicit mock, labeled "Mock data" in the header. Engine refusals appear as `run.detail`, and agent failures as `session.round_detail`. `/replay` stays a separate, self-contained backtest page outside the flow. It is someone else's untracked work and is not committed by this effort.

---

## 6. Rules rewrite

**docs/AGENTS.md: new wording**

> **3. One engine.** All spread, impact and patient-state logic lives in the Python engine, `engine/sim_core`: the rules in `engine.py`, the app mapping in `app_bridge.py`, and agent-policy application in `app_policy.py`. Visible runs (through the run watcher) and the uAgents' test runs (through `hippo-sim`, the engine's CLI) call the same functions. Nothing else computes spread, impact or patient states. The SpacetimeDB module stores and reveals rows, the watcher only forwards engine frames, and the browser only renders.

> **4. The visible run lives in SpacetimeDB.** A run advances only when the run watcher writes the engine's next frame through the server-only `run_frames_apply` reducer, paced at the run's speed. Pause, resume, step, speed and reset are presenter reducers that the watcher obeys. Clients never compute ticks; they subscribe.

> **6. Deterministic.** The engine has no RNG and no clock on the replay path. The same hospital, patient zero, policy and challenges give byte-identical output across processes, hash seeds and transports (Python, `POST /app/session`, `hippo-sim`). Keep two tests: (a) app-path byte identity across `PYTHONHASHSEED` values and transports, and (b) parity, `run_result(x) == to_run_result(run_session(x))`, so the agents' numbers equal the visible run's. `seed` fields remain for contract compatibility and are ignored.

Related edits in the same file:

- Rule 5: add "…or while any run in the session is `requested` or `running`."
- Rule 8: replace "comes from `hippo-sim` results" with "comes from engine results (`hippo-sim`)".
- Rule 11: add `run_frames_apply` and `run_fail` to the server-only list.
- "Engine wiring" (lines 35-58) becomes one section: **one engine** (`engine/`); CLIs `hippo-sim` (app test runs) and `hippo-backtest` (CUH backtest); HTTP `POST /app/session`, `POST /app/run_result`, `/replay`…; the run watcher drives SpacetimeDB; the UI subscribes only. The "two engines" and "frozen-contract change needed" paragraphs are deleted.

**Other doc lines that must change in the same change (rule 18)**

| File | Lines | Change |
|---|---|---|
| `docs/engine.md` | 1-22 (two-engine table and "bridge between the two"), 62 and 64-101 (`/app/run` as the live path), 113-115 (`run_session` "is the `/app/run` body", `to_run_result`), 117-121 ("How the app wires in"), 87 (`delayed` is never produced today) | One-engine framing; `/app/session` and `/app/run_result` contracts; `TickFrame`; watcher wiring; CLI `hippo-sim` |
| `docs/hippocratech/CODE_REFERENCE.md` | 9-19, 47-48 ("separate from the live run engine"), 52-53 (sim-core/hippo-sim tree), 64-72 (sim-core table; 68 also misstates the `step` signature), 74 (`run_tick` in the reducer list), 96 (`round.ts` "start_round or reassess"; code only calls `/start_round`), 98, the web rows (~154-180), the data row (~184: claims demo.json has an inactive unknown device and vendor link, which it does not), invariants 193-194 | New rows: `app_policy.py`, `app_cli.py`, the new engine tests, `ingest.ts`, `solution.ts`, `hospital.ts`, `run.ts`, `engine.ts`, the watcher tests, `spread-fx.tsx`, the solution route, `refresh_fixtures.py`. Remove the sim-core rows. **Note:** this file has an uncommitted 1-line edit from another session (the `ENGINE_RESEARCH_PAPER.md` row); merge it, don't overwrite it. |
| `docs/hippocratech/HOSPITAL_SCHEMA.md` | 7-8 ("No automatic conversion to the legacy `infected` boolean" is false: `run_session` does this), 55-58, 205-229 (`RunResult` "What `hippo-sim` prints… Every number comes from `sim-core`") | New sections: **App run contract** (`AppSessionRequest`, the `run_session` output, **TickFrame**), **Run ingestion** (`run` columns and status machine, `run_frames_apply`/`run_fail`/`solution_start` args), and the RunResult semantics under the engine (tick axis = frame ticks, `ticksDown` rule) |
| `docs/hippocratech/TEAM_BRIEF.md` | 22 (`sim-core`, scheduled `run_tick`, `hippo-sim`), 54 (publish steps) | One engine; watcher-driven runs |
| `docs/README.md` | 26, 28, 32, 50, 84 | Same |
| `docs/Hippocratech.md` | 91, 172, 255, 274, 290-305 (Simulation in SpacetimeDB), 324 (mulberry32), 351, 363, 395 (architecture box), 411, 416 ("One engine: sim-core…"), 428 (Tech Stack), 512 (`run_tick` in the API), 535-541 (frozen sim-core interface), 611-616, 648-661 (decision log), 672-673 (glossary) | Same. Add a decision-log entry dated 2026-10-24: "sim-core retired; one Python engine." |
| `docs/.env.example` | watcher block (14-19), agents block | `ENGINE_URL`, `ENGINE_PORT`; agents' `HIPPO_SIM_BIN`, `HOSPITAL_PATH`, `WATCHER_RELAY_URL`, `RELAY_TOKEN` |
| Code comments | spacetime/src/index.ts:1-8 (also cites "rule 6" for no network calls, which is rule 7), schema.ts:211 and 260 ("hippo-sim"), app_bridge.py:6 and 168-170, agents/tools.py:1-6, module.test.ts:64 ("rule 5") | Updated with the code that changes |

---

## 7. Build order

### Phase 2: make each piece whole

Each package has a disjoint file set, so packages can run in parallel without two of them editing the same file. **D0 goes first**: it freezes the contracts in §5 as doc text that every other package codes against.

| Pkg | Files (exclusive) | Contract in → out | Standalone tests | Depends on |
|---|---|---|---|---|
| **D0 Contracts** | `docs/hippocratech/HOSPITAL_SCHEMA.md` (new sections only), `docs/hippocratech/INTEGRATION.md` | — | — | — |
| **E Engine** | `engine/sim_core/app_policy.py` (new), `app_bridge.py`, `api.py`, `app_cli.py` (new), `engine/pyproject.toml`, `uv.lock`, `engine/tests/test_app_policy.py` (new), `test_app_bridge.py`, `test_api.py`, `test_app_determinism.py` (new), `test_app_cli.py` (new), `engine/scripts/build_frames_fixture.py` (new; writes the frames fixture to stdout) | `(hospital, pz, policy?, challenges?)` → `AppSession` with `frames`; → `RunResult` | Policy port parity on hand-built cases; agent-fixture parity for the 3 candidates; frames contiguous, tick 0 complete, no self-attempt, every success attempt has a real `flowId`; `to_run_result` parity; byte identity across `PYTHONHASHSEED` 0/1 and Python/HTTP/CLI; `/app/session` 200/422 (`invalid_policy`, `invalid_app_input`) | D0 |
| **B Backend** | `spacetime/src/schema.ts`, `index.ts`, `agents.ts`, `ingest.ts` (new), `solution.ts` (new), `hospital.ts` (new), `constants.ts`, `spacetime/package.json`, root `package-lock.json`, `spacetime/test/module.test.ts`, `spacetime/test/fixtures/frames.demo.mri_2.json` (new), `spacetime/test/live.integration.test.ts` | reducer args (§5b) → public rows | Fixture frames through `run_frames_apply` reproduce exact rows tick by tick; auth (non-server refused); tick contiguity; unknown ids; size cap; `run_fail`; pause/resume/speed/step flags; reset → `requested`; pair applied atomically; `solution_start` keeps `active_run_id`; `defend_request` refuses `requested`/any running run | D0. The fixture starts hand-written from the contract and is replaced by E's output when E lands. |
| **W Watcher** | `apps/watcher/src/run.ts` (new), `engine.ts` (new), `config.ts`, `stdb.ts`, `index.ts`, `round.ts` (guard only), `apps/watcher/test/run.test.ts` (new), `engine.test.ts` (new) | `run` rows + engine HTTP → `runFramesApply`/`runFail` calls | Fake reducers, fake engine and fake timers; no server | D0. It codes against a local `RunReducers` type until B's bindings regenerate, then switches to the `Pick`. |
| **A Agents** | `agents/scripts/refresh_fixtures.py` (new), `agents/fixtures/results/*.json`, `agents/tests/test_runtime.py`, `agents/tests/test_engine_edge.py` (new; runs the real `HIPPO_SIM_BIN` when set), copy in `agents/tools.py` docstring only | `HIPPO_SIM_BIN` CLI → `RunResult` | `pytest --ignore=tests/test_live_round.py` passes with refreshed fixtures; one new test runs the real `HIPPO_SIM_BIN` when set (skipped otherwise) | **E** (the CLI) |
| **U UI** | `apps/web/lib/stdb/types.ts`, `live-session.ts`, `use-session.ts`, `engine-session.ts` + `engine-demo-session.json` (delete), `features/agents/*`, `features/policy/card-body.tsx`, `features/scene/spread-fx.tsx` (new), `features/solution/*` (new), `app/s/[sessionId]/**`, `components/timeline.tsx`, `components/panel/*`, `components/scene/*`, `components/shell/header.tsx`, `apps/web/package.json`, `vitest.config.ts` (new), `lib/stdb/*.test.ts` (new) | rows → render; actions → reducers | `snapshotOf(rows)`, `agent-rows`, `defendBlocker` and stepper state from fixture rows; typecheck | D0. It compiles against the new bindings after B regenerates them (it can start with local types). |
| **D1 Docs** | `docs/AGENTS.md`, `docs/engine.md`, `docs/hippocratech/CODE_REFERENCE.md`, `TEAM_BRIEF.md`, `docs/README.md`, `docs/Hippocratech.md`, `docs/.env.example` | — | — | Lands with the code. **CODE_REFERENCE.md is serialized:** each package hands its rows to D1 instead of editing the file in parallel. |

**Parallel:** E, B, W and U run in parallel after D0. A starts when E's CLI lands. D1 merges last.
**Shared-file hazards** (one owner each): `apps/web/lib/stdb/module_bindings/` (B regenerates; never hand-edited), root `package-lock.json` (B), `data/hospitals/demo.json` (nobody, unless Q6 in §8 decides to add `dev_unknown_7`; then E owns it, because the engine tests read it).

### Phase 3: integrate the edges, in order

| Step | Edge | Work | Proof | Needs |
|---|---|---|---|---|
| **I1** | Watcher drives the engine into SpacetimeDB | Publish the module locally (SpacetimeDB on :3000; web dev moves to :3001), regenerate bindings, start the engine on :8000 and the watcher with `ENGINE_URL`. Start a run from a script client. | Unit suites green in every piece. A live run reaches `done`, and its rows equal `frames.demo.mri_2.json`. `live.integration.test.ts` (module) is rewritten to the fixture and passes. | E, B, W, the CLI (§8) |
| **I2** | UI subscribes; drop `/app/run` | Point the web at the local module (`NEXT_PUBLIC_STDB_URI`). Delete `engine-session.ts`. Remove `POST /app/run` from `api.py` with its 2 tests, after moving them to `/app/session`. | Two tabs on `/s/demo` show the same patient zero, ticks, pulses and events. Pause, step and reset from the presenter are seen by both. | I1, U |
| **I3** | `defend_request` wakes the agents | Agents' `.env` per §5d; run `run_all.py` on free ports, or on 8001-8004 once the other session frees them; relay on 8010. | After the baseline is `done`, **Create aggregate fix** produces `agent_message` rows in both tabs; Clinical rejects isolate_imaging on `keep_flow`; Flow revises to keep_scans; the recommendation is `draft`; `fixture:false` everywhere. | I1, A |
| **I4** | Chosen plan reruns through the same path | Show the solution → `solution_start` → watcher computes both runs → solution view | Both tabs see the pair in lockstep; the plan run's numbers equal `recommendation.verified_json` (parity) | I1, I3, B (`solution.ts`), U (solution view) |
| **I5** | Retire sim-core and finish | Delete `packages/sim-core` and its workspace entry; verify that nothing imports it; run `npm run typecheck --workspaces --if-present`, `npm run test --workspaces --if-present`, `uv run pytest -q` (engine), agents pytest; D1 docs | Full suite list in the PR description; two-tab screen capture | I1-I4 |

---

## 8. Risks and open questions

### Risks

1. *(Resolved: `spacetime` 2.13.0 was installed to `~/.local/bin` with the official installer, matching `spacetimedb@2.13.0`.)* **The `spacetime` CLI was not installed** (`which spacetime` → not found). It is needed for a local server, `publish:local`, `generate` (bindings) and the server token (`spacetime login show --token`). Until it is available, B's reducers can be unit-tested only through the harness (`createModuleTestHarness` in `node_modules/spacetimedb`), and I1-I4 are blocked. Options: install the CLI, or use the `clockworklabs/spacetime` image through Docker (`/opt/homebrew/bin/docker` exists; untried). **Bindings must not be hand-edited.**
2. *(Resolved: the other session and its agents were stopped.)* **Ports:** SpacetimeDB's default `:3000` collides with Next dev's default. demo-v1 layout: SpacetimeDB `:3000` (so `publish:local` and the live tests keep their defaults), web `:3001` (`npm run dev -w web -- -p 3001`), engine `:8000`, watcher relay `:8010`, agents `:8001-8004`. Run `agents/tests/test_live_round.py` only when 8001-8004 are free (it is not auto-skipped).
3. **Schema migration:** removing `run_state`/`tick_timer` and the scheduled reducer likely requires `spacetime publish --delete-data` on an existing database. Every added column has a default.
4. **Frozen contracts (rule 17):** the table, reducer and binding changes touch the base app's frozen contracts. The user's request is the approval for demo-v1, and it is recorded here.
5. **Shared bindings:** web and watcher both compile against `apps/web/lib/stdb/module_bindings`, so a regeneration moves both at once (B regenerates; W and U rebase).
6. **Reducer argument size:** the demo's whole-run frames are tens of KB. Per-tick frames are small, and tick 0 holds about 48 devices, 7 services and 6 groups. The cap of 256 KiB is unverified on a real server because unit tests bypass BSATN.
7. **Watcher as a single point of failure:** `process.exit(1)` on disconnect (stdb.ts:25-28) stops the relay, the rounds and the run driver together. Restart semantics (§5c) recover runs; rounds in agent memory are lost on an agent restart.
8. **Demo outcomes are nearly binary:** 14 infected at baseline versus 1 under either imaging candidate. The rerun lasts about 1-2 ticks (`finalTick` 2 today and 1 after the self-attempt fix), so the solution view needs a deliberate pace (for example, hold on the final frame).
9. **`keep_service` becomes inert** under the engine: services fail only at detonation, so `ticksDown` is at most 1, below `MAX_SERVICE_LOSS=2`. Clinical rejects only on `protectedBroken`. This is acceptable for the demo story. Do not "fix" it by inventing durations.
10. **Patient-zero refusals:** the engine refuses many devices, including every medical device except `mri_2`, plus badge readers and HVAC. Judges clicking a scanner will see a `run.detail` error unless the pick is restricted (Q4).
11. **Partial writes in the relay** (relay.ts:92 before validating the payload) can store a message while the agent believes it was not sent. Fix in W (validate first) or accept it for demo-v1.
12. **Untracked and uncommitted work from other sessions** (`apps/web/app/replay`, `components/propagation`, `lib/propagation`, `public/propagation-runs`, `engine/ENGINE_RESEARCH_PAPER.md`, and edits to CODE_REFERENCE.md, engine/HANDOFF.md and engine/README.md) must not be committed, reverted or lost by the `demo-v1` branch work. Create the branch without `clean`/`stash`, and stage files explicitly.
13. **Environment drift:** Node is v25.8.0 (the docs assume 22); the agents' venv is Python 3.12.4 (the docs say 3.11); the engine's venv is 3.11.
14. **The committed `spacetime/dist/bundle.js`** still inlines sim-core until republished.
15. **Presenter model:** the first identity to create `demo` becomes the presenter. If a script or another tab creates it first, the judge's tab cannot control playback. Create the session from the judge's tab, or `set_presenter`.
16. **Branch naming:** the user asked for `demo-v1`, which differs from AGENTS.md's `f<N>/`/`base/` convention. The user's request wins.

### Open questions (each blocks the noted package)

| # | Question | Default if unanswered | Blocks |
|---|---|---|---|
| Q1 | Watcher-paced ticks (chosen, per the user's wording) or watcher-loads/module-reveals with the scheduled `run_tick` kept? | Watcher-paced | B, W |
| Q2 | One `frames_json: string` argument (chosen, matching the module's JSON-string style) or typed `t.array(t.object('TickFrame', …))`? | `frames_json` | B, W |
| Q3 | Fizzles: emit `success:false` attempts for policy-removed flows that touch an infected device, disclosed as an `[S]` note, or show no fizzles and draw removed flows as cut connections only? | No fizzles; cut connections from `removed_flows_json` | E, U |
| Q4 | Restrict the patient-zero pick in the UI with an engine-provided eligible list (for example `POST /app/eligible {hospital} → {deviceIds}`, stored on `session`), or show the refusal as `run.detail`? | Refusal as `run.detail`; demo default `mri_2` | E, B, U |
| Q5 | `delayed_procedures` meaning: patients in delayed outpatient_scan/surgical groups (the column's meaning) or groups not ok (the engine's current meaning)? | Patients in delayed outpatient_scan/surgical groups | E |
| Q6 | Should Inventory's human question be in the demo? It needs `dev_unknown_7` plus its inactive flow in `data/hospitals/demo.json`, and a challenge path (`challenge_add`, or `run_start` with challenges). | Out of scope for demo-v1; Clinical's `keep_flow` rejection is the argument | E (data), B |
| Q7 | Duration-based patient escalation (delayed → disrupted → diverted over ticks), or final-state-at-detonation? | Final state at detonation | E |
| Q8 | What does the timeline clock show, given the engine tick is one engine step and not 15 minutes? | "Step N of finalTick" | U |
| Q9 | Agents on alternate ports while 8001-8004 are held: is changing `agents/config.py PORTS` through the environment acceptable (a config, not logic, change)? | Wait for the ports, or override them through the environment | I3 |
| Q10 | Is `review_submit` (F3) in demo-v1 scope? The flow ends at the rerun, and rule 9 is unaffected. | Out of scope | — |
| Q11 | Should the engine's richer state (five levels, `dependency_outage`) reach the rows as optional columns? | No; keep the boolean rows | — |
| Q12 | Keep `StartRound.seed` and `run.seed` (accepted, ignored) or drop them? | Keep (no agent contract change) | — |
---

## 9. Decisions for demo-v1

Taken on 2026-10-24 for the `demo-v1` branch. The user's request is the lead's approval for the frozen-contract changes (rule 17). Each decision is already reflected in §5.

| # | Decision | Why |
|---|---|---|
| Q1 | **The watcher paces ticks.** `tick_timer`/`run_tick`/`run_state` are deleted; the run watcher sends one engine frame per beat through `run_frames_apply`. | The request says the watcher drives the engine tick by tick into SpacetimeDB. The module stays a state bus. |
| Q2 | **`frames_json: string`** argument. | Matches the module's JSON-string style (`policy_json`, `hospital_json`) and keeps the bindings small. |
| Q3 | **Blocked attempts are emitted** by the `app_bridge` row mapping for removed `smb`/`rdp` flows out of compromised devices, disclosed by an `[S]` note. Removed flows are also drawn as cut connections. | The rerun's payoff is the attack stopping at the cut (UX.md: "the right side stops at the zone edge"). A row behind every fizzle keeps rule 16; the note keeps it honest. |
| Q4 | **Engine-provided entry points** (`entry_points`, `POST /app/entry_points`, stored on `session.entry_points_json` by the watcher). The UI dims the rest. `mri_2` stays the demo default. | A judge must not be able to pick an attack the engine refuses. The UI still computes nothing. |
| Q5 | `delayed_procedures` = patients in `outpatient_scan`/`surgical` groups that are not `ok`. | The column's existing meaning. |
| Q6 | Inventory's human question stays **out of the demo flow** (no `challenge_add`). The capability and its tests stay untouched. | Clinical's `keep_flow` rejection and Flow's revision are the argument the judge sees. |
| Q7 | Patient states take their final value at detonation (`finalTick`), from that tick's service state. No duration escalation. | It is what the engine models. Inventing durations would break "one engine". |
| Q8 | The timeline reads **"Step N of finalTick"**; `SPAN_TICKS = run.final_tick`. | An engine tick is a step, not 15 minutes. |
| Q9 | Agents keep ports 8001-8004 (freed). | No config change needed. |
| Q10 | `review_submit`, memo and export stay **out of scope**. Rule 9 is untouched: nothing here writes `recommendation.status`. | The flow ends at the rerun. |
| Q11 | Rows keep the boolean `infected`; the engine's five levels do not reach the rows. | No UI need for demo-v1. |
| Q12 | `seed` stays in every contract, accepted and ignored. | No agent or binding contract change. |
| — | The **solution view** is the UX.md split screen: one lockstep pair from `solution_start` (`No segmentation` vs `With plan: <name>`), opened on every tab through `session.solution_pair_id`. | UX.md "Solution view"; two tabs must see the same thing. |
| — | The **direct browser → engine call is removed** (`engine-session.ts`, `engine-demo-session.json`, `POST /app/run`). The only offline view is the explicit mock (`NEXT_PUBLIC_MOCK=1`), labeled "Mock data". | Rules 14 and 16. |
| — | **`packages/sim-core` is deleted** once nothing imports it (Phase 3, I5). Its policy semantics live on in `engine/sim_core/app_policy.py`. | "One engine." |
| — | The untracked `/replay` backtest viewer (another session's work) is **not committed** and is not part of the flow. | It is not this change's work. |
