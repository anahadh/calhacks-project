"""Flow Agent (uAgent): minimize spread.

On a ProposalRequest: candidates built from this attack (logic.candidates, or the
hippo-opt optimizer when HIPPO_OPT_BIN is set), a test run for each, then logic.flow
picks one under the request's constraints. Round 1 sends a Proposal;
a revise request sends a Revision (a rule diff against the current policy).

Strategies come from the model (llm.propose), designed for this hospital and attack,
plus an optimizer's plan; code checks them and the engine tests every one.
The candidates never use which flows are protected: Flow learns them only from
the Clinical Workflow Agent's rejections (keep_flow constraints). That is the demo.

Claude (llm.py) words "why this plan" as the message's reason; the choice is code's.
"""

import json
from concurrent.futures import ThreadPoolExecutor

from uagents import Context

import agent_chat

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
CONTAINED = 3  # an attack held to this many devices counts as contained
MEDICAL = {"mri", "ct", "patient_monitor", "infusion_pump", "anesthesia_machine", "lab_analyzer"}
# Where an attack can start: workstations, nurse stations and Windows medical consoles (phishing lands there).
STARTS = sorted(d for d, x in H.devices.items()
                if x["type"] in ("workstation", "nurse_station") or (x["type"] in MEDICAL and str(x.get("os", "")).startswith("windows")))


def average_infected(c: Candidate | None, req: ProposalRequest) -> float:
    """The objective: mean devices infected over every place an attack could start (None = no plan)."""
    with ThreadPoolExecutor(max_workers=8) as pool:
        counts = list(pool.map(lambda s: run_sim(c, s, req.seed, req.challenges).infectedCount, STARTS))
    return sum(counts) / len(counts)


def with_average(c: Candidate, avg: float, baseline_avg: float) -> Candidate:
    note = f"Average over {len(STARTS)} attack starts: {avg:.1f} devices infected (vs {baseline_avg:.1f} without segmentation)."
    return c.copy(update={"policy": c.policy.copy(update={"rationale": f"{c.policy.rationale} {note}"})})


def with_coverage(c: Candidate, req: ProposalRequest) -> Candidate:
    """The plan tested against every other starting point: how many attacks it would also hold.
    The count goes into its rationale, so humans see which plans protect beyond this one attack."""
    others = [s for s in STARTS if s != req.patientZero]
    with ThreadPoolExecutor(max_workers=8) as pool:
        held = sum(r.infectedCount <= CONTAINED for r in pool.map(lambda s: run_sim(c, s, req.seed, req.challenges), others))
    note = f"Also holds {held} of {len(others)} other attack starts to {CONTAINED} devices or fewer."
    return c.copy(update={"policy": c.policy.copy(update={"rationale": f"{c.policy.rationale} {note}"})})


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
            # The agent's own strategies for this hospital and attack (the model designs them; code checks
            # and turns them into rules; the engine tests them), plus the optimizer's plan.
            keep = candidates_mod.kept_by_constraints(req.constraints)
            plans = await llm.propose(candidates_mod.proposal_facts(H, req.baseline, req.patientZero, req.constraints),
                                      {fid for fid in H.flows})
            candidates = [c for i, p in enumerate(plans, start=1)
                          if (c := candidates_mod.from_proposal(H, i, p.name, p.strategy, p.rationale, p.tradeoff, p.cut, keep))]
            candidates += candidates_mod.generate(H, req.baseline, req.patientZero, req.constraints, starts=STARTS)
        tested = [(c, run_sim(c, req.patientZero, req.seed, req.challenges)) for c in candidates]
        if not tested:
            raise RuntimeError("no candidate plan: every connection the attack used is one the agents must keep")
        # The objective is the whole hospital, not this one machine: phishing can land on any workstation.
        # Among plans that meet every constraint, the lowest average infection over every attack start wins
        # (fewest connections cut breaks a tie). With none meeting them all, the least-violating one goes.
        averages = {c.id: average_infected(c, req) for c, _ in tested}
        ok = [(c, r) for c, r in tested if not flow.violates(r, req.constraints, H, len(c.policy.rules))]
        violating = not ok
        pool_ = ok or [min(tested, key=lambda cr: flow.violation_count(cr[1], req.constraints, H, len(cr[0].policy.rules)))]
        cand, result = min(pool_, key=lambda cr: (averages[cr[0].id], len(cr[1].removedFlows), cr[0].id))
        cand = with_average(cand, averages[cand.id], average_infected(None, req))
        policy = cand.policy
        # The other plans that meet every constraint, best first: offered alongside the lead.
        ranked = [] if violating else [
            (next(c for c, _ in tested if c.policy is p), r) for p, r in flow.rank([(c.policy, r) for c, r in tested], req.constraints, H)
        ]
        # Only plans that actually contain the attack are offered: safe-but-useless plans stay off the table.
        contains = lambda r: r.infectedCount <= max(CONTAINED, req.baseline.infectedCount // 4)
        # One plan: the best of what the agent designed and tested. No alternatives go to the reviewers or humans.
        alternatives: list[Alternative] = []
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
        agent_chat.note(NAME, f"{type} \"{msg.name}\": {msg.reason}" if msg.reason else f"{type} \"{msg.name}\"")
        await relay.status(req.sessionId, NAME, "idle")
    except Exception as e:
        await fail(ctx, NAME, req.sessionId, e)


agent.include(protocol)
# The chat protocol, so the agent answers a judge on ASI:One; the manifest goes to the
# Almanac only when the agent registers there (as the Coordinator does).
agent.include(agent_chat.make_chat(NAME, agent), publish_manifest=settings().mailbox or not settings().local_resolve)

if __name__ == "__main__":
    agent.run()
