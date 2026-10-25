# ASI:One reasoning orchestrator: design

Date: 2026-10-24. Branch: `asi1` (off `fetch_optimziaiotn`). Feature: F1 (agents).
Scope: `agents/` and docs only. The web app, watcher and SpacetimeDB module are not touched.

## Intent

On ASI:One, the Hippocratech Orchestrator today matches the user's text against a few
regexes (`agents/chat.py`) and answers with a wall of cards that mirror the local app.
Anything off-script ("what was the final recommendation?") gets the help card. The three
specialists answer every chat with one fixed intro line. Judges for the Fetch.ai track
want to see the Innovation Lab stack used for real: an orchestrator that reasons, calls
its sub-agents by handle in a way the viewer can watch, uses MCP, and keeps the UI clean.

The Innovation Lab systems the Fetch team shows off (`video-to-map-agent`,
`07-short-film-agent`, `fetch-hackkit`) share one shape: everything happens inside the
ASI:One thread, the orchestrator narrates its workers by name while they run, and the
result arrives in the same thread. Our thread today shows a menu, then silence, then a card.

The change: narrate every negotiation step live in the thread as it happens, put a
model with tools behind the chat protocol in all four agents, make the Coordinator's
calls to the specialists visible as `@handle` invocations, expose the hospital and the
simulator as an MCP server the agents call, and shrink cards to the two places they
earn their space. No payment protocol.

Nothing in the negotiation rounds changes. Verdicts, revisions, questions and
recommendations are still decided by code in `agents/logic/`.

## What the judge sees (target)

```
jg:  @hippocratech-coordinator what happens if ransomware starts at the ICU nurse station?

Orchestrator:  Starting a simulated round from ICU nurse station (session chat-4f2a91c0).
               Baseline: 12 devices infected over 40 ticks. Asking @hippocratech-flow for a plan…

Orchestrator:  [ @hippocratech-flow · round 1 ] proposed "Isolate ICU workstation VLAN":
               3 devices infected with it, 12 without.
Orchestrator:  [ @hippocratech-inventory · round 1 ] accepted.
Orchestrator:  [ @hippocratech-clinical-workflow · round 1 ] rejected: it cuts the
               ICU nurse station → PACS imaging flow, a protected flow.
Orchestrator:  [ @hippocratech-flow · round 2 ] revised: keeps ICU → PACS, 4 infected.
Orchestrator:  [ @hippocratech-inventory · round 2 ] asking a human to confirm ICU-UNK-7.
Orchestrator:  [ @hippocratech-clinical-workflow · round 2 ] accepted.

Orchestrator:  Round done after 2 rounds. The agents agree on "Isolate ICU workstation
               VLAN (keep imaging)": 4 devices infected instead of 12, 9 patients
               affected instead of 31. Nurse Director and IT Security must sign off in
               the app; one device still needs a human to confirm it.
               [recommendation card: before/after numbers, required roles, open room link]

jg:  why did clinical workflow reject the first one?

Orchestrator:  Let me ask. @hippocratech-clinical-workflow, why did you reject round 1?
Orchestrator:  @hippocratech-clinical-workflow said: "Round 1 removed ICU nurse station →
               PACS (imaging results), which is a protected flow; I need it kept."

jg:  @hippocratech-inventory which devices can't you identify?

Inventory:     Two devices on the ICU VLAN have no owner on record: ICU-UNK-7 and … A human
               has to confirm them before any plan that touches them can be recommended.
```

Every message is prose except the recommendation card and a six-item device picker when
the user asks where an attack could start. The bracketed status lines are the live
narration (section 0): one per negotiation event, sent the moment the Coordinator sees
it, same convention as `video-to-map-agent`'s `send_status`.

## Innovation Lab pieces used

Grounded in `fetchai/innovation-lab-examples` (cloned 2026-10-24) and the Innovation Lab docs:

