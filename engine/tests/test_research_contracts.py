"""Research protocol checks on invented inputs; no incident replay or hold-out.

The CUH check reads inventory only, to verify its declared normalization. No
ground-truth labels or incident campaign are loaded anywhere in this module.
"""

from pathlib import Path

import pytest

from sim_core.adapters import load_cuh
from sim_core.generator import GeneratorConfig, generate_trial
from sim_core.replay import replay, schedule
from sim_core.research import (
    ExpectedService,
    ablate_defender,
    assert_frozen,
    conditional_org_score,
    freeze,
    naive_baseline,
    robustness,
    run_holdout_once,
)
from sim_core.schema import (
    Account,
    Campaign,
    Dependency,
    Domain,
    Event,
    HostProfile,
    Lever,
    Link,
    Node,
    Plan,
    Scenario,
    Service,
)


def invented_node(node_id, *, kind="ws", dept="clinical", org="invented-org", domain="invented-domain", medical=False, external=False, os_family="windows", requires=()):
    return Node(
        id=node_id,
        dept=dept,
        org=org,
        domain=domain,
        kind=kind,
        host=HostProfile(os_family=os_family, os_version="inventory-version", domain_joined=os_family == "windows"),
        medical_device=medical,
        external=external,
        mail_client=kind == "ws" and not medical,
        requires=list(requires),
    )


@pytest.fixture
def interior():
    nodes = [
        invented_node("workstation-1"),
        invented_node("workstation-2"),
        invented_node("cart", kind="cow"),
        invented_node("console", kind="console"),
        invented_node("server", kind="srv", dept="servers"),
        invented_node("medical-console", kind="console", medical=True),
        invented_node("appliance", os_family="appliance"),
        invented_node("external-workstation", external=True, org="outside-org"),
        invented_node("foreign-server", kind="srv", domain="foreign-domain", org="foreign-org"),
    ]
    nodes[0].requires = [Dependency(provider="server", port_class="imaging"), Dependency(provider="server", port_class="admin")]
    return Scenario(
        scenario_id="invented-interior",
        snapshot_date="2030-01-01",
        nodes=nodes,
        links=[Link(a="workstation-1", b="server")],
        domains=[Domain(id="invented-domain"), Domain(id="foreign-domain")],
        accounts=[Account(id="invented-admin", domain="invented-domain", tier="domain_admin", admin_to=["*"], sessions_on=["workstation-1", "server"])],
        services=[Service(name="Invented imaging", requires_all=["server"], consumers=["workstation-1"])],
        levers=["segment_departments"],
    )


def segmentation_plan():
    return Plan(plan_id="invented-plan", levers=[Lever(id="segment_departments", zones={"clinical": ["clinical"], "servers": ["servers"]})])


def test_generator_is_seeded_preserves_inputs_and_declares_eligible_denominator(interior):
    plan = segmentation_plan()
    before_scenario, before_plan = interior.model_dump(), plan.model_dump()
    config = GeneratorConfig(eol_workstation_min=0.5, eol_workstation_max=0.5, extra_allow_flows=2)

    first = generate_trial(interior, plan, 17, config)
    second = generate_trial(interior, plan, 17, config)

    assert first.model_dump() == second.model_dump()
    assert interior.model_dump() == before_scenario
    assert plan.model_dump() == before_plan
    eligible_ids = {"workstation-1", "workstation-2", "cart", "console"}
    eligible = [node for node in first.scenario.nodes if node.id in eligible_ids]
    assert sum(node.host.end_of_life for node in eligible) == 2
    assert all(node.host.os_version == ("Windows 7" if node.host.end_of_life else "Windows 10") for node in eligible)
    assert "EOL denominator is 4 nonmedical Windows ws/cow/console nodes" in first.scenario.assumptions[-1].statement
    assert all(flow[2] == "imaging" for flow in first.plan.levers[0].allow)


def test_generator_preserves_medical_hardware_domain_membership_and_grants(interior):
    generated = generate_trial(interior, Plan(), 42).scenario
    source_nodes = {node.id: node for node in interior.nodes}
    for node in generated.nodes:
        source = source_nodes[node.id]
        assert (node.medical_device, node.domain, node.host.domain_joined) == (source.medical_device, source.domain, source.host.domain_joined)
        if node.id in {"medical-console", "appliance", "server", "external-workstation", "foreign-server"}:
            assert node.host == source.host
    account = generated.accounts[0]
    assert account.admin_to == interior.accounts[0].admin_to
    assert account.tier == interior.accounts[0].tier
    assert len(account.sessions_on) == 2
    assert len(set(account.sessions_on)) == 2
    assert all(source_nodes[host].org == "invented-org" and source_nodes[host].domain == account.domain for host in account.sessions_on)
    assert not next(node for node in generated.nodes if node.id == "medical-console").encryptable


