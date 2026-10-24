"""Counterfactual tests of mechanisms, not fitted incident outcomes."""

import pytest

from sim_core.engine import Engine
from sim_core.replay import advance, compare_plan, replay
from sim_core.schema import Account, Campaign, Domain, EntryRoute, Event, HostProfile, Level, Lever, Link, Node, Plan, Scenario, Service, Trust


def invented():
    return Scenario(
        scenario_id="invented",
        snapshot_date="2021-01-01",
        nodes=[
            Node(id="gateway", dept="edge", org="local", kind="vpn", internet_exposed=True,
                 host=HostProfile(os_family="windows", patch_state={"remote_access": "unpatched_critical"}, service_classes=["remote_access"])),
            Node(id="dc", dept="dc", org="local", domain="D", kind="dc", host=HostProfile(os_family="windows", domain_joined=True)),
        ],
        links=[Link(a="gateway", b="dc")],
        domains=[Domain(id="D", dcs=["dc"])],
        accounts=[Account(id="da", domain="D", tier="domain_admin", admin_to=["*"], sessions_on=["gateway"])],
        services=[Service(name="Directory", requires_all=["dc"])],
        levers=["tier_admin_accounts", "patch_gateway", "mfa_remote", "edr_servers"],
    )


def campaign():
    return Campaign(campaign_id="invented-campaign", events=[
        Event(t="2021-01-01T12:00", order=0, rule="R1", target="gateway", mode="edge"),
        Event(t="2021-01-01T12:01", order=0, rule="tick", budget=10),
        Event(t="2021-01-02T01:00", order=0, rule="R6"),
    ])


def test_tiering_earlier_session_loss_is_attributed_by_paired_effects():
    plan = Plan(plan_id="tier", levers=[Lever(id="tier_admin_accounts")])
    comparison = compare_plan(invented(), campaign(), plan)
    assert comparison["avoided_encryption"] == ["dc"]
    assert comparison["necessary_levers_in_context"] == {"tier_admin_accounts": ["dc"]}
    restored = comparison["event_effects_restored_without_lever"]["1"]["tier_admin_accounts"]
    assert "credential:da" in restored
    assert "privilege:da" in restored
    assert all(row.event_index is not None for row in comparison["defended"].trace)


def test_mfa_does_not_claim_to_patch_unauthenticated_edge_exploitation():
    plan = Plan(levers=[Lever(id="mfa_remote")])
    engine = Engine(invented(), plan)
    assert engine.initial_access("gateway", "edge", "2021-01-01")


def test_patch_lever_cannot_fix_end_of_life_gateway():
    scenario = invented()
    scenario.nodes[0].host.end_of_life = True
    engine = Engine(scenario, Plan(levers=[Lever(id="patch_gateway")]))
    assert not engine.states["gateway"].patched
    assert engine.initial_access("gateway", "edge", "2021-01-01")


def test_majority_edr_is_a_cohort_not_a_claim_of_zero_encrypted_hosts():
    scenario = invented()
    template = scenario.nodes[1]
    scenario.nodes = [template.model_copy(update={"id": f"host-{i:02d}"}, deep=True) for i in range(10)]
    scenario.domains[0].dcs = []
    scenario.links, scenario.accounts, scenario.services = [], [], []
    engine = Engine(scenario)
    for state in engine.states.values():
        state.level = Level.controlled
    engine.protect("local", "2021-01-01", coverage=.9)
    engine.detonate("2021-01-02")
    assert sum(state.level == Level.encrypted for state in engine.states.values()) == 1
    # Protection deployed later is not restoration.
    engine.protect("local", "2021-01-03", coverage=1)
    assert sum(state.level == Level.encrypted for state in engine.states.values()) == 1


def test_shared_domain_eviction_requires_explicit_account_ownership():
    scenario = invented()
    scenario.nodes.append(scenario.nodes[1].model_copy(update={"id": "other", "org": "other"}, deep=True))
    engine = Engine(scenario)
    with pytest.raises(ValueError, match="ownership"):
        engine.evict("local", "2021-01-01")
    scenario.accounts[0].org = "other"
    engine = Engine(scenario)
    engine.creds.add("da")
    engine.privileges.add("da")
    engine.evict("local", "2021-01-01")
    assert "da" in engine.creds and "da" in engine.privileges


