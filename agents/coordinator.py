"""Sign-off Coordinator (uAgent): runs rounds; cannot approve anything.

One logic.coordinator.Round per session. REST handlers (called by the watchers):
POST /start_round, /resume, /reassess. Every Action the Round returns is carried
out here: to an agent → uAgents message; to "humans" or "relay" → relay row.
Claude (llm.py) words the Recommendation's explanation; it cannot change the plan,
the numbers or the required roles.

It is the orchestrator, and the only agent that speaks the chat protocol (ASI:One):
"simulate ransomware from MRI 2" starts a round through the same begin() as
/start_round, and the sender gets the result as an ASI:One card when it ends. Lookups
("what is PACS?", "devices", "protected flows") are answered from the hospital file.
chat.py reads the text (and card button clicks); cards.py builds the replies; all code.
"""

import time
import asyncio
import copy
import json
import uuid
from dataclasses import dataclass, field

from uagents import Context, Model, Protocol
from uagents_core.contrib.protocols.chat import (
    ChatAcknowledgement,
    ChatMessage,
    MetadataContent,
    StartSessionContent,
    TextContent,
    chat_protocol_spec,
)

import addresses
import brain
import cards
import chat
import facts
import llm
import mcp_server
import narrate
from config import AGENTS, settings
from logic import hospital as hospital_mod
from logic.coordinator import Action, Round
from protocol import Answer, Proposal, Question, Reassess, RestAck, Resume, Revision, StartRound, Verdict
from pathlib import Path

from runtime import PROFILES, fail, make_agent, reason_of, received, send
from tools import relay, run_sim

NAME = "coordinator"
CHAT_SESSION = "asi1-chat"  # relay session for chat that doesn't belong to a round
agent, protocol = make_agent(NAME)
H = hospital_mod.load(settings().hospital_path)
rounds: dict[str, Round] = {}
# When each session's round began (monotonic seconds); a running round older than this with no end is abandoned.
started: dict[str, float] = {}
STALE_ROUND_S = 90.0
events: dict[str, list[tuple[str, object]]] = {}  # session → (type, message) seen, for chat summaries
lock = asyncio.Lock()  # one event at a time, REST, messages and chat alike


@dataclass
class ChatRound:
    sender: str  # the chat user's agent address
    device_name: str
    notified: bool = False
    session: uuid.UUID | None = None  # the envelope session the chat arrived in: ASI:One's thread key
    trace: list[str] = field(default_factory=list)  # every narration line so far, in order
    last_sent: float = 0.0  # monotonic time of the last trace message
    flush: asyncio.Task | None = None  # the pending coalesced send, if any
    summary_sent: bool = False


NARRATE_INTERVAL_S = 4.0  # ASI:One rate-limits bursts (429): at most one trace message per interval
SEND_TRIES = 4
SEND_BACKOFF_S = 2.0


def _with_session(ctx: Context, session: uuid.UUID | None):
    """The same context, stamping outgoing envelopes with `session`. uAgents takes the
    envelope session from the sending handler's context, and ASI:One ties a message to a
    thread by that session; narration and the summary go out from round handlers, so
    they must carry the chat's session or ASI:One drops them."""
    if session is None or getattr(ctx, "session", None) == session:
        return ctx
    c = copy.copy(ctx)
    c._session = session
    return c


chats: dict[str, ChatRound] = {}  # session → who to tell when it ends
last_session: list[str] = []  # the most recent session started, for "status"
picked: dict[str, str] = {}  # sender → card the turn's tools asked for: "picker" or "recommendation:<session>"
SYSTEM_PROMPT = (Path(__file__).parent / "prompts" / "coordinator.md").read_text()
HANDLES = {PROFILES[a].handle: a for a in ("inventory", "flow", "clinical_workflow")}  # @handle → agent name


def ctx_stub():
    """A Context stand-in for tests: storage and a logger, nothing else. Not used at runtime."""
    import logging
    from types import SimpleNamespace

    class Store(dict):
        def get(self, k):
            return super().get(k)

        def set(self, k, v):
            self[k] = v

    return SimpleNamespace(storage=Store(), logger=logging.getLogger("coordinator.test"))


