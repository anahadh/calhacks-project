"""Sign-off Coordinator: run rounds until both guardians accept, pause for humans,
and pick who must sign off. It cannot approve anything (AGENTS.md rule 8).

`Round` is a pure state machine. Each event method returns the Actions to carry
out; the uAgents runtime only executes them (sends, relays). The same events
always give the same actions.

Message order the runtime must keep: Inventory sends its Question (on_questions)
before the Verdict it belongs to (on_verdict).

Options: every round puts the Flow Agent's lead plan and its alternatives (up to two)
to both guardians. Every rejection adds its constraint, so the next round repairs all
of them. The round ends with recommendations when at least two plans are accepted,
when the lead is accepted and no alternative is left to repair, or at the last round
with any plan accepted: up to three options, for humans to choose from.

Pausing (spec, The Agents, step 5): the round goes to waiting_for_human as soon as a
question is open. Proposals, revisions and verdicts that arrive while it waits are
held. On resume, verdicts held for the current candidate are dropped and both
guardians check it again (the answer may change Inventory's view). Held proposals
and revisions are then processed in arrival order.
"""

from dataclasses import dataclass
from typing import Literal

from protocol import (
    AgentName,
    Alternative,
    Answer,
    Constraint,
    Policy,
    Proposal,
    ProposalRequest,
    Question,
    Recommendation,
    Revision,
    RoundState,
    RunResult,
    Strict,
    Verdict,
)

from . import flow
from .hospital import HospitalIndex

MAX_ROUNDS = 6
MAX_OPTIONS = 3  # recommendations offered to humans: the lead and up to two alternatives
GUARDIANS: tuple[AgentName, ...] = ("inventory", "clinical_workflow")
CLINICAL_TYPES = {
    "mri", "ct", "patient_monitor", "infusion_pump", "anesthesia_machine", "lab_analyzer", "nurse_station",
}
OPERATIONS_ROOMS = {"er", "or", "icu", "pharmacy"}
KIND_ORDER = ("keep_flow", "keep_service", "confirm_device", "max_rules")

ActionType = Literal[
    "proposal_request", "proposal", "revision", "verdict", "question", "answer", "recommendation", "round_state"
]
State = Literal["idle", "running", "waiting_for_human", "done"]


@dataclass(frozen=True)
class Action:
    to: AgentName | Literal["humans", "relay"]
    type: ActionType
    message: Strict  # one protocol model


def required_roles(result: RunResult, hospital: HospitalIndex) -> list[str]:
    """Who must sign off, from the devices the policy touches. Security always."""
    touched = hospital.touched(result)
    protected = hospital.endpoints(fid for fid, f in hospital.flows.items() if f["protected"])
    roles = ["security"]
    if any(
        hospital.room_type(d) == "imaging" or hospital.devices[d]["type"] in CLINICAL_TYPES or d in protected
        for d in touched
    ):
        roles.append("clinical_engineering")
    if any(hospital.room_type(d) in OPERATIONS_ROOMS for d in touched):
        roles.append("operations")
    return roles


def merge(constraints: list[Constraint], new: Constraint) -> list[Constraint]:
    """One constraint per kind: target ids are unioned, max_rules keeps the lowest limit."""
    by_kind = {c.kind: c for c in constraints}
    old = by_kind.get(new.kind)
    if old is None:
        by_kind[new.kind] = new
    elif new.kind == "max_rules":
        by_kind[new.kind] = Constraint(kind="max_rules", targetIds=[], limit=min(old.limit, new.limit))
    else:
        by_kind[new.kind] = Constraint(kind=new.kind, targetIds=sorted(set(old.targetIds) | set(new.targetIds)))
    return [by_kind[k] for k in KIND_ORDER if k in by_kind]


