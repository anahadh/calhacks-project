"""Scorekeeper: rank every plan a session's round has seen, and say why the leader leads.

It explains; it never decides (AGENTS.md rule 8). Nothing here sends a Verdict, adds a
Constraint, asks a Question, or touches which plans are recommended or their order: the
Coordinator's Round never sees a Scorecard. No model writes any text: `why` and the chat
replies are fixed templates filled with numbers from the inputs (the engine's RunResults,
rule counts, rounds and plan names). Pure: no I/O, clock or randomness, so the same inputs
give byte-identical Scorecards.

`CopyTracker` is the Coordinator's side: it watches the plans and verdicts the round already
handles and says when a round's plans have all been judged, so the Coordinator can send the
Scorekeeper one fire-and-forget copy. Each copy carries every plan judged so far in the
negotiation, so the Scorekeeper keeps no state and a new negotiation starts a new tracker.
"""

import re

from protocol import (
    BrokenConstraint,
    Proposal,
    Revision,
    RunResult,
    ScoreCandidate,
    ScoreInput,
    Scorecard,
    ScoreRow,
    Verdict,
)

from .clinical import services_down_too_long
from .coordinator import GUARDIANS, MAX_OPTIONS
from .flow import apply_diff
from .hospital import HospitalIndex

# The one ranking order, best first. score_key() implements it; keep the two in step.
RANKING = (
    "accepted by both guardians",
    "fewest patients affected",
    "fewest devices infected",
    "fewest services down too long",
    "fewest rules",
    "candidate id",  # stable tie-break; then round, for a plan id seen in two rounds
)

GUARDIAN_NAME = {"inventory": "Inventory", "clinical_workflow": "Clinical Workflow"}
# Never in a Scorekeeper text (AGENTS.md prompt rules). Whole words, any case.
FORBIDDEN = re.compile(r"\b(approved|ready|safe to deploy|deaths?|died|lives|fatal|mortality)\b", re.I)


class ScorekeeperError(ValueError):
    pass


def patients_affected(result: RunResult) -> int:
    c = result.patientCounts
    return c.delayed + c.disrupted + c.diverted


def score_key(row: ScoreRow) -> tuple:
    """RANKING as a sort key."""
    both = row.inventory == "accept" and row.clinicalWorkflow == "accept"
    return (0 if both else 1, row.patientsAffected, row.devicesInfected, row.servicesDownTooLong, row.ruleCount,
            row.policyId, row.round)


def _names(hospital: HospitalIndex, kind: str, ids: list[str]) -> list[str]:
    device = lambda d: hospital.devices[d]["name"] if d in hospital.devices else d
    if kind == "keep_flow":
        return [f"{device(f['from'])} → {device(f['to'])}" if (f := hospital.flows.get(i)) else i for i in ids]
    if kind == "keep_service":
        return [hospital.services[i]["name"] if i in hospital.services else i for i in ids]
    if kind == "confirm_device":
        return [device(i) for i in ids]
    return []


def _row(c: ScoreCandidate, hospital: HospitalIndex) -> ScoreRow:
    broken = [
        BrokenConstraint(agent=v.agent, kind=v.constraint.kind, targetIds=list(v.constraint.targetIds),
                         targetNames=_names(hospital, v.constraint.kind, list(v.constraint.targetIds)))
        for v in (c.inventory, c.clinicalWorkflow) if v.decision == "reject" and v.constraint is not None
    ]
    return ScoreRow(
        rank=1, policyId=c.policyId, name=c.name, round=c.round, devicesInfected=c.testResult.infectedCount,
        servicesDownTooLong=len(services_down_too_long(c.testResult, hospital)),
        patientsAffected=patients_affected(c.testResult), ruleCount=c.ruleCount,
        inventory=c.inventory.decision, clinicalWorkflow=c.clinicalWorkflow.decision, broken=broken,
    )


def _count(n: int, one: str, many: str) -> str:
    return f"{n} {one if n == 1 else many}"