async def execute(ctx: Context, rnd: Round, actions: list[Action]):
    for a in actions:
        msg = a.message
        if a.type == "recommendation":
            msg = await llm.worded(msg, "recommendation", facts.recommendation(H, msg, rnd.baseline, rnd.round))
            rnd.recommendations[msg.option - 1] = msg
            if msg.option == 1:
                rnd.recommendation = msg
            events.setdefault(rnd.sessionId, []).append(("recommendation", msg))
            if msg.option == 1:
                await narrate_chat(ctx, rnd.sessionId, narrate.line(H, "recommendation", msg))
        if a.to in AGENTS:
            await send(ctx, NAME, a.to, a.type, msg)
            await narrate_chat(ctx, rnd.sessionId, narrate.handoff(a.to, a.type, rnd.round))
        else:  # "humans" (questions) or "relay" (round_state, recommendation)
            reason, source = reason_of(msg)
            await relay.post(rnd.sessionId, rnd.round, NAME, a.to, a.type, msg, reason,
                             direction="sent", reason_source=source)
    await relay.status(rnd.sessionId, NAME, "waiting" if rnd.state == "waiting_for_human" else "idle")
    await notify_chat(ctx, rnd)


async def begin(ctx: Context, req: StartRound) -> RestAck:
    """Start a round. The one code path for /start_round and for chat."""
    ctx.logger.info(f"[begin] start_round session={req.sessionId} run={req.runId} pz={req.patientZero} challenges={req.challenges}")
    async with lock:
        existing = rounds.get(req.sessionId)
        # A round still "running" long after it began with no specialist answer is one that died in an
        # agent (a crash, a restart): a new request replaces it instead of being refused forever.
        stale = existing is not None and existing.state == "running" and time.monotonic() - started.get(req.sessionId, 0) > STALE_ROUND_S
        if existing is not None and existing.state != "done" and not stale:
            ctx.logger.warning(f"[begin] refused: a round is already {existing.state} for {req.sessionId}")
            return RestAck(ok=False, detail=f"a round is already {existing.state} for session {req.sessionId}")
        try:
            ctx.logger.info(f"[begin] relay={settings().relay_url or 'FILE LOG (WATCHER_RELAY_URL unset)'}; running baseline")
            await relay.status(req.sessionId, NAME, "thinking")
            baseline = run_sim(None, req.patientZero, req.seed, req.challenges)
            rnd = Round(req.sessionId, H)
            ctx.logger.info(f"[begin] baseline done: {baseline.infectedCount} infected over {baseline.ticks} ticks")
            await narrate_chat(ctx, req.sessionId, narrate.started(H, baseline))
            actions = rnd.start(req.runId, req.patientZero, baseline, req.seed, req.challenges)
            rounds[req.sessionId] = rnd
            started[req.sessionId] = time.monotonic()
            events[req.sessionId] = []
            last_session[:] = [req.sessionId]
            await execute(ctx, rnd, actions)
        except Exception as e:
            await fail(ctx, NAME, req.sessionId, e)
            await narrate_chat(ctx, req.sessionId, narrate.failed(NAME, f"{type(e).__name__}: {e}"))
            return RestAck(ok=False, detail=f"{type(e).__name__}: {e}")
        return RestAck(ok=True, detail=f"round 1 started for {req.runId}")


@agent.on_rest_post("/start_round", StartRound, RestAck)
async def start_round(ctx: Context, req: StartRound) -> RestAck:
    return await begin(ctx, req)


@agent.on_rest_post("/resume", Resume, RestAck)
async def resume(ctx: Context, req: Resume) -> RestAck:
    async with lock:
        rnd = rounds.get(req.sessionId)
        if rnd is None:
            return RestAck(ok=False, detail=f"no round for session {req.sessionId}")
        answer = Answer(sessionId=req.sessionId, questionId=req.questionId, author=req.author, role=req.role, choice=req.choice)
        try:
            actions = rnd.on_answer(answer)  # checks the question, the role and the choice
        except ValueError as e:
            return RestAck(ok=False, detail=str(e))
        try:
            await relay.post(req.sessionId, rnd.round, "humans", NAME, "answer", answer, direction="received")
            await execute(ctx, rnd, actions)
        except Exception as e:
            await fail(ctx, NAME, req.sessionId, e)
            return RestAck(ok=False, detail=f"{type(e).__name__}: {e}")
        return RestAck(ok=True, detail=f"answer recorded; round {rnd.round} is {rnd.state}")


@agent.on_rest_post("/reassess", Reassess, RestAck)
async def reassess(ctx: Context, req: Reassess) -> RestAck:
    return RestAck(ok=False, detail="reassess not implemented yet")


