"""Decision logic: guardians, Flow ranking, and the Coordinator's state machine.

RunResults come from tests/fixtures/results/test_*.json. They are hand-written
(there is no simulator yet), test-only, and never loaded at runtime. Policy rules
here are illustrative: no code reads rule contents, only rule ids and counts.

`pytest -s` prints the scenario a→b transcript.
"""

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

from logic import clinical, coordinator, flow, inventory
from logic import hospital as hospital_mod
from logic.coordinator import MAX_ROUNDS, Action, Round, required_roles
from protocol import (
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
    Verdict,
)

RESULTS = Path(__file__).parent / "fixtures" / "results"
H = hospital_mod.load()


def result(name: str) -> RunResult:
    return RunResult.parse_file(RESULTS / f"test_{name}.json")


def rule(id, frm, to, plain, **kw):
    return {"id": id, "from": frm, "to": to, "plain": plain, **kw}


BASE_RULES = [
    rule("r1", {"zone": "critical_care"}, {"zone": "it_core"}, "Critical care may reach the IT core."),
    rule("r2", {"zone": "inpatient"}, {"zone": "it_core"}, "Wards may reach the IT core."),
]
POLICY_A = Policy.parse_obj({
    "strategy": "max_containment", "name": "Isolate imaging",
    "rules": BASE_RULES, "rationale": "[rationale]", "tradeoff": "[tradeoff]",
})
POLICY_B = Policy.parse_obj({
    **POLICY_A.dict(),
    "rules": BASE_RULES + [
        rule("r3", {"zone": "imaging", "deviceType": "mri"}, {"role": "pacs"}, "MRI scanners may send images to PACS on port 104.", protocol="dicom", port=104),
        rule("r4", {"zone": "imaging"}, {"zone": "it_core"}, "Imaging may reach the IT core."),
    ],
})


def proposal(round, policy_id, policy, res):
    return Proposal(sessionId="demo", round=round, policyId=policy_id, **{k: v for k, v in policy.dict().items()}, testResult=res)


# --- a small harness: the coordinator plus guardians played by the logic functions ---


def describe(msg) -> str:
    def cons(cs):
        return ", ".join(f"{c.kind}{c.targetIds}" + (f"≤{c.limit}" if c.limit else "") for c in cs) or "none"

    if isinstance(msg, ProposalRequest):
        what = f"revise {msg.revise}" if msg.revise else "propose"
        return f"round {msg.round}: {what}; constraints: {cons(msg.constraints)}"
    if isinstance(msg, (Proposal, Revision)):
        r = msg.testResult
        head = (
            f"{msg.policyId} '{msg.name}' ({msg.strategy}), {len(msg.rules)} rules"
            if isinstance(msg, Proposal)
            else f"{msg.policyId}: +{[x.id for x in msg.diff.added]} −{msg.diff.removed}"
        )
        return (
            f"{head}; removes {r.removedFlows}; infected {r.infectedCount}; "
            f"patients ok {r.patientCounts.ok}; protected broken {r.protectedBroken or 'none'}"
        )
    if isinstance(msg, Verdict):
        c = f" with {msg.constraint.kind}{msg.constraint.targetIds}" if msg.constraint else ""
        return f"{msg.decision.upper()} {msg.policyId} (round {msg.round}){c}"
    if isinstance(msg, Question):
        return f"{msg.id} about {msg.targetId}; {len(msg.choices)} choices; answerable by {msg.allowedRoles}"
    if isinstance(msg, Answer):
        return f"{msg.author} ({msg.role}) answers {msg.questionId}: {msg.choice}"
    if isinstance(msg, Recommendation):
        r = msg.testResult
        return (
            f"'{msg.policy.name}', {len(msg.policy.rules)} rules; infected {r.infectedCount}; "
            f"verdicts {[v.agent + ':' + v.decision for v in msg.verdicts]}; required roles {msg.requiredRoles}"
        )
    if isinstance(msg, RoundState):
        return f"round {msg.round}: {msg.state}" + (f" ({msg.detail})" if msg.detail else "")
    raise TypeError(msg)