def verdict_phrase(row: ScoreRow) -> str:
    no = [GUARDIAN_NAME[g] for g, d in (("inventory", row.inventory), ("clinical_workflow", row.clinicalWorkflow))
          if d == "reject"]
    if not no:
        return "accepted by both"
    return "rejected by both" if len(no) == 2 else f"rejected by {no[0]}"


def why(rows: list[ScoreRow]) -> str:
    """One sentence on why the first row leads: the first RANKING step where it beats the second."""
    label = _labels(rows)
    a = rows[0]
    if len(rows) == 1:
        return (f"{label[0]} is the only plan scored so far: {verdict_phrase(a)}, "
                f"{_count(a.patientsAffected, 'patient', 'patients')} affected, "
                f"{_count(a.devicesInfected, 'device', 'devices')} infected.")
    b, la, lb = rows[1], label[0], label[1]
    lead = f"{la} leads: {verdict_phrase(a)}"
    ka, kb = score_key(a), score_key(b)
    if ka[0] != kb[0]:
        return f"{lead}, while {lb} was {verdict_phrase(b)}."
    if ka[1] != kb[1]:
        return f"{lead}, {_count(a.patientsAffected, 'patient', 'patients')} affected vs {b.patientsAffected} for {lb}."
    same = f"the same {_count(a.patientsAffected, 'patient', 'patients')} affected"
    if ka[2] != kb[2]:
        return f"{lead}, {same}, {_count(a.devicesInfected, 'device', 'devices')} infected vs {b.devicesInfected} for {lb}."
    if ka[3] != kb[3]:
        return (f"{lead}, {same}, {_count(a.servicesDownTooLong, 'service', 'services')} down too long "
                f"vs {b.servicesDownTooLong} for {lb}.")
    if ka[4] != kb[4]:
        return f"{lead}, {same}, {_count(a.ruleCount, 'rule', 'rules')} vs {b.ruleCount} for {lb}."
    return f"{la} and {lb} tie on every count; {la} comes first by candidate id."


def _labels(rows: list[ScoreRow]) -> list[str]:
    """Plan names, with the round added where two rows share a name (a revision keeps its name)."""
    dup = {r.name for r in rows if sum(x.name == r.name for x in rows) > 1}
    return [f"{r.name} (round {r.round})" if r.name in dup else r.name for r in rows]


def scorecard(session_id: str, candidates: list[ScoreCandidate], hospital: HospitalIndex) -> Scorecard:
    """Every candidate, ranked by RANKING. The latest copy of a (round, policy id) wins."""
    if not candidates:
        raise ScorekeeperError("no candidates to score")
    latest = {(c.round, c.policyId): c for c in candidates}
    rows = sorted((_row(c, hospital) for c in latest.values()), key=score_key)
    rows = [r.copy(update={"rank": i}) for i, r in enumerate(rows, start=1)]
    card = Scorecard(sessionId=session_id, round=max(r.round for r in rows), rankedBy=list(RANKING), rows=rows,
                     why=why(rows))
    check_text(card.why)
    return card


def check_text(text: str) -> str:
    if FORBIDDEN.search(text):
        raise ScorekeeperError(f"forbidden word in Scorekeeper text: {FORBIDDEN.search(text).group(0)!r}")
    return text


# --- text for chat (ASI:One) and logs: templates only ---


def card_text(card: Scorecard) -> str:
    lines = [f"Ranking after round {card.round}, best first:"]
    for r, label in zip(card.rows, _labels(card.rows)):
        line = (f"{r.rank}. {label} · {verdict_phrase(r)} · {_count(r.patientsAffected, 'patient', 'patients')} affected · "
                f"{_count(r.devicesInfected, 'device', 'devices')} infected · "
                f"{_count(r.servicesDownTooLong, 'service', 'services')} down too long · {_count(r.ruleCount, 'rule', 'rules')}")
        for b in r.broken:
            line += f" · {GUARDIAN_NAME[b.agent]} needs {b.kind.replace('_', ' ')}: {', '.join(b.targetNames) or 'fewer rules'}"
        lines.append(line)
    lines.append(card.why)
    lines.append("I explain the ranking; I don't vote. Humans decide.")
    return check_text("\n".join(lines))