async def handle(ctx: Context, sender: str, type: str, msg, event):
    async with lock:
        try:
            await received(NAME, sender, type, msg)
            rnd = rounds.get(msg.sessionId)
            if rnd is None:
                raise ValueError(f"{type} for session {msg.sessionId}, which has no round")
            events.setdefault(msg.sessionId, []).append((type, msg))
            await narrate_chat(ctx, msg.sessionId, narrate.line(H, type, msg, baseline=rnd.baseline))
            await execute(ctx, rnd, event(rnd))
        except Exception as e:
            await fail(ctx, NAME, msg.sessionId, e)
            await narrate_chat(ctx, msg.sessionId, narrate.failed(NAME, f"{e.__class__.__name__}: {e}"))


@protocol.on_message(Proposal)
async def on_proposal(ctx: Context, sender: str, msg: Proposal):
    await handle(ctx, sender, "proposal", msg, lambda r: r.on_proposal(msg))


@protocol.on_message(Revision)
async def on_revision(ctx: Context, sender: str, msg: Revision):
    await handle(ctx, sender, "revision", msg, lambda r: r.on_revision(msg))


@protocol.on_message(Verdict)
async def on_verdict(ctx: Context, sender: str, msg: Verdict):
    await handle(ctx, sender, "verdict", msg, lambda r: r.on_verdict(msg))


@protocol.on_message(Question)
async def on_question(ctx: Context, sender: str, msg: Question):
    await handle(ctx, sender, "question", msg, lambda r: r.on_questions([msg]))


# --- chat protocol (ASI:One) ---

chat_protocol = Protocol(spec=chat_protocol_spec)


async def chat_send(ctx: Context, to: str, message: Model, session_id: str, text: str | None = None,
                    card: dict | None = None) -> None:
    """Send a chat-protocol message with the chat protocol's digest, whichever handler we
    are in (a summary goes out from the handler of the round's last verdict). Replies
    are relayed first, card included, like every other message (rule 10); acks aren't."""
    if text is not None:
        rnd = rounds.get(session_id)
        payload = {"text": text, "via": "asi1"} | ({"card": card} if card is not None else {})
        await relay.post(session_id, rnd.round if rnd else 0, NAME, "humans", "chat", payload, direction="sent")
    for attempt in range(1, SEND_TRIES + 1):
        status = await ctx.send_raw(
            destination=to,
            message_schema_digest=Model.build_schema_digest(message),
            message_body=message.model_dump_json(),
            protocol_digest=chat_protocol.digest,
        )
        if status.status.value in ("delivered", "sent"):
            return
        ctx.logger.error(f"chat reply to {to[:16]}… not delivered (try {attempt}/{SEND_TRIES}): {status.detail}")
        if attempt < SEND_TRIES:
            await asyncio.sleep(SEND_BACKOFF_S * attempt)  # ASI:One's 429s clear in seconds


async def reply(ctx: Context, to: str, text: str, session_id: str = CHAT_SESSION) -> None:
    await chat_send(ctx, to, ChatMessage(content=[TextContent(text=text)]), session_id, text)


async def narrate_chat(ctx: Context, session_id: str, text: str) -> None:
    """One live status line for the chat user whose message started this session's round
    (nothing for rounds started from the web app). The line joins the session's trace, and
    the whole trace goes out as one message with the trace card: ASI:One shows one message
    per agent turn and rate-limits bursts, so sends are coalesced to NARRATE_INTERVAL_S."""
    c = chats.get(session_id)
    if c is None:
        return
    c.trace.append(text)
    if c.flush is not None and not c.flush.done():
        return  # the pending send will carry this line too
    wait = max(0.0, NARRATE_INTERVAL_S - (time.monotonic() - c.last_sent))
    c.flush = asyncio.get_event_loop().create_task(_flush_trace(_with_session(ctx, c.session), session_id, wait))


async def _flush_trace(ctx: Context, session_id: str, wait: float) -> None:
    await asyncio.sleep(wait)
    c = chats.get(session_id)
    if c is None or c.notified and c.summary_sent:
        return
    c.last_sent = time.monotonic()
    rnd = rounds.get(session_id)
    msg = cards.trace_card(H, session_id, c.device_name, list(c.trace), rnd.round if rnd else 1,
                           rnd.state if rnd else "starting", room_url(session_id))
    await reply_card(ctx, c.sender, msg, session_id)


async def reply_card(ctx: Context, to: str, msg: ChatMessage, session_id: str = CHAT_SESSION) -> None:
    """A card reply: the text bubble and the card's element tree both go to the relay."""
    bubble = next(c.text for c in msg.content if isinstance(c, TextContent))
    card = json.loads(next(c.metadata["card_payload"] for c in msg.content if isinstance(c, MetadataContent)))
    await chat_send(ctx, to, msg, session_id, bubble, card)


