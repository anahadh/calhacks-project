"""Capture the real 3D hospital scene for ASI:One cards (run on a laptop with the web app up).

For the overview and for the no-plan spread from every device an attack can start from, the
engine computes who is infected (tools.run_sim, the same call the rounds use), the web app's
/snap page renders that state in the 3D scene, and headless Chrome screenshots it into
apps/web/public/asi1/. Deploying the web app publishes them at /asi1/<name>.png, which is
what the ASI:One cards link (viz.scene_url() on the asi1 branch). Rerun when the hospital changes.

    agents/.venv/bin/python agents/scripts/snap_scenes.py [--web http://localhost:3001]
"""

import argparse
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlencode

sys.path.insert(0, str(Path(__file__).parent.parent))

import chat  # noqa: E402
from logic import hospital as hospital_mod  # noqa: E402
from tools import run_sim  # noqa: E402
from config import settings  # noqa: E402

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
OUT = Path(__file__).resolve().parents[2] / "apps" / "web" / "public" / "asi1"


def shoot(url: str, path: Path, tries: int = 4) -> bool:
    """A shot that came out blank (the scene not loaded yet) is taken again, with more time."""
    for attempt in range(tries):
        if path.exists():
            path.unlink()
        _shoot_once(url, path, 9000 + 6000 * attempt)
        if path.exists() and path.stat().st_size > 60_000:
            return True
    return False


def _shoot_once(url: str, path: Path, budget_ms: int) -> None:
    subprocess.run([CHROME, "--headless=new", "--disable-gpu-sandbox", "--use-angle=swiftshader",
                        "--enable-unsafe-swiftshader", "--hide-scrollbars", "--window-size=1400,820",
                        f"--virtual-time-budget={budget_ms}", f"--screenshot={path}", url],
                   capture_output=True, text=True, timeout=180)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--web", default="http://localhost:3001")
    a = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    h = hospital_mod.load(settings().hospital_path)
    if not ((OUT / "overview.png").exists() and (OUT / "overview.png").stat().st_size > 60_000):
        print("overview:", shoot(f"{a.web}/snap", OUT / "overview.png"), flush=True)
    done, skipped = 0, []
    for d in chat.devices_on_network(h):
        if (OUT / f"spread-{d}.png").exists() and (OUT / f"spread-{d}.png").stat().st_size > 60_000:
            done += 1
            continue
        try:
            r = run_sim(None, d, chat.DEMO_SEED, [])
        except Exception as e:
            skipped.append(f"{d} ({e.__class__.__name__})")
            continue
        q = urlencode({"start": d, "infected": ",".join(sorted(x.id for x in r.infectedDevices))})
        ok = shoot(f"{a.web}/snap?{q}", OUT / f"spread-{d}.png")
        done += ok
        print(f"spread-{d}: {'ok' if ok else 'FAILED'} ({r.infectedCount} infected)", flush=True)
    print(f"{done} spreads captured; skipped (engine refuses as a start): {', '.join(skipped) or 'none'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
