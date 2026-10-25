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
from dataclasses import dataclass
from concurrent.futures import ThreadPoolExecutor

from uagents import Context

import agent_chat

import brain
import facts
import llm
from config import settings
from logic.segments import segment_of
from logic import candidates as candidates_mod
from logic import flow
from logic import hospital as hospital_mod
from protocol import StartEvidence, Alternative, Candidate, Policy, Proposal, ProposalRequest, Revision
from runtime import fail, make_agent, received, send
from tools import optimize, relay, run_sim
from protocol import RunResult  # the chat tools' FlowSession

NAME = "flow"
agent, protocol = make_agent(NAME)
H = hospital_mod.load(settings().hospital_path)
current: dict[str, Candidate] = {}  # session → the candidate last sent
baselines: dict[str, dict[str, int]] = {}  # session → no-plan count per start, computed once


@dataclass
class FlowSession:
    """What the chat tools answer from: the plans tested, the one sent, the baseline, and why it was revised."""
    tested: list[tuple[Candidate, RunResult]]
    last: Proposal | Revision | None
    baseline: RunResult | None
    reason: str | None = None  # the last revision's reason, if the last message was a revision


history: dict[str, FlowSession] = {}
last_session: list[str] = []


def tools() -> list[brain.Tool]:
    """What this agent can tell a chat, from the plans it tested (code only; the engine tested them)."""
    def latest() -> FlowSession | None:
        return history.get(last_session[0]) if last_session else None

    async def last_proposal(args: dict):
        h = latest()
        if h is None or h.last is None:
            return {"none": True, "note": "I haven't proposed a plan yet."}
        m = h.last
        return {"round": m.round, "policy_name": getattr(m, "name", None) or m.policyId, "policy_id": m.policyId,
                "infected_with": m.testResult.infectedCount,
                "infected_without": h.baseline.infectedCount if h.baseline else None,
                "connections_cut": len(m.testResult.removedFlows), "reason": m.reason}

    async def candidates(args: dict):
        h = latest()
        if h is None:
            return {"none": True}
        return [{"id": c.id, "name": c.policy.name, "strategy": c.policy.strategy, "infected": r.infectedCount,
                 "rules": len(c.policy.rules), "protected_flows_broken": len(r.protectedBroken)} for c, r in h.tested]

    async def why_revised(args: dict):
        h = latest()
        if h is None or h.reason is None:
            return {"none": True, "note": "the last plan was a first proposal, not a revision"}
        return {"reason": h.reason}

    obj = lambda props, req=(): {"type": "object", "properties": props, "required": list(req)}
    return [
        brain.Tool("last_proposal", "The plan this agent last sent: name, infected devices with and without it, connections cut, and why.", obj({}), last_proposal),
        brain.Tool("candidates", "Every plan this agent designed and tested in the last round, with each one's infected count.", obj({}), candidates),
        brain.Tool("why_revised", "Why the last plan was revised, when it was.", obj({}), why_revised),
    ]
CONTAINED = 3  # an attack held to this many devices counts as contained wherever it went


def contained(r, start: str) -> bool:
    """An attack is contained when it stayed inside the functional segment it started in
    (segmentation's promise: that network's machines may be hit, the rest of the hospital is not),
    or when it touched CONTAINED devices or fewer wherever they are."""
    seg = segment_of(H, start)
    return r.infectedCount <= CONTAINED or all(segment_of(H, d.id) == seg for d in r.infectedDevices if d.id in H.devices)
MEDICAL = {"mri", "ct", "patient_monitor", "infusion_pump", "anesthesia_machine", "lab_analyzer"}
# Where an attack can start: workstations, nurse stations and Windows medical consoles (phishing lands there).
STARTS = sorted(d for d, x in H.devices.items()
                if x["type"] in ("workstation", "nurse_station") or (x["type"] in MEDICAL and str(x.get("os", "")).startswith("windows")))


def per_start(c: Candidate | None, req: ProposalRequest) -> dict[str, int]:
    """Devices infected from every place an attack could start (None = no plan): the engine's count per start."""
    with ThreadPoolExecutor(max_workers=8) as pool:
        counts = list(pool.map(lambda s: run_sim(c, s, req.seed, req.challenges).infectedCount, STARTS))
    return dict(zip(STARTS, counts))


def average_infected(c: Candidate | None, req: ProposalRequest, counts: dict[str, int] | None = None) -> float:
    """The objective: mean devices infected over every place an attack could start (None = no plan)."""
    counts = counts or per_start(c, req)
    return sum(counts.values()) / len(counts)


def with_average(c: Candidate, avg: float, baseline_avg: float, plan: dict[str, int] | None = None,
                 base: dict[str, int] | None = None) -> Candidate:
    """The average in the rationale, and the per-start counts as the policy's evidence (the proof humans see)."""
    note = f"Average over {len(STARTS)} attack starts: {avg:.1f} devices infected (vs {baseline_avg:.1f} without segmentation)."
    evidence = [StartEvidence(start=s, name=H.devices[s]["name"], baseline=(base or {}).get(s, 0), plan=(plan or {}).get(s, 0)) for s in STARTS] if plan and base else []
    return c.copy(update={"policy": c.policy.copy(update={"rationale": f"{c.policy.rationale} {note}", "evidence": evidence})})


