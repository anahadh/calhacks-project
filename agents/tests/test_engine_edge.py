"""The engine edge: tools.run_sim through the real hippo-sim (HIPPO_SIM_BIN, the Python
engine's CLI), against data/hospitals/demo.json, the hospital the live session uses.
Then the demo story the pure logic tells from those numbers: Clinical rejects
"Isolate imaging" on keep_flow, Flow revises to "keep scans flowing", both guardians
accept, and the Coordinator's Round publishes it.

Skipped unless HIPPO_SIM_BIN is set (in the environment or agents/.env). No agent
processes and no network: one hippo-sim subprocess per run, nothing else.
"""

import os
from pathlib import Path

import pytest

import config  # noqa: F401  (loads agents/.env, which may set HIPPO_SIM_BIN)
import tools
from logic import clinical, coordinator, flow, inventory
from logic import hospital as hospital_mod
from protocol import Candidate, Proposal, Revision, RunResult

BIN = os.environ.get("HIPPO_SIM_BIN", "").strip()
pytestmark = pytest.mark.skipif(not BIN, reason="HIPPO_SIM_BIN is not set (the engine's hippo-sim)")

DEMO = Path(__file__).resolve().parents[2] / "data" / "hospitals" / "demo.json"
FIXTURE_HOSPITAL = tools.FIXTURES / "hospital.json"
PZ, SEED, SESSION = "mri_2", 1337, "edge-test"
CANDIDATES = [Candidate.parse_file(p) for p in sorted((tools.FIXTURES / "candidates").glob("*.json"))]
BY_ID = {c.id: c for c in CANDIDATES}
IMAGING_PROTECTED = ["fl_1", "fl_2", "fl_3", "fl_4"]  # MRI and CT scans to PACS


@pytest.fixture(scope="module")
def engine():
    """run(hospital, candidate=None, ...) → RunResult, through the real CLI."""
    with pytest.MonkeyPatch.context() as mp:
        mp.setenv("HIPPO_SIM_FIXTURES", "0")
        mp.setenv("HIPPO_OPT_BIN", "")

        def run(hospital, candidate=None, challenges=(), patient_zero=PZ, seed=SEED):
            mp.setenv("HOSPITAL_PATH", str(hospital))
            return tools.run_sim(candidate, patient_zero, seed, list(challenges))

        yield run


@pytest.fixture(scope="module")
def demo(engine):
    """The baseline and each fixture candidate on the demo hospital."""
    return {"baseline": engine(DEMO), **{c.id: engine(DEMO, c) for c in CANDIDATES}}


def test_results_follow_the_engine_contract(demo):
    H = hospital_mod.load(DEMO)
    for name, r in demo.items():
        infected = {d.id: d.tick for d in r.infectedDevices}
        assert r.infectedCount == len(r.infectedDevices) == len(infected), name
        assert [d for d, t in infected.items() if t == 0] == [PZ], name  # logic.clinical's patient zero
        for s in r.servicesDown:
            assert s.id in H.services and s.ticksDown == r.ticks - s.downSinceTick + 1, (name, s.id)
        assert set(r.protectedBroken) <= set(r.removedFlows), name
        assert all(H.flows[f]["protected"] for f in r.protectedBroken), name
    assert demo["baseline"].removedFlows == demo["baseline"].protectedBroken == []
    # The engine applies the agents' policies (engine/sim_core/app_policy.py): flows kept by no rule are removed.
    assert demo["cand_isolate_imaging"].removedFlows == [*IMAGING_PROTECTED, "fl_8", "fl_9", "fl_10", "fl_61", "fl_62", "fl_63", "fl_72"]
    assert demo["cand_keep_scans"].removedFlows == ["fl_8", "fl_9", "fl_10", "fl_61", "fl_62", "fl_63", "fl_72"]
    assert demo["cand_unknown_cut"].removedFlows == []  # the demo hospital has no unidentified device


def test_seed_is_accepted_and_ignored(engine, demo):
    assert engine(DEMO, seed=1) == demo["baseline"]


def test_challenge_without_its_device_changes_nothing(engine, demo):
    keep = BY_ID["cand_keep_scans"]
    assert engine(DEMO, keep, ["unknown_device_imaging"]) == demo["cand_keep_scans"]