class Sim:
    """Feeds events to a Round and plays Inventory and Clinical Workflow from the logic
    module, the way the agents will. Flow's proposals and humans' answers are scripted."""

    def __init__(self, challenges=(), baseline="baseline"):
        self.round = Round("demo", H)
        self.challenges, self.baseline = list(challenges), baseline
        self.inventory_challenges: list[str] = []  # Inventory learns them from round 1's request
        self.inventory_confirmed: dict[str, str] = {}  # Inventory's own copy, updated by answer actions
        self.inventory_asked: dict[str, str] = {}  # question id → device, for the questions Inventory sent
        self.actions: list[Action] = []
        self.log: list[tuple[str, str, str, str]] = []  # (from, to, type, summary)
        self.pending_requests: list[ProposalRequest] = []

    def _event(self, sender, type, msg, actions):
        self.log.append((sender, "coordinator", type, describe(msg)))
        self._run(actions)

    def _run(self, actions):
        queue = list(actions)
        while queue:
            a = queue.pop(0)
            self.actions.append(a)
            self.log.append(("coordinator", a.to, a.type, describe(a.message)))
            queue += self._deliver(a)

    def _deliver(self, a: Action) -> list[Action]:
        """What the receiving agent does. Returns the coordinator's follow-up actions."""
        m = a.message
        if a.to == "flow" and a.type == "proposal_request":
            self.pending_requests.append(m)
        elif a.to == "inventory" and a.type == "proposal_request":
            self.inventory_challenges = m.challenges
            qs = inventory.preflight(m.sessionId, m.round, m.baseline, H, self.inventory_confirmed, m.challenges)
            self.inventory_asked.update({q.id: q.targetId for q in qs})
            if qs:
                self.log.append(("inventory", "coordinator", "question", "; ".join(describe(q) for q in qs)))
                return self.round.on_questions(qs)
        elif a.to == "inventory" and a.type == "answer":
            self.inventory_confirmed[self.inventory_asked[m.questionId]] = m.choice
        elif a.to == "inventory" and a.type in ("proposal", "revision"):
            verdict, q = inventory.check(
                m.sessionId, m.round, m.policyId, m.testResult, H, self.inventory_confirmed, self.inventory_challenges
            )
            out = []
            if q:  # Inventory sends the Question before its Verdict
                self.inventory_asked[q.id] = q.targetId
                self.log.append(("inventory", "coordinator", "question", describe(q)))
                out += self.round.on_questions([q])
            self.log.append(("inventory", "coordinator", "verdict", describe(verdict)))
            return out + self.round.on_verdict(verdict)
        elif a.to == "clinical_workflow" and a.type in ("proposal", "revision"):
            verdict = clinical.check(m.sessionId, m.round, m.policyId, m.testResult, H)
            self.log.append(("clinical_workflow", "coordinator", "verdict", describe(verdict)))
            return self.round.on_verdict(verdict)
        return []

    # scripted events
    def start(self):
        detail = f"start_round run_baseline, patient zero mri_2, challenges {self.challenges or 'none'}"
        self._event("watcher", "start", RoundState(sessionId="demo", round=0, state="idle", detail=detail),
                    self.round.start("run_baseline", "mri_2", result(self.baseline), seed=1337, challenges=self.challenges))

    def propose(self, p: Proposal):
        self._event("flow", "proposal", p, self.round.on_proposal(p))

    def revise(self, r: Revision):
        self._event("flow", "revision", r, self.round.on_revision(r))

    def answer(self, a: Answer):
        self._event("humans", "answer", a, self.round.on_answer(a))

    def transcript(self) -> str:
        return "\n".join(f"{i:>2}. {f:>17} → {t:<17} {ty:<16} {s}" for i, (f, t, ty, s) in enumerate(self.log, 1))


def scenario_ab() -> Sim:
    sim = Sim()
    sim.start()
    sim.propose(proposal(1, "pol_a", POLICY_A, result("a_max_containment")))
    req = sim.pending_requests[-1]
    sim.revise(Revision(sessionId="demo", round=req.round, policyId="pol_a", diff=flow.diff(POLICY_A, POLICY_B), testResult=result("b_revision")))
    return sim


def actions_json(sim: Sim) -> list[str]:
    return [json.dumps({"to": a.to, "type": a.type, "message": json.loads(a.message.json())}, sort_keys=True) for a in sim.actions]


def by_type(sim, type):
    return [a for a in sim.actions if a.type == type]


# --- unit checks ---


CHALLENGE = ["unknown_device_imaging"]


def test_hospital_index():
    assert H.room_type("mri_2") == "imaging" and H.zone("srv_pacs") == "it_core"
    # fl_unknown_7_smb is inactive until the unknown_device_imaging challenge.
    assert H.flows_by_device["dev_unknown_7"] == ()
    assert [f["id"] for f in H.all_flows_by_device["dev_unknown_7"]] == ["fl_unknown_7_smb"]
    assert H.touched(result("b_revision")) == {"ws_img_1", "mri_2"}


