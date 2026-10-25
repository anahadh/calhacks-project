# Judging-day runbook (print this page)

All commands run from the repo root on the **demo laptop**. `scripts/demo.py` starts, checks and stops everything (`up`, `status`, `restart <piece>`, `down`). Its pieces are `spacetimedb`, `publish`, `engine`, `watcher`, `web` and `agents`, and their logs are in `logs/demo/<piece>.log`. The ports are SpacetimeDB :3000, web **:3001**, engine :8000, relay :8010 and agents :8001-8004.

**Who does what** (fill in): Presenter (talks, clicks in the app) ________ · Operator (demo laptop terminal, logs, restarts) ________ · Second laptop (shows the same session) ________ · Backup (video, cached run, timekeeping) ________

## The night before
- [ ] `git pull` on the branch we demo. `npm install`. Engine: `cd engine && uv sync --python 3.11 --group dev`. Agents: `cd agents && .venv/bin/pip install -r requirements.txt`.
- [ ] Env: `.env.local` and `agents/.env` are filled in. `python scripts/demo.py status` lists missing variable **names** only; fix each one. For two laptops, `NEXT_PUBLIC_STDB_URI` must use the demo laptop's LAN address, not `localhost`.
- [ ] Record the cached run (`docs/hippocratech/CACHED_RUN.md` §1; on the `f1/cached-run` branch until it merges). Run a real round, then `agents/.venv/bin/python agents/scripts/record_round.py agents/logs/dev.jsonl`, and commit `agents/cache/demo_round.json`.
- [ ] `python scripts/demo.py status`: every row says `yes`, and `demo_check.py` (when it's on the branch) passes, including **Cached run**.
- [ ] Record the backup video: one full demo, start to finish, 2-3 min, kept offline on two laptops and a phone.
- [ ] Charge every laptop and phone. Pack chargers, an HDMI/USB-C adapter and a phone hotspot.

## 30 minutes before
- [ ] `python scripts/demo.py up`. Wait for the table (all `yes`) and the "Open http://localhost:3001" line. Leave that terminal open: it shows a loud banner if any piece exits.
- [ ] Open the app on the demo laptop, then on the second laptop at the printed LAN URL. Both must show the same session.
- [ ] Full dry run: **Simulate attacks** → click MRI 2 → **Start attack** → wait for the run to finish → **Create aggregate fix** → watch the **Agents** tab until the round is done → **Show the solution** on a plan. Confirm the second laptop follows each step.
- [ ] Press **New demo** so the first judge starts clean.

## Between judges (reset)
- After a finished round, the presenter presses **New demo**: a fresh session with the demo hospital, and every open tab follows. It appears only when the round is done and no solution view is open, so close the solution view first.
- If the round never finished, open `http://localhost:3001/` and press **Simulate attacks** for a new session. Send the new link to the second laptop.
- Nothing needs restarting between judges. Glance at the `up` window for banners.

## If something breaks

| Symptom | Do this |
|---|---|
| A banner in the `up` window names a piece | `python scripts/demo.py restart <piece>` in a second terminal, then reload the page |
| Page says "Not connected", or nothing updates | `restart spacetimedb`, then `restart publish`, then reload both laptops |
| Stuck at "Waiting for the engine…", or a run shows an engine error | `restart engine`, then `restart watcher` |
| The run never starts or never advances | `restart watcher`, and check `logs/demo/watcher.log` |
| Blank page, or a Next.js error | `restart web` (the first load after a restart takes ~30 s) |
| **Create aggregate fix** does nothing, or the Agents tab is silent for 30 s | `restart agents`; check `logs/demo/agents.log` for relay 401 (token) or model errors |
| A model/Agentverse/Wi-Fi failure mid-round, or a second agent failure | **Cached run** (below) |
| The 3D view is broken, or the projector has no WebGL | The page falls back to the 2D plan by itself. To force it, open Chrome with `--disable-webgl` |
| Nothing works within 2 minutes | Play the backup video, and talk over it |

**Switching to the cached run:** use the session on screen, with its run **finished**, and **don't** press **Create aggregate fix**. Run `cd agents && .venv/bin/python scripts/replay_cached.py --session <id from the URL /s/<id>> --speed 1.5`. Say out loud: **"This is a cached run of a real round we recorded earlier."** Every message is labeled "Cached run". If the replay prints a relay error, it stops there: go to the video.

**Stopping:** Ctrl-C in the `up` window, or `python scripts/demo.py down` from any terminal. Either way it stops everything it started and confirms the ports are free.