ORDER_TEXT = "I rank plans by: " + "; then ".join(RANKING) + "."
INTRO = ("I'm the Hippocratech Scorekeeper. I explain how the agents' plans rank, from the simulator's numbers. "
         "I use no AI model and I never vote. Ask me \"what's the ranking?\" or \"how do you rank?\".")


def chat_reply(text: str, card: Scorecard | None) -> str:
    t = text.lower()
    if re.search(r"\b(how|order|criteria|rules for)\b", t) and not re.search(r"\b(ranking|scorecard|standings)\b", t):
        return ORDER_TEXT
    if re.search(r"\b(rank|ranking|ranked|score|scores|scorecard|lead|leads|leading|best|standings|table|plans?)\b", t):
        if card is None:
            return "No plans scored yet. I score a round once both guardians have judged its plans."
        return card_text(card)
    return f"{INTRO} {ORDER_TEXT}"


# --- the Coordinator's side: when to send a copy ---


class CopyTracker:
    """Which plans a round put to both guardians, and the verdicts they got.

    Mirrors Round._forward: a round's lead plan (the first Proposal or Revision for that
    round) plus up to MAX_OPTIONS - 1 of its alternatives. Read-only towards the Round:
    it is fed the same messages and returns a ScoreInput when every plan of a round has
    both guardians' verdicts (again, if a re-judged plan's verdicts change). The copy holds
    every round judged so far, in round order."""

    def __init__(self, session_id: str):
        self.session_id = session_id
        self._lead_rules: list = []
        self._lead_name = ""
        self._plans: dict[int, dict[str, tuple[str, int, RunResult]]] = {}  # round → policy id → (name, rules, result)
        self._verdicts: dict[tuple[int, str], dict[str, Verdict]] = {}
        self._judged: dict[int, list[ScoreCandidate]] = {}  # round → its plans, once all are judged
        self._sent = ""

    def on_plan(self, msg: Proposal | Revision) -> None:
        if msg.round in self._plans:
            return
        if isinstance(msg, Proposal):
            self._lead_rules, self._lead_name = list(msg.rules), msg.name
        else:
            self._lead_rules = apply_diff(self._lead_rules, msg.diff)
            self._lead_name = msg.name or self._lead_name
        plans = {msg.policyId: (self._lead_name or msg.policyId, len(self._lead_rules), msg.testResult)}
        for a in [a for a in msg.alternatives if a.policyId != msg.policyId][: MAX_OPTIONS - 1]:
            plans[a.policyId] = (a.name, len(a.rules), a.testResult)
        self._plans[msg.round] = plans

    def on_verdict(self, v: Verdict) -> ScoreInput | None:
        plans = self._plans.get(v.round)
        if plans is None or v.policyId not in plans or v.agent not in GUARDIANS:
            return None
        self._verdicts.setdefault((v.round, v.policyId), {})[v.agent] = v
        got = [self._verdicts.get((v.round, pid), {}) for pid in plans]
        if any(len(g) < len(GUARDIANS) for g in got):
            return None
        candidates = [
            ScoreCandidate(policyId=pid, name=name, round=v.round, ruleCount=rules, testResult=result,
                           inventory=g["inventory"], clinicalWorkflow=g["clinical_workflow"])
            for (pid, (name, rules, result)), g in zip(plans.items(), got)
        ]
        self._judged[v.round] = candidates
        everything = [c for r in sorted(self._judged) for c in self._judged[r]]
        copy = ScoreInput(sessionId=self.session_id, round=v.round, candidates=everything)
        signature = copy.json(sort_keys=True)
        if self._sent == signature:
            return None
        self._sent = signature
        return copy