def test_authored_failed_trust_target_stays_in_targeted_denominator():
    scenario = invented()
    scenario.domains.append(Domain(id="foreign", external=True))
    scenario.trusts = [Trust(a="foreign", b="D")]
    replay_campaign = Campaign(campaign_id="failed-trust", events=[Event(t="2021-01-01T12:00", order=0, rule="R5", source_domain="foreign", target_domain="D")])
    result = replay(scenario, replay_campaign)
    assert result.summary["targeted_orgs"] == ["local"]
    assert result.trace[0].status == "blocked"


def test_dated_replay_runs_only_the_named_rule_without_unearned_ticks():
    replay_campaign = campaign()
    replay_campaign.events = [event for event in replay_campaign.events if event.rule != "tick"]
    result = replay(invented(), replay_campaign)
    assert result.levels["gateway"] == "footholded"
    assert result.levels["dc"] == "clean"
    assert not any(row.rule in {"R2", "R3", "R4", "R5"} for row in result.trace)


@pytest.mark.parametrize("budget,expected", [(0, False), (1, True)])
def test_alternate_external_context_activates_only_inside_detour_budget(budget, expected):
    scenario = invented()
    scenario.domains.append(Domain(id="foreign", external=True))
    scenario.nodes.append(Node(id="external", dept="outside", org="foreign", domain="foreign", kind="cloud", external=True, host=HostProfile(os_family="none")))
    scenario.links.append(Link(a="external", b="dc"))
    scenario.trusts.append(Trust(a="foreign", b="D", direction="a_to_b"))
    scenario.accounts.append(Account(id="foreign-admin", domain="foreign", tier="domain_admin", admin_to=["*@D"]))
    boundary = Campaign(campaign_id="alternate", events=[], initial_creds=["foreign-admin"], initial_privileges=["foreign-admin"], detour_budget=budget, entry_routes=[EntryRoute(id="trust-door", target="dc", mode="trust", source_domain="foreign", target_domain="D", source_foothold="external")])
    engine = Engine(scenario, campaign=boundary)
    advance(engine, "2021-01-01", 10)
    assert (engine.states["dc"].level == Level.controlled) is expected
    assert (engine.states["external"].level == Level.footholded) is expected
    assert not any(row.rule == "R2" and row.node == "external" for row in engine.trace)
    assert engine.detours_used == budget


def test_redundant_endpoint_and_mfa_levers_get_no_local_blocker_credit():
    scenario = invented()
    scenario.nodes[1].host.endpoint_protection = "edr"
    scenario.mfa_remote_access = True
    engine = Engine(scenario, Plan(levers=[Lever(id="edr_servers"), Lever(id="mfa_remote")]))
    engine.harvest("dc", "2021-01-01")
    assert all(not blocker.levers for blocker in engine.trace[-1].blockers)
    engine.initial_access("gateway", "credential", "2021-01-01")
    assert all(not blocker.levers for blocker in engine.trace[-1].blockers)
    engine.states["dc"].level = Level.controlled
    engine.detonate("2021-01-02")
    assert all(not blocker.levers for blocker in engine.trace[-1].blockers)


def test_historical_endpoint_protection_supersedes_local_plan_blocker_credit():
    engine = Engine(invented(), Plan(levers=[Lever(id="edr_servers")]))
    engine.protect("local", "2021-01-01", 1)
    engine.states["dc"].level = Level.controlled
    engine.detonate("2021-01-02")
    assert all(not blocker.levers for row in engine.trace for blocker in row.blockers)


def test_unlisted_department_cannot_collide_with_an_explicit_zone_name():
    with pytest.raises(ValueError, match="reserved"):
        Lever(id="segment_departments", zones={"unlisted:ward": ["dc"]})
