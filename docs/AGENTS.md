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
3. **One engine.** All spread logic lives in `sim-core`. The SpacetimeDB module uses it for visible runs, and `hippo-sim` is built from it for test runs. Nothing else computes spread, impact, or patient states, and the browser only renders.
4. **The simulation runs in SpacetimeDB.** Visible runs advance only through the scheduled `run_tick` reducer. Clients never compute ticks; they subscribe.
5. **Deterministic.** `sim-core` uses only the seeded RNG stored on the run: no wall-clock time, no other randomness. Keep the test that the module and `hippo-sim` give identical results for the same inputs.
6. **Reducers make no network calls.** Anything needing Claude or an agent goes through the Node server or a watcher, then writes back through a reducer.
7. **uAgents decide with code.** A Verdict's accept or reject comes from `hippo-sim` results, the inventory, and constraints. Whether to ask a `Question` is decided in code. Claude writes only the `reason` and question text. Never let model output set a verdict, a required role, or an answer.
8. **Humans decide deployment.** Only the `review_submit` reducer writes `recommendation.status`, and only humans answer `Question`s. uAgent acceptance never marks anything ready, and no code path applies a policy to any network.
9. **Every uAgent message reaches SpacetimeDB.** Each message sent or received goes through the watcher's message relay into `agent_message`. Never send a message that skips it. The Agent Room shows only what is in that table.
10. **Server-only reducers** (`agent_message_add`, `agent_status_set`, `question_add`, `recommendation_upsert`, `round_state_set`, `memo_save_draft`) check the caller against the server identity in `config`.
11. **Schemas are strict.** Every zod object uses `.strict()`. Pydantic models forbid extra fields.
12. **Secrets stay server-side.** Keys are read only in `apps/web/server/`, `apps/web/app/api/`, `apps/watcher/`, and `agents/`. Never in client code, never in `NEXT_PUBLIC_*`, never committed.
13. **No faking a sponsor.** If an integration fails, show the error. The only exception is the cached demo agent round, labeled "Cached run."
14. **Sponsor scope.** Integrate only Fetch.ai, Anthropic (Claude), SpacetimeDB, and the tech in the spec's Tech Stack.
15. **Visuals come from data.** Every animation (pulses, fizzles, flashes, message particles, highlights) is driven by rows: `spread_attempt`, `sim_event`, `agent_message`, `agent_status`. Never fake an animation that has no row behind it.
16. **Stay in your feature's files** once the base app's contracts are frozen. Frozen contracts change only with the lead's approval.
17. **Update docs in the same change:** `CODE_REFERENCE.md` for files, `HOSPITAL_SCHEMA.md` for contracts.

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