def test_robustness_reports_observed_seed_denominators_without_incident_labels(interior):
    result = robustness(
        interior,
        Campaign(campaign_id="invented-no-attack", events=[]),
        Plan(),
        [ExpectedService(name="available", service="Invented imaging", acceptable=["up"])],
        seeds=[3, 8, 12],
    )
    assert result["shares"]["available"] == {"matches": 3, "total": 3, "share": 1.0}
    assert result["medical_devices_encrypted"] == 0
    assert len(result["trial_keys"]) == 3
    with pytest.raises(ValueError, match="unique seeds"):
        robustness(interior, Campaign(campaign_id="none", events=[]), Plan(), [], seeds=[3, 3])


def make_freeze(workspace, *, study="invented-study", exposure=None):
    (workspace / "generator.py").write_text("GENERATOR_VERSION = 'invented-v1'\n", encoding="utf-8")
    (workspace / "generator-config.json").write_text('{"eol_min": 0.45}\n', encoding="utf-8")
    return freeze(workspace, ["generator.py", "generator-config.json"], study_id=study, protocol="Score one declared synthetic service; no clinical labels.", prior_holdout_exposure=exposure or [])


@pytest.mark.parametrize("changed_file", ["generator.py", "generator-config.json"])
def test_freeze_detects_changed_code_or_generator_inputs(tmp_path, changed_file):
    manifest = make_freeze(tmp_path)
    assert_frozen(tmp_path, manifest)
    with (tmp_path / changed_file).open("a", encoding="utf-8") as handle:
        handle.write("changed input\n")
    with pytest.raises(ValueError, match="inputs changed"):
        assert_frozen(tmp_path, manifest)


def test_one_shot_ledger_rejects_rerun_even_after_refreezing_same_study(tmp_path):
    manifest = make_freeze(tmp_path)
    ledger = tmp_path / "ledger"
    evaluations = []

    assert run_holdout_once(tmp_path, manifest, ledger, "invented-holdout", lambda: evaluations.append("ran") or 12) == 12
    with pytest.raises(FileExistsError):
        run_holdout_once(tmp_path, manifest, ledger, "invented-holdout", lambda: evaluations.append("reran"))
    (tmp_path / "generator.py").write_text("GENERATOR_VERSION = 'invented-v2'\n", encoding="utf-8")
    new_freeze = freeze(tmp_path, manifest.files, study_id=manifest.study_id, protocol=manifest.protocol, prior_holdout_exposure=[])
    with pytest.raises(FileExistsError):
        run_holdout_once(tmp_path, new_freeze, ledger, "invented-holdout", lambda: evaluations.append("refrozen-rerun"))
    assert evaluations == ["ran"]


def test_failed_holdout_attempt_is_consumed_before_evaluation(tmp_path):
    manifest = make_freeze(tmp_path)
    ledger = tmp_path / "ledger"

    def failed_evaluation():
        raise RuntimeError("invented evaluation failed after it started")

    with pytest.raises(RuntimeError, match="evaluation failed"):
        run_holdout_once(tmp_path, manifest, ledger, "invented-holdout", failed_evaluation)
    with pytest.raises(FileExistsError):
        run_holdout_once(tmp_path, manifest, ledger, "invented-holdout", lambda: None)
    assert len(list(ledger.glob("*.attempt.json"))) == 1


def test_declared_prior_exposure_disallows_confirmatory_attempt(tmp_path):
    manifest = make_freeze(tmp_path, exposure=["invented labels inspected during design"])
    evaluations = []
    ledger = tmp_path / "ledger"
    with pytest.raises(ValueError, match="prior hold-out exposure"):
        run_holdout_once(tmp_path, manifest, ledger, "invented-holdout", lambda: evaluations.append("invalid"))
    assert evaluations == []
    assert not ledger.exists()
    assert run_holdout_once(tmp_path, manifest, ledger, "invented-exploratory-run", lambda: "exploratory", require_unseen=False) == "exploratory"


def test_org_score_conditions_on_targets_and_keeps_unknowns_in_denominator():
    result = conditional_org_score(
        predicted={"targeted-correct": True, "targeted-unknown": None, "untargeted": False},
        labels={"targeted-correct": True, "targeted-unknown": True, "untargeted": False},
        targeted_orgs=iter(["targeted-correct", "targeted-unknown", "targeted-unlabelled"]),
    )
    assert result["targeted_with_labels"] == ["targeted-correct", "targeted-unknown"]
    assert result["accuracy_over_all_labelled_targets"] == 0.5
    assert result["unknown"] == ["targeted-unknown"]
    assert result["excluded_untargeted"] == ["untargeted"]


