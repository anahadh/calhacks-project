# Agent notes (F1)

Working notes on Fetch.ai uAgents, Agentverse, and the watchers, for F1. Owner: Teammate 1.

Checked Oct 24, 2026.

## Versions

Installed in `agents/.venv` (Python 3.11.17) from `agents/requirements.txt`:

| Package | Version |
|---|---|
| uagents | 0.26.1 |
| uagents-core | 0.4.12 |
| pydantic | 2.14.1 (but `uagents.Model` is pydantic **v1**, see below) |
| anthropic | 2.3.0 |
| httpx | 0.28.1 |
| python-dotenv | 1.2.4 |
| pytest | 9.1.1 |

Setup:

```bash
cd agents
python3.11 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python -m pytest
```

## Sources

`uagents.fetch.ai`, `innovationlab.fetch.ai` and `agentverse.ai` were blocked by the network policy of the cloud session that wrote these notes, so the docs sites themselves could not be read. These official sources were used instead:

- The `fetchai/uAgents` repo at `main` (commit `f2dc4e8`, Oct 23, 2026), which is exactly uagents 0.26.1 / uagents-core 0.4.12: `python/src/uagents/`, its examples (`python/tests/examples/11-mailbox-agents/`), and its tests (`python/tests/test_rest.py`).
- The `fetchai/innovation-lab-examples` repo (commit `ae840c2`, Sep 1, 2026), for the chat protocol pattern (e.g. `duffel-agent/protocols/chat_proto.py`).
- The installed package source in `agents/.venv`.

Every snippet below, except the live Agentverse connection, is run by `agents/tests/test_uagents_api.py`. **Re-check the mailbox steps against the docs sites from a laptop before relying on them.**

## Findings

### 1. `uagents.Model` is pydantic v1

`uagents_core.models.Model` subclasses `pydantic.v1.BaseModel` ("reverting back to pydantic v1 BaseModel for backwards compatibility"). It adds v2-style names as thin wrappers: `model_dump_json()` calls `.json()`, `model_validate_json()` calls `parse_raw()`, `model_dump()` calls `.dict()`.

Consequences for `agents/protocol.py`:

- **Extra fields:** pydantic v1 *ignores* them by default. A v2 `model_config = ConfigDict(extra="forbid")` does nothing on a v1 model. Use a v1 `Config` class:

  ```python
  from pydantic.v1 import Extra
  from uagents import Model

  class Strict(Model):
      class Config:
          extra = Extra.forbid
          allow_population_by_field_name = True
  ```

- **Aliases:** messages go on the wire with `message.model_dump_json()` → `.json()` (no `by_alias`), and REST responses with `.model_dump()` → `.dict()`. The Policy schema's `from` is a Python keyword, so `PolicyRule` uses `from_ = Field(..., alias="from")`, and `Strict` overrides `dict()` and `json()` to default to `by_alias=True`. Without that, the wire format would say `from_`.
- Use `pydantic.v1` imports (`Field`, `conint`, `conlist`, `root_validator`) in models, not pydantic v2's.
- A model's schema digest (`Model.build_schema_digest`) is a hash of its JSON schema, so any field change makes the agents' protocols incompatible until every agent restarts on the new code.

### 2. Address from seed

The address depends only on the seed (`Identity.from_seed(seed, 0)`), not on the name or port. One fixed seed per uAgent (`*_AGENT_SEED` in `agents/.env`) gives stable addresses for Agentverse and for the other agents to send to.

```python
from uagents import Agent
from uagents.crypto import Identity

agent = Agent(name="coordinator", seed=SEED)
assert agent.address == Identity.from_seed(SEED, 0).address  # "agent1q..."
```

To print an address without starting the agent: `.venv/bin/python -c "from uagents.crypto import Identity; print(Identity.from_seed('<seed>', 0).address)"`. Creating an `Agent` logs "Ledger unavailable" warnings when offline. They are harmless for this.

### 3. Mailbox agents

```python
from uagents import Agent, Context, Model

agent = Agent(name="coordinator", seed=COORDINATOR_AGENT_SEED, port=8004, mailbox=True)

if __name__ == "__main__":
    agent.run()
```

