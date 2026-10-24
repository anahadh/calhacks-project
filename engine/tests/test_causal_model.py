"""Mechanism tests on invented networks, independent of incident hold-outs."""

import pytest

from sim_core.engine import Engine
from sim_core.replay import schedule
from sim_core.schema import (
    Account,
    Campaign,
    Dependency,
    Domain,
    Event,
    HostProfile,
    Level,
    Lever,
    Link,
    Node,
    Plan,
    Scenario,
    Service,
    Trust,
)


T = "2021-05-13T12:00:00"


def host(node_id, *, domain="A", dept="dc", org=None, **kwargs):
    return Node(
        id=node_id,
        dept=dept,
        org=org or f"org-{domain.lower()}",
        domain=domain,
        kind="srv",
        host=HostProfile(os_family="windows", domain_joined=True),
        **kwargs,
    )


def network(nodes, *, links=(), accounts=(), trusts=(), services=(), levers=()):
    return Scenario(
        scenario_id="invented-causal-test",
        snapshot_date="2021-05-13",
        nodes=nodes,
        links=list(links),
        domains=[Domain(id=domain) for domain in sorted({n.domain for n in nodes if n.domain})],
        accounts=list(accounts),
        trusts=list(trusts),
        services=list(services),
        levers=list(levers),
    )


@pytest.mark.parametrize("reachable,authorized", [(False, True), (True, False), (True, True)])
def test_lateral_requires_both_network_path_and_existing_identity_right(reachable, authorized):
    account = Account(id="operator", domain="A", tier="administrator", admin_to=["target"] if authorized else [])
    scenario = network(
        [host("source"), host("target")],
        links=[Link(a="source", b="target")] if reachable else [],
        accounts=[account],
    )
    engine = Engine(scenario)
    engine.states["source"].level = Level.controlled
    engine.creds.add(account.id)
    engine.privileges.add(account.id)

    assert engine.lateral("target", T) is (reachable and authorized)
    assert (engine.states["target"].level == Level.controlled) is (reachable and authorized)


def test_executing_foothold_can_use_harvested_rights_without_controlled_source_deadlock():
    account = Account(id="operator", domain="A", tier="administrator", admin_to=["target"], sessions_on=["source"])
    scenario = network(
        [host("source", mail_client=True), host("target")],
        links=[Link(a="source", b="target")],
        accounts=[account],
    )
    engine = Engine(scenario)

    assert engine.initial_access("source", "phishing", T)
    assert engine.states["source"].level == Level.footholded
    assert engine.harvest("source", T)
    assert engine.adopt_credentials(T)
    assert engine.states["source"].level == Level.cred_holder
    assert engine.lateral("target", T)
    assert engine.states["target"].level == Level.controlled


def test_same_tier_credentials_with_distinct_grants_remain_usable():
    accounts = [
        Account(id="first", domain="A", tier="administrator", admin_to=["left"], sessions_on=["source"]),
        Account(id="second", domain="A", tier="administrator", admin_to=["right"], sessions_on=["right-source"]),
    ]
    scenario = network(
        [host("source"), host("right-source"), host("left"), host("right")],
        links=[Link(a="source", b=node) for node in ["right-source", "left", "right"]],
        accounts=accounts,
    )
    engine = Engine(scenario)
    engine.states["source"].level = Level.footholded
    engine.states["right-source"].level = Level.footholded

    engine.harvest("source", T)
    engine.adopt_credentials(T)
    assert engine.lateral("left", T)
    engine.harvest("right-source", T)
    assert engine.adopt_credentials(T)
    assert {"first", "second"} <= engine.privileges
    assert engine.lateral("right", T)