def room_url(session_id: str) -> str:
    return f"{settings().web_url}/room/{session_id}"


async def notify_chat(ctx: Context, rnd: Round) -> None:
    """When a round started from chat ends: one prose summary (worded by the loop from the
    round's events) and the recommendation card. Scheduled as a task: model round trips
    must not hold the Coordinator's lock."""
    c = chats.get(rnd.sessionId)
    if c is None or c.notified or rnd.state != "done":
        return
    c.notified = True
    asyncio.get_event_loop().create_task(_summary(ctx, rnd))


async def _summary(ctx: Context, rnd: Round) -> None:
    c = chats[rnd.sessionId]
    last_session[:] = [rnd.sessionId]
    ctx = _with_session(ctx, c.session)
    if c.flush is not None and not c.flush.done():
        c.flush.cancel()  # the summary message carries the whole trace itself
    prefix = narrate.render(c.trace) + "\n\n" if c.trace else ""
    try:
        await chat_turn(ctx, c.sender, "The round just ended; summarise it for me, naming each agent by handle and ending "
                                       "with who must sign off.", session_id=rnd.sessionId, relay_in=False, prefix=prefix,
                        default_card=f"recommendation:{rnd.sessionId}" if rnd.recommendation is not None else None)
    except Exception as e:  # rule 14: a failed summary is shown, never swallowed by the task
        ctx.logger.error(f"summary failed: {e!r}")
        await reply(ctx, c.sender, f"{prefix}I couldn't write the summary: {e.__class__.__name__}: {e}", rnd.sessionId)
    c.summary_sent = True


# --- the Coordinator's own tools (the hospital ones come from mcp_server) ---


def _session_for(sender: str, session_id: str | None) -> str | None:
    if session_id and session_id in rounds:
        return session_id
    mine = [s for s, c in chats.items() if c.sender == sender]
    return mine[-1] if mine else (last_session[0] if last_session else None)


def _events(session_id: str, most: int = 30) -> list[dict]:
    rnd = rounds[session_id]
    out = []
    for type, msg in events.get(session_id, [])[-most:]:
        agent = getattr(msg, "agent", "flow" if type in ("proposal", "revision") else "coordinator")
        out.append({"type": type, "agent": "@" + PROFILES[agent].handle, "round": getattr(msg, "round", rnd.round),
                    "line": narrate.line(H, type, msg, baseline=rnd.baseline)})
    return out


