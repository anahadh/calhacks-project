# Engine (`engine/`) — the causal backtest engine and its wiring

This is the single reference for the standalone causal engine: what it is, every
way to call it (CLI, HTTP, WebSocket), the exact inputs and outputs of each, and
how the app wires into it. For the research rationale and evidence limits see
[`../engine/RESEARCH_DECISIONS.md`](../engine/RESEARCH_DECISIONS.md); for usage see
[`../engine/README.md`](../engine/README.md).

## What it is, and how it relates to the live engine

Two engines live in this repo, on purpose:

| | **Live engine** — `packages/sim-core` (TypeScript) | **Causal engine** — `engine/` (Python) |
|---|---|---|
| Where it runs | inside the SpacetimeDB module (`run_tick` reducer) | standalone CLI + HTTP server |
| Model | probabilistic spread over flows (per-protocol odds) | credentials + reachability + trust hops; controlled vs encrypted; defender actions; medical devices never encrypt |
| Role | drives the visible on-screen run (hard rule 3) | backtests a plan against the real 2021 campaign, and powers the offline/`/app/run` UI |
| CLI | `hippo-sim` | **`hippo-backtest`** (distinct name, no collision) |

`sim_core.app_bridge` is the translation layer between the two: it maps the app's
`hospital.json` into the causal engine's `Scenario`, runs it, and maps the result
back to the rows the UI and agents expect.

## Running it

```sh
cd engine
uv sync --python 3.11 --group dev      # installs core + api + dev deps
uv run pytest -q                       # 113 checks

# CLI
uv run hippo-backtest replay --scenario SCN --campaign CMP [--plan PLN]
# HTTP + WebSocket server (CORS allows http://localhost:3000)
uv run uvicorn sim_core.api:app --port 8000
```

## CLI — `hippo-backtest`

JSON only on stdout; errors to stderr with a nonzero exit.

| Command | Inputs | Output |
|---|---|---|
| `replay --scenario S --campaign C [--plan P] [--scenario-format auto\|canonical\|cuh] [--cache-dir D] [--compare] [--output F]` | canonical `Scenario`/`Campaign`/`Plan` JSON (CUH dialect via `--scenario-format cuh`) | `ReplayResult` JSON, or a `compare_plan` bundle with `--compare` |
| `replay --bundle B.json [--verify]` | a frozen attack bundle | `ReplayResult` JSON; `--verify` re-runs the frozen inputs and refuses a tampered bundle |
| `freeze --scenario S --campaign C [--plan P] [--output F]` | same as replay | an `AttackBundle` (inputs + fingerprint + full result) |
| `sensitivity --scenario S --seed N [--eol-min --eol-max --extra-allow-flows]` | a scenario + a generator seed | a `GeneratedTrial` (perturbed interior). The seed is the generator's only — replay has no seed. |

## HTTP API — `sim_core.api` (FastAPI)

Served by `uvicorn sim_core.api:app`. The default app registers a CUH demo under
server-owned ids and enables CORS for `http://localhost:3000`. No endpoint computes
a transition; they load inputs, call the engine in a worker thread, and serialize.
Invalid data is `413/422/404`; a valid run whose trace merely contains `blocked`
steps is a normal `200`.

| Method · Path | Request | Response |
|---|---|---|
| `GET /healthz` | — | `{ "status": "ok", "rules_version": "causal-v1" }` |
| `POST /replay` | `{scenario, campaign, plan?}` **or** `{scenario_id, campaign_id, plan?}` (strict, exactly one of each) | `ReplayResult` JSON; headers `X-Cache-Key`, `X-Cache: hit\|miss` |
| `WS /replay/{cache_key}/trace` | a cache key from a prior `/replay` | ordered messages: `meta` → each `trace` → each `service_frame` → each `event_effect` → final `summary` (levels + summary). Reassemble to a byte-identical `ReplayResult`. |
| `GET /planner/scenario/{id}` | a registered scenario id | `{ "scenario": <canonical>, "plan_schema": <Plan JSON schema> }` — never the campaign |
| **`POST /app/run`** | **`{hospital, patient_zero}`** (the app hospital format) | **the UI sim rows** (below) — this is the live path the web uses |

### `POST /app/run` — the live UI path (inputs / outputs)