def test_directed_trust_hop_unlocks_existing_rights_without_minting_credentials():
    account = Account(id="a-admin", domain="A", tier="domain_admin", admin_to=["*@B"])
    scenario = network(
        [host("source"), host("target", domain="B")],
        links=[Link(a="source", b="target")],
        accounts=[account],
        trusts=[Trust(a="A", b="B", direction="a_to_b")],
    )
    engine = Engine(scenario)
    engine.states["source"].level = Level.controlled
    engine.domains_held.add("A")

    assert not engine.trust_hop("A", "B", T)
    assert engine.creds == set()
    assert engine.privileges == set()
    engine.creds.add(account.id)
    engine.privileges.add(account.id)
    assert engine.trust_hop("A", "B", T)
    assert engine.creds == {account.id}
    assert engine.privileges == {account.id}
    assert "B" in engine.domains_held
    assert engine.lateral("target", T)


def test_cross_domain_wildcard_cannot_substitute_for_missing_trust():
    account = Account(id="a-admin", domain="A", tier="domain_admin", admin_to=["*@B"])
    scenario = network(
        [host("source"), host("target", domain="B")],
        links=[Link(a="source", b="target")],
        accounts=[account],
    )
    engine = Engine(scenario)
    engine.states["source"].level = Level.controlled
    engine.creds.add(account.id)
    engine.privileges.add(account.id)
    engine.domains_held.add("A")

    assert not engine.trust_hop("A", "B", T)
    assert not engine.lateral("target", T)


def test_windows_medical_device_never_encrypts_but_loses_encrypted_dependency():
    scenario = network(
        [host("server"), host("scanner", medical_device=True, requires=[Dependency(provider="server", port_class="imaging")])],
        links=[Link(a="scanner", b="server")],
    )
    engine = Engine(scenario)
    engine.states["server"].level = Level.controlled
    engine.states["scanner"].level = Level.controlled

    assert engine.detonate(T)
    assert engine.states["server"].level == Level.encrypted
    assert engine.states["scanner"].level == Level.controlled
    assert engine.rollup(T).devices["scanner"] == "dependency_outage"


def test_control_alone_does_not_degrade_service_and_encryption_uses_paper_fallback():
    scenario = network(
        [host("server")],
        services=[Service(name="Scheduling", requires_all=["server"], paper_fallback=True)],
    )
    engine = Engine(scenario)
    engine.states["server"].level = Level.controlled
    assert engine.rollup(T).services["Scheduling"] == "up"

    engine.detonate(T)
    assert engine.rollup(T).services["Scheduling"] == "paper"


def test_evict_resets_org_and_invalidates_its_copied_credentials_only():
    accounts = [
        Account(id="a-admin", domain="A", tier="domain_admin", admin_to=["*"]),
        Account(id="b-admin", domain="B", tier="domain_admin", admin_to=["*"]),
    ]
    scenario = network(
        [host("a-host"), host("b-host", domain="B")],
        links=[Link(a="a-host", b="b-host")],
        accounts=accounts,
    )
    engine = Engine(scenario)
    for state in engine.states.values():
        state.level = Level.controlled
    engine.creds.update(a.id for a in accounts)
    engine.privileges.update(a.id for a in accounts)
    engine.domains_held.update(["A", "B"])

    assert engine.evict("org-a", T)
    assert engine.states["a-host"].level == Level.clean
    assert engine.states["a-host"].evicted
    assert engine.states["b-host"].level == Level.controlled
    assert engine.creds == {"b-admin"}
    assert engine.privileges == {"b-admin"}
    assert not engine.lateral("a-host", T)


