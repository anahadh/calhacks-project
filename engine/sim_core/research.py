"""Falsifiable evaluation contracts, causal controls and a one-use hold-out gate.

Ground truth is passed to evaluators only. No loader in this module feeds labels
back into inventory, account permissions, scheduling, or the propagation rules.
"""

from __future__ import annotations

import hashlib
import json
from collections.abc import Callable, Iterable
from pathlib import Path
from typing import Literal, TypeVar

from .engine import Engine
from .generator import GeneratorConfig, generate_trial
from .replay import canonical_json, replay
from .schema import Campaign, Plan, ReplayResult, Scenario, StrictModel


class ExpectedService(StrictModel):
    name: str
    service: str
    acceptable: list[Literal["up", "paper", "down"]]


def service_matches(result: ReplayResult, expectations: list[ExpectedService]) -> dict[str, bool]:
    final = result.services[-1].services
    return {expected.name: final.get(expected.service) in expected.acceptable for expected in expectations}


def robustness(scenario: Scenario, campaign: Campaign, plan: Plan, expectations: list[ExpectedService], *, seeds: Iterable[int] = range(100), config: GeneratorConfig | None = None) -> dict[str, object]:
    config = config or GeneratorConfig()
    seed_list = list(seeds)
    if not seed_list or len(set(seed_list)) != len(seed_list):
        raise ValueError("robustness requires nonempty unique seeds")
    names = [item.name for item in expectations]
    if len(names) != len(set(names)):
        raise ValueError("expectation names must be unique")
    counts = dict.fromkeys(names, 0)
    medical_encrypted = 0
    trial_keys = []
    assumptions: list[dict] = []
    for seed in seed_list:
        trial = generate_trial(scenario, plan, seed, config)
        result = replay(trial.scenario, campaign, trial.plan)
        for name, matched in service_matches(result, expectations).items():
            counts[name] += int(matched)
        medical_encrypted += result.summary["medical_devices_encrypted"]
        trial_keys.append(result.cache_key)
        if not assumptions:
            # The reconstruction + generator disclosure is identical in shape across
            # seeds; the first trial is the representative serialized record of it.
            assumptions = [a.model_dump(mode="json") for a in trial.scenario.assumptions]
    return {"seeds": seed_list, "config": config.model_dump(mode="json"), "assumptions": assumptions, "shares": {name: {"matches": count, "total": len(seed_list), "share": count / len(seed_list)} for name, count in counts.items()}, "medical_devices_encrypted": medical_encrypted, "trial_keys": trial_keys, "interpretation": "Descriptive sensitivity under the declared synthetic generator; not a validated incident probability."}


def naive_baseline(scenario: Scenario, campaign: Campaign, *, kind: Literal["encrypt_everything_reached", "sir_epidemic_on_reachability_graph"]) -> set[str]:
    """Intentionally wrong controls, isolated from the actual propagation rules.

    Both ignore credential authority and historical defender actions. SIR uses
    deterministic beta=1, infectious lifetime=one step (gamma=1); the prediction
    is ever infected. These illustrative parameters are not an epidemiological fit.
    """
    engine = Engine(scenario)
    sources = set(campaign.initial_footholds) | {e.target for e in campaign.events if e.rule == "R1" and e.target is not None}
    if kind == "encrypt_everything_reached":
        reached = {n.id for n in scenario.nodes if any(engine.topology.network_reach(source, n.id, "admin") for source in sources)}
    elif kind == "sir_epidemic_on_reachability_graph":
        reached, frontier = set(sources), set(sources)
        recovered: set[str] = set()
        while frontier:
            nxt = {n.id for n in scenario.nodes if n.id not in reached and any(engine.topology.network_reach(source, n.id, "admin") for source in frontier)}
            recovered.update(frontier)
            reached.update(nxt)
            frontier = nxt
    else:
        raise ValueError(f"unknown baseline: {kind}")
    return {n.id for n in scenario.nodes if n.encryptable and n.id in reached}


