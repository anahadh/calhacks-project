"""Comparator contracts on invented results; no incident labels are loaded."""

import pytest

from sim_core.protocols import (
    CalibrationExpectations,
    compare_calibration,
    compare_cuh_press,
    compare_library,
)
from sim_core.schema import (
    Account,
    Campaign,
    Domain,
    EventEffect,
    HostProfile,
    Node,
    ReplayResult,
    Scenario,
    ServiceFrame,
    TraceEntry,
)


def result_fixture(*, levels=None, services=None, trace=None, summary=None, effects=None):
    return ReplayResult(
        cache_key="invented-test-result",
        trace=trace or [],
        services=[ServiceFrame(t="2030-01-10T23:59:59", services=services or {}, devices={}, causes={})],
        levels=levels or {},
        summary=summary or {},
        event_effects=effects or [],
    )


def node_fixture(name, *, kind="srv", org="invented-org", medical=False):
    return Node(
        id=name,
        org=org,
        dept="invented-dept",
        domain="invented-domain",
        kind=kind,
        medical_device=medical,
        host=HostProfile(os_family="windows", domain_joined=True),
    )


def scenario_fixture(nodes, accounts=()):
    return Scenario(scenario_id="invented-scoring", snapshot_date="2030-01-01", nodes=nodes, accounts=list(accounts), links=[], domains=[Domain(id="invented-domain")])


def test_press_comparison_excludes_unmodeled_neighboring_hospital():
    result = result_fixture(services={"Radiology (X-ray, CT, MRI)": "up"})
    comparison = compare_cuh_press(result, [{"site": "Invented neighboring hospital", "service": "X-ray", "outcome_reported": "cancelled"}])[0]
    assert comparison["status"] == "out_of_scope"
    assert "predicted" not in comparison


def test_press_comparison_accepts_declared_aliases_and_reports_unknown_language():
    result = result_fixture(services={"Radiology (X-ray, CT, MRI)": "down", "Outpatients & chemotherapy": "paper"})
    comparisons = compare_cuh_press(result, [
        {"site": "Cork University Hospital", "service": "X-ray", "outcome_reported": "do not attend unless contacted"},
        {"site": "Cork University Hospital", "service": "Chemotherapy", "outcome_reported": "going ahead with printed lists"},
        {"site": "Cork University Hospital", "service": "X-ray", "outcome_reported": "invented ambiguous statement"},
        {"site": "Cork University Hospital", "service": "Unmodeled specialty", "outcome_reported": "cancelled"},
    ])
    assert [comparison["status"] for comparison in comparisons] == ["match", "match", "unsupported", "unsupported"]
    assert comparisons[0]["modeled_service"] == "Radiology (X-ray, CT, MRI)"
    assert comparisons[1]["acceptable"] == ["paper", "up"]
    assert comparisons[2]["acceptable"] == []


def test_empty_library_cohorts_are_unsupported_even_when_service_predictions_match():
    scenario = scenario_fixture([node_fixture("medical-server", medical=True)])
    result = result_fixture(levels={"medical-server": "clean"}, services={"Finance and payroll": "up", "Email": "up", "Catalogue and reading rooms": "down"})
    comparison = compare_library(scenario, result)
    assert comparison["servers"] == {"encrypted": 0, "eligible": 0, "majority": None}
    assert comparison["workstations"] == {"encrypted": 0, "eligible": 0, "none_encrypted": None}
    assert all(service["matches"] for service in comparison["services"].values())


@pytest.mark.parametrize("server_levels,majority", [(["encrypted", "clean"], False), (["encrypted", "encrypted", "clean"], True)])
def test_library_majority_requires_strictly_more_than_half(server_levels, majority):
    nodes = [node_fixture(f"server-{index}") for index in range(len(server_levels))] + [node_fixture("workstation", kind="ws")]
    levels = {f"server-{index}": level for index, level in enumerate(server_levels)} | {"workstation": "clean"}
    comparison = compare_library(scenario_fixture(nodes), result_fixture(levels=levels))
    assert comparison["servers"]["majority"] is majority
    assert comparison["workstations"]["none_encrypted"] is True
    assert all(service["matches"] is None for service in comparison["services"].values())


def calibration_expectations(required_min):
    return CalibrationExpectations(encrypted_orgs=["targeted-org"], survivor_orgs=["untargeted-org"], spread_order_by_day={"2030-01-10": ["targeted-org"]}, privileged_accounts_min=required_min, privileged_deadline="2030-01-10")


def calibration_result(effects=()):
    return result_fixture(
        levels={"target": "encrypted", "untargeted": "clean"},
        trace=[TraceEntry(t="2030-01-10T12:00:00", rule="R4", technique_label="invented", node="target", from_level="clean", to_level="controlled", reason="invented state transition")],
        summary={"targeted_orgs": ["targeted-org"], "orgs": {"targeted-org": {"encrypted_share": 1.0}, "untargeted-org": {"encrypted_share": 0.0}}},
        effects=list(effects),
    )


def account_fixture(name):
    return Account(id=name, domain="invented-domain", tier="administrator")


def test_calibration_reports_insufficient_account_inventory_and_excludes_untargeted_negative():
    scenario = scenario_fixture([node_fixture("target", org="targeted-org"), node_fixture("untargeted", org="untargeted-org")], [account_fixture("admin-1")])
    campaign = Campaign(campaign_id="invented-calibration", events=[], initial_creds=["admin-1"])
    comparison = compare_calibration(scenario, campaign, calibration_result(), calibration_expectations(2))
    assert comparison["privileged_accounts_by_deadline"] == {"count": 1, "required_min": 2, "status": "insufficient_inventory"}
    assert comparison["org_outcomes"]["targeted-org"]["status"] == "match"
    assert comparison["org_outcomes"]["untargeted-org"]["status"] == "unsupported"
    assert comparison["spread_order"]["2030-01-10"]["matches"] is True


def test_date_only_calibration_deadline_includes_late_credentials_and_excludes_next_day():
    scenario = scenario_fixture([node_fixture("target", org="targeted-org"), node_fixture("untargeted", org="untargeted-org")], [account_fixture(f"admin-{index}") for index in [1, 2, 3]])
    campaign = Campaign(campaign_id="invented-deadline", events=[], initial_creds=["admin-1"])
    effects = [
        EventEffect(event_index=index, t=time, rule="R2", target="target", level_changes={}, creds_added=[account], creds_removed=[], privileges_added=[], domains_added=[])
        for index, time, account in [(0, "2030-01-10T23:59:59", "admin-2"), (1, "2030-01-11T00:00:00", "admin-3")]
    ]
    comparison = compare_calibration(scenario, campaign, calibration_result(effects), calibration_expectations(2))
    assert comparison["privileged_accounts_by_deadline"] == {"count": 2, "required_min": 2, "status": "match"}