- `mailbox=True` makes the agent receive messages through its Agentverse mailbox (polled every second, `MAILBOX_POLL_INTERVAL_SECONDS`), so it needs no public endpoint.
- On start, the agent logs `Agent inspector available at https://agentverse.ai/inspect/?uri=http%3A//127.0.0.1:<port>&address=<address>`. Open that link, signed in to Agentverse, and choose **Connect → Mailbox**. The inspector calls the agent's local `/connect` REST endpoint, which registers it in Agentverse through a signed challenge. **Not run here** (no network); this flow is read from `agent.py` and `mailbox.py` and is the step to verify first on a laptop.
- **The local HTTP server still runs.** In `run_async()`, a mailbox agent drops its local server only when it has no REST handlers. In 0.26.1 that never happens by default: `enable_agent_inspector=True` registers `/agent_info`, `/messages`, `/connect` and `/disconnect` on *every* agent, including Inventory, Flow and Clinical Workflow. To make it independent of the inspector setting, every agent also serves `GET /health` (`runtime.make_agent`). `tests/test_runtime.py` builds each agent with `mailbox=True` and checks `/health`, and `test_live_mailbox_mode_keeps_local_delivery` runs a whole round over local `/submit` with all four in mailbox mode.
- An `endpoint=` argument overrides `mailbox=True` (`parse_endpoint_config` logs "Endpoint configuration overrides mailbox setting"), so mailbox agents get no endpoint.
- Give each agent its own `port`.

### 4. REST handlers (`on_rest_post`)

```python
from protocol import RestAck, StartRound

@agent.on_rest_post("/start_round", StartRound, RestAck)
async def start_round(ctx: Context, req: StartRound) -> RestAck:
    return RestAck(ok=True)
```

```bash
curl -X POST http://127.0.0.1:8004/start_round \
  -H 'content-type: application/json' \
  -d '{"sessionId":"demo","runId":"run_baseline","patientZero":"mri_2"}'
# {"ok": true, "detail": null}
```

- Signatures: `on_rest_post(endpoint, request: type[Model], response: type[Model])` and `on_rest_get(endpoint, response: type[Model])`. The handler is `async def h(ctx, req)` for POST and `async def h(ctx)` for GET, and returns a model instance or a dict.
- The body is parsed with `request.model_validate_json`. With `Strict`, an unknown field returns **HTTP 400** with the pydantic error (`{"type": "value_error.extra", ...}`) and the handler never runs. Tested.
- The return value is re-validated against the response model. A mismatch returns HTTP 500 `{"error": "Handler response does not match response schema."}`.
- If several agents in one process (a `Bureau`) register the same path, callers must send an `x-uagents-address` header. Only the Coordinator registers `start_round`, `reassess` and `resume`, so this doesn't come up.

### 5. Chat protocol (`uagents_core.contrib.protocols.chat`)

`chat_protocol_spec` is `AgentChatProtocol` v0.3.0: `ChatMessage` is answered with `ChatAcknowledgement`. Content types: `TextContent`, `ResourceContent`, `MetadataContent`, `StartSessionContent`, `EndSessionContent`, `StartStreamContent`, `EndStreamContent`. `ChatMessage` fills in `msg_id` and `timestamp` itself, and `msg.text()` joins its text parts.

```python
from uagents import Context, Protocol
from uagents_core.contrib.protocols.chat import (
    ChatAcknowledgement, ChatMessage, EndSessionContent, TextContent, chat_protocol_spec,
)

chat = Protocol(spec=chat_protocol_spec)

@chat.on_message(ChatMessage)
async def on_chat(ctx: Context, sender: str, msg: ChatMessage):
    await ctx.send(sender, ChatAcknowledgement(acknowledged_msg_id=msg.msg_id))
    await ctx.send(sender, ChatMessage(content=[TextContent(text=f"You said: {msg.text()}")]))

@chat.on_message(ChatAcknowledgement)
async def on_ack(ctx: Context, sender: str, msg: ChatAcknowledgement):
    pass

agent.include(chat, publish_manifest=True)
```

- The spec defines handlers for both message types, so define both.
- `publish_manifest=True` publishes the protocol manifest, so other agents and Agentverse can discover that the agent speaks this protocol.
- Our agent-to-agent messages (`Proposal`, `Verdict`, …) should be our own `Protocol(name=..., version=...)` built on `protocol.py`'s models, not chat messages. The chat protocol is for being reachable from Agentverse and ASI:One.

### 6. Event loops in tests

`Agent()` binds to the current event loop when it is constructed. `asyncio.run()` closes that loop, and the next `Agent()` then fails with "There is no current event loop". In tests, drive an agent with `agent._loop.run_until_complete(...)`.

