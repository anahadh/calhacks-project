"""Scoring choices fixed outside the propagation rules.

These functions consume results, never create causal input. Published labels
already inspected during this implementation must be declared prior exposure
in a freeze manifest; implementing a comparator does not validate a hold-out.
"""

from __future__ import annotations

from datetime import datetime, timedelta

from pydantic import Field

from .engine import PRIVILEGED_TIERS, SERVER_KINDS
from .schema import Campaign, ReplayResult, Scenario, StrictModel

CUH_SERVICE_ALIASES = {
    "Radiotherapy": "Radiotherapy",
    "X-ray": "Radiology (X-ray, CT, MRI)",
    "GP bloods": "Laboratory (GP bloods)",
    "Outpatients": "Outpatients & chemotherapy",
    "Chemotherapy": "Outpatients & chemotherapy",
    "Surgery": "Theatres & surgery",
    "Emergency department": "Emergency department",
}
PRESS_OUTCOME_PREFIXES = {
    "cancelled": {"down"},
    "do not attend": {"down"},
    "not processed": {"down"},
    "going ahead": {"paper", "up"},
    "open with delays": {"paper"},
}


def compare_cuh_press(result: ReplayResult, rows: list[dict[str, str]]) -> list[dict[str, object]]:
    comparisons = []
    final = result.services[-1].services
    for row in rows:
        site, press_service, outcome = row["site"], row["service"], row["outcome_reported"]
        if site != "Cork University Hospital":
            comparisons.append({"site": site, "service": press_service, "status": "out_of_scope", "reason": "this scenario does not represent that hospital"})
            continue
        service = CUH_SERVICE_ALIASES.get(press_service)
        acceptable = next((values for prefix, values in PRESS_OUTCOME_PREFIXES.items() if outcome.casefold().startswith(prefix)), None)
        actual = final.get(service)
        supported = service is not None and acceptable is not None and actual is not None
        comparisons.append({"site": site, "service": press_service, "modeled_service": service, "reported": outcome, "predicted": actual, "acceptable": sorted(acceptable) if acceptable else [], "status": "match" if supported and actual in acceptable else "mismatch" if supported else "unsupported"})
    return comparisons


def compare_library(scenario: Scenario, result: ReplayResult) -> dict[str, object]:
    servers = [n.id for n in scenario.nodes if n.encryptable and n.kind in SERVER_KINDS]
    workstations = [n.id for n in scenario.nodes if n.encryptable and n.kind in {"ws", "cow", "console"}]
    encrypted_servers = [h for h in servers if result.levels[h] == "encrypted"]
    final = result.services[-1].services
    return {
        "servers": {"encrypted": len(encrypted_servers), "eligible": len(servers), "majority": len(encrypted_servers) > len(servers) / 2 if servers else None},
        "workstations": {"encrypted": sum(result.levels[h] == "encrypted" for h in workstations), "eligible": len(workstations), "none_encrypted": all(result.levels[h] != "encrypted" for h in workstations) if workstations else None},
        "services": {name: {"predicted": final.get(name), "expected": expected, "matches": final[name] == expected if name in final else None} for name, expected in {"Finance and payroll": "up", "Email": "up", "Catalogue and reading rooms": "down"}.items()},
        "interpretation": "Conditional on the explicitly reconstructed inventory and credentials; absent cohorts are unsupported, not passing negatives.",
    }


class CalibrationExpectations(StrictModel):
    encrypted_orgs: list[str]
    survivor_orgs: list[str]
    spread_order_by_day: dict[str, list[str]]
    privileged_accounts_min: int = Field(ge=0)
    privileged_deadline: str
    # This is an organization classification, not a claim that no host encrypted.
    org_encryption_threshold: float = Field(default=0.5, ge=0, le=1)


def compare_calibration(scenario: Scenario, campaign: Campaign, result: ReplayResult, expected: CalibrationExpectations) -> dict[str, object]:
    targeted = set(result.summary["targeted_orgs"])
    orgs = result.summary["orgs"]
    outcomes = {}
    for org, should_encrypt in [(org, True) for org in expected.encrypted_orgs] + [(org, False) for org in expected.survivor_orgs]:
        value = orgs.get(org)
        share = value["encrypted_share"] if value else None
        outcomes[org] = {"status": "unsupported" if org not in targeted or share is None else "match" if (share > expected.org_encryption_threshold) == should_encrypt else "mismatch", "encrypted_share": share, "targeted": org in targeted}
    node_org = {n.id: n.org for n in scenario.nodes}
    first_control = {}
    for entry in result.trace:
        if entry.rule == "R4" and entry.status == "applied" and entry.to_level == "controlled":
            first_control.setdefault(node_org[entry.node], entry.t[:10])
    daily = {day: sorted(org for org, actual_day in first_control.items() if actual_day == day) for day in expected.spread_order_by_day}
    actual_privileged = set(campaign.initial_creds)
    deadline = datetime.fromisoformat(expected.privileged_deadline)
    day_deadline = "T" not in expected.privileged_deadline
    if day_deadline:
        deadline += timedelta(days=1)
    for effect in result.event_effects:
        when = datetime.fromisoformat(effect.t.split("/")[0])
        if (when < deadline if day_deadline else when <= deadline):
            actual_privileged.update(effect.creds_added)
    privileged_ids = {a.id for a in scenario.accounts if a.tier in PRIVILEGED_TIERS}
    held_count = len(actual_privileged & privileged_ids)
    return {
        "org_outcomes": outcomes,
        "spread_order": {day: {"expected": sorted(orgs), "actual": daily[day], "matches": sorted(orgs) == daily[day]} for day, orgs in expected.spread_order_by_day.items()},
        "unexpected_spread": {org: day for org, day in first_control.items() if org not in expected.spread_order_by_day.get(day, [])},
        "privileged_accounts_by_deadline": {"count": held_count, "required_min": expected.privileged_accounts_min, "status": "insufficient_inventory" if len(privileged_ids) < expected.privileged_accounts_min else "match" if held_count >= expected.privileged_accounts_min else "mismatch"},
        "interpretation": "Calibration and counterfactual falsification; organization outcomes are conditional on authored targeting. This is not statistical validation.",
    }
