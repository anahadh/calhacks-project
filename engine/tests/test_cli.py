"""CLI contract: JSON only on stdout, errors on stderr, no seed on replay."""

import json
from pathlib import Path

import pytest

from sim_core.adapters import load_cuh
from sim_core.cli import main
from sim_core.replay import compare_plan, replay
from sim_core.schema import Campaign, Plan, ReplayResult, Scenario

ROOT = Path(__file__).resolve().parents[2]
ENGINE = Path(__file__).resolve().parents[1]
CUH = ROOT / "claude_instructions/data/scenarios/cuh_hospital.json"
CAMPAIGN = ENGINE / "examples/cuh_campaign.json"
PLAN = ENGINE / "examples/cuh_plan.json"


def test_replay_prints_only_the_result_json_matching_a_direct_call(capsys):
    assert main(["replay", "--scenario", str(CUH), "--campaign", str(CAMPAIGN)]) == 0
    out = capsys.readouterr()
    assert out.err == ""
    result = ReplayResult.model_validate_json(out.out.strip())
    direct = replay(load_cuh(CUH), Campaign.model_validate_json(CAMPAIGN.read_text()))
    assert result.model_dump_json() == direct.model_dump_json()


def test_replay_with_plan_writes_output_file(tmp_path, capsys):
    dest = tmp_path / "result.json"
    code = main(["replay", "--scenario", str(CUH), "--campaign", str(CAMPAIGN), "--plan", str(PLAN), "--output", str(dest)])
    assert code == 0
    assert capsys.readouterr().out == ""
    written = ReplayResult.model_validate_json(dest.read_text())
    expected = replay(load_cuh(CUH), Campaign.model_validate_json(CAMPAIGN.read_text()), Plan.model_validate_json(PLAN.read_text()))
    assert written.model_dump_json() == expected.model_dump_json()


def test_compare_emits_baseline_and_defended(capsys):
    assert main(["replay", "--scenario", str(CUH), "--campaign", str(CAMPAIGN), "--plan", str(PLAN), "--compare"]) == 0
    bundle = json.loads(capsys.readouterr().out)
    assert {"baseline", "defended", "avoided_encryption", "necessary_levers_in_context"} <= bundle.keys()
    assert bundle["baseline"]["cache_key"] != bundle["defended"]["cache_key"]


def test_compare_without_plan_is_a_clean_error(capsys):
    assert main(["replay", "--scenario", str(CUH), "--campaign", str(CAMPAIGN), "--compare"]) == 1
    out = capsys.readouterr()
    assert out.out == ""
    assert "compare" in out.err.lower()


def test_cache_dir_hit_is_byte_identical(tmp_path, capsys):
    args = ["replay", "--scenario", str(CUH), "--campaign", str(CAMPAIGN), "--cache-dir", str(tmp_path)]
    assert main(args) == 0
    first = capsys.readouterr().out.strip()
    assert main(args) == 0
    second = capsys.readouterr().out.strip()
    assert first == second
    assert list(tmp_path.glob("*.json"))


def test_invalid_scenario_is_stderr_and_nonzero(tmp_path, capsys):
    bad = tmp_path / "bad.json"
    bad.write_text('{"scenario_id": "x"}', encoding="utf-8")  # missing required fields
    assert main(["replay", "--scenario", str(bad), "--campaign", str(CAMPAIGN)]) == 1
    out = capsys.readouterr()
    assert out.out == ""
    assert out.err.startswith("error:")


def test_embedded_campaign_in_a_canonical_scenario_is_rejected(tmp_path, capsys):
    scenario = json.loads(CUH.read_text())  # CUH dialect; add a canonical marker + forbidden field
    poisoned = {"scenario_id": "x", "snapshot_date": "2021-05-13", "nodes": [], "links": [], "domains": [], "campaign": {"x": 1}}
    bad = tmp_path / "poison.json"
    bad.write_text(json.dumps(poisoned), encoding="utf-8")
    assert main(["replay", "--scenario", str(bad), "--campaign", str(CAMPAIGN)]) == 1
    assert "error:" in capsys.readouterr().err


def test_replay_subcommand_has_no_seed(capsys):
    with pytest.raises(SystemExit) as exc:
        main(["replay", "--scenario", str(CUH), "--campaign", str(CAMPAIGN), "--seed", "7"])
    assert exc.value.code == 2  # argparse usage error


def test_sensitivity_takes_a_seed_and_is_deterministic(capsys):
    args = ["sensitivity", "--scenario", str(CUH), "--plan", str(PLAN), "--seed", "17"]
    assert main(args) == 0
    first = capsys.readouterr().out
    assert main(args) == 0
    second = capsys.readouterr().out
    assert first == second
    trial = json.loads(first)
    assert trial["seed"] == 17 and "scenario" in trial and "generator_version" in trial
