# ASI:One Reasoning Orchestrator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the four uAgents' ASI:One chat reason with tools, narrate every negotiation event live in the thread, invoke specialists by `@handle`, and serve hospital facts over MCP, without touching the web app or watcher.

**Architecture:** `narrate.py` turns each round message into a one-line status the Coordinator sends to the chat sender as it happens. `brain.py` is one tool-calling loop (ASI:One `asi1`, Claude fallback) shared by all four agents; tools are MCP tools from `mcp_server.py` (in-process FastMCP) plus per-agent local tools over the state each agent keeps. The Coordinator's `ask_agent` tool sends a real chat message to a specialist and quotes the answer. Cards shrink to a device picker and the recommendation card.

**Tech Stack:** Python 3.12 in `agents/.venv`, uAgents 0.26.1 (`uagents_core.contrib.protocols.chat`), `mcp` (FastMCP server + in-memory client), `httpx` for ASI:One, `anthropic` for the fallback, pytest.

**Spec:** `docs/superpowers/specs/2026-10-24-asi1-reasoning-orchestrator-design.md`

## Global Constraints

- Branch `asi1`. Commit messages start with `F1:`. Only `agents/` and `docs/` change.
- Rule 8: a model never sets a verdict, a required role, or an answer. Tools return facts; the model writes prose.
- Every chat reply must pass `llm.FORBIDDEN` and the number rule: every number in the reply appears in that turn's tool results or the user's text. One retry with the errors, then the agent replies with the error text (rule 14, no fallback prose).
- Rule 10: every chat message sent or received, including narration lines, interim "Asking @handle" lines, and specialist question/answer pairs, is `relay.post`ed before it is sent, type `chat`, payload `{"text": ..., "via": "asi1"}`.
- Rule 5: `ask_agent` is refused (returns `{"error": "a round is running"}`) while any `Round` in `coordinator.rounds` has `state == "running"`.
- Never the words approved, ready, safe to deploy, death, died, fatal, mortality in any prompt or line.
- Run every check with `agents/.venv/bin/python -m pytest` from `agents/`. `ASI1_API_KEY` is deleted by `conftest.py`; tests never hit the network.
- Handles come from `runtime.PROFILES[name].handle`: `hippocratech-coordinator`, `hippocratech-inventory`, `hippocratech-flow`, `hippocratech-clinical-workflow`.
- `ASI1_MODEL` default is `asi1` everywhere (`llm.ASI1_DEFAULT_MODEL` moves with it).

## Review Focus

1. A model reply that quotes a number from an earlier turn's tool result (not this turn's) must be rejected and retried; test in Task 2.
2. `ask_agent` called with a handle that is not one of the three specialists must return an error, never send; test in Task 6.
3. A chat message arriving while a round from a different sender is running must still get a prose answer (only `ask_agent` is refused); test in Task 6.
4. A card button click arriving as planner prose ("The user picked action simulate for device mri_2") must still start a round; test in Task 4.
5. The round-end summary must be sent once even if two verdicts land in the same tick; test in Task 4 (`notified` flag).

---

### Task 1: Live narration lines

**Files:**
- Create: `agents/narrate.py`
- Modify: `agents/coordinator.py` (`execute()` lines 63-79, `handle()` lines 143-152, `begin()` lines 82-108)
- Test: `agents/tests/test_narrate.py`

**Interfaces:**
- Consumes: `protocol.Proposal/Revision/Verdict/Question/Recommendation`, `facts.AGENT_NAMES`, `runtime.PROFILES`, `cards.flow_label`, `cards.target_label`.
- Produces: `narrate.line(h: HospitalIndex, type: str, msg, agent: str | None = None) -> str` and `narrate.started(h, baseline: RunResult) -> str`, `narrate.failed(agent: str, error: str) -> str`. `type` is one of `proposal`, `revision`, `verdict`, `question`, `recommendation`. For `verdict`/`question` the agent comes from `msg.agent`; for `proposal`/`revision` it is `flow`; for `recommendation`, `coordinator`. `coordinator.narrate_chat(ctx, session_id: str, text: str)` sends a `TextContent`-only `ChatMessage` to `chats[session_id].sender` if that session came from chat, after relaying it.

- [ ] **Step 1: Write the failing tests**

```python
# agents/tests/test_narrate.py
import json
import narrate
from llm import FORBIDDEN, NUMBER, fact_numbers
from logic import hospital as hospital_mod
from protocol import Proposal, Verdict, Question, Constraint, RunResult
from tests_paths import FIXTURES

H = hospital_mod.load()
baseline = RunResult.model_validate_json((FIXTURES / "results" / "baseline.json").read_text())
cand = RunResult.model_validate_json((FIXTURES / "results" / "cand_isolate_imaging.json").read_text())

def proposal():
    p = json.loads((FIXTURES / "candidates" / "cand_isolate_imaging.json").read_text())["policy"]
    return Proposal(sessionId="s", round=1, policyId="cand_isolate_imaging", testResult=cand, reason="Cuts the path.", **p)

def test_started_names_flow_and_baseline_numbers():
    s = narrate.started(H, baseline)
    assert "@hippocratech-flow" in s and str(baseline.infectedCount) in s and str(baseline.ticks) in s

def test_proposal_line_has_handle_round_name_and_both_counts():
    s = narrate.line(H, "proposal", proposal(), baseline=baseline)
    assert s.startswith("[ @hippocratech-flow · round 1 ]") and '"' in s
    assert str(cand.infectedCount) in s and str(baseline.infectedCount) in s

def test_reject_line_names_the_constraint():
    v = Verdict(sessionId="s", round=1, policyId="p", agent="clinical_workflow", decision="reject",
                reason="It cuts imaging.", constraint=Constraint(kind="keep_flow", targetIds=["fl_mri2_pacs"]))
    s = narrate.line(H, "verdict", v)
    assert s.startswith("[ @hippocratech-clinical-workflow · round 1 ] rejected:") and "keep" in s

def test_accept_line_is_short():
    v = Verdict(sessionId="s", round=2, policyId="p", agent="inventory", decision="accept", reason="Fine.")
    assert narrate.line(H, "verdict", v) == "[ @hippocratech-inventory · round 2 ] accepted."

def test_question_line_names_the_device():
    q = Question(sessionId="s", id="q1", round=1, agent="inventory", targetId="dev_unknown_7", text="What is it?",
                 choices=["a", "b"], allowedRoles=["security"])
    assert H.devices["dev_unknown_7"]["name"] in narrate.line(H, "question", q)

def test_every_number_comes_from_the_message_and_no_forbidden_words():
    for s, msg in [(narrate.line(H, "proposal", proposal(), baseline=baseline), {"m": proposal().dict(), "b": baseline.dict()})]:
        assert {n for n in NUMBER.findall(s)} <= fact_numbers(msg)
        assert not FORBIDDEN.search(s)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `agents/.venv/bin/python -m pytest tests/test_narrate.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'narrate'`

- [ ] **Step 3: Implement `agents/narrate.py`**

Signatures: `handle(agent: str) -> str` (returns `"@" + PROFILES[agent].handle`), `started(h, baseline) -> str`, `line(h, type, msg, baseline: RunResult | None = None) -> str`, `failed(agent, error) -> str`. Lines follow the spec's table in section 0 exactly. The reject line is `rejected: {msg.reason} Needs: {cards.target_label(h, kind, ids)}.` when a constraint is present. The revision line uses `len(msg.diff.added)`/`len(msg.diff.removed)` as "{a} rules added, {r} removed".

- [ ] **Step 4: Run tests to verify they pass**

Run: `agents/.venv/bin/python -m pytest tests/test_narrate.py -v`
Expected: PASS

- [ ] **Step 5: Hook narration into the Coordinator**

In `coordinator.py` add:

```python
async def narrate_chat(ctx: Context, session_id: str, text: str) -> None:
    c = chats.get(session_id)
    if c is None:
        return
    await chat_send(ctx, c.sender, ChatMessage(content=[TextContent(text=text)]), session_id, text)
