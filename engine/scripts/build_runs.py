"""Generate a curated grid of deterministic CUH runs for the offline UI.

Writes one ReplayResult JSON per run into apps/web/public/propagation-runs/ plus an
index.json. Each run is the deterministic output of the frozen engine (the same
bytes a `hippo-backtest freeze` bundle's result holds); the UI renders them with no
server. Re-run this whenever the rules or the example inputs change.

    uv run python scripts/build_runs.py
"""

from __future__ import annotations

import json
from pathlib import Path

from sim_core import RULES_VERSION
from sim_core.adapters import load_cuh
from sim_core.generator import generate_trial
from sim_core.replay import replay
from sim_core.schema import Campaign, Plan

ROOT = Path(__file__).resolve().parents[2]
ENGINE = Path(__file__).resolve().parents[1]
OUT = ROOT / "apps" / "web" / "public" / "propagation-runs"

LEVER_LABEL = {
    "segment_departments": "segmentation",
    "cut_hse_trust": "cut HSE trust",
    "tier_admin_accounts": "tier admin accounts",
    "patch_gateway": "patch gateway",
    "mfa_remote": "MFA on remote access",
    "edr_servers": "EDR on servers",
    "offline_backup": "offline backup",
}


def _stats(result) -> dict:
    final = result.services[-1].services
    return {
        "cache_key": result.cache_key,
        "encrypted_hosts": len(result.summary["encrypted_hosts"]),
        "services_down": sorted(s for s, state in final.items() if state == "down"),
        "services_on_paper": sorted(s for s, state in final.items() if state == "paper"),
        "blocked_steps": len(result.summary["blocked_steps"]),
    }


def build() -> None:
    scenario = load_cuh(ROOT / "claude_instructions/data/scenarios/cuh_hospital.json")
    campaign = Campaign.model_validate_json((ENGINE / "examples/cuh_campaign.json").read_text())
    full_plan = Plan.model_validate_json((ENGINE / "examples/cuh_plan.json").read_text())

    runs: list[tuple[str, str, str, str, Plan, object]] = []  # key,label,desc,group,plan,scenario
    runs.append(("undefended", "Undefended", "No local plan — the campaign reaches detonation.", "plan", Plan(), scenario))
    runs.append(("full-plan", "Full illustrative plan", "All seven levers together.", "plan", full_plan, scenario))
    for lever in full_plan.levers:
        runs.append((
            f"only-{lever.id}",
            f"Only: {LEVER_LABEL.get(lever.id, lever.id)}",
            f"The illustrative plan reduced to the single {LEVER_LABEL.get(lever.id, lever.id)} lever.",
            "single-lever",
            Plan(plan_id=f"only-{lever.id}", levers=[lever.model_copy(deep=True)]),
            scenario,
        ))
    for seed in (0, 1, 2):
        trial = generate_trial(scenario, Plan(), seed)
        runs.append((f"seed-{seed}", f"Seed {seed} (undefended)", f"Synthetic-interior variant (seed {seed}), no plan — sensitivity, not new validation.", "sensitivity", trial.plan, trial.scenario))

    OUT.mkdir(parents=True, exist_ok=True)
    index = {"rules_version": RULES_VERSION, "runs": []}
    for key, label, desc, group, plan, scn in runs:
        result = replay(scn, campaign, plan)
        (OUT / f"{key}.json").write_text(result.model_dump_json(), encoding="utf-8")
        index["runs"].append({"key": key, "label": label, "description": desc, "group": group, "file": f"{key}.json", **_stats(result)})
    (OUT / "index.json").write_text(json.dumps(index, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {len(runs)} runs + index.json to {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    build()
