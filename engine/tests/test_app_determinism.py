"""Rule 6 (rewritten): the app path is the engine's own determinism. The same
(hospital, patient_zero, policy, challenges) gives byte-identical output across
processes, PYTHONHASHSEED values, and the Python call / HTTP / the hippo-sim CLI."""

import json
import subprocess
import sys
from pathlib import Path

from fastapi.testclient import TestClient

from sim_core.api import create_app
from sim_core.app_bridge import run_result, run_session

ROOT = Path(__file__).resolve().parents[2]
DEMO = ROOT / "data" / "hospitals" / "demo.json"


def _hospital() -> dict:
    return json.loads(DEMO.read_text())["hospital"]


def _canon(obj: object) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"))


def test_run_session_is_stable_across_hash_seeds():
    hospital = _hospital()
    prog = "import json,sys;from sim_core.app_bridge import run_session;" \
           "h=json.load(open(sys.argv[1]))['hospital'];" \
           "print(json.dumps(run_session(h,'mri_2'),sort_keys=True,separators=(',',':')))"
    outs = []
    for seed in ("0", "1"):
        proc = subprocess.run([sys.executable, "-c", prog, str(DEMO)], capture_output=True, text=True,
                              env={"PYTHONHASHSEED": seed, "PATH": __import__("os").environ["PATH"]})
        assert proc.returncode == 0, proc.stderr
        outs.append(proc.stdout.strip())
    assert outs[0] == outs[1]
    assert outs[0] == _canon(run_session(hospital, "mri_2"))


def test_python_http_and_cli_agree_on_run_result(tmp_path):
    hospital = _hospital()
    direct = run_result(hospital, "mri_2")

    client = TestClient(create_app(tmp_path))
    http = client.post("/app/run_result", json={"hospital": hospital, "patient_zero": "mri_2"}).json()

    cli = subprocess.run([str(ROOT / "engine/.venv/bin/hippo-sim"), "--hospital", str(DEMO), "--patient-zero", "mri_2"],
                         capture_output=True, text=True)
    assert cli.returncode == 0, cli.stderr

    assert _canon(direct) == _canon(http) == _canon(json.loads(cli.stdout))


def test_committed_session_fixtures_are_the_engines_current_output():
    # The module and the watcher play copies of these files (scripts/build_frames_fixture.py
    # writes them); a mismatch means the engine changed, so rebuild them and copy them again.
    hospital = _hospital()
    keep_scans = json.loads((ROOT / "agents/fixtures/candidates/cand_keep_scans.json").read_text())["policy"]
    for name, policy in (("app_session.demo.mri_2.json", None), ("app_session.demo.mri_2.keep_scans.json", keep_scans)):
        committed = json.loads((Path(__file__).parent / "fixtures" / name).read_text())
        assert committed == run_session(hospital, "mri_2", policy=policy), name
