"""Run the calibration.yaml checks and report an honest status for each.

Each check is ``passed`` / ``failed`` / ``exploratory`` / ``unsupported`` /
``not_run``. The national HSE and British Library inputs are raw, non-canonical
snapshots, so the checks that depend on them (1, 2, 5, and the >=33 privileged
account count) are reported ``unsupported`` with the concrete ``audit_raw_snapshot``
gaps — they are never fitted to pass. The CUH checks (3, 4, 6) run against the
supplied exploratory reconstruction and are labelled ``exploratory`` because their
outcomes were inspected during implementation, not held out. Service names are
resolved only through the fixed ``protocols`` aliases or an exact scenario match;
an unresolved calibration label is reported, never guessed. Robustness serializes
every seed, the config, the disclosed assumptions, the shares and the trial keys.
"""

from __future__ import annotations

import csv
from pathlib import Path
from typing import Iterable

from .adapters import audit_raw_snapshot, load_cuh
from .protocols import CUH_SERVICE_ALIASES, compare_cuh_press
from .replay import replay
from .research import ExpectedService, robustness
from .schema import Campaign, Plan, Scenario

REPO_ROOT = Path(__file__).resolve().parents[2]
ENGINE_ROOT = Path(__file__).resolve().parents[1]
DATA = REPO_ROOT / "claude_instructions" / "data"

# These service states are not "up"; check 6 asserts the national cut defeats any
# local plan for radiology and email. The names are the CUH scenario's own.
CUH_RADIOLOGY = "Radiology (X-ray, CT, MRI)"
CUH_EMAIL = "Email & comms (HSE)"


def load_calibration(path: Path | str) -> dict:
    import yaml  # research extra; imported lazily so the core never needs YAML

    return yaml.safe_load(Path(path).read_text(encoding="utf-8"))


def load_csv(path: Path | str) -> list[dict]:
    with Path(path).open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def _json_safe(data: object) -> object:
    if isinstance(data, dict):
        return {str(key): _json_safe(value) for key, value in data.items()}
    if isinstance(data, (list, tuple)):
        return [_json_safe(value) for value in data]
    return data


def _resolve_service(label: str, service_names: set[str]) -> str | None:
    """Exact match, then the fixed press aliases. Never an invented mapping."""
    if label in service_names:
        return label
    alias = CUH_SERVICE_ALIASES.get(label)
    return alias if alias in service_names else None


def _unsupported_from_raw(check: str, raw_path: Path, reason: str) -> dict:
    try:
        import json

        gaps = audit_raw_snapshot(json.loads(raw_path.read_text(encoding="utf-8")))
    except OSError:
        return {"check": check, "status": "not_run", "reason": f"missing input: {raw_path}"}
    return {"check": check, "status": "unsupported", "reason": reason, "evidence_gaps": gaps, "raw_input": str(raw_path.relative_to(REPO_ROOT))}


def check_1_hse_calibration(calibration: dict) -> dict:
    result = _unsupported_from_raw(
        "check_1_hse_calibration",
        DATA / "scenarios" / "hse_national_orgs.json",
        "The national HSE file is an org-level aggregate, not a canonical host scenario; "
        "spread order, org encryption and the >=33 privileged-account count cannot be scored "
        "without a separately authored host/account reconstruction.",
    )
    expected = calibration.get("check_1_hse_calibration", {}) if calibration else {}
    result["privileged_accounts_by_13_may"] = {
        "required_min": (expected.get("privileged_accounts_by_13_may") or {}).get("min"),
        "status": "insufficient_inventory",
        "note": "No account inventory is supplied; the count is not synthesized from the calibration target.",
    }
    result["labels_present_but_unscored"] = {
        "encrypted_orgs": expected.get("encrypted_at_detonation"),
        "survivor_orgs": expected.get("not_encrypted"),
    }
    return result


def check_2_right_reasons(calibration: dict) -> dict:
    result = _unsupported_from_raw(
        "check_2_right_reasons",
        DATA / "scenarios" / "hse_national_orgs.json",
        "Defender ablations (remove D1 from A, D2 from DoH, D3 from HSE) and the two naive "
        "baselines are implemented and unit-tested, but the HSE-specific expectations can only "
        "be scored against a canonical HSE host reconstruction, which is not supplied.",
    )
    result["available_but_unscored"] = {
        "defender_ablations": "sim_core.research.ablate_defender",
        "baselines": ["encrypt_everything_reached", "sir_epidemic_on_reachability_graph"],
    }
    return result