def local_tools(ctx: Context, sender: str) -> list[brain.Tool]:
    async def start_round(args: dict):
        query = str(args.get("device_query", "")).strip()
        device = chat.resolve_device(H, query) if query else None
        if device is None:
            return {"error": chat.unknown_device(H, query or "?")}
        name = H.devices[device]["name"]
        session_id = f"chat-{uuid.uuid4().hex[:8]}"
        chats[session_id] = ChatRound(sender=sender, device_name=name, session=getattr(ctx, "session", None))
        req = StartRound(sessionId=session_id, runId=f"run_{session_id.replace('-', '_')}", patientZero=device,
                         seed=chat.DEMO_SEED, challenges=[])
        ack = await begin(ctx, req)
        if not ack.ok:
            chats.pop(session_id, None)
            return {"error": ack.detail or "unknown error"}
        return {"session_id": session_id, "device": name, "live_room": room_url(session_id)}

    async def round_status(args: dict):
        sid = _session_for(sender, args.get("session_id"))
        rnd = rounds.get(sid) if sid else None
        if rnd is None:
            return {"none": True, "hint": "no round has run yet; start_round starts one"}
        device = chats[sid].device_name if sid in chats else H.devices.get(rnd.patient_zero, {}).get("name", rnd.patient_zero)
        return {"session_id": sid, "device": device, "state": rnd.state, "round": rnd.round, "events": _events(sid),
                "live_room": room_url(sid)}

    async def recommendation(args: dict):
        sid = _session_for(sender, args.get("session_id"))
        rnd = rounds.get(sid) if sid else None
        rec = getattr(rnd, "recommendation", None) if rnd is not None else None
        if rec is None:
            return {"none": True}
        n = facts.numbers(H, rec.testResult, rnd.baseline)
        picked[sender] = f"recommendation:{sid}"
        return {"session_id": sid, "policy_name": rec.policy.name, "explanation": rec.explanation,
                "required_roles": [facts.ROLE_NAMES[r] for r in rec.requiredRoles],
                "infected_before": n.get("infectedDevicesWithoutPlan"), "infected_after": n["infectedDevicesWithPlan"],
                "patients_affected_before": n.get("patientsWithCareDelayedOrDisruptedWithoutPlan"),
                "patients_affected_after": n["patientsWithCareDelayedOrDisruptedWithPlan"],
                "agents_agreeing": [facts.AGENT_NAMES[v.agent] for v in rec.verdicts if v.decision == "accept"],
                "note": "a recommendation, not a decision: humans sign off in the app"}

    async def show_device_picker(args: dict):
        picked[sender] = "picker"
        return {"shown": True, "devices": [H.devices[d]["name"] for d in chat.devices_on_network(H)][:6]}

    async def ask(args: dict):
        return await ask_agent(ctx, sender, str(args.get("handle", "")), str(args.get("question", "")))

    obj = lambda props, req=(): {"type": "object", "properties": props, "required": list(req)}
    sid = {"session_id": {"type": "string", "description": "a session id from an earlier answer; omit for the latest round"}}
    return [
        brain.Tool("start_round", "Start a simulated ransomware round from one device. The round narrates itself in the "
                   "thread. Returns the session id and device name, or an error.",
                   obj({"device_query": {"type": "string", "description": "device name or id as the user wrote it"}}, ["device_query"]), start_round),
        brain.Tool("round_status", "The state of a round and every event so far (proposals, verdicts with reasons, "
                   "questions, recommendation), one line each.", obj(sid), round_status),
        brain.Tool("recommendation", "The recommendation a finished round produced: plan name, explanation, numbers before "
                   "and after, and the roles that must sign off. Attaches the recommendation card.", obj(sid), recommendation),
        brain.Tool("show_device_picker", "Show the user a card of devices an attack can start from. Use for 'where can "
                   "an attack start' or 'which device should I pick'.", obj({}), show_device_picker),
        brain.Tool("ask_agent", "Ask one specialist agent a question in its own words and get its answer. Use for the "
                   "specialist's own reasoning. Refused while a round is running.",
                   obj({"handle": {"type": "string", "enum": sorted(HANDLES)},
                        "question": {"type": "string"}}, ["handle", "question"]), ask),
    ]


ASK_TIMEOUT_S = 25


async def _ask_over_wire(ctx: Context, agent: str, question: str) -> str:
    """Send a chat-protocol message to a specialist and wait for its ChatMessage reply
    (uAgents send_and_receive; the specialist's ack has another digest and passes by).
    Raises TimeoutError when nothing comes back in ASK_TIMEOUT_S."""
    response, status = await ctx.send_and_receive(
        addresses.address(agent), ChatMessage(content=[TextContent(text=question)]),
        response_type=ChatMessage, timeout=ASK_TIMEOUT_S,
    )
    if status.status.value not in ("delivered", "sent") or not isinstance(response, ChatMessage):
        raise TimeoutError(status.detail or "no reply")
    return response.text().strip()


async def ask_agent(ctx: Context, sender: str, handle: str, question: str) -> dict:
    """The Coordinator invokes a specialist by @handle, visibly: an interim line to the chat
    user, the question and the answer relayed as agent_message rows (rule 10), and the
    answer returned to the loop to quote. Refused while any round is running (rule 5)."""
    handle = handle.lstrip("@").strip()
    agent = HANDLES.get(handle)
    if agent is None:
        return {"error": f"unknown agent @{handle}; the specialists are " + ", ".join("@" + h for h in sorted(HANDLES))}
    if any(r.state == "running" for r in rounds.values()):
        return {"error": "a round is running"}
    sid = _session_for(sender, None) or CHAT_SESSION
    rnd_no = rounds[sid].round if sid in rounds else 0
    await chat_send(ctx, sender, ChatMessage(content=[TextContent(text=f"Asking @{handle}: {question}")]), sid,
                    f"Asking @{handle}: {question}")
    await relay.post(sid, rnd_no, NAME, agent, "chat", {"text": question, "via": "asi1"}, direction="sent")
    try:
        said = await _ask_over_wire(ctx, agent, question)
    except (TimeoutError, asyncio.TimeoutError) as e:
        return {"error": f"@{handle} did not answer within {ASK_TIMEOUT_S} s" + (f": {e}" if str(e) else "")}
    await relay.post(sid, rnd_no, agent, NAME, "chat", {"text": said, "via": "asi1"}, direction="received")
    return {"agent": handle, "said": said}


# --- the turn ---