```

(`chat_send` relays the row itself when `text` is passed, so this writes exactly one `agent_message` row; Step 6 counts it.)

Call sites: in `begin()` after `baseline` is computed: `await narrate_chat(ctx, req.sessionId, narrate.started(H, baseline))` (place it after `chats[session_id]` is set by the chat handler, which it already is before `begin()` is called). In `handle()` after `events[...].append((type, msg))`: `await narrate_chat(ctx, msg.sessionId, narrate.line(H, type, msg, baseline=rnd.baseline))`. In `execute()` when `a.type == "recommendation"` after wording: `await narrate_chat(ctx, rnd.sessionId, narrate.line(H, "recommendation", msg))`. In `runtime.fail` callers inside the Coordinator (`begin`, `handle`): `await narrate_chat(ctx, session, narrate.failed(NAME, str(e)))`.

- [ ] **Step 6: Write the relay-row test**

Append to `tests/test_narrate.py`: with `WATCHER_RELAY_URL` unset and `RELAY_LOG_DIR` pointed at `tmp_path`, import `coordinator`, set `coordinator.chats["s1"] = coordinator.ChatRound(sender="agent1qsender", device_name="MRI 2")`, monkeypatch `coordinator.chat_send` with an async recorder, run `asyncio.run(coordinator.narrate_chat(ctx_stub, "s1", "[ x ] y"))`, and assert exactly one `agent_message` row with `type == "chat"`, `from == "coordinator"`, `to == "humans"`, `payload.text == "[ x ] y"` in `tmp_path / "s1.jsonl"`, and the recorder got one call. A `ctx_stub` can be `types.SimpleNamespace(send_raw=...)` only if `chat_send` is patched; it is.

- [ ] **Step 7: Run all tests**

Run: `agents/.venv/bin/python -m pytest -q`
Expected: all PASS (test_live_round skips without agents running)

- [ ] **Step 8: Commit**

```bash
git add agents/narrate.py agents/coordinator.py agents/tests/test_narrate.py
git commit -m "F1: narrate every negotiation event live in the ASI:One thread"
```

---

### Task 2: The reasoning loop (`brain.py`)

**Files:**
- Create: `agents/brain.py`, `agents/prompts/coordinator.md`, `agents/prompts/inventory.md`, `agents/prompts/flow.md`, `agents/prompts/clinical_workflow.md`
- Modify: `agents/llm.py` (line 31 `ASI1_DEFAULT_MODEL = "asi1"`, docstring lines 1-14: ASI:One `asi1`; rule 8, not rule 7, is why a model may read chat text)
- Test: `agents/tests/test_brain.py`

**Interfaces:**
- Consumes: `llm.FORBIDDEN`, `llm.NUMBER`, `llm.fact_numbers`, `llm._norm`, `llm._make_client`, `llm._asi1_model`, `llm.ASI1_URL`, `llm.LlmError`.
- Produces:

```python
@dataclass
class Tool:
    name: str
    description: str
    parameters: dict            # JSON schema, type object
    call: Callable[[dict], Awaitable[Any]]   # returns JSON-serialisable

@dataclass
class Turn:
    text: str                    # the final reply
    tools_called: list[str]      # tool names in order
    results: dict[str, Any]      # tool name → last result, this turn only
    source: str                  # "asi1" | "claude"

async def respond(storage, who: str, sender: str, text: str, tools: list[Tool], system: str,
                  session_id: str | None = None) -> Turn
def history_key(sender: str) -> str          # "chat:" + sender
MAX_TOOL_ROUNDS = 6
HISTORY_TURNS = 20
```

`storage` is `ctx.storage` (any object with `get(key)`/`set(key, value)`); history is stored as a list of `{"role", "content"}` dicts. `system` is the prompt file's text. The `x-session-id` header is `session_id` when given.

- [ ] **Step 1: Write the failing tests**

```python
# agents/tests/test_brain.py
import asyncio, json
import pytest
import brain

class Store(dict):
    def get(self, k): return super().get(k)
    def set(self, k, v): self[k] = v

def scripted(*replies):
    """Each reply: a dict for an assistant message. Tool-call replies give {"tool_calls": [...]}; text gives {"content": "..."}."""
    it = iter(replies); seen = []
    async def post(body):
        seen.append(body)
        msg = {"role": "assistant", "content": None, **next(it)}
        return {"choices": [{"message": msg, "finish_reason": "tool_calls" if msg.get("tool_calls") else "stop"}]}
    return post, seen

def call(name, args, id="c1"):
    return {"id": id, "type": "function", "function": {"name": name, "arguments": json.dumps(args)}}

async def lookup(args): return {"name": "MRI 2", "zone": "imaging", "flows": 3}
TOOLS = [brain.Tool("lookup_device", "look up", {"type": "object", "properties": {"query": {"type": "string"}}}, lookup)]

