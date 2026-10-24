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
- **The local HTTP server still runs.** In `run_async()`, a mailbox agent drops its local server only when it has no REST handlers. The inspector endpoints (`/agent_info`, `/connect`, `/messages`, on by default) and our own `on_rest_post` handlers keep it up. So the Coordinator can be a mailbox agent and still serve `start_round`, `reassess` and `resume` locally for the watchers.
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

## Test fixture: `agents/fixtures/hospital.json`

A stand-in until `data/hospitals/demo.json` exists. It is generated, not hand-edited:

```bash
node agents/scripts/export_fixture.mjs   # from the repo root, Node 22.18+
```

The script exports `hospital` from `apps/web/lib/stdb/mock-session.ts` in the upload file format (`{ "schemaVersion": 1, "hospital": … }`) and adds one device:

- **(a) `dev_unknown_7` was added for testing.** Type `unknown`, in `rm_imaging`, vulnerable, criticality `medium`, with one SMB/445 flow (`fl_unknown_7_smb`) to `ws_img_1`. The mock has no unknown device, and the Inventory Agent needs one. **`demo.json` should include this device** (the spec's `unknown_device_imaging` challenge needs it there, inactive until the challenge applies). `mock-session.ts` is unchanged.
- **(b) The mock devices have no `make` or `model`.** The spec's Inventory check also flags missing make or model, but on this data that would flag every device. **Until `demo.json` adds make and model, the Inventory Agent must flag only devices with `type: "unknown"` or with no flows.**

Other gaps between the mock and `HOSPITAL_SCHEMA.md`, for the lead:

- Patient groups have an `id`, which the schema's `PatientGroup` does not list (`types.ts` does).
- No flow sets `observed`, so all default to `true`.

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
- `Constraint.kind: max_rules` has no number field in the spec. Today it can only carry `targetIds`.
