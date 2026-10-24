"""Cache round-trip and integrity on invented inputs; no incident data."""

import pytest

from sim_core import cache
from sim_core.replay import fingerprint, replay
from sim_core.schema import Account, Campaign, Domain, Event, HostProfile, Link, Node, Plan, Scenario, Service


def case():
    scenario = Scenario(
        scenario_id="invented-cache",
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
    campaign = Campaign(campaign_id="invented-cache", events=[
        Event(t="2030-01-02T09:00:00", order=0, rule="R1", target="entry", mode="phishing"),
        Event(t="2030-01-02T09:00:00", order=1, rule="tick", budget=5),
        Event(t="2030-01-02T11:00:00", order=0, rule="R6"),
    ])
    return scenario, campaign


def test_store_then_load_reproduces_identical_bytes(tmp_path):
    scenario, campaign = case()
    fresh = replay(scenario, campaign)
    path = cache.store(tmp_path, fresh)
    assert path.is_file()
    loaded = cache.load(tmp_path, fresh.cache_key)
    assert loaded is not None
    # The whole point: cached bytes represent the same result.
    assert loaded.model_dump_json() == fresh.model_dump_json()
    assert loaded.cache_key == fresh.cache_key == fingerprint(scenario, campaign, Plan())


def test_load_or_compute_computes_then_hits_without_recomputing(tmp_path):
    scenario, campaign = case()
    first, cached_first = cache.load_or_compute(tmp_path, scenario, campaign)
    assert cached_first is False
    second, cached_second = cache.load_or_compute(tmp_path, scenario, campaign)
    assert cached_second is True
    assert first.model_dump_json() == second.model_dump_json()


def test_corrupt_or_foreign_file_is_a_miss_not_a_crash(tmp_path):
    scenario, campaign = case()
    key = fingerprint(scenario, campaign, Plan())
    cache.cache_path(tmp_path, key).write_text("{not valid json", encoding="utf-8")
    assert cache.load(tmp_path, key) is None


def test_file_stored_under_the_wrong_key_is_rejected(tmp_path):
    scenario, campaign = case()
    fresh = replay(scenario, campaign)
    wrong_key = "0" * 64
    cache.cache_path(tmp_path, wrong_key).write_text(fresh.model_dump_json(), encoding="utf-8")
    assert cache.load(tmp_path, wrong_key) is None


def test_store_leaves_no_temp_files(tmp_path):
    scenario, campaign = case()
    cache.store(tmp_path, replay(scenario, campaign))
    assert [p.name for p in tmp_path.glob(".tmp-*")] == []


@pytest.mark.parametrize("bad", ["../escape", "a/b", "name.json", "", "has space"])
def test_cache_key_must_be_a_bare_digest(tmp_path, bad):
    with pytest.raises(ValueError, match="invalid cache key"):
        cache.cache_path(tmp_path, bad)
