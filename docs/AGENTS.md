# Agent guide

Rules for any coding agent (Claude Code or another) working in this repo. These are checks, not suggestions. If a task conflicts with a rule here, stop and ask the person.

"Agent" below means a coding agent working on the repo. The product's own agents are called **uAgents** or by name (Inventory, Flow, Clinical Workflow, Sign-off Coordinator).

## Read order

1. `hippocratech/TEAM_BRIEF.md`
2. The section of `Hippocratech.md` your task touches, plus its Build Plan (features F1–F4 and their owners)
3. `hippocratech/UX.md`, if the task touches UI
4. `hippocratech/CODE_REFERENCE.md`, before creating a file. It says which feature owns which files

## Hard rules

1. **Synthetic data only.** No field identifies a person. Patient groups are counts.
2. **No deaths.** Nothing computes, shows, or writes about deaths, injuries, or clinical outcomes.
3. **One engine.** All spread, impact and patient-state logic lives in the Python engine, `engine/sim_core`: the rules in `engine.py`, the app mapping in `app_bridge.py`, and agent-policy application in `app_policy.py`. Visible runs (through the run watcher) and the uAgents' test runs (through `hippo-sim`, the engine's CLI) call the same functions. Nothing else computes spread, impact or patient states. The SpacetimeDB module stores and reveals rows, the watcher only forwards engine frames, and the browser only renders. (`packages/sim-core` is retired.)
4. **The visible run lives in SpacetimeDB.** A run advances only when the run watcher writes the engine's next frame through the server-only `run_frames_apply` reducer, paced at the run's speed. Pause, resume, step, speed and reset are presenter reducers the watcher obeys. Clients never compute ticks; they subscribe.
5. **Simulation and agent rounds are separate.** uAgents message only after a human calls `defend_request` (**Create aggregate fix**). No agent traffic while any run in the session is `requested` or `running`. The round watcher must not start a round when a run completes; only `defend_request` wakes the Coordinator.
6. **Deterministic.** The engine has no RNG and no clock on the replay path. The same hospital, patient zero, policy and challenges give byte-identical output across processes, hash seeds and transports (the Python call, `POST /app/session`, and `hippo-sim`). Keep two tests: app-path byte identity across `PYTHONHASHSEED` values and transports, and parity, `run_result(x) == to_run_result(run_session(x))`, so the agents' numbers equal the visible run's. `seed` fields remain for contract compatibility and are ignored.
7. **Reducers make no network calls.** Anything needing Claude or an agent goes through the Node server or a watcher, then writes back through a reducer.
8. **uAgents decide with code.** A Verdict's accept or reject comes from `hippo-sim` results, the inventory, and constraints. Whether to ask a `Question` is decided in code. Claude writes only the `reason` and question text. Never let model output set a verdict, a required role, or an answer.
9. **Humans decide deployment.** Only the `review_submit` reducer writes `recommendation.status`, and only humans answer `Question`s. uAgent acceptance never marks anything ready, and no code path applies a policy to any network.
10. **Every uAgent message reaches SpacetimeDB.** Each message sent or received goes through the watcher's message relay into `agent_message`. Never send a message that skips it. The Agent Room shows only what is in that table.
11. **Server-only reducers** (`agent_message_add`, `agent_status_set`, `question_add`, `recommendation_upsert`, `round_state_set`, `run_frames_apply`, `run_fail`, `session_entry_points_set`, `memo_save_draft`) check the caller against the server identity in `config`.
12. **Schemas are strict.** Every zod object uses `.strict()`. Pydantic models forbid extra fields.
13. **Secrets stay server-side.** Keys are read only in `apps/web/server/`, `apps/web/app/api/`, `apps/watcher/`, and `agents/`. Never in client code, never in `NEXT_PUBLIC_*`, never committed.
14. **No faking a sponsor.** If an integration fails, show the error. The only exception is the cached demo agent round, labeled "Cached run."
15. **Sponsor scope.** Integrate only Fetch.ai, Anthropic (Claude), SpacetimeDB, and the tech in the spec's Tech Stack.
16. **Visuals come from data.** Every animation (pulses, fizzles, flashes, message particles, highlights) is driven by rows: `spread_attempt`, `sim_event`, `agent_message`, `agent_status`. Never fake an animation that has no row behind it.
17. **Stay in your feature's files** once the base app's contracts are frozen. Frozen contracts change only with the lead's approval.
18. **Update docs in the same change:** `CODE_REFERENCE.md` for files, `HOSPITAL_SCHEMA.md` for contracts.