def test_flagged_devices():
    assert inventory.flagged_devices(H, {}) == set()  # dormant without its challenge
    assert inventory.flagged_devices(H, {}, CHALLENGE) == {"dev_unknown_7"}
    assert inventory.flagged_devices(H, {"dev_unknown_7": "workstation"}, CHALLENGE) == set()
    assert inventory.flagged_devices(H, {}, ["vendor_link_mri3"]) == set()  # another challenge


def test_preflight_asks_about_unknown_device_on_the_infection_path():
    assert inventory.preflight("demo", 1, result("baseline"), H, {}) == []
    (q,) = inventory.preflight("demo", 1, result("baseline_challenge"), H, {}, CHALLENGE)
    assert q.id == "q-r1-dev_unknown_7" and q.targetId == "dev_unknown_7"
    assert "unknown" not in q.choices and len(q.choices) == 12
    assert q.allowedRoles == ["clinical_engineering", "security"] and q.text == "[question]"
    # Its neighbor ws_img_1 is infected; the only flow between them is the challenge's.
    assert inventory.preflight("demo", 1, result("baseline"), H, {}, CHALLENGE) == [q]
    assert inventory.preflight("demo", 1, result("baseline_challenge"), H, {"dev_unknown_7": "workstation"}, CHALLENGE) == []
    # Contained (only MRI 2 infected): dev_unknown_7 is not on the infection path.
    assert inventory.preflight("demo", 1, result("b_revision"), H, {}, CHALLENGE) == []


def test_clinical_exempts_services_patient_zero_takes_down():
    # svc_mri depends on mri_2 (patient zero) and is down all run in every result.
    assert clinical.unavoidable_services(result("b_revision"), H) == {"svc_mri"}
    v = clinical.check("demo", 1, "baseline", result("baseline"), H)
    assert v.decision == "reject" and v.constraint.kind == "keep_service"
    assert v.constraint.targetIds == ["svc_ehr", "svc_er", "svc_reading"]  # critical only, not svc_mri


def flow_id(frm, to):
    return next(fid for fid, f in H.flows.items() if (f["from"], f["to"]) == (frm, to))


def test_required_roles():
    assert required_roles(result("b_revision"), H) == ["security", "clinical_engineering"]
    er_cut = result("b_revision").copy(update={"removedFlows": [flow_id("ws_er_1", "srv_file")]})  # ER + server room
    assert required_roles(er_cut, H) == ["security", "clinical_engineering", "operations"]  # the ER shared drive is protected
    admin_cut = result("b_revision").copy(update={"removedFlows": [flow_id("ws_admin_1", "srv_dc")]})  # admin + server room
    assert required_roles(admin_cut, H) == ["security"]
    pacs_cut = result("b_revision").copy(update={"removedFlows": [flow_id("ws_rad_1", "srv_pacs")]})  # protected flow
    assert required_roles(pacs_cut, H) == ["security", "clinical_engineering"]


def test_violates():
    a, b = result("a_max_containment"), result("b_revision")
    keep = [Constraint(kind="keep_flow", targetIds=["fl_2"])]
    assert flow.violates(a, keep, H) and not flow.violates(b, keep, H)
    assert flow.violates(result("c_unknown_cut"), [Constraint(kind="confirm_device", targetIds=["dev_unknown_7"])], H)
    assert flow.violates(result("baseline"), [Constraint(kind="keep_service", targetIds=["svc_reading"])], H)
    assert not flow.violates(b, [Constraint(kind="keep_service", targetIds=["svc_mri"])], H)  # patient zero's own
    cap = [Constraint(kind="max_rules", targetIds=[], limit=3)]
    assert flow.violates(b, cap, H, rule_count=4) and not flow.violates(b, cap, H, rule_count=3)
    assert flow.violates(b, cap, H)  # no rule count: can't show it complies


def test_diff_round_trips():
    d = flow.diff(POLICY_A, POLICY_B)
    assert [r.id for r in d.added] == ["r3", "r4"] and d.removed == []
    assert flow.apply_diff(POLICY_A.rules, d) == POLICY_B.rules
    changed = Policy.parse_obj({**POLICY_A.dict(), "rules": [BASE_RULES[0], {**BASE_RULES[1], "plain": "Changed."}]})
    d2 = flow.diff(POLICY_A, changed)
    assert d2.removed == ["r2"] and [r.plain for r in d2.added] == ["Changed."]
    assert flow.apply_diff(POLICY_A.rules, d2) == changed.rules