@pytest.mark.parametrize("patient_zero, challenges", [("no_such_device", ()), (PZ, ("vendor_link_mri3",))])
def test_engine_refusals_are_tool_errors(engine, patient_zero, challenges):
    """An unknown patient zero or an unsupported challenge: hippo-sim exits 2 with one line."""
    with pytest.raises(tools.ToolError, match=r"^hippo-sim exited 2: \S"):
        engine(DEMO, None, challenges, patient_zero=patient_zero)


@pytest.mark.parametrize("path", sorted((tools.FIXTURES / "results").glob("*.json")), ids=lambda p: p.stem)
def test_fixture_results_match_the_engine(engine, path):
    """fixtures/results/ holds what hippo-sim prints for fixtures/hospital.json
    (scripts/refresh_fixtures.py rewrites them), so fixture mode gives the engine's numbers."""
    base, _, challenges = path.stem.partition("@")
    candidate = None if base == "baseline" else BY_ID[base]
    fresh = engine(FIXTURE_HOSPITAL, candidate, challenges.split("+") if challenges else ())
    assert RunResult.parse_file(path) == fresh, f"{path.name} is stale: run scripts/refresh_fixtures.py"


def test_demo_story_reaches_a_recommendation(engine, demo):
    H = hospital_mod.load(DEMO)
    baseline = demo["baseline"]
    tested = [(c.policy, demo[c.id]) for c in CANDIDATES]

    def candidate(policy):
        return next(c for c in CANDIDATES if c.policy is policy)

    rnd = coordinator.Round(SESSION, H)
    actions = rnd.start("run_edge", PZ, baseline, SEED)
    assert [(a.to, a.type) for a in actions] == [
        ("relay", "round_state"), ("flow", "proposal_request"), ("inventory", "proposal_request")]
    assert inventory.preflight(SESSION, 1, baseline, H, rnd.confirmed) == []  # nobody to ask about

    # Round 1: Flow proposes the most containing candidate; Clinical rejects it on keep_flow.
    policy, result, violating = flow.choose(tested, [], H)
    first = candidate(policy)
    assert first.id == "cand_isolate_imaging" and not violating
    proposal = Proposal(sessionId=SESSION, round=1, policyId=first.id, testResult=result, **policy.dict())
    assert [(a.to, a.type) for a in rnd.on_proposal(proposal)] == [("inventory", "proposal"), ("clinical_workflow", "proposal")]
    inv, question = inventory.check(SESSION, 1, first.id, result, H, rnd.confirmed)
    clin = clinical.check(SESSION, 1, first.id, result, H)
    assert inv.decision == "accept" and question is None
    assert clin.decision == "reject" and clin.constraint.kind == "keep_flow"
    assert clin.constraint.targetIds == IMAGING_PROTECTED
    assert rnd.on_verdict(inv) == []
    actions = rnd.on_verdict(clin)
    assert [(a.to, a.type) for a in actions] == [("relay", "round_state"), ("flow", "proposal_request")]
    request = actions[-1].message
    assert (request.round, request.revise, request.constraints) == (2, first.id, [clin.constraint])

    # Round 2: under keep_flow, Flow revises to keep scans flowing; both guardians accept.
    policy, result, violating = flow.choose(tested, request.constraints, H)
    second = candidate(policy)
    assert second.id == "cand_keep_scans" and not violating
    changed = {k: getattr(policy, k) for k in ("strategy", "name", "rationale", "tradeoff")
               if getattr(policy, k) != getattr(first.policy, k)}
    revision = Revision(sessionId=SESSION, round=2, policyId=second.id, diff=flow.diff(first.policy, policy),
                        testResult=result, **changed)
    assert [(a.to, a.type) for a in rnd.on_revision(revision)] == [("inventory", "revision"), ("clinical_workflow", "revision")]
    inv, question = inventory.check(SESSION, 2, second.id, result, H, rnd.confirmed)
    clin = clinical.check(SESSION, 2, second.id, result, H)
    assert inv.decision == clin.decision == "accept" and question is None
    assert rnd.on_verdict(inv) == []
    assert [a.type for a in rnd.on_verdict(clin)] == ["recommendation", "round_state"] and rnd.state == "done"

    rec = rnd.recommendation
    assert rec.policy == second.policy and rec.testResult == demo["cand_keep_scans"]
    assert rec.testResult.protectedBroken == [] and rec.testResult.infectedCount == 1 < baseline.infectedCount
    assert rec.requiredRoles == ["security", "clinical_engineering"]
    # The recommendation's numbers are what a rerun of its policy gives (the solution view's rerun).
    assert engine(DEMO, Candidate(id="rerun", policy=rec.policy)) == rec.testResult
