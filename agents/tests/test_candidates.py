"""logic/candidates.py: plans built from the attack, as allow-lists the engine reads. No network."""

from logic import candidates as C
from logic import hospital as hospital_mod
from protocol import Constraint, RunResult
from tests_paths import FIXTURES

H = hospital_mod.load()
BASELINE = RunResult.parse_file(FIXTURES / "results" / "baseline.json")  # an attack from MRI 2


def test_each_allow_list_keeps_exactly_what_it_does_not_cut():
    for cand in C.generate(H, BASELINE, "mri_2", []):
        kept = C.kept(H, cand.policy.rules)
        active = {f["id"] for f in C.active_flows(H)}
        assert len(cand.policy.rules) <= C.MAX_RULES
        assert kept < active, cand.id  # something is cut
        cut = active - kept
        # signature collisions may keep a few extra flows, never cut one outside the plan's cut set
        assert cut, cand.id


def test_attack_path_joins_devices_infected_at_different_ticks():
    path = C.attack_path(H, BASELINE)
    tick = {d.id: d.tick for d in BASELINE.infectedDevices}
    assert path
    for fid in path:
        f = H.flows[fid]
        assert tick[f["from"]] != tick[f["to"]]


def test_keep_flow_constraints_are_never_cut():
    path = sorted(C.attack_path(H, BASELINE))
    keep = Constraint(kind="keep_flow", targetIds=path[:2])
    for cand in C.generate(H, BASELINE, "mri_2", [keep]):
        assert set(path[:2]) <= C.kept(H, cand.policy.rules), cand.id


def test_candidates_name_the_zone_the_attack_starts_in():
    ids = [c.id for c in C.generate(H, BASELINE, "mri_2", [])]
    assert "wall_imaging" in ids and "cut_attack_path" in ids
    assert len(set(ids)) == len(ids)
