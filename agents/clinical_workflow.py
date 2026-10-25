"""Clinical Workflow Agent (uAgent): keep care running.

Judges each Proposal and Revision with logic.clinical.check and replies with a Verdict.
Claude (llm.py) words the verdict's reason; it cannot change the verdict.
"""

from uagents import Context

import agent_chat

import brain
import facts
import llm
from config import settings
from logic import clinical
from logic import hospital as hospital_mod
import cards
from protocol import Proposal, Revision, Verdict
from runtime import fail, make_agent, received, send
from tools import relay

NAME = "clinical_workflow"
agent, protocol = make_agent(NAME)
H = hospital_mod.load(settings().hospital_path)
judged: dict[str, list[tuple[Proposal | Revision, Verdict]]] = {}  # session → the plans judged, in order
last_session: list[str] = []


def remember(session_id: str, msg: Proposal | Revision, verdict: Verdict) -> None:
    judged.setdefault(session_id, []).append((msg, verdict))
    last_session[:] = [session_id]


def tools() -> list[brain.Tool]:
    """What this agent can tell a chat, from the plans it judged (no spread logic here)."""
    def latest():
        return judged.get(last_session[0]) if last_session else None

    async def last_verdict(args: dict):
        plans = latest()
        if not plans:
            return {"none": True, "note": "I haven't judged a plan yet."}
        msg, v = plans[-1]
        needs = cards.target_label(H, v.constraint.kind, v.constraint.targetIds) if v.constraint else None
        return {"round": v.round, "policy_name": getattr(msg, "name", None) or msg.policyId, "decision": v.decision,
                "reason": v.reason, "needs": needs}

    async def flows_broken_by(args: dict):
        want = str(args.get("policy_name", "")).strip().lower()
        for msg, v in reversed(latest() or []):
            if (getattr(msg, "name", None) or msg.policyId).lower() == want:
                return [{"flow": cards.flow_label(H, fid), "purpose": H.flows[fid].get("purpose", "")}
                        for fid in msg.testResult.protectedBroken if fid in H.flows]
        return {"error": f"no policy named {args.get('policy_name')!r} in the last round"}

    obj = lambda props, req=(): {"type": "object", "properties": props, "required": list(req)}
    return [
        brain.Tool("last_verdict", "This agent's latest verdict: the plan, accept or reject, the reason and what it needs kept.",
                   obj({}), last_verdict),
        brain.Tool("flows_broken_by", "The protected clinical flows a named plan cut, with their purpose.",
                   obj({"policy_name": {"type": "string"}}, ["policy_name"]), flows_broken_by),
    ]


async def judge(ctx: Context, sender: str, type: str, msg: Proposal | Revision):
    try:
        await received(NAME, sender, type, msg)
        verdict = clinical.check(msg.sessionId, msg.round, msg.policyId, msg.testResult, H)
        kind = "verdict_accept" if verdict.decision == "accept" else "verdict_reject"
        verdict = await llm.worded(verdict, kind, facts.verdict(H, verdict, msg, msg.name))
        remember(msg.sessionId, msg, verdict)
        await send(ctx, NAME, "coordinator", "verdict", verdict)
        agent_chat.note(NAME, f"{verdict.decision}: {verdict.reason}")
        await relay.status(msg.sessionId, NAME, "idle")
    except Exception as e:  # show it; never answer with a made-up verdict
        await fail(ctx, NAME, msg.sessionId, e)


@protocol.on_message(Proposal)
async def on_proposal(ctx: Context, sender: str, msg: Proposal):
    await judge(ctx, sender, "proposal", msg)


@protocol.on_message(Revision)
async def on_revision(ctx: Context, sender: str, msg: Revision):
    await judge(ctx, sender, "revision", msg)


agent.include(protocol)
# The chat protocol, so the agent answers a judge on ASI:One; the manifest goes to the
# Almanac only when the agent registers there (as the Coordinator does).
agent.include(agent_chat.make_chat(NAME, agent, tools), publish_manifest=settings().mailbox or not settings().local_resolve)

if __name__ == "__main__":
    agent.run()
