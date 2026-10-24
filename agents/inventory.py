"""Inventory Agent (uAgent): never act on a device nobody can name.

- Round 1's ProposalRequest: preflight on the baseline, a Question per flagged device.
- Proposal or Revision: logic.inventory.check. The Question, if any, is sent before
  the Verdict (the Coordinator relies on that order).
- Answer: the human's type for the device that question was about.
"""

from dataclasses import dataclass, field

from uagents import Context

from config import settings
from logic import hospital as hospital_mod
from logic import inventory
from protocol import Answer, Proposal, ProposalRequest, Question, Revision
from runtime import fail, make_agent, received, send
from tools import relay

NAME = "inventory"
agent, protocol = make_agent(NAME)
H = hospital_mod.load(settings().hospital_path)


@dataclass
class Session:
    confirmed: dict[str, str] = field(default_factory=dict)  # device id → type a human named
    challenges: list[str] = field(default_factory=list)  # from round 1's request
    asked: dict[str, str] = field(default_factory=dict)  # question id → device id


sessions: dict[str, Session] = {}


async def ask(ctx: Context, s: Session, q: Question):
    s.asked[q.id] = q.targetId
    await send(ctx, NAME, "coordinator", "question", q)


@protocol.on_message(ProposalRequest)
async def on_request(ctx: Context, sender: str, msg: ProposalRequest):
    try:
        await received(NAME, sender, "proposal_request", msg)
        s = sessions.setdefault(msg.sessionId, Session())
        s.challenges = list(msg.challenges)
        for q in inventory.preflight(msg.sessionId, msg.round, msg.baseline, H, s.confirmed, s.challenges):
            await ask(ctx, s, q)
        await relay.status(msg.sessionId, NAME, "idle")
    except Exception as e:
        await fail(ctx, NAME, msg.sessionId, e)


async def judge(ctx: Context, sender: str, type: str, msg: Proposal | Revision):
    try:
        await received(NAME, sender, type, msg)
        s = sessions.setdefault(msg.sessionId, Session())
        verdict, question = inventory.check(
            msg.sessionId, msg.round, msg.policyId, msg.testResult, H, s.confirmed, s.challenges
        )
        if question is not None:
            await ask(ctx, s, question)
        await send(ctx, NAME, "coordinator", "verdict", verdict)
        await relay.status(msg.sessionId, NAME, "idle")
    except Exception as e:
        await fail(ctx, NAME, msg.sessionId, e)


@protocol.on_message(Proposal)
async def on_proposal(ctx: Context, sender: str, msg: Proposal):
    await judge(ctx, sender, "proposal", msg)


@protocol.on_message(Revision)
async def on_revision(ctx: Context, sender: str, msg: Revision):
    await judge(ctx, sender, "revision", msg)


@protocol.on_message(Answer)
async def on_answer(ctx: Context, sender: str, msg: Answer):
    try:
        await received(NAME, sender, "answer", msg)
        s = sessions.setdefault(msg.sessionId, Session())
        device = s.asked.get(msg.questionId)
        if device is None:
            raise ValueError(f"answer to {msg.questionId}, which Inventory did not ask")
        s.confirmed[device] = msg.choice
        await relay.status(msg.sessionId, NAME, "idle")
    except Exception as e:
        await fail(ctx, NAME, msg.sessionId, e)


agent.include(protocol)

if __name__ == "__main__":
    agent.run()
