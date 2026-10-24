"""Freeze an attack into a deterministic, tamper-evident, replayable bundle.

An attack is the triple (scenario, campaign, plan). A bundle pins that triple, the
rules version, the content fingerprint and the complete `ReplayResult`, so the same
attack replays to byte-identical output offline and indefinitely — the "bad venue
Wi-Fi plays a cached trace" case, made into a single self-contained artifact.

Loading checks the bundle's internal consistency (the stored fingerprint matches the
stored result's key). `verify_bundle` goes further and adversarially re-runs the
frozen inputs: if an edited scenario, a changed result, or a different rules version
no longer reproduces the frozen fingerprint and bytes, it raises rather than
replaying a trace that does not belong to the frozen inputs.
"""

from __future__ import annotations

from pathlib import Path

from pydantic import model_validator

from . import RULES_VERSION
from .replay import fingerprint, replay
from .schema import Campaign, Plan, ReplayResult, Scenario, StrictModel


class BundleMismatch(ValueError):
    """The frozen inputs no longer reproduce the frozen fingerprint/result."""


class AttackBundle(StrictModel):
    bundle_version: str = "attack-bundle-v1"
    rules_version: str
    fingerprint: str
    scenario: Scenario
    campaign: Campaign
    plan: Plan
    result: ReplayResult

    @model_validator(mode="after")
    def _internally_consistent(self) -> "AttackBundle":
        # Cheap structural check at load time; the heavy recompute is verify_bundle.
        if self.fingerprint != self.result.cache_key:
            raise ValueError("bundle fingerprint does not match the stored result's cache key")
        return self


def freeze_attack(scenario: Scenario, campaign: Campaign, plan: Plan | None = None) -> AttackBundle:
    """Replay once and freeze the inputs, fingerprint and complete result."""
    plan = plan or Plan()
    result = replay(scenario, campaign, plan)
    return AttackBundle(
        rules_version=RULES_VERSION,
        fingerprint=result.cache_key,
        scenario=scenario,
        campaign=campaign,
        plan=plan,
        result=result,
    )


def verify_bundle(bundle: AttackBundle) -> ReplayResult:
    """Re-run the frozen inputs and confirm they still reproduce the frozen output.

    Raises BundleMismatch on tampering or a rules-version change. Returns the frozen
    result (equal to the recomputed one) when everything agrees.
    """
    if bundle.rules_version != RULES_VERSION:
        raise BundleMismatch(f"bundle rules_version {bundle.rules_version!r} != engine {RULES_VERSION!r}")
    current = fingerprint(bundle.scenario, bundle.campaign, bundle.plan)
    if current != bundle.fingerprint:
        raise BundleMismatch("frozen inputs no longer hash to the stored fingerprint (tampered inputs or changed rules)")
    recomputed = replay(bundle.scenario, bundle.campaign, bundle.plan)
    if recomputed.model_dump_json() != bundle.result.model_dump_json():
        raise BundleMismatch("frozen inputs no longer reproduce the stored result")
    return bundle.result


def replay_bundle(bundle: AttackBundle, *, verify: bool = False) -> ReplayResult:
    """Return the frozen result. With verify=True, prove it still reproduces first."""
    return verify_bundle(bundle) if verify else bundle.result


def save_bundle(path: Path | str, bundle: AttackBundle) -> Path:
    destination = Path(path)
    destination.write_text(bundle.model_dump_json(indent=2), encoding="utf-8")
    return destination


def load_bundle(path: Path | str) -> AttackBundle:
    return AttackBundle.model_validate_json(Path(path).read_text(encoding="utf-8"))


__all__ = ["AttackBundle", "BundleMismatch", "freeze_attack", "verify_bundle", "replay_bundle", "save_bundle", "load_bundle"]
