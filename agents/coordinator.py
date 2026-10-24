"""Sign-off Coordinator (uAgent): runs rounds; cannot approve anything.

One logic.coordinator.Round per session. REST handlers (called by the watchers):
POST /start_round, /resume, /reassess. Every Action the Round returns is carried
out here: to an agent → uAgents message; to "humans" or "relay" → relay row.
Claude (llm.py) words the Recommendation's explanation; it cannot change the plan,
the numbers or the required roles.
"""

import asyncio

from uagents import Context

import facts
import llm
from config import AGENTS, settings
from logic import hospital as hospital_mod
from logic.coordinator import Action, Round
from protocol import Answer, Proposal, Question, Reassess, RestAck, Resume, Revision, StartRound, Verdict
from runtime import fail, make_agent, reason_of, received, send
from tools import relay, run_sim

NAME = "coordinator"
agent, protocol = make_agent(NAME)
H = hospital_mod.load(settings().hospital_path)
rounds: dict[str, Round] = {}
lock = asyncio.Lock()  # one event at a time, REST and messages alike


async def execute(ctx: Context, rnd: Round, actions: list[Action]):
    for a in actions:
        msg = a.message
        if a.type == "recommendation":
            msg = await llm.worded(msg, "recommendation", facts.recommendation(H, msg, rnd.baseline, rnd.round))
            rnd.recommendation = msg
        if a.to in AGENTS:
            await send(ctx, NAME, a.to, a.type, msg)
        else:  # "humans" (questions) or "relay" (round_state, recommendation)
            reason, source = reason_of(msg)
            await relay.post(rnd.sessionId, rnd.round, NAME, a.to, a.type, msg, reason,
                             direction="sent", reason_source=source)
    await relay.status(rnd.sessionId, NAME, "waiting" if rnd.state == "waiting_for_human" else "idle")


@agent.on_rest_post("/start_round", StartRound, RestAck)
async def start_round(ctx: Context, req: StartRound) -> RestAck:
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
            await execute(ctx, rnd, actions)
        except Exception as e:
            await fail(ctx, NAME, req.sessionId, e)
            return RestAck(ok=False, detail=f"{type(e).__name__}: {e}")
        return RestAck(ok=True, detail=f"round 1 started for {req.runId}")


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


agent.include(protocol)

if __name__ == "__main__":
    agent.run()