| Piece | Where it comes from | How we use it |
|---|---|---|
| Orchestrator + worker agents, orchestrator as the sole bridge to ASI:One | `fetch-hackathon-quickstarter/` | Coordinator relays specialist answers back to the user; specialists never answer the user inside a round |
| ASI:One function calling (OpenAI-compatible `tools`, `tool_calls` loop) | docs `asione/build/function-calling`, `dynamic-ui-on-asi1/tripmate` | The reasoning loop in all four agents, model `asi1` |
| Per-sender session memory in `ctx.storage` | `tripmate/session.py` | Conversation history per chat sender |
| Agent Chat Protocol with `@handle` addressing | uAgents `handle=` on the Agent, ASI:One mentions | Specialists are invoked and quoted by handle |
| `ctx.send_and_receive` request/response between agents | docs `agent-communication` | `ask_agent` tool, with a timeout |
| Mid-workflow status messages, one per worker step, no `EndSessionContent` | `video-to-map-agent/orchestrator_agent.py` `send_status` | Live narration of every negotiation event |
| FastMCP server, MCP client in the agent | docs `mcp-integration`, `mcp-agents/` | Hospital + simulator tools as an MCP server the agents call |
| MCP client (`tools/list` → model tool schemas, `tools/call`) | `mcp-agents/Context7-MCP-Agent`, `tripmate/mcp_client.py` | The agents load their tool list from the MCP server, not from hand-written schemas |
| Interactive cards, `custom` kind, narration + card in one message | docs `interactive-cards`, `dynamic-ui-on-asi1` | Only the recommendation card and the device picker |

## Goals

0. Every negotiation event (proposal, verdict, revision, question, recommendation,
   failure) appears in the ASI:One thread as a one-line status the moment it happens,
   naming the agent by handle.
1. Any question about the hospital, a round, or a specialist's reasoning gets a real
   answer in prose, with follow-ups that remember the thread.
2. The Coordinator's calls to specialists are visible in the ASI:One thread as
   `@handle` invocations, and the specialist's answer is quoted under its handle.
3. A judge who @-mentions a specialist directly gets a real, domain-specific answer.
4. The hospital and the simulator are MCP tools, loaded by the agents over MCP.
5. Cards: two, small.

## Non-goals

- No change to the round logic, protocol models, SpacetimeDB module, watcher, or web UI.
  The web app keeps working exactly as on `fetch_optimziaiotn`.
- No payment protocol.
- No fifth "MCP agent" on Agentverse: its replies would skip our wording checks and the
  Agent Room. MCP is in-process.
- No new sponsor. ASI:One, Agentverse, uAgents, Anthropic (fallback) only.
- No replacing the local web app. ASI:One is the second front door, not a wrapper of the first.

## Anti-goals (what would make this a failure even if it works)

- A model output ever becoming a verdict, a required role, or an answer to a Question.
- Agent chatter during a running run in the same session (rule 5).
- A specialist message that does not appear in the Agent Room (rule 10).
- Invented numbers. A reply may only use numbers that appeared in that turn's tool results.
- A fallback that hides a failure (rule 14). If ASI:One is down, the user sees the error.

## Constraints from AGENTS.md that shape this

- Rule 8: tools return facts computed by code; the model picks tools and writes prose.
  The reply passes the same checks as `llm.py` today: forbidden words, and every number in
  the reply must appear in the turn's tool results or the user's message. One retry with
  the errors, then an error reply.
- Rule 5: `ask_agent` is refused by code (tool returns `{"error": "a round is running"}`)
  while the session's round is `running`. Starting a round still goes through `begin()`.
- Rule 10: every `ask_agent` send and reply is relayed through `relay.post` before it is
  sent, so the Agent Room shows the Coordinator asking and the specialist answering.
- Rule 13: `ASI1_API_KEY`, `ANTHROPIC_API_KEY` stay in `agents/.env`.
- Rule 18: `CODE_REFERENCE.md` and `AGENTVERSE_SETUP.md` updated in the same change.

## Design

### 0. Live narration: `agents/narrate.py`

`line(h, type, message) -> str` builds one status line per negotiation event from the
message the Coordinator just saw, in code, no model:

| event | line |
|---|---|
| round start | `Baseline: {n} devices infected over {t} ticks. Asking @hippocratech-flow for a plan…` |
| proposal | `[ @hippocratech-flow · round {r} ] proposed "{name}": {with} devices infected with it, {without} without.` |
| revision | `[ @hippocratech-flow · round {r} ] revised: {what changed}, {with} infected.` |
| verdict accept | `[ @{handle} · round {r} ] accepted.` |
| verdict reject | `[ @{handle} · round {r} ] rejected: {reason}. Needs: {constraint}.` |
| question | `[ @hippocratech-inventory · round {r} ] asking a human to confirm {device}.` |
| recommendation | `[ @hippocratech-coordinator ] the agents agree on "{name}".` |
| failure | `[ @{handle} ] failed: {error}.` |

Agent reasons come from the messages' `reason` fields (already model-worded and checked
when the round ran). Numbers come from the messages. The line uses the handle from
`runtime.PROFILES`.

`coordinator.execute()` and the specialist-message handlers already see every event in
order and append it to `events[session]`. A new `narrate_chat(ctx, session, type, msg)`
hook there sends the line to the chat sender of that session (`chats[session].sender`,
if the round came from chat) as a `ChatMessage` with `TextContent` only, no
`EndSessionContent`, relayed first (`chat`, direction `sent`) like every reply. Sending
is fire-and-forget (`ctx.send_raw`, not awaited under the lock for the network round
trip beyond what `chat_send` does today).

Rounds started from the web app have no chat sender and narrate nothing.

### 1. `agents/mcp_server.py`: the Hospital MCP server

A FastMCP server named `hippocratech-hospital`. Tools (all read the hospital file
through `logic.hospital` and the simulator through `tools.run_sim`; no model inside):

- `list_devices()` → devices a round can start from, with zone and type.
- `lookup_device(query)` → one device by id or name (reuses `chat.resolve_device`), its
  zone, type, VLAN, flows in and out, and whether it is dormant or unconfirmed.
- `protected_flows()` → the protected clinical flows.
- `test_run(patient_zero, policy?)` → a `RunResult` summary from `hippo-sim` (infected
  count, ticks, patient counts, services down). Same function the rounds use. `policy` is
  a full `Policy` JSON, never an id: candidates live in Flow's process, so the caller
  passes the policy it holds (the Coordinator has `rnd.recommendation.policy`, Flow has
  its candidates). Seed is `chat.DEMO_SEED`; the engine ignores it. In fixture mode only
  `mri_2` is supported and the `ToolError` is returned as `{"error": …}` (rule 14).

Docstrings written for the model, as the Innovation Lab examples do: when to call, what
each argument means, one example each.

`python mcp_server.py` runs it over stdio for debugging. The agents use it in-process
through the MCP client (`tools/list`, `tools/call`), so the tool calls in the log are
literal MCP calls.

### 2. `agents/brain.py`: the reasoning loop

One function, `respond(ctx, who, sender, text, tools, system) -> str`, shared by all
four agents.

- Loads the sender's history from `ctx.storage` under `chat:{sender}` (last 20 turns).
  The builder checks with `tests/chat_sender.py` that ASI:One's sender address is stable
  across a conversation; if not, the key falls back to the chat `x-session-id`.
- Builds the tool list from the MCP server (`tools/list` over an in-process FastMCP
  client, converted to OpenAI function schemas) plus the agent's own local tools
  (section 3), which are the ones that need the agent's live state.
- Calls ASI:One (`POST https://api.asi1.ai/v1/chat/completions`, model `asi1`, `tools`,
  `x-session-id` = the chat session) through `httpx`, no SDK. Loops on `tool_calls` up to
  6 times. MCP tools go to `tools/call`; local tools are Python callables. Every tool
  result is JSON.