### 7. Local resolution (`LOCAL_RESOLVE=1`)

By default an agent finds another agent's endpoint through the Almanac and Agentverse (`GlobalResolver`), and on startup it registers itself there. This environment blocks `agentverse.ai` and the Fetch.ai ledger, and the demo laptop may be offline, so with `LOCAL_RESOLVE=1` (the default) `runtime.make_agent()` builds each agent from uagents 0.26.1's own extension points:

- **`resolve=RulesBasedResolver({address: "http://127.0.0.1:<port>/submit", ...})`** (`addresses.local_resolver()`). `ctx.send(address, msg)` calls `resolver.resolve(address)` with the raw address and posts the signed envelope to the endpoint it gets back. An unknown address resolves to no endpoint, so the send fails rather than going anywhere else.
- **`registration_policy=NoRegistration()`**: a no-op `AgentRegistrationPolicy`, so there is no Almanac registration loop.
- **`report_events=False`, `mark_inactive_on_shutdown=False`**: no Agentverse lookups at startup or shutdown.
- **`LocalAgent._update_agent_status` is a no-op.** `run_startup_tasks()` awaits this Almanac status call before any `on_event("startup")` handler runs. Unreachable, it retries 10 times with backoff (about a minute) and then logs a traceback. It is a private method, so `tests/test_runtime.py` fails if an upgrade removes it.
- The ledger client is still created in `Agent.__init__`. Its "Ledger unavailable" warnings are silenced (logger `network`, set to ERROR) and so is gRPC's proxy noise (`GRPC_VERBOSITY=NONE`, set by `run_all.py`).
- `endpoint=["http://127.0.0.1:<port>/submit"]`, ports 8001 (inventory), 8002 (flow), 8003 (clinical_workflow), 8004 (coordinator). With `AGENT_MAILBOX=1` there is no endpoint and `mailbox=True`.

Proof: `tests/test_runtime.py` checks the resolver maps all four addresses to their ports and that `make_agent` wires it in. `tests/test_live_round.py` runs a whole round between four separate processes this way, with every message delivered (`ctx.send` returns `delivered` only after the receiver's `/submit` accepted it).

Not tested here: `LOCAL_RESOLVE=0` (Almanac registration) and `AGENT_MAILBOX=1`, both blocked by this environment's network policy. Try them on a laptop.

### 7b. Modes (`AGENT_MAILBOX` × `LOCAL_RESOLVE`)

| `AGENT_MAILBOX` | `LOCAL_RESOLVE` | The other three reached at | Strangers (ASI:One users) reached through | Registers on Agentverse/Almanac | Tested here |
|---|---|---|---|---|---|
| 0 | 1 (default) | `127.0.0.1:<port>/submit` | can't (rules only) | no (`NoRegistration`, `LocalAgent`) | yes, the live rounds |
| **1** | **1** | `127.0.0.1:<port>/submit` | Almanac/Agentverse (`LocalFirstResolver`) | yes: mailbox, Almanac, manifest | local delivery yes (`test_live_mailbox_mode_keeps_local_delivery`); Agentverse side only on a laptop |
| 0 | 0 | Almanac lookup of the local endpoint | Almanac | yes, with `http://127.0.0.1:<port>/submit` | no (blocked) |
| 1 | 0 | their mailboxes (slow, about a 1 s poll) | Almanac/Agentverse | yes | no (blocked) |

- **Mailbox + local (the demo mode)** uses a plain `Agent`, not `LocalAgent`. It needs its real Almanac registration loop, its startup status update and the manifest publish, so that ASI:One can find it.
  - `LocalFirstResolver` sends to our four agents through the local rules, and anyone else through `GlobalResolver`. Without the fallback, the Coordinator couldn't reply to an ASI:One user.
- In this environment, mailbox mode logs `Failed to connect to mailbox server` about once a second per agent, plus "Ledger unavailable" and "Unable to publish manifest". On a connected laptop those go away once the mailbox is connected.
  - Shutdown is slower in mailbox mode, because each agent marks itself inactive in the Almanac.
- `LOCAL_PEERS` (`agent1q...=http://127.0.0.1:<port>/submit`, comma-separated) adds addresses to the local rules. It's for tests and dev, so the fake chat sender (`tests/chat_sender.py`) can be replied to without Agentverse.

### 7c. Profiles (`readme_path`, `description`, `handle`, `publish_agent_details`)

From `agent.py` 0.26.1:
- `readme_path` is read once, in `__init__`: `os.path.join(os.getcwd(), readme_path)`, or `<dir>/README.md` if it's a directory. An absolute path is used as is, so `runtime.PROFILES` passes absolute paths to `agents/profiles/<agent>.md`.
- `description`, the readme, `avatar_url` and `banner_url` go into `AgentProfile` **only if `publish_agent_details=True`**. They're sent only through the inspector's `/connect` handler (`_build_registration_profile`): connecting is when the profile is published, so reconnect after editing a profile.
- `handle` goes into the same `/connect` `RegistrationRequest`. Whether Agentverse accepts hyphenated handles (`hippocratech-clinical-workflow`) can only be seen on a laptop.
- `name` is the display name (`Hippocratech Inventory Agent`, …) and also the name in log lines. It doesn't affect the address. The code's own names (`inventory`, …) stay the keys for seeds and ports.

### 7d. Connecting the mailbox from code (`AGENTVERSE_API_KEY`)

- **Supported, using what the Inspector already uses.** The Inspector's Connect → Mailbox POSTs `{"user_token": <the signed-in user's token>, "agent_type": "mailbox"}` to the agent's own `/connect`. The inspector handler builds the registration (name, handle, profile, endpoints, protocols) and calls `uagents.mailbox.register_in_agentverse`: a signed identity challenge, then `POST /v2/agents`.
- `uagents_core.utils.registration.register_agent()` puts an **Agentverse API key** into that same `AgentverseConnectRequest.user_token` field. So with `AGENT_MAILBOX=1` and `AGENTVERSE_API_KEY` set, `runtime.connect_mailbox()` POSTs `{"user_token": $AGENTVERSE_API_KEY, "agent_type": "mailbox"}` to our own `http://127.0.0.1:<port>/connect` at startup. It retries until our server listens, and never logs the key.
- `register_chat_agent()` / `register_agent()` themselves don't fit: they register a **webhook** agent with a public `https://` endpoint, not a mailbox.
- Unverified here: that Agentverse accepts an API key as `user_token` for a mailbox connect. On a laptop, look for `Agentverse: connected the mailbox with AGENTVERSE_API_KEY`; if it fails, fall back to the Inspector.

