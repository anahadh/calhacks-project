"""Completion criterion: CLI, direct API, uncached WS and cached WS agree byte-for-byte.

Runs on the real CUH reconstruction + exploratory campaign so the identity is
proven on a full-size, realistic replay, not only an invented two-node network.
"""

from pathlib import Path

from fastapi.testclient import TestClient

from sim_core import cache
from sim_core.adapters import load_cuh
from sim_core.api import create_app
from sim_core.cli import main
from sim_core.replay import replay
from sim_core.schema import Campaign, Plan, ReplayResult

ROOT = Path(__file__).resolve().parents[2]
ENGINE = Path(__file__).resolve().parents[1]
CUH = ROOT / "claude_instructions/data/scenarios/cuh_hospital.json"
CAMPAIGN = ENGINE / "examples/cuh_campaign.json"


def _reassemble_ws(client: TestClient, key: str) -> ReplayResult:
    data = {"cache_key": key, "trace": [], "services": [], "event_effects": [], "levels": {}, "summary": {}}
    with client.websocket_connect(f"/replay/{key}/trace") as ws:
        while True:
            msg = ws.receive_json()
            if msg["kind"] == "trace":
                data["trace"].append(msg["entry"])
            elif msg["kind"] == "service_frame":
                data["services"].append(msg["frame"])
            elif msg["kind"] == "event_effect":
                data["event_effects"].append(msg["effect"])
            elif msg["kind"] == "summary":
                data["levels"], data["summary"], data["cache_key"] = msg["levels"], msg["summary"], msg["cache_key"]
                break
    return ReplayResult.model_validate(data)


def test_all_transports_export_one_deterministic_replay(tmp_path, capsys):
    scenario = load_cuh(CUH)
    campaign = Campaign.model_validate_json(CAMPAIGN.read_text())

    # 1) Direct in-process replay — the reference bytes.
    direct = replay(scenario, campaign, Plan()).model_dump_json()

    # 2) CLI stdout.
    assert main(["replay", "--scenario", str(CUH), "--campaign", str(CAMPAIGN)]) == 0
    cli_json = capsys.readouterr().out.strip()

    # 3) Cache file on disk, read back.
    stored_result, cached = cache.load_or_compute(tmp_path, scenario, campaign)
    assert cached is False
    cache_file_bytes = cache.cache_path(tmp_path, stored_result.cache_key).read_text()

    # 4) Direct API call (cache miss) + 5) uncached WebSocket stream of that result.
    client = TestClient(create_app(tmp_path / "api-cache"))
    posted = client.post("/replay", json={"scenario": scenario.model_dump(mode="json"), "campaign": campaign.model_dump(mode="json")})
    assert posted.headers["X-Cache"] == "miss"
    api_body = posted.text
    key = posted.headers["X-Cache-Key"]
    uncached_ws = _reassemble_ws(client, key).model_dump_json()

    # 6) Cached WebSocket: a second POST is a cache hit; the stream still matches.
    assert client.post("/replay", json={"scenario": scenario.model_dump(mode="json"), "campaign": campaign.model_dump(mode="json")}).headers["X-Cache"] == "hit"
    cached_ws = _reassemble_ws(client, key).model_dump_json()

    assert cli_json == direct
    assert cache_file_bytes == direct
    assert api_body == direct
    assert uncached_ws == direct
    assert cached_ws == direct


def test_replay_is_stable_across_separate_processes(tmp_path):
    """Hash-seed independence: a fresh interpreter must print identical bytes."""
    import subprocess
    import sys

    def run(seed: str) -> str:
        proc = subprocess.run(
            [sys.executable, "-I", "-m", "sim_core.cli", "replay", "--scenario", str(CUH), "--campaign", str(CAMPAIGN)],
            cwd=str(ENGINE), capture_output=True, text=True,
            env={"PYTHONHASHSEED": seed, "PATH": __import__("os").environ.get("PATH", "")},
        )
        assert proc.returncode == 0, proc.stderr
        return proc.stdout.strip()

    assert run("0") == run("1")