**Request**
```jsonc
{
  "hospital": {                 // the app hospital object (data/hospitals/*.json → .hospital)
    "devices":  [ { "id", "type", "roomId", "os", "role?", ... } ],
    "flows":    [ { "id", "from", "to", "protocol", "port" } ],
    "services": [ { "id", "name", "dependsOnDevices": [...] } ],
    "patients": [ { "id", "type", "count", "dependsOnServices": [...] } ],
    "domains?": [...], "accounts?": [...], "trusts?": [...]   // real identity layer, if present
  },
  "patient_zero": "mri_2"       // a device id; must be an executing Windows host (IT, or a Windows medical console)
}
```

**Response** (`200`) — the sim rows the 3D scene renders and animates:
```jsonc
{
  "patientZero": "mri_2",
  "finalTick": 15,
  "devices":  [ { "deviceId", "infected": true, "infectedAtTick": 3, "infectedBy": "mri_2" }, ... ],
  "services": [ { "serviceId": "svc_mri", "down": true, "downSinceTick": 15 }, ... ],
  "patients": [ { "groupId": "pg_er", "state": "ok|delayed|disrupted|diverted" }, ... ],
  "attempts": [ { "tick", "from", "to", "flowId", "success" }, ... ],   // the per-tick spread, for animation
  "events":   [ { "tick", "kind", "targetId", "text" }, ... ],
  "snapshots":[ { "tick", "infectedCount" }, ... ],                     // one per tick, 0..finalTick
  "chokePoints": [ { "deviceId", "share" }, ... ],
  "delayedProcedures": 6,
  "assumptions": [ "[S] ...", ... ],                                    // disclosed reconstruction notes
  "encryptedHosts": 14,
  "medicalDevicesEncrypted": 0
}
```

**Errors:** `413` body/hospital too large; `422 invalid_request` (bad body shape),
`422 invalid_hospital` (no devices), `422 invalid_app_input` (e.g. patient zero is a
non-Windows medical scanner — pick an IT host or a Windows medical console).

## The bridge — `sim_core.app_bridge`

Maps the app hospital ⇄ the causal engine. Decisions (all disclosed as `[S]` notes
in the response `assumptions`):

- **Device kinds:** `server_rack`→`srv` (role `domain_controller`→`dc`), `workstation`/`nurse_station`→`ws`, medical types→vendor appliances that never encrypt.
- **Windows medical consoles:** a medical device whose `os` is Windows (e.g. the demo's Windows-7 MRI 2) is modeled as an attackable IT node, so it can be patient zero; its vendor scanner still never encrypts.
- **Lateral movement:** `smb`/`rdp` links carry admin-class reach; `https`/`dicom`/`hl7` stay application-layer.
- **Identity layer:** `domains`/`accounts`/`trusts` are used when the hospital supplies them; otherwise a single domain, its DC, and a domain-admin are **synthesized** (invented inputs, labeled `[S]`).

Programmatic entry points: `to_scenario(hospital)`, `run(hospital, pz, plan?)`,
`run_session(hospital, pz, plan?)` (the `/app/run` body), `to_run_result(...)` (the
agents' `RunResult`).

## How the app wires in

- **Web UI (offline / `/app/run`):** `apps/web/lib/stdb/use-session.ts` → `useEngineSession()` (`engine-session.ts`) POSTs `mockSession.hospital` to `/app/run` on load and renders the fresh result; a baked run (`engine-demo-session.json`) is the fallback when the engine is down. This path is active whenever `NEXT_PUBLIC_STDB_URI` is unset. Set `NEXT_PUBLIC_ENGINE_URL` to point at a non-default engine server.
- **Agents (planned):** the agents call `hippo-sim` and expect a `RunResult`; `app_bridge.to_run_result` produces that contract, so a shim can point them at the causal engine.
- **Live SpacetimeDB run (not yet wired):** the reducer is sandboxed WASM and cannot call Python. Driving the live run with this engine means the watcher computes via `app_bridge` and feeds rows in through a reducer. See the unified-engine plan.

## Output contracts (summary)

- **`ReplayResult`** (`sim_core/schema.py`): `cache_key`, `trace[]`, `services[]` (frames), `levels{}`, `summary{}`, `event_effects[]`.
- **UI sim rows** (`/app/run`): the object above.
- **`RunResult`** (agents, `agents/protocol.py`): `ticks`, `infectedCount`, `infectedDevices[]`, `servicesDown[]`, `patientCounts{}`, `protectedBroken[]`, `removedFlows[]`.

## Honesty boundaries

Deterministic (no replay RNG; identical bytes across CLI/HTTP/WS/cache). Medical
devices never encrypt. On a hospital with no identity layer the credentials are
synthesized and disclosed. The HSE and British Library checks are reported
unsupported, never fitted. See `RESEARCH_DECISIONS.md`.