### 7e. Chat protocol on the Coordinator

- `Protocol(spec=chat_protocol_spec)`, included with `publish_manifest=True` when the agent registers (mailbox mode or `LOCAL_RESOLVE=0`). In local-only mode the manifest has nowhere to go, so it's included without publishing.
- Every `ChatMessage` gets a `ChatAcknowledgement`. The text goes to `brain.respond()` (`agents/brain.py`): a model (ASI:One `asi1` with function calling, or Claude when only its key is set) reads it, picks tools, and writes the reply. Code runs the tools and has already made every decision; the reply may use only numbers from this turn's tool results or the user's text, and never a forbidden word (one retry, then the error is the reply). This is allowed by rule 8 (a model never sets a verdict, a required role or an answer); rule 7 is about SpacetimeDB reducers, not chat. The regex parser `chat.parse` is gone; `chat.selection` still reads card button clicks.
  - The Coordinator's tools: `start_round`, `round_status`, `recommendation` (attaches the card), `show_device_picker` (attaches the picker), `ask_agent`, plus the hospital MCP tools (`mcp_server.as_brain_tools()`: `list_devices`, `lookup_device`, `protected_flows`, `test_run`).
  - `ask_agent(handle, question)`: refused while any round is `running` (rule 5); sends the user `Asking @handle: …`, relays the question (`coordinator → <agent>`, `chat`) and the answer (`<agent> → coordinator`), and returns the answer for the model to quote as `@handle said: "…"`. Transport: `ctx.send_and_receive(address, ChatMessage, response_type=ChatMessage, timeout=25)`; the specialist's ack has another digest and passes by.
  - Every negotiation event is narrated to the chat user who started the round (`narrate.py`, `coordinator.narrate_chat`): `[ @handle · round N ] …`, built in code from the message, relayed first. Rounds started from the web app narrate nothing.
  - Per-sender history lives in `ctx.storage` under `chat:<sender>` (last 20 turns).
- A chat round goes through the same `begin()` as `/start_round`, with session `chat-<8 hex>`, seed 1337 and no challenges.
  - The "Started a round…" reply goes out before the round can move on, because the Coordinator handles one message at a time.
  - When the round reaches `done`, `notify_chat` schedules a task outside the lock that sends one prose summary (the loop, from `round_status` + `recommendation`) and the recommendation card.
