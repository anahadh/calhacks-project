"""Serialize a content freeze, then run the supplied cases as an exploratory study.

The freeze is rooted at the repository root because the code (``engine/``) and the
frozen data (``claude_instructions/data/``) are sibling trees; it hashes every
``sim_core`` module, the packaging/lock files, the raw and example inventories,
the campaigns, plans, calibration config, ground-truth CSVs and the scorer/alias
protocol. The supplied CUH and British Library outcomes were inspected during
implementation, so they are declared prior exposure and the study runs with an
explicitly exploratory label via ``run_holdout_once(require_unseen=False)``. This
does NOT constitute a committed pre-inspection hold-out: a genuine unseen claim
needs a committed freeze and new held-out evidence before any label is opened.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Iterable

from . import research_runner
from .research import FreezeManifest, assert_frozen, freeze, run_holdout_once

REPO_ROOT = Path(__file__).resolve().parents[2]

PROTOCOL = (
    "Scoring protocol: organisation encryption is a declared share threshold (>0.5); org "
    "outcomes are conditional on authored targeting; CUH service/press aliasing and neighbouring-"
    "hospital exclusion come only from sim_core.protocols; robustness reports per-seed shares, the "
    "generator config and disclosed assumptions, never a single favourable seed. Normalized "
    "inventory is the deterministic output of the frozen sim_core.adapters.load_cuh over the frozen "
    "raw inventory; it is not a separate committed file. HSE/BL checks are unsupported until a "
    "separately authored causal reconstruction is supplied and are never fitted to pass."
)

# The supplied hold-out descriptions and some outcomes were inspected during
# implementation; any study using those labels must declare this exposure.
PRIOR_EXPOSURE = [
    "CUH press outcomes (cuh_press_outcomes.csv) were inspected during implementation.",
    "British Library expected outcomes (british_library_2023.json) were inspected during implementation.",
    "HSE org-level outcomes and calibration targets were inspected during implementation.",
]


def frozen_files(repo_root: Path | str = REPO_ROOT) -> list[str]:
    """Repo-root-relative paths of everything a study must freeze."""
    root = Path(repo_root).resolve()
    data = root / "claude_instructions" / "data"
    candidates: list[Path] = []
    candidates += sorted((root / "engine" / "sim_core").glob("*.py"))
    candidates += [root / "engine" / "pyproject.toml", root / "engine" / "uv.lock"]
    candidates += sorted((root / "engine" / "examples").glob("*.json"))
    candidates += sorted((data / "scenarios").glob("*.json"))
    candidates += sorted((data / "ground_truth").glob("*.csv"))
    candidates += [data / "ground_truth" / "hse_calibration_targets.json"]
    candidates += [data / "tests" / "calibration.yaml"]
    return sorted({path.resolve().relative_to(root).as_posix() for path in candidates if path.is_file()})


def build_manifest(study_id: str, *, repo_root: Path | str = REPO_ROOT, prior_exposure: list[str] | None = None) -> FreezeManifest:
    return freeze(
        Path(repo_root),
        frozen_files(repo_root),
        study_id=study_id,
        protocol=PROTOCOL,
        prior_holdout_exposure=list(PRIOR_EXPOSURE) if prior_exposure is None else prior_exposure,
    )


def run_exploratory_study(study_id: str, ledger_dir: Path | str, report_dir: Path | str, *, repo_root: Path | str = REPO_ROOT, seeds: Iterable[int] = range(100), label: str = "cuh-bl-exploratory") -> dict:
    """Freeze, claim a one-use attempt, run the checks, and persist manifest + report."""
    manifest = build_manifest(study_id, repo_root=repo_root)
    report_dir = Path(report_dir)
    report_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = report_dir / "freeze_manifest.json"
    manifest_path.write_text(manifest.model_dump_json(indent=2), encoding="utf-8")

    report = run_holdout_once(
        Path(repo_root),
        manifest,
        Path(ledger_dir),
        label,
        lambda: research_runner.run_default(seeds=seeds),
        require_unseen=False,
    )
    report_path = report_dir / "report.json"
    report_path.write_text(json.dumps(research_runner._json_safe(report), indent=2, sort_keys=True), encoding="utf-8")

    return {
        "study_id": study_id,
        "label": label,
        "exploratory": True,
        "committed_preinspection_freeze": False,
        "manifest_digest": manifest.digest,
        "prior_holdout_exposure": manifest.prior_holdout_exposure,
        "frozen_file_count": len(manifest.files),
        "manifest_path": str(manifest_path),
        "report_path": str(report_path),
        "ledger_dir": str(Path(ledger_dir)),
        "note": "This run uses previously inspected CUH/BL outcomes. It is exploratory and is NOT a committed pre-inspection hold-out. A genuine unseen claim requires a committed freeze and new held-out evidence before labels are opened.",
    }


def verify_manifest(manifest: FreezeManifest, *, repo_root: Path | str = REPO_ROOT) -> None:
    """Raise if any frozen input changed since the manifest was built."""
    assert_frozen(Path(repo_root), manifest)


__all__ = ["REPO_ROOT", "PROTOCOL", "PRIOR_EXPOSURE", "frozen_files", "build_manifest", "run_exploratory_study", "verify_manifest"]