def ablate_defender(campaign: Campaign, org: str, action: Literal["D1", "D2", "D3"]) -> Campaign:
    matched = [e for e in campaign.events if e.org == org and e.rule == action]
    if not matched:
        raise ValueError("ablation did not match a defender event")
    return campaign.model_copy(update={"campaign_id": f"{campaign.campaign_id}-without-{action}-{org}", "events": [e for e in campaign.events if not (e.org == org and e.rule == action)]}, deep=True)


def conditional_org_score(predicted: dict[str, bool | None], labels: dict[str, bool], targeted_orgs: Iterable[str]) -> dict[str, object]:
    """Untargeted organizations are never evidence of successful protection."""
    targeted = set(targeted_orgs)
    denominator = sorted(targeted & labels.keys())
    correct = [org for org in denominator if predicted.get(org) is not None and predicted[org] == labels[org]]
    unknown = [org for org in denominator if predicted.get(org) is None]
    return {"targeted_with_labels": denominator, "correct": correct, "unknown": unknown, "accuracy_over_all_labelled_targets": len(correct) / len(denominator) if denominator else None, "excluded_untargeted": sorted(labels.keys() - targeted)}


class FreezeManifest(StrictModel):
    study_id: str
    files: dict[str, str]
    prior_holdout_exposure: list[str]
    # The protocol must bind scoring/aliasing conventions as well as code/data.
    protocol: str

    @property
    def digest(self) -> str:
        return hashlib.sha256(canonical_json(self.model_dump(mode="json")).encode()).hexdigest()


def freeze(workspace: Path, files: Iterable[str], *, study_id: str, protocol: str, prior_holdout_exposure: list[str]) -> FreezeManifest:
    """Build a reviewable content freeze. It does not make a Git commit for you."""
    root = workspace.resolve()
    hashes = {}
    for name in sorted(set(files)):
        path = (root / name).resolve()
        if not path.is_relative_to(root) or not path.is_file():
            raise ValueError(f"freeze file is outside workspace or missing: {name}")
        hashes[path.relative_to(root).as_posix()] = hashlib.sha256(path.read_bytes()).hexdigest()
    if not hashes or not protocol.strip():
        raise ValueError("freeze needs files and an explicit scoring protocol")
    return FreezeManifest(study_id=study_id, files=hashes, protocol=protocol, prior_holdout_exposure=prior_holdout_exposure)


def assert_frozen(workspace: Path, manifest: FreezeManifest) -> None:
    current = freeze(workspace, manifest.files.keys(), study_id=manifest.study_id, protocol=manifest.protocol, prior_holdout_exposure=manifest.prior_holdout_exposure)
    if current.digest != manifest.digest:
        raise ValueError("frozen research inputs changed; this is a new exploratory study, not the original hold-out")


T = TypeVar("T")


def run_holdout_once(workspace: Path, manifest: FreezeManifest, ledger: Path, name: str, evaluate: Callable[[], T], *, require_unseen: bool = True) -> T:
    """Claim an attempt before reading labels; failed attempts are consumed too.

    The transport adapter persists the manifest and result. The ledger's atomic
    exclusive file creation prevents accidental reruns; it is an honesty guard,
    not a security boundary against someone deleting their own research history.
    """
    assert_frozen(workspace, manifest)
    if require_unseen and manifest.prior_holdout_exposure:
        raise ValueError("prior hold-out exposure was declared; label this exploratory or use a genuinely unseen scenario")
    ledger.mkdir(parents=True, exist_ok=True)
    # Stable per study+holdout, independent of changed code/hash, so refreezing
    # cannot silently reset the one-use constraint under the same study ID.
    key = hashlib.sha256(canonical_json([manifest.study_id, name]).encode()).hexdigest()
    marker = ledger / f"{key}.attempt.json"
    with marker.open("x", encoding="utf-8") as handle:
        json.dump({"study": manifest.study_id, "holdout": name, "freeze": manifest.digest, "prior_exposure": manifest.prior_holdout_exposure}, handle, sort_keys=True)
    result = evaluate()
    assert_frozen(workspace, manifest)
    return result