- Chat replies sent later (the summary goes out from the handler of the round's last verdict) use `ctx.send_raw(..., protocol_digest=chat_protocol.digest)`, so they carry the chat protocol's digest, not the handler's.
- Chat text is relayed as `type: "chat"` rows: received with `from: "humans"`, replies with `to: "humans"`. Rows that belong to a round use its session; the rest go under `asi1-chat`. The sender's address isn't stored, and acks aren't relayed.
- **Fixture mode refuses other patient zeros.** Every fixture result is for MRI 2, so `tools.run_sim` now raises "fixture results exist only for an attack starting at MRI 2", rather than returning MRI 2's numbers for "simulate from CT 1". The chat reply passes that on.

### 8. Message order and delivery

`ctx.send` awaits the delivery status: the envelope is posted to the receiver's `/submit`, which queues it. Awaiting each send in turn therefore keeps the order, which is how Inventory's Question reaches the Coordinator before its Verdict. Each agent processes its queue one message at a time (`handle_messages_concurrently=False`, the default). `runtime.send` raises if a send isn't `delivered` (or `sent`, through a mailbox).

## Test fixture: `agents/fixtures/hospital.json`

A stand-in until `data/hospitals/demo.json` exists. It is generated, not hand-edited:

```bash
node agents/scripts/export_fixture.mjs   # from the repo root, Node 22.18+
```

The script exports `hospital` from `apps/web/lib/stdb/mock-session.ts` in the upload file format (`{ "schemaVersion": 1, "hospital": … }`) and adds one device:

- **(a) `dev_unknown_7` was added for testing.** Type `unknown`, in `rm_imaging`, vulnerable, criticality `medium`, with one SMB/445 flow (`fl_unknown_7_smb`) to `ws_img_1`. That flow has `"active": false` (schema `Flow.active`): the device is on the network only while the `unknown_device_imaging` challenge is applied (spec 7.5). The mock has no unknown device, and the Inventory Agent needs one. **`demo.json` should include this device, with its flow inactive.** `mock-session.ts` is unchanged.
- **(b) The mock devices have no `make` or `model`.** The spec's Inventory check also flags missing make or model, but on this data that would flag every device. **Until `demo.json` adds make and model, the Inventory Agent must flag only devices with `type: "unknown"` or with no flows.**

Other gaps between the mock and `HOSPITAL_SCHEMA.md`, for the lead:

- Patient groups have an `id`, which the schema's `PatientGroup` does not list (`types.ts` does).
- No flow sets `observed`, so all default to `true`.

## Running the agents

```bash
cd agents
python3.11 -m venv .venv && .venv/bin/pip install -r requirements.txt
# agents/.env (gitignored): one seed per agent, e.g. INVENTORY_AGENT_SEED=..., FLOW_AGENT_SEED=...,
# CLINICAL_WORKFLOW_AGENT_SEED=..., COORDINATOR_AGENT_SEED=...  (see docs/.env.example)

HIPPO_SIM_FIXTURES=1 .venv/bin/python run_all.py      # shell 1: the four agents
.venv/bin/python scripts/start_round.py               # shell 2: session dev, run run_dev, patient zero mri_2
.venv/bin/python scripts/answer.py --choice workstation   # answer the latest open question, if any
.venv/bin/python addresses.py                         # print the four addresses and endpoints
```

- `run_all.py` starts `inventory.py`, `flow.py`, `clinical_workflow.py` and `coordinator.py` as separate processes and prefixes each one's output with `[agent]`. Ctrl-C or SIGTERM stops all four; if one exits, the rest are stopped.
- With no `WATCHER_RELAY_URL`, each sent message prints one line (`#seq from → to type summary [fixture]`), followed by its worded text and who wrote it (`(asi1)` or `(claude)`). Every row goes to `agents/logs/<sessionId>.jsonl`.
- `HIPPO_SIM_FIXTURES=1` reads `agents/fixtures/results/<candidate id or baseline>.json` (with challenges: `<id>@<challenge>.json`). Without it, `HIPPO_SIM_BIN` must point at `hippo-sim`, or the round fails with that error. Nothing falls back silently.
- Without `HIPPO_OPT_BIN`, the candidates are `agents/fixtures/candidates/*.json`.

### Relay rows

`tools.relay` writes the spec's `agent_message` and `agent_status` rows (Data Model), with the same field names:

```jsonc
{"table": "agent_message", "sessionId": "dev", "round": 1, "seq": 16, "from": "clinical_workflow", "to": "coordinator",
 "type": "verdict", "payload": { /* the protocol model, as JSON */ }, "reason": "[reason]",
 "createdAt": "2026-10-24T04:03:12.101+00:00", "direction": "sent", "fixture": true}
{"table": "agent_status", "sessionId": "dev", "agent": "flow", "status": "thinking", "updatedAt": "…", "fixture": true}
```

- `type` is one of `proposal_request`, `proposal`, `revision`, `verdict`, `question`, `answer`, `recommendation`, `round_state`. `from` and `to` are agent names, `humans`, or `relay` (for `round_state` → `round_state_set` and `recommendation` → `recommendation_upsert`).
- **Beyond the spec's columns:** `direction` (`sent` or `received`) and `fixture`.
  - Rule 9 has both ends post, so every agent-to-agent message appears twice. The Agent Room should animate the `sent` row and can use `received` to confirm delivery.
  - `fixture: true` means the numbers came from fixture files, and the UI should label the run (rule 13).
- In file mode, `seq` is assigned under a file lock, because four processes append to one file. With `WATCHER_RELAY_URL`, rows are POSTed to `<url>/agent_message` and `<url>/agent_status` with `Authorization: Bearer $RELAY_TOKEN`, and `seq` is left for the reducer to assign. `apps/watcher/src/relay.ts` implements this contract (port `RELAY_PORT`, default 8010, so `WATCHER_RELAY_URL=http://127.0.0.1:8010`).

### What each agent does

| Agent | Receives | Does (all decisions from `logic/`) | Sends |
|---|---|---|---|
| Coordinator | REST `/start_round`, `/resume`, `/reassess`; Proposal, Revision, Verdict, Question | One `Round` per session; baseline via `run_sim(None, …)`; carries out every Action | ProposalRequest, Proposal/Revision (to guardians), Answer (to Inventory); questions → humans; round_state, recommendation → relay |
| Flow | ProposalRequest | `optimize()` (protected flags and purposes stripped), `run_sim` on each candidate, `logic.flow.choose` | Proposal (round 1) or Revision (diff against its last candidate) |
| Clinical Workflow | Proposal, Revision | `logic.clinical.check` | Verdict |
| Inventory | ProposalRequest (round 1), Proposal, Revision, Answer | `preflight`; `check`; remembers question id → device | Question (before its Verdict), Verdict |

- `/reassess` returns `{"ok": false, "detail": "reassess not implemented yet"}`.
- REST errors from the logic (a wrong role, a closed question, a round already running) return `ok: false` with the reason.
- When no candidate meets every constraint, Flow sends the one that breaks the fewest (`logic.flow.choose`) and logs that it did. The guardians reject it and the rounds run out honestly.
- Agents report `thinking` on receive, `speaking` before each send, then `idle`. The Coordinator reports `waiting` while its round is `waiting_for_human`. An error is logged, the agent goes `idle`, and nothing is made up in its place.

## Claude-written text (`agents/llm.py`)

Code makes every decision (`logic/`). Claude only puts it into words, in four places, each filled in by the agent file just before it sends:

| Where | Field | Kind | Written by |
|---|---|---|---|
| Every Verdict | `reason` | `verdict_accept` / `verdict_reject` | Inventory, Clinical Workflow |
| Inventory's Question | `text` | `question` | Inventory |
| Flow's Proposal and Revision ("why this plan") | `reason` | `proposal` / `revision` | Flow |
| The Recommendation | `explanation` | `recommendation` | Coordinator |

- **Facts** (`agents/facts.py`) are built by code from the RunResult, the constraint and the hospital. They use human names and purposes ("MRI 2 → PACS, DICOM, 'Scans to radiologists'") and carry the numbers the text may use: infected devices with and without the plan, patients not ok, connections cut, protected flows broken, and critical services down too long.
  - Clinical Workflow never sees the baseline, so its facts have no "without the plan" numbers.
- **The request:** `AsyncAnthropic(timeout=10, max_retries=0)` and model `$ANTHROPIC_MODEL` (default `claude-haiku-5-5`), with `max_tokens=200`, `output_config.effort="low"`, and a JSON schema (`{"text": string}`, no other keys). On Haiku, thinking is disabled, because a 200-token answer has no room for it.
  - The model's reply is also validated with a strict pydantic model, so an extra key (say `"decision"`) gets the reply rejected rather than read.
- **Checks in code** (`llm.problems`):
  - Every number in the text must appear in some fact value, including numbers inside names ("MRI 2").
  - None of the words approved, ready, safe to deploy, death(s), died, fatal or mortality, as whole words, case-insensitive (so "already" is fine).
  - At most 280 characters and 1–2 sentences.
- **On a failure:** one retry, listing the errors. If that fails too, or on a refusal, an API error, a timeout, or no key, `explain()` raises `LlmError`: the agent's step fails and the error becomes the round's status (`fail()` in `runtime.py`). There is no fallback text. With `ASI1_API_KEY` set, ASI:One's `asi1` (`ASI1_MODEL` overrides) writes instead of Claude (source `asi1`), through the same checks and retry.
- **Every relay row has `reasonSource`**, `asi1` or `claude`, and the message carries it too (`reasonSource`, `textSource`, `explanationSource`). The live tests word messages through a local fake ASI:One server (`ASI1_BASE_URL`).
- **Rule 7 in code:** `llm.with_text()` sets only the text and its source, and raises `DecisionChanged` if any other field would differ. `tests/test_llm.py` feeds contradictory model output (for example "I accept this" on a rejection) and checks that the decision, constraint, choices, allowed roles, required roles and numbers are unchanged.
- **Not run against the real API yet:** this cloud session has no `ANTHROPIC_API_KEY` (and no `ant` login). api.anthropic.com is reachable, though. Set the key in `agents/.env` and run `HIPPO_SIM_FIXTURES=1 .venv/bin/python run_all.py`. A message whose line ends `(claude)` was written by Claude.
- `propose()` (Flow's Claude-proposed alternatives) is F2's and not written yet.

## Open questions for the lead

- **RunResult** is drafted in `HOSPITAL_SCHEMA.md` under "RunResult (draft, needs lead approval)" and in `protocol.py`. `hippo-sim` should print exactly this.
- **Choices made in `protocol.py` that go past the spec's field table:**
  - `Question` has an `id`, since `Answer` refers to `questionId`.
  - `Verdict.decision` is `accept` or `reject`.
  - `Revision.diff` is `{ added: PolicyRule[], removed: rule ids }`.
  - `Reassess.challenge` is one of the three preset ids.
  - Roles exclude `observer`.
  - REST handlers return `RestAck { ok, detail? }`, since `on_rest_post` needs a response model.
  - `Policy` enforces the `fastest_deploy` rule strictly: no zone, type, role, or protocol, only VLAN and port.
  - `Proposal` also carries `strategy`, `name` and `tradeoff`, so it holds a whole Policy and the Coordinator can publish it. `Revision` stays a diff, which the Coordinator applies.
  - `Constraint` has `limit`, required for `max_rules` and forbidden for other kinds (the spec's `max_rules` had no number).
  - Two Coordinator models the spec doesn't list: `ProposalRequest` (to Flow; round 1's also goes to Inventory for its preflight) and `RoundState` (to the relay, for `round_state_set`).
- **Patient zero and `MAX_SERVICE_LOSS`.** Patient zero is infected at tick 0, so any service that depends on it is down for the whole run under every policy (in the demo, `svc_mri`, because patient zero is MRI 2). Applied literally, "no critical service down for more than 2 ticks" would reject every candidate. `logic/clinical.py` exempts the services that depend on a device infected at tick 0 (`unavoidable_services`). Lead: confirm, or choose another rule.

- **Protocol changes for the live agents:**
  - `sessionId` on `Proposal`, `Revision`, `Verdict`, `Question` and `Answer`.
  - `seed` (required) and `challenges` on `StartRound` and `ProposalRequest`, so test runs use the visible run's seed and challenges.
  - `Revision` has optional `strategy`, `name`, `rationale` and `tradeoff`, so a revised plan doesn't keep its old name.
  - `Candidate { id, policy }` for optimizer output. The Policy format itself is unchanged.
- **Draft CLI and HTTP contracts, for F2 and the watcher:**
  - `hippo-opt --hospital <file> --baseline <RunResult file> --constraints <Constraint[] file>` prints `Candidate[]` JSON.
  - The relay accepts POSTs at `/agent_message` and `/agent_status` (see "Relay rows").
- **Realism check on the demo story.** With MRI 2 as patient zero and MRI → PACS (DICOM) kept, the spec's spread model reaches PACS with p = 0.10 per tick, which is about 99% over 48 ticks. When real `hippo-sim` results replace the fixtures, "keep scans flowing" will likely lose PACS, and Clinical will reject it with `keep_service[svc_reading]`. The fixture `cand_keep_scans.json` assumes PACS stays clean. Lead: decide whether the demo seed, the tick count, or the story changes.

## Several runs per segmentation plan (decided Oct 24, not built yet)

A session can hold several baseline runs, each from a different patient zero, and **Create segmentation plan** gives the agents all of them (spec 7.3, 7.4). What has to change here:

- `StartRound`: `runs: [{ runId, patientZero, seed, challenges }]` (at least one) replaces the single `runId`, `patientZero`, `seed` and `challenges`. The watcher fills it from the `defend_request_log` row.
- The Coordinator runs one `hippo-sim` baseline per run. `ProposalRequest` carries `baselines: [{ runId, patientZero, seed, challenges, result }]`.
- Inventory's preflight walks every run's infection path. The optimizer gets the union of the runs' infected sets.
- Flow tests each candidate once per run. `Proposal`, `Revision` and `Recommendation` carry `testResults: [{ runId, result }]` instead of one `testResult`.
- Clinical Workflow rejects if **any** run breaks a protected flow or keeps a critical service down past `MAX_SERVICE_LOSS` (with `unavoidable_services` worked out per run). `logic.flow.rank` ranks on the totals across runs.
- `facts.py` and the chat summary report numbers per run plus the total. The chat command keeps one patient zero (a one-run segmentation plan).
- Fixtures: one results file per run's patient zero, or `HIPPO_SIM_BIN`. Fixture mode still covers MRI 2 only, so a multi-run round needs real `hippo-sim`.

## Decision logic (`agents/logic/`)

Pure functions; the agents only execute what they return (AGENTS.md rule 7). No network, Claude, uagents runtime, clock, or randomness, and every set-derived output is sorted (a test replays a scenario under three `PYTHONHASHSEED`s).

- "Devices a policy touches" are the endpoints of the flows in `RunResult.removedFlows`.
- `inventory.check` rejects with `confirm_device` naming every flagged device touched, but asks about one device per check (the first, by id). The rest are asked about on the re-check after each answer.
- `coordinator.Round` passes each Question to humans once per device. A confirmed device is never asked about again.
- **The unidentified device appears only with its challenge.** Inventory ignores a *dormant* device, one whose flows are all inactive (`logic.inventory.dormant`), unless `unknown_device_imaging` is among the round's challenges (`StartRound.challenges` → `ProposalRequest.challenges`). With that challenge, an unknown-type device's inactive flows count as its flows: it is flagged, and preflight finds it on the infection path from either side of its flow. Without the challenge, scenario a→b and the live round ask no questions at all.
- **The round pauses as soon as a question is open** (spec, The Agents, step 5): `on_questions` moves it to `waiting_for_human`. This replaces the earlier rule, which paused only on a `confirm_device` rejection.
  - While it waits, proposals and revisions are held, and verdicts on the current candidate are dropped.
  - Between processes, Flow's proposal can reach the Coordinator before Inventory's preflight question. The guardians may then already be judging when the pause starts, and their verdicts are dropped (see `test_live_challenge_pauses_for_a_human_and_resumes`).
- After the answer (`/resume`), the round resumes:
  - A candidate that was mid-judgement goes back to both guardians.
  - A candidate rejected only for want of the answer is judged again. If it still breaks another constraint, Flow is asked to revise instead.
  - Held proposals and revisions are then processed in order.
- **Runtime contract:** Inventory sends its `Question` before the `Verdict` it belongs to, and remembers which device each of its question ids is about, so it can apply an `answer` action. Both are implemented in `agents/inventory.py`.
- Not handled yet: `Reassess` (challenges) has no event in `Round`.


## Options for humans (orchestrator)

Every round, the Coordinator puts the Flow Agent's lead plan and up to two alternatives (`Proposal.alternatives` / `Revision.alternatives`, built by `logic/candidates.py` and tested with hippo-sim) to both guardians. Every rejection, on any plan, adds its constraint, so the next round repairs all of them. The round ends with up to three `Recommendation`s (`option` 1-3) when at least two plans are accepted, when the lead is accepted and no alternative is left to repair, or at the last round with any plan accepted. Humans choose one in the Agent Room and sign it off; agent acceptance is never approval.