- When `ASI1_API_KEY` is unset and `ANTHROPIC_API_KEY` is set, the same loop runs on
  Claude's Messages API with `tools` (model `claude-haiku-5-5`). The source is recorded
  in the relay payload (`via: "asi1"` or `"claude"`), as `llm.py` does today.
- Checks the final text: `llm.FORBIDDEN`, and the number rule against the union of the
  turn's tool results and the user's text. Retry once with the errors appended. Then
  raise; the agent replies with the error.
- Saves the turn (user text, assistant text, tool calls made) to the history.

System prompts live in `agents/prompts/{coordinator,inventory,flow,clinical_workflow}.md`.
Each says: who you are, which handles the other agents have, that you only state facts
returned by tools, that agents agreeing is never approval, and the outcome-language ban.

### 3. Local tools per agent

Coordinator:
- `start_round(device_query)` → resolves the device, calls `begin()`, returns the session
  id and the device name. The round runs as today; the Coordinator sends the summary
  message when it ends (section 4).
- `round_status(session_id?)` → state, round number, and the event list (proposals,
  verdicts with reasons, questions, recommendation) from `events`, as the summary builds
  from today. Defaults to the sender's last session.
- `recommendation(session_id?)` → the recommendation's policy name, explanation, numbers
  and required roles, or "none".
- `ask_agent(handle, question)` → see section 4.

Inventory: `unconfirmed_devices()`, `last_question()`, `device_owner(query)`.
Flow: `last_proposal()`, `candidates()` (from the last round's optimizer output), `why_revised()`.
Clinical Workflow: `last_verdict()`, `flows_broken_by(policy_name)`.

Flow and Clinical Workflow keep, per session, the candidates they tested, the revision
reasons and the policies they judged (today only the last one is kept); tools answer
from the most recent session unless given one. `flows_broken_by` re-runs
`logic.clinical`'s flow check on a stored policy, which is rule code, not spread logic.
No tool computes spread, impact or patient states.

### 4. Visible `@handle` invocations

`ask_agent(handle, question)` in the Coordinator:

1. Code checks that no round in the Coordinator's `rounds` is `running` (rule 5; chat
   sessions have no SpacetimeDB `run` rows, so "running" means the agent round state),
   and that `handle` is one of the three specialist handles. One judge's round blocks
   every judge's `ask_agent` for its duration; that is the safe side. A direct
   @-mention of a specialist is model plus local tools, no inter-agent traffic, so it is
   always allowed. The round-end summary runs after the round is `done`.
2. Sends the user an interim `ChatMessage`: `Asking @{handle}: {question}` (relayed as
   `chat`, direction `sent`).
3. Relays the question as an `agent_message` from `coordinator` to the specialist (rule
   10), then `ctx.send_and_receive(address, ChatMessage(...), response_type=ChatMessage,
   timeout=25)`. The specialist acks first and replies via `send_raw`; the builder
   prototypes that this matches on uagents 0.26.1 before anything else. If it does not,
   fall back to an `Ask`/`Said` `Model` pair on the hippocratech protocol, still relayed,
   same visible result.
   Relay rows go to the sender's last round session when there is one, else `asi1-chat`.
   `relay.ts` and `agent-rows.ts` already accept `type: "chat"` between any two speakers,
   so no watcher or web change.
4. The specialist's chat handler runs its own `respond()` with its tools and replies in
   prose; its reply is relayed before it is sent.
5. The tool returns `{"agent": handle, "said": text}`. The model's final reply quotes it
   as `@{handle} said: "…"`. The prompt instructs this form and `_said`-style quoting is
   checked in a test.

Multiple specialists in one turn are allowed (the loop runs the tool calls in order).

