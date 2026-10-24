"""Freeze workflow: exploratory label, one-use ledger, repo-root sibling trees."""

import pytest

from sim_core import freeze_runner


def test_frozen_file_set_spans_code_and_sibling_data():
    files = freeze_runner.frozen_files()
    # New adapter modules are frozen alongside the causal core.
    assert "engine/sim_core/cli.py" in files
    assert "engine/sim_core/api.py" in files
    assert "engine/sim_core/cache.py" in files
    assert "engine/pyproject.toml" in files and "engine/uv.lock" in files
    # Sibling data tree is frozen too (the trap that single-root freeze() would hit).
    assert "claude_instructions/data/tests/calibration.yaml" in files
    assert "claude_instructions/data/scenarios/cuh_hospital.json" in files
    assert any(path.endswith("cuh_press_outcomes.csv") for path in files)


def test_manifest_is_exposed_and_verifies_against_the_tree(tmp_path):
    manifest = freeze_runner.build_manifest("unit-study")
    assert manifest.prior_holdout_exposure  # CUH/BL were inspected
    freeze_runner.verify_manifest(manifest)  # nothing changed -> no raise


def test_exploratory_study_persists_and_is_one_use(tmp_path):
    ledger = tmp_path / "ledger"
    reports = tmp_path / "reports"
    result = freeze_runner.run_exploratory_study("unit-study", ledger, reports, seeds=range(2))

    assert result["exploratory"] is True
    assert result["committed_preinspection_freeze"] is False
    assert result["prior_holdout_exposure"]
    assert (reports / "freeze_manifest.json").is_file()
    assert (reports / "report.json").is_file()
    assert list(ledger.glob("*.attempt.json"))  # ledger marker persisted

    # One-use: the same study + label cannot be rerun.
    with pytest.raises(FileExistsError):
        freeze_runner.run_exploratory_study("unit-study", ledger, reports, seeds=range(2))