def propagation_case():
    scenario = Scenario(
        scenario_id="invented-replay",
        snapshot_date="2030-01-01",
        nodes=[invented_node("entry"), invented_node("target", kind="srv")],
        links=[Link(a="entry", b="target")],
        domains=[Domain(id="invented-domain")],
        accounts=[Account(id="invented-admin", domain="invented-domain", tier="administrator", admin_to=["target"], sessions_on=["entry"])],
        services=[Service(name="Invented service", requires_all=["target"])],
    )
    campaign = Campaign(campaign_id="invented-replay", events=[
        Event(t="2030-01-02T09:00:00", order=0, rule="R1", target="entry", mode="phishing"),
        Event(t="2030-01-02T09:00:00", order=1, rule="R2", target="entry"),
        Event(t="2030-01-02T09:00:00", order=2, rule="R3"),
        Event(t="2030-01-02T09:00:00", order=3, rule="R4", target="target"),
        Event(t="2030-01-02T10:00:00", order=0, rule="D1", org="invented-org"),
        Event(t="2030-01-02T11:00:00", order=0, rule="R6"),
    ])
    return scenario, campaign


@pytest.mark.parametrize("kind", ["encrypt_everything_reached", "sir_epidemic_on_reachability_graph"])
def test_naive_baselines_intentionally_ignore_effective_eviction(kind):
    scenario, campaign = propagation_case()
    result = replay(scenario, campaign)
    assert any(entry.rule == "R4" and entry.status == "applied" for entry in result.trace)
    assert result.summary["encrypted_hosts"] == []
    assert "target" in naive_baseline(scenario, campaign, kind=kind)
    without_eviction = replay(scenario, ablate_defender(campaign, "invented-org", "D1"))
    assert without_eviction.summary["encrypted_hosts"] == ["target"]


def test_replay_is_deterministic_and_does_not_mutate_inputs():
    scenario, campaign = propagation_case()
    before_scenario, before_campaign = scenario.model_dump(), campaign.model_dump()
    first, second = replay(scenario, campaign), replay(scenario, campaign)
    assert first.model_dump() == second.model_dump()
    assert first.cache_key == second.cache_key
    assert scenario.model_dump() == before_scenario
    assert campaign.model_dump() == before_campaign


def test_schedule_rejects_date_only_events_mixed_with_timed_midnight():
    campaign = Campaign(campaign_id="invented-ambiguous-clock", events=[
        Event(t="2030-01-02", order=0, rule="observation"),
        Event(t="2030-01-02T00:00:00", order=1, rule="R6"),
    ])
    with pytest.raises(ValueError, match="mixed date-only/timed"):
        schedule(campaign)


def test_dormancy_observation_never_implies_free_attack_ticks():
    scenario, _ = propagation_case()
    campaign = Campaign(
        campaign_id="invented-idle",
        initial_footholds=["entry"],
        initial_creds=["invented-admin"],
        initial_privileges=["invented-admin"],
        events=[Event(t="2030-01-02/2030-02-01", order=0, rule="idle")],
    )
    result = replay(scenario, campaign)
    assert result.levels == {"entry": "footholded", "target": "clean"}
    assert result.summary["encrypted_hosts"] == []
    assert len(result.trace) == 1
    assert result.trace[0].rule == "idle" and result.trace[0].status == "observation"


def test_cuh_inventory_normalization_preserves_medical_identity_without_replay():
    path = Path(__file__).resolve().parents[2] / "claude_instructions/data/scenarios/cuh_hospital.json"
    snapshot = load_cuh(path)
    nodes = {node.id: node for node in snapshot.nodes}
    assert len(nodes) == 95 and len(snapshot.links) == 97
    assert sum(node.medical_device for node in snapshot.nodes) == 15
    assert all(not node.encryptable for node in snapshot.nodes if node.medical_device)
    assert nodes["PH-ROBOT"].kind == "srv" and nodes["PH-ROBOT"].medical_device
    assert nodes["MRI-1"].host.os_family == "windows" and not nodes["MRI-1"].encryptable
    assert nodes["DC-01"].domain == "CUH" and nodes["GW-REMOTE"].domain is None
    assert nodes["HSE / NHN"].domain == "HSE" and nodes["HSE / NHN"].external
    assert nodes["MRI-1"].requires[0].port_class == "imaging"
    assert nodes["LINAC-1"].requires[0].port_class == "oncology"
    assert next(account for account in snapshot.accounts if account.domain == "HSE").sessions_on == []