# --- scenarios ---


def test_a_round_1_clinical_rejects_broken_protected_flow():
    sim = Sim()
    sim.start()
    sim.propose(proposal(1, "pol_a", POLICY_A, result("a_max_containment")))
    rejection = next(e for e in sim.log if e[0] == "clinical_workflow")
    assert "REJECT pol_a" in rejection[3]
    v = clinical.check("demo", 1, "pol_a", result("a_max_containment"), H)
    assert v.constraint == Constraint(kind="keep_flow", targetIds=["fl_1", "fl_2", "fl_3", "fl_4"])
    (req,) = [a.message for a in by_type(sim, "proposal_request") if a.to == "flow" and a.message.round == 2]
    assert req.revise == "pol_a" and req.constraints == [v.constraint]
    assert sim.round.state == "running" and sim.round.round == 2


def test_ab_without_the_challenge_asks_no_questions():
    sim = scenario_ab()
    assert not by_type(sim, "question") and sim.round.open_questions == {}
    assert "waiting_for_human" not in [a.message.state for a in by_type(sim, "round_state")]


def test_b_round_2_revision_accepted_by_both():
    sim = scenario_ab()
    (rec,) = [a.message for a in by_type(sim, "recommendation")]
    assert rec.requiredRoles == ["security", "clinical_engineering"]
    assert [(v.agent, v.decision, v.round) for v in rec.verdicts] == [("inventory", "accept", 2), ("clinical_workflow", "accept", 2)]
    assert rec.policy == POLICY_B and rec.testResult.removedFlows == ["fl_8"]
    assert rec.explanation == "[explanation]" and all(v.reason == "[reason]" for v in rec.verdicts)
    assert sim.round.state == "done" and sim.actions[-1].message.state == "done"


def test_c_challenge_question_pauses_the_round_until_answered():
    """With the challenge, the unidentified device is on the infection path: the round
    pauses as soon as Inventory's preflight question is open, and resumes on the answer."""
    sim = Sim(challenges=CHALLENGE, baseline="baseline_challenge")
    sim.start()
    (q,) = [a.message for a in by_type(sim, "question")]
    assert q.targetId == "dev_unknown_7" and q.id == "q-r1-dev_unknown_7"
    assert sim.round.state == "waiting_for_human"
    assert sim.actions[-1].message == RoundState(sessionId="demo", round=1, state="waiting_for_human")

    # Flow's proposal arrives while the round waits: it is held, not judged.
    sim.propose(proposal(1, "pol_c", POLICY_B, result("c_unknown_cut")))
    assert not by_type(sim, "verdict") and [a.to for a in by_type(sim, "proposal")] == []
    assert sim.round.state == "waiting_for_human"

    sim.answer(Answer(sessionId="demo", questionId=q.id, author="Dev", role="clinical_engineering", choice="workstation"))
    assert sim.round.confirmed == {"dev_unknown_7": "workstation"}
    after = sim.actions[[a.type for a in sim.actions].index("answer"):]
    assert after[1].message.state == "running"  # resumed
    assert [a.to for a in after if a.type == "proposal"] == ["inventory", "clinical_workflow"]
    (rec,) = [a.message for a in by_type(sim, "recommendation")]
    assert rec.testResult.removedFlows == ["fl_8", "fl_unknown_7_smb"]  # touches the device, now named
    assert [v.decision for v in rec.verdicts] == ["accept", "accept"]
    assert sim.round.state == "done"


def test_c2_challenge_question_mid_round_pauses_then_rejudges():
    """The device is off the infection path, so no preflight question; the candidate cuts
    its flow, Inventory asks while rejecting, and the round pauses before the verdicts land."""
    sim = Sim(challenges=CHALLENGE, baseline="b_revision")
    sim.start()
    assert not by_type(sim, "question") and sim.round.state == "running"
    sim.propose(proposal(1, "pol_c", POLICY_B, result("c_unknown_cut")))
    (q,) = [a.message for a in by_type(sim, "question")]
    assert q.targetId == "dev_unknown_7" and sim.round.state == "waiting_for_human"
    assert sim.round.constraints == []  # the rejection arrived while paused and was dropped
    assert not by_type(sim, "recommendation")

    sim.answer(Answer(sessionId="demo", questionId=q.id, author="Ana", role="security", choice="workstation"))
    proposals = [a.to for a in by_type(sim, "proposal")]
    assert proposals == ["inventory", "clinical_workflow"] * 2  # judged again after the answer
    (rec,) = [a.message for a in by_type(sim, "recommendation")]
    assert [v.decision for v in rec.verdicts] == ["accept", "accept"] and rec.verdicts[0].round == 1