def _selection_text(text: str) -> str:
    """A card button click (JSON, or ASI:One's planner prose) as the user turn it stands for."""
    sel = chat.selection(text)
    if sel is None:
        return text
    if sel.kind == "simulate" and sel.device:
        return f"simulate ransomware from {sel.device}"
    if sel.kind == "lookup" and sel.device:
        return f"what is {sel.device}?"
    return {"status": "what is the status of the last round?", "devices": "where can an attack start?",
            "protected": "which flows are protected?"}.get(sel.kind, "help")


async def chat_turn(ctx: Context, sender: str, text: str, session_id: str | None = None, relay_in: bool = True,
                    prefix: str = "", default_card: str | None = None) -> None:
    """One ASI:One turn: relay the text in, let the loop pick tools and write the reply,
    relay the reply out, send it with a card when a tool asked for one."""
    sel = chat.selection(text)
    sid = session_id or _session_for(sender, None) or CHAT_SESSION
    if sel is not None and sel.kind == "open":  # a card's link button: ASI:One sends the selection back; answer with the link
        await reply(ctx, sender, f"Live room for this round: {sel.url or room_url(sid)}", sid)
        return
    text = _selection_text(text)
    if relay_in:
        await relay.post(sid, rounds[sid].round if sid in rounds else 0, "humans", NAME, "chat",
                         {"text": text, "via": "asi1"}, direction="received")
    picked.pop(sender, None)
    # An attack request starts a round at once, decided in code: the reply is instant and the
    # round narrates itself. Only an unresolvable device falls through to the model.
    wanted = chat.wants_round(text)
    if wanted and chat.resolve_device(H, wanted):
        start = next(t for t in local_tools(ctx, sender) if t.name == "start_round")
        out = await start.call({"device_query": wanted})
        if "error" in out:
            await reply(ctx, sender, f"I couldn't start that: {out['error']}", sid)
        else:
            await reply(ctx, sender, f"Starting a simulated ransomware round from {out['device']} (session {out['session_id']}). "
                                     f"Baseline first, then {narrate.handle('flow')}, {narrate.handle('inventory')} and "
                                     f"{narrate.handle('clinical_workflow')} negotiate here, step by step.", out["session_id"])
        return
    try:
        tools = await mcp_server.as_brain_tools() + local_tools(ctx, sender)
        turn = await brain.respond(ctx.storage, NAME, sender, text, tools, SYSTEM_PROMPT, session_id=sid)
    except brain.BrainError as e:
        await reply(ctx, sender, f"I couldn't answer: {e}", sid)
        return
    except Exception as e:  # rule 14: any failure (MCP, relay, a tool) is shown, never silent
        ctx.logger.error(f"chat turn failed: {e!r}")
        await reply(ctx, sender, f"I couldn't answer: {e.__class__.__name__}: {e}", sid)
        return
    want = picked.pop(sender, None) or default_card  # the card is code's call when the round has a result
    out = prefix + turn.text
    card = None
    if want == "picker":
        card = cards.picker_card(H, chat.devices_on_network(H), out)
    elif want and want.startswith("recommendation:"):
        rsid = want.split(":", 1)[1]
        rnd = rounds.get(rsid)
        if rnd is not None and rnd.recommendation is not None:
            card = cards.recommendation_card(H, rsid, rnd.recommendation, rnd.baseline, room_url(rsid), out)
    if card is not None:
        await reply_card(ctx, sender, card, sid)
    else:
        await reply(ctx, sender, out, sid)


@chat_protocol.on_message(ChatMessage)
async def on_chat(ctx: Context, sender: str, msg: ChatMessage):
    await chat_send(ctx, sender, ChatAcknowledgement(acknowledged_msg_id=msg.msg_id), CHAT_SESSION)
    text = msg.text().strip()
    if not text:
        if not any(isinstance(c, StartSessionContent) for c in msg.content):
            return
        text = "hello"
    # A task, not an await: uAgents handles inbound messages one at a time, and a turn's
    # model round trips must not hold up the round's own messages.
    asyncio.get_event_loop().create_task(chat_turn(ctx, sender, text))


@chat_protocol.on_message(ChatAcknowledgement)
async def on_chat_ack(ctx: Context, sender: str, msg: ChatAcknowledgement):
    pass


agent.include(protocol)
# The manifest goes to the Almanac, which only matters when the agent registers there.
agent.include(chat_protocol, publish_manifest=settings().mailbox or not settings().local_resolve)

if __name__ == "__main__":
    agent.run()