class Round:
    def __init__(self, sessionId: str, hospital: HospitalIndex):
        self.sessionId = sessionId
        self.hospital = hospital
        self.state: State = "idle"
        self.round = 0
        self.constraints: list[Constraint] = []
        self.confirmed: dict[str, str] = {}  # device id → type a human named
        self.open_questions: dict[str, Question] = {}  # question id → question
        self.recommendation: Recommendation | None = None
        self._run_id = ""
        self._patient_zero = ""
        self._seed = 0
        self.challenges: list[str] = []
        self._baseline: RunResult | None = None
        self._policy: Policy | None = None  # current candidate
        self._result: RunResult | None = None
        self._current: Proposal | Revision | None = None  # last proposal or revision, as received
        self._verdicts: dict[str, Verdict] = {}
        self._decided = True  # no candidate is waiting for verdicts
        self._decided_round = True  # the round's plans have all been judged and acted on
        self._held: list[Proposal | Revision] = []  # arrived while waiting_for_human
        self._waiting_rejection = False  # paused after a confirm_device rejection
        self.recommendations: list[Recommendation] = []  # option 1 first
        self._alternatives: list[Alternative] = []  # offered with the current candidate
        self._alt_verdicts: dict[str, dict[str, Verdict]] = {}  # this round's alternatives: policy id → verdicts

    @property
    def baseline(self) -> RunResult | None:
        return self._baseline

    @property
    def patient_zero(self) -> str:
        return self._patient_zero

    # --- events ---

    def start(
        self, runId: str, patientZero: str, baseline: RunResult, seed: int, challenges: list[str] = ()
    ) -> list[Action]:
        self._require("idle")
        self._run_id, self._patient_zero, self._baseline = runId, patientZero, baseline
        self._seed, self.challenges = seed, sorted(challenges)
        self.round, self.state = 1, "running"
        request = self._request(revise=None)
        # Inventory gets round 1's request too: it runs its preflight on the baseline.
        return [self._round_state(), Action("flow", "proposal_request", request), Action("inventory", "proposal_request", request)]

    def on_questions(self, questions: list[Question]) -> list[Action]:
        """Record open questions and pass them to humans. A question about a device
        that already has one open is dropped, so humans are asked once."""
        for q in questions:
            self._check_session(q)
        if self.state == "done":
            return []
        asked = {q.targetId for q in self.open_questions.values()}
        actions = []
        for q in sorted(questions, key=lambda q: q.id):
            if q.id in self.open_questions or q.targetId in asked or q.targetId in self.confirmed:
                continue
            self.open_questions[q.id] = q
            asked.add(q.targetId)
            actions.append(Action("humans", "question", q))
        if actions and self.state == "running":
            self.state = "waiting_for_human"
            actions.append(self._round_state())
        return actions

    def on_proposal(self, proposal: Proposal) -> list[Action]:
        self._check_session(proposal)
        if self.state == "waiting_for_human":
            self._held.append(proposal)
            return []
        if self.state != "running" or proposal.round != self.round or self._policy is not None:
            return []
        self._policy = Policy(
            strategy=proposal.strategy,
            name=proposal.name,
            rules=proposal.rules,
            rationale=proposal.rationale,
            tradeoff=proposal.tradeoff,
            evidence=proposal.evidence,
        )
        return self._forward(proposal, "proposal")

    def on_revision(self, revision: Revision) -> list[Action]:
        self._check_session(revision)
        if self.state == "waiting_for_human":
            self._held.append(revision)
            return []
        if self.state != "running" or revision.round != self.round or self._policy is None:
            return []
        rules = flow.apply_diff(self._policy.rules, revision.diff)
        changed = {k: getattr(revision, k) for k in ("strategy", "name", "rationale", "tradeoff", "evidence") if getattr(revision, k) is not None}
        # parse_obj re-validates (e.g. still at most 40 rules); copy(update=...) would not.
        self._policy = Policy.parse_obj({**self._policy.dict(), **changed, "rules": [r.dict() for r in rules]})
        return self._forward(revision, "revision")

    def on_verdict(self, verdict: Verdict) -> list[Action]:
        self._check_session(verdict)
        if verdict.agent not in GUARDIANS:
            raise ValueError(f"verdict from {verdict.agent}, which is not a guardian")
        if verdict.policyId in self._alt_verdicts and self._current is not None and verdict.round == self._current.round:
            got = self._alt_verdicts[verdict.policyId]
            if self.state != "running" or self._decided_round or verdict.agent in got:
                return []
            got[verdict.agent] = verdict
            return self._decide_if_complete()
        stale = self._current is None or (verdict.round, verdict.policyId) != (self._current.round, self._current.policyId)
        # While waiting, a verdict on the current candidate is dropped: on resume both
        # guardians check it again with the human's answer.
        if self.state != "running" or stale or self._decided or verdict.agent in self._verdicts:
            return []
        self._verdicts[verdict.agent] = verdict
        if len(self._verdicts) == len(GUARDIANS):
            self._decided = True
        return self._decide_if_complete()

    def _decide_if_complete(self) -> list[Action]:
        """Once both guardians have judged the lead and every alternative of the round."""
        if not self._decided or any(len(v) < len(GUARDIANS) for v in self._alt_verdicts.values()) or self._decided_round:
            return []
        self._decided_round = True
        verdicts = [self._verdicts[a] for a in GUARDIANS]
        all_verdicts = verdicts + [v for got in self._alt_verdicts.values() for v in got.values()]
        for v in all_verdicts:
            if v.decision == "reject" and v.constraint is not None:
                self.constraints = merge(self.constraints, v.constraint)
        lead_ok = all(v.decision == "accept" for v in verdicts)
        alts = {a.policyId: a for a in self._alternatives}
        accepted_alts = [alts[pid] for pid, got in self._alt_verdicts.items()
                         if all(got[g].decision == "accept" for g in GUARDIANS)]
        rejected_alts = len(self._alt_verdicts) - len(accepted_alts)
        options = ([(self._policy, self._result, verdicts)] if lead_ok else []) + [
            (Policy(strategy=a.strategy, name=a.name, rules=a.rules, rationale=a.rationale, tradeoff=a.tradeoff),
             a.testResult, [self._alt_verdicts[a.policyId][g] for g in GUARDIANS]) for a in accepted_alts]
        last = self.round >= MAX_ROUNDS
        if len(options) >= 2 or (lead_ok and (rejected_alts == 0 or last)) or (last and options):
            return self._publish(options)
        if lead_ok:
            # The lead holds, but its alternatives need repair: one more round, with what they taught.
            return self._next_round()
        if self._waiting_on_humans():
            self.state = "waiting_for_human"
            self._waiting_rejection = True
            return [self._round_state()]
        return self._next_round()

    def on_answer(self, answer: Answer) -> list[Action]:
        self._check_session(answer)
        q = self.open_questions.get(answer.questionId)
        if q is None:
            raise ValueError(f"no open question {answer.questionId}")
        if answer.role not in q.allowedRoles:
            raise ValueError(f"{answer.role} may not answer {q.id}")
        if answer.choice not in q.choices:
            raise ValueError(f"{answer.choice!r} is not a choice for {q.id}")
        del self.open_questions[q.id]
        self.confirmed[q.targetId] = answer.choice
        self.constraints = self._without_confirmed(self.constraints)
        actions = [Action("inventory", "answer", answer)]
        if self.state == "waiting_for_human" and not self._waiting_on_humans():
            actions += self._resume()
        return actions

    # --- internals ---

    def _check_session(self, msg):
        if msg.sessionId != self.sessionId:
            raise ValueError(f"{type(msg).__name__} for session {msg.sessionId}, this round is {self.sessionId}")

    def _require(self, state: State):
        if self.state != state:
            raise ValueError(f"round is {self.state}, expected {state}")

    def _round_state(self, detail: str | None = None) -> Action:
        return Action("relay", "round_state", RoundState(sessionId=self.sessionId, round=self.round, state=self.state, detail=detail))

    def _request(self, revise: str | None) -> ProposalRequest:
        return ProposalRequest(
            sessionId=self.sessionId,
            round=self.round,
            runId=self._run_id,
            patientZero=self._patient_zero,
            seed=self._seed,
            challenges=self.challenges,
            baseline=self._baseline,
            constraints=self.constraints,
            revise=revise,
        )

    def _forward(self, msg: Proposal | Revision, type: ActionType) -> list[Action]:
        self._current, self._result, self._verdicts, self._decided = msg, msg.testResult, {}, False
        self._decided_round = False
        # The alternatives Flow offered with this plan, each put to both guardians too.
        self._alternatives = [a for a in msg.alternatives if a.policyId != msg.policyId][: MAX_OPTIONS - 1]
        self._alt_verdicts = {a.policyId: {} for a in self._alternatives}
        alt_msgs = [Proposal(sessionId=self.sessionId, round=msg.round, policyId=a.policyId, strategy=a.strategy, name=a.name,
                             rules=a.rules, rationale=a.rationale, tradeoff=a.tradeoff, testResult=a.testResult,
                             reason=a.reason, reasonSource=a.reasonSource) for a in self._alternatives]
        return [Action(g, type, msg) for g in GUARDIANS] + [Action(g, "proposal", a) for a in alt_msgs for g in GUARDIANS]

    def _waiting_on_humans(self) -> bool:
        """A confirm_device constraint is waiting on an open question about one of its devices."""
        asked = {q.targetId for q in self.open_questions.values()}
        return any(c.kind == "confirm_device" and asked & set(c.targetIds) for c in self.constraints)

    def _without_confirmed(self, constraints: list[Constraint]) -> list[Constraint]:
        out = []
        for c in constraints:
            if c.kind == "confirm_device":
                left = [d for d in c.targetIds if d not in self.confirmed]
                if not left:
                    continue
                c = Constraint(kind="confirm_device", targetIds=left)
            out.append(c)
        return out

    def _resume(self) -> list[Action]:
        self.state = "running"
        actions = [self._round_state()]
        reopen, self._waiting_rejection = self._waiting_rejection, False
        again = "proposal" if isinstance(self._current, Proposal) else "revision"
        if self._current is not None and not self._decided_round and not reopen:
            # Paused mid-judgement (the lead or an alternative): verdicts that came in meanwhile were dropped; judge again.
            actions += self._forward(self._current, again)
        elif self._current is not None and reopen:
            # Rejected for an unanswered question. If the answer cleared the only objection,
            # ask both guardians again; otherwise move on to a revision.
            if flow.violates(self._result, self.constraints, self.hospital, len(self._policy.rules)):
                actions += self._next_round()
            else:
                actions += self._forward(self._current, again)
        held, self._held = self._held, []
        for msg in held:
            if self.state != "running":  # a replayed message paused or ended the round again
                self._held.append(msg)
                continue
            actions += self.on_proposal(msg) if isinstance(msg, Proposal) else self.on_revision(msg)
        return actions


    def _next_round(self) -> list[Action]:
        if self.round >= MAX_ROUNDS:
            self.state = "done"
            return [self._round_state(f"No agreement after {MAX_ROUNDS} rounds. No recommendation.")]
        self.round += 1
        self._verdicts = {}
        return [self._round_state(), Action("flow", "proposal_request", self._request(revise=self._current.policyId))]

    def _publish(self, options: list[tuple[Policy, RunResult, list[Verdict]]]) -> list[Action]:
        options = options[:MAX_OPTIONS]
        self.recommendations = [
            Recommendation(policy=p, testResult=r, verdicts=vs, explanation="[explanation]",
                           requiredRoles=required_roles(r, self.hospital), option=i)
            for i, (p, r, vs) in enumerate(options, start=1)
        ]
        self.recommendation = self.recommendations[0]
        self.state = "done"
        return [*(Action("relay", "recommendation", rec) for rec in self.recommendations), self._round_state()]
