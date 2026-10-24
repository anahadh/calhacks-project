"""Sign-off Coordinator (uAgent): runs rounds; cannot approve anything.

One logic.coordinator.Round per session. REST handlers (called by the watchers):
POST /start_round, /resume, /reassess. Every Action the Round returns is carried
out here: to an agent → uAgents message; to "humans" or "relay" → relay row.
Claude (llm.py) words the Recommendation's explanation; it cannot change the plan,
the numbers or the required roles.

It also speaks the chat protocol (ASI:One): "simulate ransomware from MRI 2" starts
a round through the same begin() as /start_round, and the sender gets a summary when
it ends. chat.py reads the text and builds the replies in code.
"""

import asyncio
import uuid
from dataclasses import dataclass

from uagents import Context, Model, Protocol
from uagents_core.contrib.protocols.chat import (
    ChatAcknowledgement,
    ChatMessage,
    TextContent,
    chat_protocol_spec,
)

import chat
import facts
import llm
from config import AGENTS, settings
from logic import hospital as hospital_mod
from logic.coordinator import Action, Round
from protocol import Answer, Proposal, Question, Reassess, RestAck, Resume, Revision, StartRound, Verdict
from runtime import fail, make_agent, reason_of, received, send
from tools import relay, run_sim

NAME = "coordinator"
CHAT_SESSION = "asi1-chat"  # relay session for chat that doesn't belong to a round
agent, protocol = make_agent(NAME)
H = hospital_mod.load(settings().hospital_path)
rounds: dict[str, Round] = {}
events: dict[str, list[tuple[str, object]]] = {}  # session → (type, message) seen, for chat summaries
lock = asyncio.Lock()  # one event at a time, REST, messages and chat alike


@dataclass
class ChatRound:
    sender: str  # the chat user's agent address
    device_name: str
    notified: bool = False


chats: dict[str, ChatRound] = {}  # session → who to tell when it ends
last_session: list[str] = []  # the most recent session started, for "status"


async def execute(ctx: Context, rnd: Round, actions: list[Action]):
    for a in actions:
        msg = a.message
        if a.type == "recommendation":
            msg = await llm.worded(msg, "recommendation", facts.recommendation(H, msg, rnd.baseline, rnd.round))
            rnd.recommendation = msg
            events.setdefault(rnd.sessionId, []).append(("recommendation", msg))
        if a.to in AGENTS:
            await send(ctx, NAME, a.to, a.type, msg)
        else:  # "humans" (questions) or "relay" (round_state, recommendation)
            reason, source = reason_of(msg)
            await relay.post(rnd.sessionId, rnd.round, NAME, a.to, a.type, msg, reason,
                             direction="sent", reason_source=source)
    await relay.status(rnd.sessionId, NAME, "waiting" if rnd.state == "waiting_for_human" else "idle")
    await notify_chat(ctx, rnd)


async def begin(ctx: Context, req: StartRound) -> RestAck:
    """Start a round. The one code path for /start_round and for chat."""
    async with lock:
        existing = rounds.get(req.sessionId)
        if existing is not None and existing.state != "done":
            return RestAck(ok=False, detail=f"a round is already {existing.state} for session {req.sessionId}")
        try:
            await relay.status(req.sessionId, NAME, "thinking")
            baseline = run_sim(None, req.patientZero, req.seed, req.challenges)
            rnd = Round(req.sessionId, H)
            actions = rnd.start(req.runId, req.patientZero, baseline, req.seed, req.challenges)
            rounds[req.sessionId] = rnd
            events[req.sessionId] = []
            last_session[:] = [req.sessionId]
            await execute(ctx, rnd, actions)
        except Exception as e:
            await fail(ctx, NAME, req.sessionId, e)
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
            await execute(ctx, rnd, event(rnd))
        except Exception as e:
            await fail(ctx, NAME, msg.sessionId, e)


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


async def chat_send(ctx: Context, to: str, message: Model, session_id: str, text: str | None = None) -> None:
    """Send a chat-protocol message with the chat protocol's digest, whichever handler we
    are in (a summary goes out from the handler of the round's last verdict). Text
    replies are relayed first, like every other message (rule 9); acks aren't."""
    if text is not None:
        rnd = rounds.get(session_id)
        await relay.post(session_id, rnd.round if rnd else 0, NAME, "humans", "chat", {"text": text}, direction="sent")
    status = await ctx.send_raw(
        destination=to,
        message_schema_digest=Model.build_schema_digest(message),
        message_body=message.model_dump_json(),
        protocol_digest=chat_protocol.digest,
    )
    if status.status.value not in ("delivered", "sent"):
        ctx.logger.error(f"chat reply to {to[:16]}… not delivered: {status.detail}")


async def reply(ctx: Context, to: str, text: str, session_id: str = CHAT_SESSION) -> None:
    await chat_send(ctx, to, ChatMessage(content=[TextContent(text=text)]), session_id, text)


async def notify_chat(ctx: Context, rnd: Round) -> None:
    c = chats.get(rnd.sessionId)
    if c is None or c.notified or rnd.state != "done":
        return
    c.notified = True
    text = chat.summary(H, rnd.sessionId, c.device_name, events.get(rnd.sessionId, []), rnd.state, rnd.round,
                        settings().hippo_sim_fixtures)
    await reply(ctx, c.sender, text, rnd.sessionId)


@chat_protocol.on_message(ChatMessage)
async def on_chat(ctx: Context, sender: str, msg: ChatMessage):
    await chat_send(ctx, sender, ChatAcknowledgement(acknowledged_msg_id=msg.msg_id), CHAT_SESSION)
    text = msg.text().strip()
    if not text:
        return  # e.g. only a start-session marker
    await relay.post(CHAT_SESSION, 0, "humans", NAME, "chat", {"text": text}, direction="received")
    command = chat.parse(text)
    if command.kind == "status":
        sid = last_session[0] if last_session else None
        rnd = rounds.get(sid) if sid else None
        last = None
        if rnd is not None:
            name = chats[sid].device_name if sid in chats else rnd.patient_zero
            last = (sid, name, rnd.state, rnd.round, rnd.recommendation is not None)
        await reply(ctx, sender, chat.status(last))
        return
    if command.kind == "help" or not command.device:
        await reply(ctx, sender, chat.help_text())
        return
    device = chat.resolve_device(H, command.device)
    if device is None:
        await reply(ctx, sender, chat.unknown_device(H, command.device))
        return
    name = H.devices[device]["name"]
    session_id = f"chat-{uuid.uuid4().hex[:8]}"
    chats[session_id] = ChatRound(sender=sender, device_name=name)
    req = StartRound(sessionId=session_id, runId=f"run_{session_id.replace('-', '_')}", patientZero=device,
                     seed=chat.DEMO_SEED, challenges=[])
    ack = await begin(ctx, req)
    if not ack.ok:
        chats.pop(session_id, None)
        await reply(ctx, sender, chat.could_not_start(name, ack.detail or "unknown error"), session_id)
        return
    await reply(ctx, sender, chat.started(name, session_id, settings().hippo_sim_fixtures), session_id)


@chat_protocol.on_message(ChatAcknowledgement)
async def on_chat_ack(ctx: Context, sender: str, msg: ChatAcknowledgement):
    pass


agent.include(protocol)
# The manifest goes to the Almanac, which only matters when the agent registers there.
agent.include(chat_protocol, publish_manifest=settings().mailbox or not settings().local_resolve)

if __name__ == "__main__":
    agent.run()