def with_coverage(c: Candidate, req: ProposalRequest) -> Candidate:
    """The plan tested against every other starting point: how many attacks it would also hold.
    The count goes into its rationale, so humans see which plans protect beyond this one attack."""
    others = [s for s in STARTS if s != req.patientZero]
    with ThreadPoolExecutor(max_workers=8) as pool:
        held = sum(contained(r, s) for s, r in zip(others, pool.map(lambda s: run_sim(c, s, req.seed, req.challenges), others)))
    note = f"Also holds {held} of {len(others)} other attack starts inside the segment they begin in."
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
            try:
                plans = await llm.propose(candidates_mod.proposal_facts(H, req.baseline, req.patientZero, req.constraints),
                                          {fid for fid in H.flows})
            except llm.LlmError as e:
                # The model's plans were unusable (bad JSON, unknown ids, forbidden words). The round goes on
                # with the agent's own code-built candidates below; nothing from the model is kept.
                ctx.logger.warning(f"model plans dropped: {e}")
                plans = []
            candidates = [c for i, p in enumerate(plans, start=1)
                          if (c := candidates_mod.from_proposal(H, i, p.name, p.strategy, p.rationale, p.tradeoff, p.cut, keep,
                                                                candidates_mod.rule_limit(req.constraints)))]
            candidates += candidates_mod.generate(H, req.baseline, req.patientZero, req.constraints, starts=STARTS)
        # Round 1 is the naive plan on purpose: wall off the department the attack started in. The
        # reviewers' objections (scans cut from PACS, other starts unprotected) are what the next rounds fix.
        if req.revise is None and not req.constraints:
            first = candidates_mod.naive(H, req.patientZero, keep)
            if first is not None:
                candidates = [first]
        tested = [(c, run_sim(c, req.patientZero, req.seed, req.challenges)) for c in candidates]
        if not tested:
            raise RuntimeError("no candidate plan: every connection the attack used is one the agents must keep")
        # The objective is the whole hospital, not this one machine: phishing can land on any workstation.
        # Among plans that meet every constraint, the lowest average infection over every attack start wins
        # (fewest connections cut breaks a tie). With none meeting them all, the least-violating one goes.
        # Speed: the lead is picked on this attack's result (constraints first, then fewest infected, fewest
        # cuts); only the lead is then tested from every start, and the no-plan baseline once per session.
        ok = [(c, r) for c, r in tested if not flow.violates(r, req.constraints, H, len(c.policy.rules))]
        violating = not ok
        pool_ = ok or [min(tested, key=lambda cr: flow.violation_count(cr[1], req.constraints, H, len(cr[0].policy.rules)))]
        cand, result = min(pool_, key=lambda cr: (cr[1].infectedCount, len(cr[1].removedFlows), cr[0].id))
        base_counts = baselines.get(req.sessionId) or baselines.setdefault(req.sessionId, per_start(None, req))
        lead_counts = per_start(cand, req)
        averages = {cand.id: average_infected(cand, req, lead_counts)}
        cand = with_average(cand, averages[cand.id], average_infected(None, req, base_counts), lead_counts, base_counts)
        policy = cand.policy
        # The other plans that meet every constraint, best first: offered alongside the lead.
        ranked = [] if violating else [
            (next(c for c, _ in tested if c.policy is p), r) for p, r in flow.rank([(c.policy, r) for c, r in tested], req.constraints, H)
        ]
        # Only plans that actually contain the attack are offered: safe-but-useless plans stay off the table.
        contains = lambda r: contained(r, req.patientZero) or r.infectedCount <= req.baseline.infectedCount // 4
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
            changed = {k: getattr(policy, k) for k in ("strategy", "name", "rationale", "tradeoff", "evidence")
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
        history[req.sessionId] = FlowSession(tested, msg, req.baseline, msg.reason if type == "revision" else None)
        last_session[:] = [req.sessionId]
        await send(ctx, NAME, "coordinator", type, msg)
        agent_chat.note(NAME, f"{type} \"{msg.name}\": {msg.reason}" if msg.reason else f"{type} \"{msg.name}\"")
        await relay.status(req.sessionId, NAME, "idle")
    except Exception as e:
        await fail(ctx, NAME, req.sessionId, e)


agent.include(protocol)
# The chat protocol, so the agent answers a judge on ASI:One; the manifest goes to the
# Almanac only when the agent registers there (as the Coordinator does).
agent.include(agent_chat.make_chat(NAME, agent, tools), publish_manifest=settings().mailbox or not settings().local_resolve)

if __name__ == "__main__":
    agent.run()