def run(post, text, store=None, tools=TOOLS):
    return asyncio.run(brain.respond(store or Store(), "coordinator", "agent1qs", text, tools, "sys", _post=post))

def test_tool_call_then_text(monkeypatch):
    monkeypatch.setenv("ASI1_API_KEY", "k")
    post, seen = scripted({"tool_calls": [call("lookup_device", {"query": "MRI 2"})]}, {"content": "MRI 2 is in imaging with 3 flows."})
    t = run(post, "what is MRI 2?")
    assert t.text == "MRI 2 is in imaging with 3 flows." and t.tools_called == ["lookup_device"] and t.source == "asi1"
    assert seen[1]["messages"][-1]["role"] == "tool" and json.loads(seen[1]["messages"][-1]["content"])["zone"] == "imaging"
    assert seen[0]["tools"][0]["function"]["name"] == "lookup_device"

def test_invented_number_is_retried_once_then_error(monkeypatch):
    monkeypatch.setenv("ASI1_API_KEY", "k")
    post, seen = scripted({"content": "There are 99 devices."}, {"content": "There are 99 devices."})
    with pytest.raises(brain.BrainError, match="99"):
        run(post, "how many devices?")
    assert len(seen) == 2 and "99" in seen[1]["messages"][-1]["content"]

def test_number_from_the_users_text_is_allowed(monkeypatch):
    monkeypatch.setenv("ASI1_API_KEY", "k")
    post, _ = scripted({"content": "Starting from MRI 2."})
    assert run(post, "simulate from MRI 2").text == "Starting from MRI 2."

def test_number_from_a_previous_turn_is_not_allowed(monkeypatch):
    monkeypatch.setenv("ASI1_API_KEY", "k")
    store = Store()
    post, _ = scripted({"tool_calls": [call("lookup_device", {"query": "MRI 2"})]}, {"content": "3 flows."})
    run(post, "what is MRI 2?", store)
    post, _ = scripted({"content": "Still 3 flows."}, {"content": "Still 3 flows."})
    with pytest.raises(brain.BrainError):
        run(post, "and now?", store)

def test_forbidden_word_is_rejected(monkeypatch):
    monkeypatch.setenv("ASI1_API_KEY", "k")
    post, _ = scripted({"content": "The plan is approved."}, {"content": "The plan is approved."})
    with pytest.raises(brain.BrainError, match="approved"):
        run(post, "is it done?")

def test_history_is_kept_per_sender_and_capped(monkeypatch):
    monkeypatch.setenv("ASI1_API_KEY", "k")
    store = Store()
    for i in range(25):
        post, seen = scripted({"content": "ok"})
        run(post, f"hi", store)
    hist = store.get(brain.history_key("agent1qs"))
    assert len(hist) == 2 * brain.HISTORY_TURNS and seen[0]["messages"][0]["role"] == "system"

def test_tool_loop_is_capped(monkeypatch):
    monkeypatch.setenv("ASI1_API_KEY", "k")
    post, seen = scripted(*([{"tool_calls": [call("lookup_device", {"query": "x"})]}] * 10))
    with pytest.raises(brain.BrainError, match="tool"):
        run(post, "loop")
    assert len(seen) == brain.MAX_TOOL_ROUNDS

def test_claude_is_used_when_only_its_key_is_set(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "k")
    calls = []
    async def fake_claude(system, messages, tools):
        calls.append(messages); return {"content": [{"type": "text", "text": "hello"}], "stop_reason": "end_turn"}
    monkeypatch.setattr(brain, "_claude", fake_claude)
    t = run(None, "hi")
    assert t.text == "hello" and t.source == "claude" and calls

def test_no_key_is_an_error(monkeypatch):
    with pytest.raises(brain.BrainError, match="ASI1_API_KEY"):
        run(None, "hi")
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `agents/.venv/bin/python -m pytest tests/test_brain.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'brain'`

- [ ] **Step 3: Implement `agents/brain.py`**

`respond(storage, who, sender, text, tools, system, session_id=None, _post=None)`; `_post` defaults to `_asi1_post(body, session_id) -> dict` (httpx POST to `llm.ASI1_URL`, `Authorization: Bearer $ASI1_API_KEY`, optional `x-session-id`, timeout 30 s, raises `BrainError` on non-200 or transport error). `_claude(system, messages, tools) -> dict` uses `llm._make_client().messages.create(model=llm._model(), max_tokens=600, system=..., messages=..., tools=[{name, description, input_schema}])` and returns `response.model_dump()`; convert tool_use blocks to the same internal shape. Picks ASI:One when `ASI1_API_KEY` is set, else Claude when `ANTHROPIC_API_KEY` is set, else `BrainError("neither ASI1_API_KEY nor ANTHROPIC_API_KEY is set")`.

Loop: messages = `[system] + history + [user]`; up to `MAX_TOOL_ROUNDS` posts; on `tool_calls`, run each tool (unknown tool → `{"error": "unknown tool X"}`), append assistant + one `tool` message per call; on text, run `checks(text, allowed)` where `allowed = fact_numbers(results_this_turn) | fact_numbers(text_of_user)`; on errors, append assistant text + a user message `"That reply can't be used: it " + "; it ".join(errors) + ". Write it again."` and loop once more; a second failure raises `BrainError`. On success save history (user, assistant) trimmed to the last `HISTORY_TURNS` pairs. `class BrainError(Exception)`.

- [ ] **Step 4: Write the four prompt files**

