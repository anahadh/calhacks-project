"""Freeze an attack, replay it deterministically, and detect tampering."""

import json
from pathlib import Path

import pytest

from sim_core.adapters import load_cuh
from sim_core.bundle import (
    AttackBundle,
    BundleMismatch,
    freeze_attack,
    load_bundle,
    replay_bundle,
    save_bundle,
    verify_bundle,
)
from sim_core.cli import main
from sim_core.replay import replay
from sim_core.schema import Account, Campaign, Domain, Event, HostProfile, Link, Node, Plan, Scenario, Service

ROOT = Path(__file__).resolve().parents[2]
ENGINE = Path(__file__).resolve().parents[1]
CUH = ROOT / "claude_instructions/data/scenarios/cuh_hospital.json"
CAMPAIGN = ENGINE / "examples/cuh_campaign.json"


def case():
    scenario = Scenario(
        scenario_id="invented-bundle",
        snapshot_date="2030-01-01",
        nodes=[
            Node(id="entry", dept="clinical", org="invented-org", domain="d", kind="ws", mail_client=True,
                 host=HostProfile(os_family="windows", domain_joined=True)),
            Node(id="target", dept="servers", org="invented-org", domain="d", kind="srv",
                 host=HostProfile(os_family="windows", domain_joined=True)),
        ],
        links=[Link(a="entry", b="target")],
        domains=[Domain(id="d")],
        accounts=[Account(id="admin", domain="d", tier="administrator", admin_to=["target"], sessions_on=["entry"])],
        services=[Service(name="Invented service", requires_all=["target"])],
    )
    campaign = Campaign(campaign_id="invented-bundle", events=[
        Event(t="2030-01-02T09:00:00", order=0, rule="R1", target="entry", mode="phishing"),
        Event(t="2030-01-02T09:00:00", order=1, rule="tick", budget=5),
        Event(t="2030-01-02T11:00:00", order=0, rule="R6"),
    ])
    return scenario, campaign


def test_freeze_then_replay_reproduces_the_frozen_result(tmp_path):
    scenario, campaign = case()
    bundle = freeze_attack(scenario, campaign)
    # Replaying the bundle (no recompute) is exactly a direct replay.
    assert replay_bundle(bundle).model_dump_json() == replay(scenario, campaign).model_dump_json()
    # Round-trips through disk unchanged.
    path = save_bundle(tmp_path / "attack.json", bundle)
    assert load_bundle(path).model_dump_json() == bundle.model_dump_json()


def test_verify_passes_on_an_untouched_bundle():
    scenario, campaign = case()
    bundle = freeze_attack(scenario, campaign)
    assert verify_bundle(bundle).model_dump_json() == bundle.result.model_dump_json()


def test_verify_detects_tampered_inputs():
    scenario, campaign = case()
    bundle = freeze_attack(scenario, campaign)
    # model_copy bypasses validation, like an attacker editing the file by hand:
    # the stored result/fingerprint are untouched, but the scenario no longer matches.
    tampered_scenario = bundle.scenario.model_copy(update={"scenario_id": "swapped"}, deep=True)
    tampered = bundle.model_copy(update={"scenario": tampered_scenario}, deep=True)
    with pytest.raises(BundleMismatch, match="fingerprint"):
        verify_bundle(tampered)


def test_verify_detects_a_tampered_result():
    scenario, campaign = case()
    bundle = freeze_attack(scenario, campaign)
    doctored_summary = dict(bundle.result.summary)
    doctored_summary["encrypted_hosts"] = []  # claim nothing was encrypted
    tampered_result = bundle.result.model_copy(update={"summary": doctored_summary}, deep=True)
    tampered = bundle.model_copy(update={"result": tampered_result}, deep=True)
    with pytest.raises(BundleMismatch, match="reproduce"):
        verify_bundle(tampered)


def test_verify_detects_a_rules_version_change():
    scenario, campaign = case()
    bundle = freeze_attack(scenario, campaign)
    stale = bundle.model_copy(update={"rules_version": "causal-v0-old"}, deep=True)
    with pytest.raises(BundleMismatch, match="rules_version"):
        verify_bundle(stale)


def test_load_rejects_a_bundle_whose_fingerprint_contradicts_its_result(tmp_path):
    scenario, campaign = case()
    bundle = freeze_attack(scenario, campaign)
    data = json.loads(bundle.model_dump_json())
    data["fingerprint"] = "0" * 64  # no longer equals result.cache_key
    bad = tmp_path / "bad.json"
    bad.write_text(json.dumps(data), encoding="utf-8")
    with pytest.raises(Exception):  # pydantic ValidationError from the consistency validator
        load_bundle(bad)


def test_cli_freeze_then_replay_bundle_verify_is_byte_identical(tmp_path, capsys):
    path = tmp_path / "cuh-attack.json"
    assert main(["freeze", "--scenario", str(CUH), "--campaign", str(CAMPAIGN), "--output", str(path)]) == 0
    assert capsys.readouterr().out == ""
    assert path.is_file()

    assert main(["replay", "--bundle", str(path), "--verify"]) == 0
    from_bundle = capsys.readouterr().out.strip()
    direct = replay(load_cuh(CUH), Campaign.model_validate_json(CAMPAIGN.read_text())).model_dump_json()
    assert from_bundle == direct


def test_cli_replay_of_a_tampered_bundle_fails_cleanly(tmp_path, capsys):
    path = tmp_path / "cuh-attack.json"
    assert main(["freeze", "--scenario", str(CUH), "--campaign", str(CAMPAIGN), "--output", str(path)]) == 0
    capsys.readouterr()
    data = json.loads(path.read_text())
    data["result"]["summary"]["encrypted_hosts"] = []  # tamper the frozen outcome
    path.write_text(json.dumps(data), encoding="utf-8")

    assert main(["replay", "--bundle", str(path), "--verify"]) == 1
    out = capsys.readouterr()
    assert out.out == "" and out.err.startswith("error:")
