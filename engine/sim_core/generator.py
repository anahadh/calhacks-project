"""The only random component: a disclosed synthetic-interior sensitivity model.

Generated inventory is ordinary replay input. The replay never receives an RNG.
The 45–55% range below is an experimental choice over eligible workstations,
NOT a recovered fraction of the supplied 95-node or 75-Windows-node inventory.
"""

from __future__ import annotations

from random import Random

from pydantic import Field, model_validator

from .schema import Assumption, Plan, Scenario, StrictModel

GENERATOR_VERSION = "interior-v1"
WORKSTATION_KINDS = {"ws", "cow", "console"}


class GeneratorConfig(StrictModel):
    eol_workstation_min: float = Field(default=0.45, ge=0, le=1)
    eol_workstation_max: float = Field(default=0.55, ge=0, le=1)
    extra_allow_flows: int = Field(default=0, ge=0)

    @model_validator(mode="after")
    def bounds(self) -> "GeneratorConfig":
        if self.eol_workstation_min > self.eol_workstation_max:
            raise ValueError("reversed EOL fraction range")
        return self


class GeneratedTrial(StrictModel):
    seed: int
    scenario: Scenario
    plan: Plan
    generator_version: str = GENERATOR_VERSION


def generate_trial(scenario: Scenario, plan: Plan, seed: int, config: GeneratorConfig | None = None) -> GeneratedTrial:
    config = config or GeneratorConfig()
    rng = Random(seed)
    interior, candidate = scenario.model_copy(deep=True), plan.model_copy(deep=True)
    nodes = {n.id: n for n in interior.nodes}
    workstations = sorted(n.id for n in interior.nodes if n.encryptable and n.kind in WORKSTATION_KINDS)
    fraction = rng.uniform(config.eol_workstation_min, config.eol_workstation_max)
    eol_count = min(len(workstations), int(len(workstations) * fraction + 0.5))
    eol = set(rng.sample(workstations, eol_count))
    for host in workstations:
        profile = nodes[host].host
        profile.end_of_life = host in eol
        profile.os_version = "Windows 7" if host in eol else "Windows 10"
    # Preserve number of sessions, domain ownership, rights and account tiers.
    # Existing non-domain remote sessions may move only within that account's
    # existing organization footprint; no new foreign session can be invented.
    for account in sorted(interior.accounts, key=lambda a: a.id):
        if not account.sessions_on:
            continue
        footprint = {nodes[h].org for h in account.sessions_on}
        eligible = sorted(n.id for n in interior.nodes if n.encryptable and n.org in footprint and (n.domain == account.domain or n.id in account.sessions_on))
        count = len(account.sessions_on)
        if len(eligible) < count:
            raise ValueError(f"not enough eligible distinct session hosts for {account.id}")
        account.sessions_on = sorted(rng.sample(eligible, count))
    for lever in candidate.levers:
        if lever.id != "segment_departments" or not config.extra_allow_flows:
            continue
        # Only explicitly named zones are sampled. Extra clinical flows never
        # include wildcard/admin classes; they cannot silently dissolve the wall.
        zones = sorted(lever.zones)
        classes = sorted({d.port_class for n in interior.nodes for d in n.requires} - {"admin", "remote_access", "remote_desktop", "*"})
        options = sorted((a, b, cls) for a in zones for b in zones for cls in classes if a != b and (a, b, cls) not in lever.allow)
        lever.allow.extend(rng.sample(options, min(config.extra_allow_flows, len(options))))
        lever.allow.sort()
    interior.assumptions.append(Assumption(id=f"generated-{seed}", provenance="S", statement=f"{GENERATOR_VERSION}, seed={seed}, config={config.model_dump_json()}. EOL denominator is {len(workstations)} nonmedical Windows ws/cow/console nodes; {eol_count} assigned Windows 7. Server OS, hardware, medical flags, domain membership and admin grants are unchanged. Account sessions are reassigned within existing organization/domain footprints; this is an assumed sensitivity distribution, not a posterior over real interiors."))
    return GeneratedTrial(seed=seed, scenario=interior, plan=candidate)
