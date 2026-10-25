"""Inventory Agent (uAgent): never act on a device nobody can name.

- Round 1's ProposalRequest: preflight on the baseline, a Question per flagged device.
- Proposal or Revision: logic.inventory.check. The Question, if any, is sent before
  the Verdict (the Coordinator relies on that order).
- Answer: the human's type for the device that question was about.

Claude (llm.py) words the Question's text and the Verdict's reason; it cannot change
which device is asked about, the choices, who may answer, or the verdict.
"""

from dataclasses import dataclass, field

from uagents import Context

import agent_chat

import brain
import chat
import facts
import llm
from config import settings
from logic import hospital as hospital_mod
from logic import inventory
from protocol import Answer, Proposal, ProposalRequest, Question, Revision, RunResult
from runtime import fail, make_agent, received, send
from tools import relay

NAME = "inventory"
agent, protocol = make_agent(NAME)
H = hospital_mod.load(settings().hospital_path)


@dataclass
class Session:
    confirmed: dict[str, str] = field(default_factory=dict)  # device id → type a human named
    challenges: list[str] = field(default_factory=list)  # from round 1's request
    baseline: RunResult | None = None  # from round 1's request, for the reason's numbers
    asked: dict[str, str] = field(default_factory=dict)  # question id → device id
    rule_count: int | None = None  # the current plan's rules, kept across revisions (diffs)
    questions: list[Question] = field(default_factory=list)  # every question asked, in order


sessions: dict[str, Session] = {}
last_session: list[str] = []


def tools() -> list[brain.Tool]:
    """What this agent can tell a chat, from the session it keeps (code only)."""
    def latest() -> Session | None:
        return sessions.get(last_session[0]) if last_session else None

    async def unconfirmed_devices(args: dict):
        s = latest() or Session()
        return [{"id": d, "name": H.devices[d]["name"], "room": H.rooms[H.devices[d]["roomId"]]["name"]}
                for d in sorted(inventory.flagged_devices(H, s.confirmed, s.challenges))]

    async def last_question(args: dict):
        s = latest()
        if s is None or not s.questions:
            return {"none": True, "note": "I haven't asked a human anything yet."}
        q = s.questions[-1]
        answered = s.confirmed.get(q.targetId)
        return {"device": H.devices[q.targetId]["name"], "text": q.text, "choices": q.choices,
                "answered_as": answered, "who_may_answer": [facts.ROLE_NAMES[r] for r in q.allowedRoles]}

    async def device_owner(args: dict):
        d = chat.resolve_device(H, str(args.get("query", ""))) or (args.get("query") if args.get("query") in H.devices else None)
        if d is None:
            return {"error": chat.unknown_device(H, str(args.get("query", "?")))}
        s = latest() or Session()
        return {"id": d, "name": H.devices[d]["name"], "type": H.devices[d]["type"],
                "confirmed_as": s.confirmed.get(d), "flagged": d in inventory.flagged_devices(H, s.confirmed, s.challenges)}

    obj = lambda props, req=(): {"type": "object", "properties": props, "required": list(req)}
    return [
        brain.Tool("unconfirmed_devices", "Devices nobody can name yet (unknown type, or no flows): the ones this agent blocks plans over.",
                   obj({}), unconfirmed_devices),
        brain.Tool("last_question", "The last question this agent asked a human, and whether it was answered.", obj({}), last_question),
        brain.Tool("device_owner", "Whether a device is identified, and what a human confirmed it as.",
                   obj({"query": {"type": "string", "description": "device name or id"}}, ["query"]), device_owner),
    ]


async def ask(ctx: Context, s: Session, q: Question):
    s.asked[q.id] = q.targetId
    q = await llm.worded(q, "question", facts.question(H, q, s.challenges))
    s.questions.append(q)
    await send(ctx, NAME, "coordinator", "question", q)


@protocol.on_message(ProposalRequest)
async def on_request(ctx: Context, sender: str, msg: ProposalRequest):
    try:
        await received(NAME, sender, "proposal_request", msg)
        s = sessions.setdefault(msg.sessionId, Session())
        s.challenges, s.baseline = list(msg.challenges), msg.baseline
        last_session[:] = [msg.sessionId]
        for q in inventory.preflight(msg.sessionId, msg.round, msg.baseline, H, s.confirmed, s.challenges):
            await ask(ctx, s, q)
        await relay.status(msg.sessionId, NAME, "idle")
    except Exception as e:
        await fail(ctx, NAME, msg.sessionId, e)


async def judge(ctx: Context, sender: str, type: str, msg: Proposal | Revision):
    try:
        await received(NAME, sender, type, msg)
        s = sessions.setdefault(msg.sessionId, Session())
        # The rule count: a proposal carries its rules, a revision only its diff.
        if isinstance(msg, Proposal):
            s.rule_count = len(msg.rules)
        elif s.rule_count is not None:
            s.rule_count += len(msg.diff.added) - len(msg.diff.removed)
        verdict, question = inventory.check(
            msg.sessionId, msg.round, msg.policyId, msg.testResult, H, s.confirmed, s.challenges, rule_count=s.rule_count
        )
        kind = "verdict_accept" if verdict.decision == "accept" else "verdict_reject"
        verdict = await llm.worded(verdict, kind, facts.verdict(H, verdict, msg, msg.name, s.baseline))
        if question is not None:
            await ask(ctx, s, question)
        await send(ctx, NAME, "coordinator", "verdict", verdict)
        agent_chat.note(NAME, f"{verdict.decision}: {verdict.reason}")
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
# The chat protocol, so the agent answers a judge on ASI:One; the manifest goes to the
# Almanac only when the agent registers there (as the Coordinator does).
agent.include(agent_chat.make_chat(NAME, agent, tools), publish_manifest=settings().mailbox or not settings().local_resolve)

if __name__ == "__main__":
    agent.run()
