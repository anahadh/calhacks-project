"""Flow Agent (uAgent): minimize spread.

On a ProposalRequest: candidates from the optimizer, a test run for each, then
logic.flow picks one under the request's constraints. Round 1 sends a Proposal;
a revise request sends a Revision (a rule diff against the current policy).

The optimizer never sees which flows are protected: Flow learns them only from
the Clinical Workflow Agent's rejections (keep_flow constraints). That is the demo.
"""

import json

from uagents import Context

from config import settings
from logic import flow
from logic import hospital as hospital_mod
from protocol import Candidate, Proposal, ProposalRequest, Revision
from runtime import fail, make_agent, received, send
from tools import optimize, relay, run_sim

NAME = "flow"
agent, protocol = make_agent(NAME)
H = hospital_mod.load(settings().hospital_path)
current: dict[str, Candidate] = {}  # session → the candidate last sent


def hospital_without_protection() -> dict:
    """The hospital as the optimizer may see it: no protected flags, no purposes."""
    h = json.loads(settings().hospital_path.read_text())["hospital"]
    for f in h["flows"]:
        f["protected"] = False
        f.pop("purpose", None)
    return h


@protocol.on_message(ProposalRequest)
async def on_request(ctx: Context, sender: str, req: ProposalRequest):
    try:
        await received(NAME, sender, "proposal_request", req)
        candidates = optimize(hospital_without_protection(), req.baseline, req.constraints)
        tested = [(c, run_sim(c, req.patientZero, req.seed, req.challenges)) for c in candidates]
        chosen = flow.choose([(c.policy, r) for c, r in tested], req.constraints, H)
        if chosen is None:
            raise RuntimeError("the optimizer returned no candidates")
        policy, result, violating = chosen
        cand = next(c for c, _ in tested if c.policy is policy)
        if violating:
            ctx.logger.warning(f"no candidate meets every constraint; sending the least-violating, {cand.id}")

        prev = current.get(req.sessionId)
        if req.revise is None or prev is None:
            msg = Proposal(sessionId=req.sessionId, round=req.round, policyId=cand.id, testResult=result, **cand.policy.dict())
            type = "proposal"
        else:
            changed = {k: getattr(policy, k) for k in ("strategy", "name", "rationale", "tradeoff")
                       if getattr(policy, k) != getattr(prev.policy, k)}
            msg = Revision(sessionId=req.sessionId, round=req.round, policyId=cand.id,
                           diff=flow.diff(prev.policy, policy), testResult=result, **changed)
            type = "revision"
        current[req.sessionId] = cand
        await send(ctx, NAME, "coordinator", type, msg)
        await relay.status(req.sessionId, NAME, "idle")
    except Exception as e:
        await fail(ctx, NAME, req.sessionId, e)


agent.include(protocol)

if __name__ == "__main__":
    agent.run()
