# Cached run (the demo fallback)

If the network fails during judging (the model's API, Agentverse, the venue Wi-Fi), the presenter can replay a **recorded real round** of the agents' negotiation through the real watcher relay into the session on screen. It is the one exception to "no faking a sponsor" (`docs/AGENTS.md` rule 14), and it must be labeled **"Cached run"**.

The pieces, all in `agents/`:

| File | What it does |
|---|---|
| `cached_run.py` | The rules: what a recording keeps, what it refuses, how rows are labeled, how a cache file is checked |
| `scripts/record_round.py` | Turns a real standalone round's log into `cache/demo_round.json` |
| `scripts/replay_cached.py` | Posts the cache through the relay into a target session, labeled, with the recorded timing |
| `scripts/demo_check.py` | The demo-day readiness check: a pass/fail table |

## 1. Record a real round (on a laptop, once)

The cache must come from the real engine and a real model, and nothing in the repo can generate one. `record_round.py` refuses a log with any `"fixture": true` row, a worded message (proposal, revision, verdict, question, recommendation) without its reason and a `claude`/`asi1` source, or no finished round.

1. **Install the engine** so `hippo-sim` exists (`engine/README.md`). For example, `HIPPO_SIM_BIN=…/calhacks-project/engine/.venv/bin/hippo-sim`.
2. **Set up `agents/.env` for a standalone round.** Leave `WATCHER_RELAY_URL` unset: the agents then write `agents/logs/<sessionId>.jsonl` instead of posting to the relay.
   ```dotenv
   HIPPO_SIM_BIN=/…/engine/.venv/bin/hippo-sim
   HIPPO_SIM_FIXTURES=0
   HOSPITAL_PATH=/…/calhacks-project/data/hospitals/demo.json
   ASI1_API_KEY=…           # or ANTHROPIC_API_KEY: the model that words the messages
   # WATCHER_RELAY_URL=     # unset for recording
   ```
   Plus the four seeds, as usual.
3. **Run a round:**
   ```bash
   cd agents
   .venv/bin/python run_all.py                 # shell 1
   .venv/bin/python scripts/start_round.py     # shell 2: session dev, patient zero mri_2
   ```
   Wait for `round_state … done` in shell 1, check the transcript reads well, then Ctrl-C.
4. **Record it:**
   ```bash
   .venv/bin/python scripts/record_round.py logs/dev.jsonl
   ```
   It prints the rows, patient zero, model, length and commit. Use `--force` to replace an existing cache. If it refuses, it says which row and why: fix the cause and record a new round, never edit the log.
5. **Commit `agents/cache/demo_round.json`** on a feature branch, with the commit's recording date in the message.

What the cache holds:
- Only the **sent** copy of each agent message. Every message is logged twice, once by each end (rule 10).
- Each agent's **status changes**, in order.
- Each row's time offset from the start.
- A header: `recordedAt`, `sourceSessionId`, `patientZero`, `engine`, `modelSources`, `gitCommit`, `rowCount`.

The rows are already in the relay's shape: no `table` or `seq` fields.

## 1b. Record from the session on screen (the shortcut)

A real round that already ran through the relay is in SpacetimeDB's `agent_message` table. The rows can be exported through the SQL HTTP endpoint (`POST /v1/database/<module>/sql`) into the log shape (`table`, `from`, `to`, `payload`, `reason`, `reasonSource`, `createdAt`, `direction`, `fixture`) and passed to `cached_run.record()`; the same refusals apply. `agent_status` history is not kept in that table, so such a cache has no status rows. The committed `agents/cache/demo_round.json` was recorded this way from a live session (patient zero `ws_img_2`, 17 messages, 26 s, model `asi1`).

## 2a. Automatic replay (the fast demo)

With `CACHED_ROUND=4` in `.env.local` (any number is the speed; `1` means the recorded pace), the watcher's round watcher answers **Create aggregate fix** by running `scripts/replay_cached.py --session <id> --speed 4` itself (`apps/watcher/src/cached.ts`) instead of calling the Coordinator. The agents need not be running. Every row still enters through the relay, every message is labeled, the Agent Room shows a **Cached run** badge next to the round chip, and the answer watcher resumes nothing. Unset `CACHED_ROUND` and restart the watcher to go back to the live agents.

## 2. Replay during judging, if the live round fails

1. **The session on screen must exist and its run must be done.** Rule 5: no agent traffic while a run is `requested` or `running`. Note its session id from the URL (`/s/<sessionId>`).
2. **Don't press Create aggregate fix.** That would wake the (failing) Coordinator. Replay instead:
   ```bash
   cd agents
   .venv/bin/python scripts/replay_cached.py --session <sessionId>            # recorded pace
   .venv/bin/python scripts/replay_cached.py --session <sessionId> --speed 2  # twice as fast
   ```
   It needs `WATCHER_RELAY_URL` and `RELAY_TOKEN`, from `agents/.env` or the shell, and the watcher running.
3. **Say it out loud: "This is a cached run of a real round we recorded earlier."**

What the replay changes, and nothing else:
- `sessionId` becomes the target session (in the row, and every `sessionId` inside the payload, including the recommendation's verdicts).
- `createdAt` / `updatedAt` become the moment each row is posted.
- **The label**, using only fields the relay already accepts (`apps/watcher/src/relay.ts`):
  - Every non-null `reason` starts with `Cached run · `.
  - Every `round_state` detail starts with `Cached run (recorded <YYYY-MM-DD>)`. `session.round_detail` therefore shows it for the whole round.
  - `"cached": true` is added to every payload the relay keeps open: `proposal_request`, `proposal`, `revision`, `verdict`, `answer`, `chat`. It isn't added to `question`, `round_state` or `recommendation`, which the relay parses strictly and would refuse.
  - `agent_status` rows are strict and have no free field, so they can't carry the label.

The first row the relay rejects stops the replay, with the relay's error and the row number. Nothing is skipped. A missing cache, URL or token stops it before anything is posted.

### The Agent Room's label

`agent-room.tsx` computes `cached` from the round detail (`Cached run (recorded …)`) or any message reason starting `Cached run · ` and shows a **Cached run** badge beside the round chip. (Earlier text of this section, kept for the record:)

### Gap: the recommendation card isn't labeled yet

The relay turns the replayed `recommendation` row into a `recommendation` table row (`recommendationUpsert`). That table has no label field, so on its own **the card would look like a live result**. The Agent Room needs one UI change (not made here; `apps/` is being changed on `wip-1`):

> In `apps/web/features/agents/agent-room.tsx`, compute
> `cached = roundState.detail?.startsWith("Cached run") || messages.some((m) => m.reason?.startsWith("Cached run · "))`.
> When `cached` is true:
> - show a **"Cached run"** badge next to `<RoundChip>` in the header (line 106), styled like the fixture note at line 157;
> - show the same badge on each recommendation card.
>
> `RoundChip` can also print `roundState.detail` as is. It already starts with "Cached run (recorded …)".

## 3. The demo-day check

```bash
cd agents && .venv/bin/python scripts/demo_check.py
```

It prints a pass/fail table and exits 1 if any check fails. It never prints a secret, only which variables are set.

| Check | Passes when |
|---|---|
| `agents/.env` | the file exists with all four seeds |
| Engine (hippo-sim) | `HIPPO_SIM_BIN` is an executable, and a baseline test run from `mri_2` (real engine, fixtures off) returns a RunResult |
| Model | `ASI1_API_KEY` (ASI:One) or `ANTHROPIC_API_KEY` (Claude) is set, and one tiny real `llm.explain` call passes its checks |
| Ports 8001-8004 | each port is free, or held by our agent (its `/health` names the right agent and address) |
| Watcher relay | `WATCHER_RELAY_URL/health` answers, and an empty `agent_status` POST with `RELAY_TOKEN` gets 400 (token accepted, nothing written), not 401 |
| Agentverse | `https://agentverse.ai` answers, and `AGENT_MAILBOX=1` |
| Cached run | `agents/cache/demo_round.json` exists and passes `cached_run.validate` |

Run it before judging with the agents and the watcher up. If the model or Agentverse check fails, keep the cached run ready.

## 4. Tests

`agents/tests/test_cached_run.py`. All inputs are hand-written test data inside the file.

- **Recording:** keeps only sent rows and status changes, in order. Refuses fixture rows, missing reasons or sources, an unfinished round, and mixed sessions.
- **Replay labels and timing:** every replayed row carries the label, the timing is scaled by `--speed`, and the replay stops at the first relay error (fake relay and a real HTTP one). The CLI fails without a cache, a URL or a token.
- **The relay's own schemas:** the replayed rows pass the watcher's `relayMessage` / `relayStatus` from `apps/watcher/src/relay.ts`, unchanged, through `tests/relay_check.mjs` (`node --experimental-transform-types`). It needs `npm ci -w watcher` for zod and is skipped without it. The same test checks that the relay refuses `cached` on a strict payload, and a logged row's `table`/`seq` fields.
- **demo_check:** each check fails cleanly with no secret shown, and the table and exit code are right.

## CODE_REFERENCE.md rows to add when this branch merges

Replace the planned `agents/cache/demo_round.json` row, and add the rest:

| Path | Owner | Role |
|---|---|---|
| `agents/cache/demo_round.json` | F1 | The cached demo run: a real round recorded with `scripts/record_round.py` (real engine, real model), replayed through the relay as "Cached run" (rule 14). Never hand-edited |
| `agents/cached_run.py` | F1 | Cached-run rules: what a recording keeps and refuses, the "Cached run" labels within the relay's schemas, cache validation |
| `agents/scripts/record_round.py` | F1 | Records a real standalone round's `logs/<sessionId>.jsonl` into `cache/demo_round.json` |
| `agents/scripts/replay_cached.py` | F1 | Replays the cached run through `WATCHER_RELAY_URL` into a target session, labeled, with the recorded timing |
| `agents/scripts/demo_check.py` | F1 | Demo-day readiness check: `.env` seeds, hippo-sim, the model, ports, relay and token, Agentverse, the cached run |
| `agents/tests/test_cached_run.py` | F1 | Recording, labeling, replay timing and errors, the relay's own schemas, demo_check |
| `agents/tests/relay_check.mjs` | F1 | Test helper: runs rows through `apps/watcher/src/relay.ts` unchanged |
| `hippocratech/CACHED_RUN.md` | F1 | How to record, replay and check the cached demo run |
