"""Flow Agent (uAgent): minimize spread.

On a ProposalRequest: candidates built from this attack (logic.candidates, or the
hippo-opt optimizer when HIPPO_OPT_BIN is set), a test run for each, then logic.flow
picks one under the request's constraints. Round 1 sends a Proposal;
a revise request sends a Revision (a rule diff against the current policy).

The candidates never use which flows are protected: Flow learns them only from
the Clinical Workflow Agent's rejections (keep_flow constraints). That is the demo.

Claude (llm.py) words "why this plan" as the message's reason; the choice is code's.
"""

import json

from uagents import Context

import facts
import llm
from config import settings
from logic import candidates as candidates_mod
from logic import flow
from logic import hospital as hospital_mod
from protocol import Alternative, Candidate, Policy, Proposal, ProposalRequest, Revision
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
        if settings().hippo_opt_bin:
            candidates = optimize(hospital_without_protection(), req.baseline, req.constraints)
        else:
            candidates = candidates_mod.generate(H, req.baseline, req.patientZero, req.constraints)
        tested = [(c, run_sim(c, req.patientZero, req.seed, req.challenges)) for c in candidates]
        chosen = flow.choose([(c.policy, r) for c, r in tested], req.constraints, H)
        if chosen is None:
            raise RuntimeError("no candidate plan: every connection the attack used is one the agents must keep")
        policy, result, violating = chosen
        cand = next(c for c, _ in tested if c.policy is policy)
        # The other plans that meet every constraint, best first: offered alongside the lead.
        alternatives = [] if violating else [
            Alternative(policyId=c.id, testResult=r, **c.policy.dict())
            for p, r in flow.rank([(c.policy, r) for c, r in tested], req.constraints, H)[1:3]
            for c in [next(c for c, _ in tested if c.policy is p)]
        ]
        if violating:
            ctx.logger.warning(f"no candidate meets every constraint; sending the least-violating, {cand.id}")

        prev = current.get(req.sessionId)
        if req.revise is None or prev is None:
            msg = Proposal(sessionId=req.sessionId, round=req.round, policyId=cand.id, testResult=result,
                           alternatives=alternatives, **cand.policy.dict())
            type = "proposal"
            words = facts.plan(H, policy, result, req.baseline, req.round)
        else:
            changed = {k: getattr(policy, k) for k in ("strategy", "name", "rationale", "tradeoff")
                       if getattr(policy, k) != getattr(prev.policy, k)}
            diff = flow.diff(prev.policy, policy)
            msg = Revision(sessionId=req.sessionId, round=req.round, policyId=cand.id,
                           diff=diff, testResult=result, alternatives=alternatives, **changed)
            type = "revision"
            words = facts.revision(H, policy, result, req.baseline, req.round, req.constraints,
                                   [r.plain for r in diff.added], diff.removed)
        # Each alternative gets its own "why this plan", worded like a proposal.
        worded = [await llm.worded(a, "proposal", facts.plan(H, Policy(**a.dict(include={"strategy", "name", "rules", "rationale", "tradeoff"})),
                                                        a.testResult, req.baseline, req.round))
                  for a in msg.alternatives]
        msg = await llm.worded(msg.copy(update={"alternatives": worded}), type, words)
        current[req.sessionId] = cand
        await send(ctx, NAME, "coordinator", type, msg)
        await relay.status(req.sessionId, NAME, "idle")
    except Exception as e:
        await fail(ctx, NAME, req.sessionId, e)


agent.include(protocol)

if __name__ == "__main__":
    agent.run()
