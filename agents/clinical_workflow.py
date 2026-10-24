"""Clinical Workflow Agent (uAgent): keep care running.

Judges each Proposal and Revision with logic.clinical.check and replies with a Verdict.
"""

from uagents import Context

from config import settings
from logic import clinical
from logic import hospital as hospital_mod
from protocol import Proposal, Revision
from runtime import fail, make_agent, received, send
from tools import relay

NAME = "clinical_workflow"
agent, protocol = make_agent(NAME)
H = hospital_mod.load(settings().hospital_path)


async def judge(ctx: Context, sender: str, type: str, msg: Proposal | Revision):
    try:
        await received(NAME, sender, type, msg)
        verdict = clinical.check(msg.sessionId, msg.round, msg.policyId, msg.testResult, H)
        await send(ctx, NAME, "coordinator", "verdict", verdict)
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

if __name__ == "__main__":
    agent.run()