## Engine wiring

One engine. **Full reference: [`engine.md`](engine.md)** and the integration record
[`hippocratech/INTEGRATION.md`](hippocratech/INTEGRATION.md) — every endpoint, its exact
inputs/outputs, and how the app wires in. The essentials:

- **The engine** = `engine/` (Python, package `sim_core`): credentials + reachability +
  trust, controlled vs encrypted, defender actions, medical devices never encrypt. It is the
  only thing that computes spread, impact, patient states and policy effects (hard rule 3).
- **Bridge:** `sim_core.app_bridge` maps the app's `hospital.json` ⇄ the engine's `Scenario`
  and back to the UI sim rows (`run_session`, with a per-tick `frames[]` timeline) and the
  agents' `RunResult` (`to_run_result`). `sim_core.app_policy` applies an agents' policy
  (kept/removed/protected-broken flows, challenge activation).
- **Two CLIs:** `hippo-sim` (an app-hospital test run → `RunResult`; what the uAgents call) and
  `hippo-backtest` (the CUH causal backtest: `replay|freeze|sensitivity`). Run the HTTP server
  with `uvicorn sim_core.api:app` (CORS for `localhost:3000`).
- **Endpoints (see `engine.md`/`INTEGRATION.md` §5a for shapes):** `GET /healthz`;
  **`POST /app/session {hospital, patient_zero, policy?, challenges?}` → UI sim rows + frames**
  (the live run the watcher drives); `POST /app/run_result` → `RunResult`;
  `POST /app/entry_points {hospital}` → legal patient zeros; and the backtest `POST /replay`,
  `WS /replay/{key}/trace`, `GET /planner/scenario/{id}`.
- **Live run wiring:** the run watcher (`apps/watcher/src/run.ts`) subscribes to `run` rows,
  calls `POST /app/session`, and feeds the engine's frames into SpacetimeDB through the
  server-only `run_frames_apply` reducer, paced at the run's speed (hard rule 4). The web
  subscribes to the rows with `NEXT_PUBLIC_STDB_URI` set; there is no direct browser→engine
  call. The reducer stays sandboxed WASM and computes nothing (rule 7).

## Before you say a task is done

- Typecheck and tests pass in every package you touched (`npm run typecheck --workspaces --if-present`, `npm run test --workspaces --if-present`; `pytest` for `agents/`).
- Show the result working: for a visual task, on two laptops or two tabs subscribed to the same session.
- If you could not run the check, say so, and do not call the task done.

## Prompt rules

For `agents/llm.py` (`propose()`, `explain()`) and `apps/web/app/api/memo/`:

- Give the exact output schema and validate it (Pydantic or zod). On a failure, retry once with the errors, then drop the item.
- `propose()`: return 2–3 policies as allow rules over existing zones, types, roles, and VLANs. Say that any numbers in the output are ignored and the policies will be tested.
- `explain()` and the memo: use only numbers present in the input. Code rejects any other number. Reasons are one or two sentences, written to be read in a chat bubble.
- Never use the words "approved," "ready," or "safe to deploy" for an agent's output. Humans approve.
- Forbid outcome language. Code rejects outputs containing `death`, `died`, `fatal`, or `mortality`.

## Commits and branches

- Branch `f<N>/<short-name>` for feature work, `base/<short-name>` for the base app.
- Commit messages start with the feature: `F1: …`, `Base: …`.
- The lead merges to `main` after the change works on two laptops.