When a round started from chat ends, `notify_chat` schedules a task outside the
Coordinator's `lock` (model round trips must not block round events or the watcher's
REST calls) that sends one prose summary built by `respond()` from `round_status` +
`recommendation` (worded in the thread's voice, each agent named by handle), followed by
the recommendation card.

### 5. Cards

`cards.py` keeps two builders and loses the rest:

- `picker_card(h, devices)`: a `custom` section with a six-row `list`, each row the
  device name and zone with a `Simulate from here` selection. Attached whenever the turn
  called the Coordinator's local `show_device_picker` tool, which the prompt tells the
  model to use for "where can an attack start" questions; `list_devices` alone is
  answered in prose.
- `recommendation_card(...)`: policy name, four numbers (infected before/after, patients
  affected before/after), required roles as badges, `Open the live room` button. Numbers
  from the `Recommendation` and the baseline, as today. Attached whenever the
  `recommendation` tool returned one in that turn, not only at round end.

`help_card`, `devices_card`, `protected_card`, `device_card`, `started_card`,
`progress_card`, `summary_card` are deleted along with their tests. `chat.py` keeps
`resolve_device`, `unknown_device`, `selection` (a button click still arrives as JSON or
planner prose) and loses the regex parser; a selection becomes a user turn
`"simulate from {device}"` fed to `respond()`.

### 6. Specialists' chat

`agent_chat.py` is rewritten: `make_chat(name, agent)` builds the chat protocol whose
handler calls `respond()` with that agent's prompt and tools, for both the Coordinator's
`send_and_receive` and a judge's direct @-mention. It never starts a round. The
`last_said` memory stays, exposed as a tool.

### 7. Config

One `ASI1_MODEL` variable,
default `asi1`, shared with `llm.py` (its `ASI1_DEFAULT_MODEL`, docstring and
`AGENTVERSE_SETUP.md` move from `asi1-mini` together; the cached round was already
recorded with `asi1`). `requirements.txt` adds `mcp` (the FastMCP server and client live in that package).

### 8. Tests (pytest, `agents/tests/`)

- `test_narrate.py`: one line per event type from fixture messages; every number in the
  line is in the message; the handle is the agent's; no forbidden words.
- `test_brain.py`: the loop with a fake ASI:One (httpx mock): tool call → tool result →
  final text; number check rejects an invented number and retries; forbidden word fails;
  Claude fallback path selected when only `ANTHROPIC_API_KEY` is set.
- `test_mcp_server.py`: each MCP tool against the fixture hospital; `test_run` parity
  with `tools.run_sim`.
- `test_ask_agent.py`: refused while a round is `running`; the interim "Asking @handle"
  message and the relay rows are produced in order; the quoted form in the final reply.
- `test_cards.py`: trimmed to the two cards, depth ≤ 8, payload ≤ 64 KB.
- Existing `test_chat.py` keeps `resolve_device` and `selection` cases, drops `parse`.

### 9. Docs

`CODE_REFERENCE.md` (new files, deleted card builders), `AGENTVERSE_SETUP.md` (new env
vars, the model default), `AGENT_NOTES.md` (why the model may read chat text: rule 8 allows
it; rule 7 is about reducers). `llm.py`'s docstring fixed the same way.

## Calls I made (not yet confirmed by the team)

- ASI:One `asi1` as the reasoning model, Claude as the fallback. Fetch judges see their
  model end to end; the existing key setup already supports both.
- Specialist answers are quoted inside the Coordinator's reply, not posted as separate
  thread messages. ASI:One delivers a reply only to the sender of the message, and the
  quickstarter's pattern is "orchestrator is the sole bridge", so this is the supported
  path. A direct @-mention of a specialist still gets a direct reply.
- A separate interim "Asking @handle…" message before the final reply, so the viewer sees
  the invocation happen rather than reading about it afterwards.
- Narration lines are built in code from the round's messages, not by a model: they must
  arrive within a second of the event, and the reasons in them were already checked.
- Build order: narration first, then the reasoning loop and `ask_agent`, then the MCP
  server and specialist tools, then the card trim. Each step is demoable on its own.
- No LangGraph / LangChain. The loop is 80 lines of `httpx`; adding a framework would
  only add a dependency to explain.

## Left to the builder

- Exact wording of the four system prompts and the tool docstrings.
- The interim message's text and whether it is skipped when the tool returns in under
  a second.
- Tool-result size limits (truncate the event list to the last 30 events).