def test_answers_are_checked():
    sim = Sim(challenges=CHALLENGE, baseline="baseline_challenge")
    sim.start()
    (q,) = sim.round.open_questions.values()
    with pytest.raises(ValueError, match="may not answer"):
        sim.round.on_answer(Answer(sessionId="demo", questionId=q.id, author="Kai", role="operations", choice="workstation"))
    with pytest.raises(ValueError, match="not a choice"):
        sim.round.on_answer(Answer(sessionId="demo", questionId=q.id, author="Dev", role="clinical_engineering", choice="unknown"))
    with pytest.raises(ValueError, match="no open question"):
        sim.round.on_answer(Answer(sessionId="demo", questionId="q-nope", author="Dev", role="security", choice="ct"))


def test_d_four_rejected_rounds_end_with_no_recommendation():
    sim = Sim()
    sim.start()
    sim.propose(proposal(1, "pol_a", POLICY_A, result("a_max_containment")))
    for _ in range(MAX_ROUNDS - 1):
        req = sim.pending_requests[-1]
        sim.revise(Revision(sessionId="demo", round=req.round, policyId="pol_a", diff=flow.diff(POLICY_A, POLICY_A), testResult=result("a_max_containment")))
    assert sim.round.state == "done" and sim.round.round == MAX_ROUNDS
    assert not by_type(sim, "recommendation") and sim.round.recommendation is None
    last = sim.actions[-1].message
    assert last == RoundState(sessionId="demo", round=4, state="done", detail="No agreement after 4 rounds. No recommendation.")
    assert [a.message.round for a in by_type(sim, "proposal_request") if a.to == "flow"] == [1, 2, 3, 4]
    # A further revision is ignored once done.
    assert sim.round.on_revision(Revision(sessionId="demo", round=5, policyId="pol_a", diff=flow.diff(POLICY_A, POLICY_A), testResult=result("a_max_containment"))) == []


def test_e_replaying_events_gives_identical_actions():
    first, second = scenario_ab(), scenario_ab()
    assert first.actions == second.actions
    assert actions_json(first) == actions_json(second)


def test_e_identical_across_hash_seeds():
    """Set iteration order changes with PYTHONHASHSEED; the actions must not."""
    code = "import json, sys; sys.path.insert(0, 'tests'); import test_logic as t; print(json.dumps(t.actions_json(t.scenario_ab())))"
    outs = []
    for seed in ("1", "2", "3"):
        env = {**os.environ, "PYTHONHASHSEED": seed}
        p = subprocess.run([sys.executable, "-c", code], cwd=Path(__file__).parent.parent, env=env, capture_output=True, text=True, check=True)
        outs.append(p.stdout)
    assert outs[0] == outs[1] == outs[2]
    assert json.loads(outs[0]) == actions_json(scenario_ab())


def test_f_rank_drops_violating_candidates():
    a = (POLICY_A, result("a_max_containment"))
    b = (POLICY_B, result("b_revision"))
    loose = (Policy.parse_obj({**POLICY_A.dict(), "name": "Loose"}), result("f_loose"))
    keep = [Constraint(kind="keep_flow", targetIds=["fl_1", "fl_2", "fl_3", "fl_4"])]
    assert flow.rank([loose, a, b], keep, H) == [b, loose]  # a dropped; fewer infected first
    # With no constraints a is ranked; ties on infected and ok go to fewer rules (a has 2, b has 4).
    assert flow.rank([b, loose, a], [], H) == [a, b, loose]
    # Then name.
    a2 = (Policy.parse_obj({**POLICY_A.dict(), "name": "A first"}), result("a_max_containment"))
    assert flow.rank([a, a2], [], H) == [a2, a]


def test_g_transcript_a_to_b(capsys):
    sim = scenario_ab()
    with capsys.disabled():
        print("\n\nScenario a→b: action log\n" + sim.transcript() + "\n")
    assert sim.round.state == "done"