def check_3_robustness(calibration: dict, scenario: Scenario, campaign: Campaign, *, seeds: Iterable[int]) -> dict:
    expected_majority = (calibration.get("check_3_robustness", {}) if calibration else {}).get("expected_majority", {})
    service_names = {service.name for service in scenario.services}
    expectations: list[ExpectedService] = []
    unresolved: list[str] = []
    for label, state in expected_majority.items():
        resolved = _resolve_service(label, service_names)
        if resolved is None:
            unresolved.append(label)
            continue
        expectations.append(ExpectedService(name=label, service=resolved, acceptable=[state]))
    report = robustness(scenario, campaign, Plan(), expectations, seeds=seeds)
    shares = {
        name: {
            **share,
            "expected": expected_majority[name],
            "resolved_service": next(e.service for e in expectations if e.name == name),
            "majority_holds": share["share"] > 0.5,
        }
        for name, share in report["shares"].items()
    }
    return {
        "check": "check_3_robustness",
        "status": "exploratory",
        "reason": "Sensitivity over the supplied CUH reconstruction; outcomes were inspected, so this is exploratory, not held-out validation.",
        "seeds": report["seeds"],
        "config": report["config"],
        "assumptions": report["assumptions"],
        "shares": shares,
        "unresolved_calibration_labels": unresolved,
        "medical_devices_encrypted": report["medical_devices_encrypted"],
        "trial_keys": report["trial_keys"],
    }


def check_4_cuh_press(scenario: Scenario, campaign: Campaign, press_rows: list[dict]) -> dict:
    result = replay(scenario, campaign, Plan())
    comparisons = compare_cuh_press(result, press_rows)
    scored = [c for c in comparisons if c["status"] in {"match", "mismatch"}]
    return {
        "check": "check_4_cuh_press_holdout",
        "status": "exploratory",
        "reason": "The CUH press outcomes were inspected during implementation; this is an exploratory comparison, not a committed hold-out.",
        "cache_key": result.cache_key,
        "matches": sum(c["status"] == "match" for c in scored),
        "scored": len(scored),
        "comparisons": _json_safe(comparisons),
    }


def check_5_out_of_sample() -> dict:
    return _unsupported_from_raw(
        "check_5_out_of_sample",
        DATA / "scenarios" / "british_library_2023.json",
        "The British Library file lacks links, domains, sessions, account grants and an initial "
        "credential boundary; completing them from the embedded expected outcomes would leak labels. "
        "A separately authored strict reconstruction and campaign are required before this can run.",
    )


def check_6_known_limit(scenario: Scenario, campaign: Campaign, plan: Plan) -> dict:
    result = replay(scenario, campaign, plan)
    final = result.services[-1].services
    radiology, email = final.get(CUH_RADIOLOGY), final.get(CUH_EMAIL)
    holds = radiology in {"down", "paper"} and email in {"down", "paper"}
    return {
        "check": "check_6_agents_plan_known_limit",
        "status": "passed" if holds else "failed",
        "reason": "Even under the illustrative local plan, the national 05:10 disconnect keeps radiology and email from being 'up'.",
        "cache_key": result.cache_key,
        "radiology": {"service": CUH_RADIOLOGY, "state": radiology},
        "email": {"service": CUH_EMAIL, "state": email},
        "basis": "Mechanism check on the exploratory CUH reconstruction with the illustrative plan.",
    }


def run_default(*, seeds: Iterable[int] = range(100)) -> dict:
    """Wire the standard file locations and return the full per-check report."""
    calibration = load_calibration(DATA / "tests" / "calibration.yaml")
    scenario = load_cuh(DATA / "scenarios" / "cuh_hospital.json")
    campaign = Campaign.model_validate_json((ENGINE_ROOT / "examples" / "cuh_campaign.json").read_text(encoding="utf-8"))
    plan = Plan.model_validate_json((ENGINE_ROOT / "examples" / "cuh_plan.json").read_text(encoding="utf-8"))
    press_rows = load_csv(DATA / "ground_truth" / "cuh_press_outcomes.csv")
    seed_list = list(seeds)
    return {
        "meta": {
            "frozen_rules_required": bool(calibration.get("frozen_rules_required")),
            "cuh_scenario": "claude_instructions/data/scenarios/cuh_hospital.json",
            "cuh_campaign": "engine/examples/cuh_campaign.json (exploratory [S]/[I], not ground truth)",
            "seed_count": len(seed_list),
            "disclaimer": "HSE and British Library checks are unsupported until a separate causal reconstruction is supplied; they are never fitted. Additional seeds are sensitivity, not new validation data.",
        },
        "check_1_hse_calibration": check_1_hse_calibration(calibration),
        "check_2_right_reasons": check_2_right_reasons(calibration),
        "check_3_robustness": check_3_robustness(calibration, scenario, campaign, seeds=seed_list),
        "check_4_cuh_press_holdout": check_4_cuh_press(scenario, campaign, press_rows),
        "check_5_out_of_sample": check_5_out_of_sample(),
        "check_6_agents_plan_known_limit": check_6_known_limit(scenario, campaign, plan),
    }


__all__ = ["REPO_ROOT", "load_calibration", "load_csv", "run_default", "check_1_hse_calibration", "check_2_right_reasons", "check_3_robustness", "check_4_cuh_press", "check_5_out_of_sample", "check_6_known_limit"]