def test_segmentation_can_break_care_before_attack_and_typed_allow_restores_it():
    scenario = network(
        [
            host("consumer", dept="ward", requires=[Dependency(provider="provider", port_class="imaging")]),
            host("provider", dept="dc"),
        ],
        links=[Link(a="consumer", b="provider")],
        services=[Service(name="Imaging", requires_all=["provider"], consumers=["consumer"])],
        levers=["segment_departments"],
    )
    zones = {"clinical": ["ward"], "servers": ["dc"]}
    closed = Plan(plan_id="closed", levers=[Lever(id="segment_departments", zones=zones)])
    allowed = Plan(
        plan_id="clinical-flow-kept",
        levers=[Lever(id="segment_departments", zones=zones, allow=[("clinical", "servers", "imaging")])],
    )

    assert Engine(scenario).rollup(T).services["Imaging"] == "up"
    defended = Engine(scenario, closed)
    assert all(state.level == Level.clean for state in defended.states.values())
    assert defended.rollup(T).services["Imaging"] == "down"
    assert Engine(scenario, allowed).rollup(T).services["Imaging"] == "up"


def test_adaptive_attacker_uses_network_pivot_even_without_cached_credentials_there():
    account = Account(id="operator", domain="A", tier="administrator", admin_to=["jump", "goal"])
    scenario = network(
        [host("source", dept="entry"), host("jump", dept="support"), host("goal", dept="critical")],
        links=[Link(a="source", b="jump"), Link(a="jump", b="goal")],
        accounts=[account],
        services=[Service(name="Critical application", requires_all=["goal"])],
        levers=["segment_departments"],
    )
    plan = Plan(
        plan_id="pivot-route",
        levers=[Lever(
            id="segment_departments",
            zones={"entry": ["entry"], "support": ["support"], "critical": ["critical"]},
            allow=[("entry", "support", "admin"), ("support", "critical", "admin")],
        )],
    )
    engine = Engine(scenario, plan)
    engine.states["source"].level = Level.footholded
    engine.creds.add(account.id)
    engine.privileges.add(account.id)

    assert not engine.topology.reach("source", "goal", "admin")
    assert engine.topology.reach("source", "jump", "admin")
    assert engine.next_target() == "jump"
    assert engine.tick(T)
    assert engine.states["jump"].level == Level.controlled
    assert engine.next_target() == "goal"
    assert engine.tick(T)
    assert engine.states["goal"].level == Level.controlled


def test_dependency_failure_fixed_point_handles_transitive_chains_and_clean_cycles():
    scenario = network(
        [
            host("server"),
            host("middleware", requires=[Dependency(provider="server", port_class="app")]),
            host("terminal", requires=[Dependency(provider="middleware", port_class="app")]),
            host("cycle-left", requires=[Dependency(provider="cycle-right", port_class="app")]),
            host("cycle-right", requires=[Dependency(provider="cycle-left", port_class="app")]),
        ],
        links=[
            Link(a="server", b="middleware"),
            Link(a="middleware", b="terminal"),
            Link(a="cycle-left", b="cycle-right"),
        ],
        services=[
            Service(name="Transitive care", requires_all=["terminal"]),
            Service(name="Healthy cycle", requires_all=["cycle-left"]),
        ],
    )
    engine = Engine(scenario)
    engine.states["server"].level = Level.controlled
    assert engine.rollup(T).services == {"Transitive care": "up", "Healthy cycle": "up"}

    engine.detonate(T)
    frame = engine.rollup(T)
    assert frame.services == {"Transitive care": "down", "Healthy cycle": "up"}
    assert "encrypted:server" in frame.causes["Transitive care"]


def test_date_only_dormancy_end_covers_the_entire_final_day():
    campaign = Campaign(
        campaign_id="dormancy-boundary",
        events=[
            Event(t="2021-04-01/2021-05-06", order=0, rule="idle"),
            Event(t="2021-05-06T15:00:00", order=0, rule="tick"),
        ],
    )

    with pytest.raises(ValueError, match="dormancy"):
        schedule(campaign)


def test_disconnect_requires_network_edge_not_a_dependency_edge_with_same_endpoints():
    scenario = network([
        host("consumer", requires=[Dependency(provider="provider", port_class="app")]),
        host("provider"),
    ])
    engine = Engine(scenario)

    with pytest.raises(ValueError, match="network link"):
        engine.disconnect([("consumer", "provider")], T)