Each `agents/prompts/<agent>.md` is plain text, under 40 lines: who the agent is (from `profiles/<agent>.md`'s first section), the four handles and what each owns, "state only what a tool returned this turn; never a number you did not get from a tool or the user", "agents agreeing is never approval; humans sign off in the Hippocra.tech app", "never say approved, ready, safe to deploy, or anything about deaths or clinical outcomes", "one to four short sentences, no markdown headers", and for the Coordinator: "when you learn something from another agent, write it as `@handle said: \"...\"`", "for 'where can an attack start' call `show_device_picker`", "to start a simulation call `start_round`; the round narrates itself, so answer with one sentence".

- [ ] **Step 5: Run tests to verify they pass**

Run: `agents/.venv/bin/python -m pytest tests/test_brain.py tests/test_llm.py -v`
Expected: PASS (test_llm's model-name assertions updated to `asi1` if any mention `asi1-mini`)

- [ ] **Step 6: Commit**

```bash
git add agents/brain.py agents/prompts agents/llm.py agents/tests/test_brain.py agents/tests/test_llm.py
git commit -m "F1: tool-calling reasoning loop on ASI:One with Claude fallback"
```

---

### Task 3: Hospital MCP server and in-process client

**Files:**
- Create: `agents/mcp_server.py`
- Modify: `agents/requirements.txt` (add `mcp>=1.8`)
- Test: `agents/tests/test_mcp_server.py`

**Interfaces:**
- Consumes: `logic.hospital.load`, `logic.inventory.dormant`, `logic.inventory.flagged_devices`, `chat.resolve_device`, `chat.devices_on_network`, `tools.run_sim`, `protocol.Policy`, `chat.DEMO_SEED`.
- Produces: `mcp_server.mcp` (a `FastMCP("hippocratech-hospital")` with tools `list_devices`, `lookup_device(query: str)`, `protected_flows()`, `test_run(patient_zero: str, policy: dict | None = None)`), and `mcp_server.as_brain_tools() -> list[brain.Tool]` which lists the server's tools through an in-memory MCP client session (`mcp.shared.memory.create_connected_server_and_client_session` or `FastMCP`'s equivalent in the installed version) and wraps `tools/call` so each `Tool.call(args)` returns the parsed JSON text of the first content block.

- [ ] **Step 1: Install the dependency**

Run: `agents/.venv/bin/pip install "mcp>=1.8"` and add `mcp>=1.8` to `agents/requirements.txt`.
Expected: `agents/.venv/bin/python -c "from mcp.server.fastmcp import FastMCP; print('ok')"` prints `ok`.

- [ ] **Step 2: Write the failing tests**

```python
# agents/tests/test_mcp_server.py
import asyncio, json, os
import pytest
import mcp_server
from logic import hospital as hospital_mod
from logic.inventory import dormant

H = hospital_mod.load()

def tools():
    return {t.name: t for t in asyncio.run(mcp_server.as_brain_tools())}

def test_tools_are_listed_over_mcp_with_schemas():
    t = tools()
    assert set(t) == {"list_devices", "lookup_device", "protected_flows", "test_run"}
    assert "query" in t["lookup_device"].parameters["properties"]
    assert t["lookup_device"].description.strip()

def test_list_devices_excludes_dormant():
    out = asyncio.run(tools()["list_devices"].call({}))
    ids = {d["id"] for d in out}
    assert "mri_2" in ids and not any(dormant(H, i) for i in ids)

def test_lookup_by_name_and_id_and_unknown():
    look = tools()["lookup_device"]
    assert asyncio.run(look.call({"query": "MRI 2"}))["id"] == "mri_2"
    assert asyncio.run(look.call({"query": "mri2"}))["id"] == "mri_2"
    assert "error" in asyncio.run(look.call({"query": "toaster"}))

def test_protected_flows_have_names():
    out = asyncio.run(tools()["protected_flows"].call({}))
    assert out and all({"id", "from", "to"} <= set(f) for f in out)

def test_test_run_parity_with_run_sim(monkeypatch):
    monkeypatch.setenv("HIPPO_SIM_FIXTURES", "1")
    from tools import run_sim
    from chat import DEMO_SEED
    want = run_sim(None, "mri_2", DEMO_SEED, []).dict()
    got = asyncio.run(tools()["test_run"].call({"patient_zero": "mri_2"}))
    assert got["infectedCount"] == want["infectedCount"] and got["ticks"] == want["ticks"]

def test_test_run_error_is_returned_not_raised(monkeypatch):
    monkeypatch.setenv("HIPPO_SIM_FIXTURES", "1")
    assert "error" in asyncio.run(tools()["test_run"].call({"patient_zero": "ct_1"}))
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `agents/.venv/bin/python -m pytest tests/test_mcp_server.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'mcp_server'`

- [ ] **Step 4: Implement `agents/mcp_server.py`**

Each `@mcp.tool()` is `async`, returns a JSON string (`json.dumps`), and has a docstring in the Innovation Lab style: when to call, each argument, one example. `lookup_device` returns `{id, name, type, zone, room, vlan, dormant, flows_in: [...], flows_out: [...]}` or `{"error": chat.unknown_device(H, query)}`. `test_run` validates `policy` with `protocol.Policy` when given, wraps it in a `Candidate` the way `flow.py` does, calls `tools.run_sim(candidate, patient_zero, chat.DEMO_SEED, [])`, returns `result.dict()`, and catches `Exception` into `{"error": f"{type(e).__name__}: {e}"}`. `as_brain_tools()` opens one in-memory client session per call (keep it simple; cache the session at module level only if the test runtime exceeds a few seconds).

- [ ] **Step 5: Run tests to verify they pass**

Run: `agents/.venv/bin/python -m pytest tests/test_mcp_server.py -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add agents/mcp_server.py agents/requirements.txt agents/tests/test_mcp_server.py
git commit -m "F1: hospital and simulator as an MCP server the agents call in-process"
```

---

### Task 4: Coordinator chat on the reasoning loop

**Files:**
- Modify: `agents/coordinator.py` (chat section lines 180-292: replace `on_chat` body; add local tools; move the summary outside the lock), `agents/chat.py` (delete `SIMULATE`, `LOOKUP`, `DEVICES`, `PROTECTED`, `parse`, `help_text`, `started`, `could_not_start`, `summary`, `status`; keep `Command`, `selection`, `resolve_device`, `devices_on_network`, `unknown_device`, `DEMO_SEED`, `EXAMPLE`)
- Test: `agents/tests/test_chat.py` (drop `parse` cases, keep `selection`/`resolve_device`), `agents/tests/test_coordinator_chat.py` (new)

**Interfaces:**
- Consumes: `brain.respond`, `brain.Tool`, `mcp_server.as_brain_tools`, `narrate`, `cards.picker_card`, `cards.recommendation_card` (Task 7 adds them; until then import the existing `help_card`/`summary_card` and swap in Task 7).
- Produces in `coordinator.py`:

```python
def local_tools(ctx: Context, sender: str) -> list[brain.Tool]   # start_round, round_status, recommendation, show_device_picker, ask_agent
async def chat_turn(ctx: Context, sender: str, text: str) -> None  # relay in, respond(), relay out, send text (+ card if the turn called show_device_picker or recommendation returned one)
picked: dict[str, str]        # sender → "picker" | "recommendation:<session>" set by tools during the turn, read by chat_turn
```

`start_round(device_query)` → `{"session_id", "device"}` or `{"error"}`; it resolves with `chat.resolve_device`, sets `chats[session_id]`, calls `begin()`. `round_status(session_id=None)` → `{"session_id", "device", "state", "round", "events": [{"type", "agent", "round", "line"}]}` using `narrate.line` for each event (last 30). `recommendation(session_id=None)` → `{"policy_name", "explanation", "required_roles": [names], "infected_before", "infected_after", "patients_affected_before", "patients_affected_after"}` or `{"none": True}`. Session defaults to `last_session[0]`. `ask_agent` is a stub returning `{"error": "not yet"}` until Task 6.

- [ ] **Step 1: Write the failing tests**

```python
# agents/tests/test_coordinator_chat.py
import asyncio, json
import pytest

@pytest.fixture
def coord(monkeypatch, tmp_path):
    monkeypatch.setenv("RELAY_LOG_DIR", str(tmp_path)); monkeypatch.delenv("WATCHER_RELAY_URL", raising=False)
    monkeypatch.setenv("HIPPO_SIM_FIXTURES", "1"); monkeypatch.setenv("ASI1_API_KEY", "k")
    import coordinator
    sent = []
    async def fake_send(ctx, to, message, session_id, text=None, card=None): sent.append((to, message, session_id, text, card))
    monkeypatch.setattr(coordinator, "chat_send", fake_send)
    coordinator.rounds.clear(); coordinator.chats.clear(); coordinator.last_session.clear()
    return coordinator, sent

def names(tools): return {t.name for t in tools}

def test_local_tools_exist(coord):
    c, _ = coord
    assert {"start_round", "round_status", "recommendation", "show_device_picker", "ask_agent"} <= names(c.local_tools(None, "agent1qs"))

def test_start_round_tool_resolves_and_registers_chat(coord, monkeypatch):
    c, _ = coord
    async def fake_begin(ctx, req): c.rounds[req.sessionId] = type("R", (), {"state": "running", "round": 1})(); return c.RestAck(ok=True, detail="")
    monkeypatch.setattr(c, "begin", fake_begin)
    tool = {t.name: t for t in c.local_tools(None, "agent1qs")}["start_round"]
    out = asyncio.run(tool.call({"device_query": "mri 2"}))
    assert out["device"] == "MRI 2" and c.chats[out["session_id"]].sender == "agent1qs"
    assert "error" in asyncio.run(tool.call({"device_query": "toaster"}))

def test_chat_turn_sends_text_and_picker_card(coord, monkeypatch):
    c, sent = coord
    async def fake_respond(storage, who, sender, text, tools, system, session_id=None):
        await {t.name: t for t in tools}["show_device_picker"].call({})
        return __import__("brain").Turn(text="Pick one.", tools_called=["show_device_picker"], results={}, source="asi1")
    monkeypatch.setattr(c.brain, "respond", fake_respond)
    asyncio.run(c.chat_turn(c.ctx_stub(), "agent1qs", "where can an attack start?"))
    assert sent[-1][3] == "Pick one." and sent[-1][4] is not None

def test_planner_prose_selection_becomes_a_user_turn(coord, monkeypatch):
    c, _ = coord
    seen = []
    async def fake_respond(storage, who, sender, text, tools, system, session_id=None):
        seen.append(text); return __import__("brain").Turn(text="ok", tools_called=[], results={}, source="asi1")
    monkeypatch.setattr(c.brain, "respond", fake_respond)
    asyncio.run(c.chat_turn(c.ctx_stub(), "agent1qs", "The user picked action simulate for device mri_2"))
    assert seen == ["simulate ransomware from mri_2"]

def test_brain_error_is_sent_as_the_reply(coord, monkeypatch):
    c, sent = coord
    async def boom(*a, **k): raise c.brain.BrainError("ASI:One error 500")
    monkeypatch.setattr(c.brain, "respond", boom)
    asyncio.run(c.chat_turn(c.ctx_stub(), "agent1qs", "hi"))
    assert "ASI:One error 500" in sent[-1][3]

def test_summary_is_sent_once(coord, monkeypatch):
    c, sent = coord
    async def fake_respond(*a, **k): return __import__("brain").Turn(text="Done.", tools_called=[], results={}, source="asi1")
    monkeypatch.setattr(c.brain, "respond", fake_respond)
    c.chats["s"] = c.ChatRound(sender="agent1qs", device_name="MRI 2")
    rnd = type("R", (), {"state": "done", "round": 2, "sessionId": "s", "recommendation": None, "baseline": None})()
    asyncio.run(c.notify_chat(c.ctx_stub(), rnd)); asyncio.run(c.notify_chat(c.ctx_stub(), rnd))
    asyncio.run(asyncio.sleep(0))
    assert sum(1 for s in sent if s[3] == "Done.") == 1
```

`coordinator.ctx_stub()` returns an object with `storage` (a dict-backed `get`/`set`) and a `logger`; add it next to `ChatRound` and mark it test-only in its docstring.

- [ ] **Step 2: Run tests to verify they fail**

Run: `agents/.venv/bin/python -m pytest tests/test_coordinator_chat.py -v`
Expected: FAIL with `AttributeError: module 'coordinator' has no attribute 'local_tools'`

- [ ] **Step 3: Implement the chat rewrite in `coordinator.py`**

`on_chat`: ack; empty text with `StartSessionContent` → `chat_turn(ctx, sender, "hello")`; else `sel = chat.selection(text)`; if `sel` and `sel.kind == "simulate"` → `text = f"simulate ransomware from {sel.device}"`, other kinds map to `"status"`, `"what is {device}?"`, `"where can an attack start?"`, `"protected flows"`; then `await chat_turn(ctx, sender, text)`. `chat_turn`: relay the received text (`humans → coordinator`), `tools = await mcp_server.as_brain_tools() + local_tools(ctx, sender)`, `system = PROMPTS["coordinator"]` (read once at import from `agents/prompts/coordinator.md`), `try: turn = await brain.respond(ctx.storage, NAME, sender, text, tools, system, session_id=...)` `except brain.BrainError as e: await reply(ctx, sender, f"I couldn't answer: {e}")`; then `card = picked.pop(sender, None)` → `cards.picker_card(...)` or `cards.recommendation_card(...)`, `reply_card` or `reply`. `notify_chat`: keep the `notified` guard, then `asyncio.create_task(_summary(ctx, rnd))` where `_summary` runs `chat_turn`-like logic with the user text `"The round just ended; summarise it for me."` and attaches the recommendation card. Remove the old `status`/`devices`/`protected`/`help`/`lookup` branches.

- [ ] **Step 4: Trim `chat.py` and `tests/test_chat.py`**

Delete the regex parser and the text builders listed in Files. In `test_chat.py` keep only the `selection` rows of the parametrize (JSON and planner prose) plus the `resolve_device`/`unknown_device` tests, asserting on `chat.selection(text)` instead of `chat.parse`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `agents/.venv/bin/python -m pytest tests/test_coordinator_chat.py tests/test_chat.py tests/test_narrate.py -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add agents/coordinator.py agents/chat.py agents/tests/test_coordinator_chat.py agents/tests/test_chat.py
git commit -m "F1: the Coordinator's ASI:One chat reasons with tools instead of regexes"
```

---

### Task 5: Specialists on the reasoning loop with per-session state

**Files:**
- Modify: `agents/agent_chat.py` (replace `reply_text`/`intro` use in `on_chat` with `brain.respond`; keep `note`, `last_said`, `intro` as a tool), `agents/flow.py` (lines 37, 84-140: keep `tested` and `reason` per session), `agents/inventory.py` (`Session` lines 32-39: add `questions: list[Question]`), `agents/clinical_workflow.py` (lines 25-36: keep judged `(policy_name, verdict)` per session)
- Test: `agents/tests/test_agent_chat.py` (rewrite), `agents/tests/test_specialist_tools.py` (new)

**Interfaces:**
- Consumes: `brain.respond`, `brain.Tool`, `mcp_server.as_brain_tools`, `PROMPTS[name]`.
- Produces: `agent_chat.make_chat(name: str, agent: Agent, tools: Callable[[], list[brain.Tool]]) -> Protocol`; `agent_chat.intro_tool(name) -> brain.Tool` (`who_am_i`), `agent_chat.last_said_tool(name) -> brain.Tool`. Per agent:
  - `flow.tools() -> list[Tool]`: `last_proposal()` → `{session_id, round, policy_name, infected_with, infected_without, rules}`; `candidates()` → `[{id, name, infected, rules}]` for the last session's `tested`; `why_revised()` → `{reason}` or `{"none": True}`. Module state: `history: dict[str, FlowSession]` with `FlowSession(tested: list[tuple[Candidate, RunResult]], last: Proposal | Revision | None, baseline: RunResult | None)`.
  - `inventory.tools()`: `unconfirmed_devices()` → `[{id, name, room}]` from `logic.inventory.flagged_devices(H, s.confirmed, s.challenges)` of the last session; `last_question()` → `{device, text, choices}` or none; `device_owner(query)` → `{id, name, confirmed_as}` or `{confirmed_as: None}`.
  - `clinical_workflow.tools()`: `last_verdict()` → `{round, decision, reason, needs}`; `flows_broken_by(policy_name)` → `[{flow, purpose}]` from the stored judged policy's `testResult.removedFlows` filtered through `H.flows[...]["protected"]`, or `{"error": "no policy named ..."}`.

- [ ] **Step 1: Write the failing tests**

```python
# agents/tests/test_specialist_tools.py
import asyncio, json
import pytest
from protocol import Proposal, RunResult, Verdict
from tests_paths import FIXTURES

cand = RunResult.model_validate_json((FIXTURES / "results" / "cand_isolate_imaging.json").read_text())
base = RunResult.model_validate_json((FIXTURES / "results" / "baseline.json").read_text())

def test_clinical_remembers_judged_policies(monkeypatch):
    import clinical_workflow as cw
    p = json.loads((FIXTURES / "candidates" / "cand_isolate_imaging.json").read_text())["policy"]
    prop = Proposal(sessionId="s", round=1, policyId="x", testResult=cand, **p)
    cw.remember("s", prop, Verdict(sessionId="s", round=1, policyId="x", agent="clinical_workflow", decision="reject", reason="r"))
    t = {x.name: x for x in cw.tools()}
    assert asyncio.run(t["last_verdict"].call({}))["decision"] == "reject"
    assert isinstance(asyncio.run(t["flows_broken_by"].call({"policy_name": p["name"]})), list)
    assert "error" in asyncio.run(t["flows_broken_by"].call({"policy_name": "nope"}))

def test_inventory_lists_unconfirmed(monkeypatch):
    import inventory
    s = inventory.sessions.setdefault("s", inventory.Session()); s.challenges = ["unknown_device_imaging"]; s.baseline = base
    inventory.last_session[:] = ["s"]
    t = {x.name: x for x in inventory.tools()}
    assert any(d["id"] == "dev_unknown_7" for d in asyncio.run(t["unconfirmed_devices"].call({})))

def test_flow_reports_candidates_and_last_proposal():
    import flow
    from protocol import Candidate
    p = json.loads((FIXTURES / "candidates" / "cand_isolate_imaging.json").read_text())
    c = Candidate(**p)
    flow.history["s"] = flow.FlowSession(tested=[(c, cand)], last=Proposal(sessionId="s", round=1, policyId=c.id, testResult=cand, **c.policy.dict()), baseline=base)
    flow.last_session[:] = ["s"]
    t = {x.name: x for x in flow.tools()}
    assert asyncio.run(t["candidates"].call({}))[0]["id"] == c.id
    assert asyncio.run(t["last_proposal"].call({}))["infected_without"] == base.infectedCount
```

`tests/test_agent_chat.py`: keep `test_intro_comes_from_the_profile_without_markdown`; replace the second test with one that patches `brain.respond` to return a `Turn` and asserts `make_chat`'s handler relays the received and sent lines and calls `send` once (same structure as Task 4's `test_chat_turn_sends_text_and_picker_card`, using a fake `ctx` with `storage` and a recorded `send_raw`).

- [ ] **Step 2: Run tests to verify they fail**

Run: `agents/.venv/bin/python -m pytest tests/test_specialist_tools.py tests/test_agent_chat.py -v`
Expected: FAIL with `AttributeError` on `remember`/`tools`/`history`

- [ ] **Step 3: Implement the state and tools in the three specialists**

Flow: in `on_request`, after `tested` and `msg` are built, `history[req.sessionId] = FlowSession(tested, msg, req.baseline)`; `last_session[:] = [req.sessionId]`. Inventory: `last_session` list set in `on_request`; `Session.questions.append(q)` in `ask()`. Clinical: `remember(session_id, msg, verdict)` called in `judge` after wording; store `judged: dict[str, list[tuple[Proposal | Revision, Verdict]]]`. Each module's `tools()` builds `brain.Tool`s over that state with `async` closures. Each agent's `agent.include(agent_chat.make_chat(NAME, agent, tools), ...)`.

- [ ] **Step 4: Rewrite `agent_chat.on_chat`**

Ack; relay received; `turn = await brain.respond(ctx.storage, name, sender, text, await mcp_server.as_brain_tools() + tools() + [intro_tool(name), last_said_tool(name)], PROMPTS[name])` in a try; on `BrainError` the answer is `f"I couldn't answer: {e}"`; relay sent; send one `ChatMessage`. Never starts a round (no `start_round` tool here).

- [ ] **Step 5: Run tests to verify they pass**

Run: `agents/.venv/bin/python -m pytest tests/test_specialist_tools.py tests/test_agent_chat.py -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add agents/agent_chat.py agents/flow.py agents/inventory.py agents/clinical_workflow.py agents/tests/test_specialist_tools.py agents/tests/test_agent_chat.py
git commit -m "F1: specialists answer ASI:One with tools over their own round state"
```

---

### Task 6: `ask_agent`: visible `@handle` invocation

**Files:**
- Modify: `agents/coordinator.py` (`local_tools`: replace the `ask_agent` stub), `agents/agent_chat.py` (the handler must reply to the Coordinator exactly as to a user, so `send_and_receive` matches)
- Test: `agents/tests/test_ask_agent.py`, `agents/tests/test_live_round.py` (one new live case, skipped without agents)

**Interfaces:**
- Consumes: `addresses.address(name)`, `runtime.PROFILES`, `narrate.handle`.
- Produces: `coordinator.ask_agent(ctx, sender, handle: str, question: str) -> dict` returning `{"agent": handle, "said": text}` or `{"error": ...}`; `coordinator.HANDLES: dict[str, str]` handle → agent name for the three specialists; `ASK_TIMEOUT_S = 25`.

- [ ] **Step 1: Prototype `send_and_receive` with the chat protocol**

Run `agents/run_all.py` with `HIPPO_SIM_FIXTURES=1` and, in a scratch script under the scratchpad directory, a throwaway uAgent that calls `ctx.send_and_receive(addresses.address("inventory"), ChatMessage(content=[TextContent(text="which devices can't you identify?")]), response_type=ChatMessage, timeout=25)`. Expected: a `ChatMessage` back within the timeout even though the specialist sends a `ChatAcknowledgement` first. If it times out or returns the ack, implement `Ask(Strict)`/`Said(Strict)` models on the hippocratech `protocol` (fields `sessionId`, `question`/`text`, `handle`) and route `ask_agent` through them, with `agent_chat` handling `Ask` by the same `respond()` call. Record which path was taken in the `ask_agent` docstring.

- [ ] **Step 2: Write the failing tests**

```python
# agents/tests/test_ask_agent.py
import asyncio
import pytest

@pytest.fixture
def coord(monkeypatch, tmp_path):
    monkeypatch.setenv("RELAY_LOG_DIR", str(tmp_path)); monkeypatch.delenv("WATCHER_RELAY_URL", raising=False)
    import coordinator
    coordinator.rounds.clear(); coordinator.chats.clear(); coordinator.last_session.clear()
    return coordinator, tmp_path

def rows(path, session): 
    import json
    return [json.loads(l) for l in (path / f"{session}.jsonl").read_text().splitlines()]

def test_unknown_handle_is_refused_without_sending(coord, monkeypatch):
    c, _ = coord
    called = []
    monkeypatch.setattr(c, "_ask_over_wire", lambda *a, **k: called.append(a))
    out = asyncio.run(c.ask_agent(c.ctx_stub(), "agent1qs", "hippocratech-nope", "hi"))
    assert "error" in out and not called

def test_refused_while_any_round_is_running(coord):
    c, _ = coord
    c.rounds["other"] = type("R", (), {"state": "running"})()
    assert asyncio.run(c.ask_agent(c.ctx_stub(), "agent1qs", "hippocratech-flow", "why?")) == {"error": "a round is running"}

def test_interim_line_question_and_answer_are_relayed_in_order(coord, monkeypatch):
    c, path = coord
    sent = []
    async def fake_send(ctx, to, message, session_id, text=None, card=None): sent.append(text)
    monkeypatch.setattr(c, "chat_send", fake_send)
    async def wire(ctx, agent, question): return "Two devices have no owner on record."
    monkeypatch.setattr(c, "_ask_over_wire", wire)
    out = asyncio.run(c.ask_agent(c.ctx_stub(), "agent1qs", "hippocratech-inventory", "which devices can't you identify?"))
    assert out == {"agent": "hippocratech-inventory", "said": "Two devices have no owner on record."}
    assert sent == ["Asking @hippocratech-inventory: which devices can't you identify?"]
    r = [(x["from"], x["to"], x["payload"]["text"]) for x in rows(path, "asi1-chat") if x["type"] == "chat"]
    assert r == [("coordinator", "humans", sent[0]),
                 ("coordinator", "inventory", "which devices can't you identify?"),
                 ("inventory", "coordinator", "Two devices have no owner on record.")]

def test_timeout_is_an_error_result(coord, monkeypatch):
    c, _ = coord
    async def wire(ctx, agent, question): raise TimeoutError()
    monkeypatch.setattr(c, "_ask_over_wire", wire)
    async def fake_send(*a, **k): pass
    monkeypatch.setattr(c, "chat_send", fake_send)
    assert "did not answer" in asyncio.run(c.ask_agent(c.ctx_stub(), "agent1qs", "hippocratech-flow", "q"))["error"]
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `agents/.venv/bin/python -m pytest tests/test_ask_agent.py -v`
Expected: FAIL with `AttributeError: module 'coordinator' has no attribute 'ask_agent'`

- [ ] **Step 4: Implement `ask_agent` and `_ask_over_wire`**

`_ask_over_wire(ctx, agent: str, question: str) -> str` does the transport chosen in Step 1 and returns the specialist's text (raises `TimeoutError` on no answer). `ask_agent` does, in order: handle check; rule-5 check; `narrate_chat`-style interim line to the sender (`Asking @{handle}: {question}`) via `chat_send` into the sender's last round session or `CHAT_SESSION`; `relay.post(session, round, NAME, agent, "chat", {"text": question, "via": "asi1"}, direction="sent")`; `_ask_over_wire`; `relay.post(session, round, agent, NAME, "chat", {"text": said, "via": "asi1"}, direction="received")`; return. Wire the real tool into `local_tools` with parameters `{handle: string (enum of the three), question: string}`.

- [ ] **Step 5: Add the live case**

In `tests/test_live_round.py`, alongside the existing chat case, a test that sends `"@hippocratech-coordinator ask the inventory agent which devices it can't identify"` through `tests/chat_sender.py` and asserts the relay log for `asi1-chat` has a `coordinator → inventory` chat row followed by `inventory → coordinator`. Skipped unless the agents are running, like its neighbours.

- [ ] **Step 6: Run tests to verify they pass**

Run: `agents/.venv/bin/python -m pytest tests/test_ask_agent.py -v`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add agents/coordinator.py agents/agent_chat.py agents/protocol.py agents/tests/test_ask_agent.py agents/tests/test_live_round.py
git commit -m "F1: the Coordinator asks specialists by @handle in the ASI:One thread"
```

---

### Task 7: Two cards

**Files:**
- Modify: `agents/cards.py` (delete `help_card`, `devices_card`, `protected_card`, `device_card`, `started_card`, `progress_card`, `summary_card` and their private helpers; keep primitives, `message`, `metadata`, `depth`, `device_name`, `flow_label`, `target_label`, `plural`, `affected`), `agents/coordinator.py` (use the two new builders)
- Test: `agents/tests/test_cards.py` (rewrite)

**Interfaces:**
- Produces: `cards.picker_card(h, on_network: list[str], bubble: str) -> ChatMessage` (six rows from `PICK_DEVICES` that are on the network, each `item([...], "simulate", device=id)`, `interactive=True`); `cards.recommendation_card(h, session_id, rec: Recommendation, baseline: RunResult, room_url: str, bubble: str) -> ChatMessage` (policy name heading, four numbers in two groups "Infected before/after", "Patients affected before/after", roles as `badge`, one `button("Open the live room", "open", url=room_url)`, `interactive=False`).

- [ ] **Step 1: Write the failing tests**

```python
# agents/tests/test_cards.py (replace)
import json
import cards
from cards import depth
from logic import hospital as hospital_mod
from protocol import Recommendation, RunResult, Verdict, Policy
from tests_paths import FIXTURES

H = hospital_mod.load()
base = RunResult.model_validate_json((FIXTURES / "results" / "baseline.json").read_text())
res = RunResult.model_validate_json((FIXTURES / "results" / "cand_isolate_imaging.json").read_text())
policy = Policy(**json.loads((FIXTURES / "candidates" / "cand_isolate_imaging.json").read_text())["policy"])
rec = Recommendation(policy=policy, testResult=res, verdicts=[], explanation="Works.", requiredRoles=["security"])

def payload(msg):
    return json.loads(next(c.metadata["card_payload"] for c in msg.content if c.type == "metadata"))["root"]

def test_picker_has_at_most_six_rows_and_is_interactive():
    m = cards.picker_card(H, ["mri_2", "ct_1", "srv_pacs", "srv_file", "ws_er_1", "ns_icu", "ws_er_2"], "Pick one.")
    root = payload(m)
    items = next(n for n in root["children"] if n["type"] == "list")["items"]
    assert len(items) == 6 and items[0]["action"]["selection"]["action"] == "simulate"
    assert next(c.metadata for c in m.content if c.type == "metadata")["requires_card_interaction"] == "true"
    assert depth(root) <= 8

def test_recommendation_card_has_four_numbers_roles_and_room_link():
    m = cards.recommendation_card(H, "s", rec, base, "http://x/room/s", "Done.")
    s = json.dumps(payload(m))
    for n in (base.infectedCount, res.infectedCount, cards.affected(base), cards.affected(res)):
        assert str(n) in s
    assert "Security" in s and "http://x/room/s" in s and "approved" not in s.lower()
    assert len(json.dumps(payload(m))) < 64 * 1024 and depth(payload(m)) <= 8

def test_deleted_cards_are_gone():
    for name in ("help_card", "devices_card", "protected_card", "device_card", "started_card", "progress_card", "summary_card"):
        assert not hasattr(cards, name)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `agents/.venv/bin/python -m pytest tests/test_cards.py -v`
Expected: FAIL with `AttributeError: module 'cards' has no attribute 'picker_card'`

- [ ] **Step 3: Implement the two builders, delete the rest, update the Coordinator's two call sites**

- [ ] **Step 4: Run tests to verify they pass**

Run: `agents/.venv/bin/python -m pytest -q`
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add agents/cards.py agents/coordinator.py agents/tests/test_cards.py
git commit -m "F1: ASI:One cards shrink to the device picker and the recommendation"
```

---

### Task 8: Docs and a real run

**Files:**
- Modify: `docs/hippocratech/CODE_REFERENCE.md` (rows for `narrate.py`, `brain.py`, `mcp_server.py`, `prompts/*.md`, the new tests; update `chat.py`, `cards.py`, `agent_chat.py`, `coordinator.py`, `llm.py` rows), `docs/hippocratech/AGENTVERSE_SETUP.md` (step 3: `ASI1_MODEL` default `asi1`, `mcp` in requirements; "what you can say" now free-form), `docs/hippocratech/AGENT_NOTES.md` (one paragraph: a model reads chat text to pick tools; rule 8 keeps decisions in code; rule 7 is about reducers)

- [ ] **Step 1: Update the three docs**

- [ ] **Step 2: Run the agents and a real thread**

`cd agents && .venv/bin/python run_all.py` with `ASI1_API_KEY`, `AGENT_MAILBOX=1`, `HIPPO_SIM_FIXTURES=1` (or the engine). On ASI:One, to `@hippocratech-coordinator`: "what happens if ransomware starts at MRI 2?", then "why did clinical workflow reject the first plan?", then to `@hippocratech-inventory`: "which devices can't you identify?". Expected: narration lines appear during the round, the final summary quotes agents by handle, the follow-up produces an "Asking @hippocratech-clinical-workflow…" line, and the specialist answers directly. Paste the transcript into the commit message body.

- [ ] **Step 3: Full test run**

Run: `agents/.venv/bin/python -m pytest -q`
Expected: all PASS

- [ ] **Step 4: Commit**

```bash
git add docs/hippocratech/CODE_REFERENCE.md docs/hippocratech/AGENTVERSE_SETUP.md docs/hippocratech/AGENT_NOTES.md
git commit -m "F1: docs for the ASI:One reasoning orchestrator"
```
