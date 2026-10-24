# Engine (`engine/`) — the one engine and its wiring

This is the single reference for the engine: what it is, every way to call it
(CLI, HTTP, WebSocket), the exact inputs and outputs of each, and how the app
wires into it. For the research rationale and evidence limits see
[`../engine/RESEARCH_DECISIONS.md`](../engine/RESEARCH_DECISIONS.md); for usage see
[`../engine/README.md`](../engine/README.md); for the integration record see
[`hippocratech/INTEGRATION.md`](hippocratech/INTEGRATION.md).

## What it is

One engine, `engine/` (Python package `sim_core`). It is the only thing that
computes spread, impact, patient states and policy effects (AGENTS.md hard rule 3).
It is a deterministic causal model: credentials, reachability and trust hops;
`clean < footholded < cred_holder < controlled < encrypted`; defender actions;
medical devices never encrypt. It has no RNG and no clock on the replay path, so
the same inputs give byte-identical output across processes, hash seeds and
transports (rule 6).

It serves two jobs through one code path:

- **Visible runs.** The run watcher (`apps/watcher/src/run.ts`) asks the engine
  for a whole run over the app's hospital (`POST /app/session`), then feeds the
  per-tick frames into SpacetimeDB through the server-only `run_frames_apply`
  reducer. Every browser subscribes to the rows. The reducer is sandboxed WASM and
  computes nothing (rule 7); the watcher moves frames, it does not compute them.
- **CUH backtest.** The same package backtests a segmentation plan against the
  real 2021 Conti campaign and scores it, through its own CLI (`hippo-backtest`)
  and `POST /replay`. This is research/credibility work on canonical
  `Scenario`/`Campaign`/`Plan` inputs, not the app hospital format.

`sim_core.app_bridge` is the translation layer: it maps the app's `hospital.json`
into the engine's `Scenario`, runs it, and maps the result back to the UI sim rows
(`run_session`, with a per-tick `frames[]` timeline) and the agents' `RunResult`
(`to_run_result`). `sim_core.app_policy` applies an agents' `Policy` (which flows
are kept, removed, or protected-and-broken, and which inactive flows a challenge
switches on). The retired TypeScript `packages/sim-core` is gone; its policy
semantics live on in `app_policy.py`.

## Running it

```sh
cd engine
uv sync --python 3.11 --group dev      # installs core + api + dev deps
uv run pytest -q                       # the engine suite

# CLIs
uv run hippo-sim --hospital H.json --patient-zero mri_2 [--policy P.json] [--challenge C]...
uv run hippo-backtest replay --scenario SCN --campaign CMP [--plan PLN]
# HTTP + WebSocket server (CORS allows http://localhost:3000); the watcher's
# ENGINE_URL defaults to http://127.0.0.1:8000
uv run uvicorn sim_core.api:app --port 8000
```

## CLIs

Two console scripts (`engine/pyproject.toml` `[project.scripts]`), both JSON on
stdout, errors to stderr with a nonzero exit.

### `hippo-sim` — the app-hospital test run (what the uAgents call)

`sim_core.app_cli:main`. One engine test run over the app hospital format, printed
as exactly one `RunResult` JSON object on stdout. Argv (matches `agents/tools.py`):

```
hippo-sim --hospital FILE --patient-zero ID [--seed N] [--policy FILE] [--challenge C]...
```

- `--hospital` is an app hospital file (`{schemaVersion, hospital}` or a bare
  hospital object).
- `--policy` is a by-alias `Policy` JSON (`agents/protocol.py`).
- `--challenge` may repeat; the only supported challenge is `unknown_device_imaging`.
- `--seed` is accepted and ignored (the engine is deterministic, rule 6).
- Errors exit `2` with one line on stderr.

Internally `hippo-sim` calls `app_bridge.run_result(hospital, pz, policy=…,
challenges=…)`, the same function `POST /app/run_result` and the visible rerun use,
so the agents' numbers are the screen's numbers.

### `hippo-backtest` — the CUH causal backtest

`sim_core.cli:main`. Canonical `Scenario`/`Campaign`/`Plan` files only (no hospital
input).

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

Every error uses one envelope, `{ "error": { "type", "detail" } }`:
`413` `body_too_large`/`too_many_nodes`; `422` `invalid_request` (bad body shape),
`invalid_hospital` (no devices), `invalid_policy` (an `apply_policy` error),
`invalid_app_input` (e.g. a refused patient zero, with the engine's message
verbatim); on the backtest path `404` for an unknown id and a valid replay whose
trace merely contains `blocked` steps is a normal `200`.

| Method · Path | Request | Response |
|---|---|---|
| `GET /healthz` | — | `{ "status": "ok", "rules_version": "causal-v1" }` |
| **`POST /app/session`** | **`{hospital, patient_zero, policy?, challenges?}`** (strict `AppSessionRequest`) | **the UI sim rows + per-tick `frames[]`** (below) — the live run the watcher drives |
| **`POST /app/run_result`** | same `{hospital, patient_zero, policy?, challenges?}` | the agents' `RunResult` (7 keys); the HTTP twin of `hippo-sim` |
| **`POST /app/entry_points`** | **`{hospital}`** | `{ "entryPoints": [deviceId, …] }` — the device ids the engine accepts as patient zero, in file order |
| `POST /replay` | `{scenario, campaign, plan?}` **or** `{scenario_id, campaign_id, plan?}` (strict, exactly one of each) | `ReplayResult` JSON; headers `X-Cache-Key`, `X-Cache: hit\|miss` |
| `WS /replay/{cache_key}/trace` | a cache key from a prior `/replay` | ordered messages: `meta` → each `trace` → each `service_frame` → each `event_effect` → final `summary`. Reassemble to a byte-identical `ReplayResult`. |
| `GET /planner/scenario/{id}` | a registered scenario id | `{ "scenario": <canonical>, "plan_schema": <Plan JSON schema> }` — never the campaign |

Limits on the app endpoints: 4,000,000 body bytes, 5,000 devices.

### `POST /app/session` — the live UI path (inputs / outputs)

**Request** (strict; any extra key is `422 invalid_request`):
```jsonc
{
  "hospital": { /* the app hospital object: data/hospitals/*.json → .hospital */ },
  "patient_zero": "mri_2",      // must be an executing Windows host (IT, or a Windows medical console)
  "policy": null,               // optional: the agents' by-alias Policy; null/omitted = no segmentation
  "challenges": []              // optional: supported ids, e.g. ["unknown_device_imaging"]
}
```

**Response** (`200`) — the `run_session` output. Every key the module stores or the
UI renders:
```jsonc
{
  "patientZero": "mri_2",
  "finalTick": 15,
  "removedFlows": [],                 // flow ids the policy removed; [] with no policy
  "protectedBroken": [],              // removed ∩ protected
  "frames": [ /* TickFrame */ ],      // exactly finalTick + 1 entries, ticks 0..finalTick
  "devices":  [ { "deviceId", "infected": true, "infectedAtTick": 3, "infectedBy": "mri_2" }, … ],
  "services": [ { "serviceId": "svc_mri", "down": true, "downSinceTick": 15 }, … ],
  "patients": [ { "groupId": "pg_er", "state": "ok|delayed|disrupted|diverted" }, … ],
  "attempts": [ { "tick", "from", "to", "flowId", "success" }, … ],
  "events":   [ { "tick", "kind", "targetId", "text" }, … ],
  "snapshots":[ { "tick", "infectedCount" }, … ],      // one per tick, 0..finalTick
  "chokePoints": [ { "deviceId", "share" }, … ],
  "delayedProcedures": 6,
  "assumptions": [ "[S] …", … ],                       // disclosed reconstruction notes
  "encryptedHosts": 14,
  "medicalDevicesEncrypted": 0
}
```

The top-level `devices`/`services`/`patients`/`attempts`/`events`/`snapshots` are
the final-state aggregate, for any consumer that is not playing frames. The watcher
does not forward them; it replays `frames`.

### `TickFrame` — the one contract the engine, watcher and module share

One frame per tick, `0..finalTick` in order. Tick 0 lists every device, service and
group (the baseline the module inserts); every later tick carries only what changed
that tick. Only frame 0 carries `run`; `final` is true only on tick `finalTick`.
Also documented in [`hippocratech/HOSPITAL_SCHEMA.md`](hippocratech/HOSPITAL_SCHEMA.md)
"Run frames"; the watcher parses it in `apps/watcher/src/engine.ts` and the module
in `spacetime/src/ingest.ts`.

```jsonc
{
  "tick": 3,                          // 0..finalTick, contiguous
  "final": false,                     // true only on tick == finalTick
  "devices":  [ { "deviceId": "ws_lab", "infected": true, "infectedAtTick": 3, "infectedBy": "ws_img_1" } ],
                                      // tick 0: EVERY device; later: only devices that changed this tick
                                      // not infected: { "infected": false, "infectedAtTick": -1, "infectedBy": "" }
  "services": [ { "serviceId": "svc_mri", "down": true, "downSinceTick": 15 } ],   // tick 0: every service; up = down:false, downSinceTick:-1
  "patients": [ { "groupId": "pg_er", "state": "diverted" } ],                    // tick 0: every group; later: changed only
  "attempts": [ { "from": "ws_img_1", "to": "ws_lab", "flowId": "fl_12", "success": true } ],
  "events":   [ { "kind": "device_infected", "targetId": "ws_lab", "text": "Lab workstation compromised" } ],
  "snapshot": { "infectedCount": 4, "patientsAffected": 0,
                "infectedIds": ["…sorted"], "servicesDown": ["…sorted"], "patients": { "pg_er": "ok" } },
  "summary":  { "patientsAffected": 0, "devicesCompromised": 4, "servicesDown": 0,
                "delayedProcedures": 0, "chokePoints": [ { "deviceId": "ws_img_1", "share": 0.5 } ] },
  "run":      { "finalTick": 15, "removedFlows": [], "protectedBroken": [], "assumptions": ["[S] …"] }
                                      // present on tick 0 only
}
```

Frame rules the engine owns (and the engine suite tests):

- Patient state comes from each tick's service state. Services fail only at
  detonation, so groups are `ok` before `finalTick` and take their final state at
  `finalTick`. There is no duration escalation.
- No self-attempts. Patient zero appears only in the tick-0 `patient_zero` event.
- Every successful attempt names a real hospital `flowId` joining `from` and `to`;
  the row mapping reconstructs the hop path along real SMB/RDP flows, so every pulse
  runs along a real edge. `chokePoints` come from those paths.
- A blocked attempt (`success:false`) is emitted for a removed `smb`/`rdp` flow out
  of a compromised device, disclosed by an `[S]` note. No policy gives no blocked
  rows. The UI also draws every `removed_flows_json` flow as a cut connection.
- `service_down` text uses the service's name; a `diversion` event fires when an
  `er` group becomes `diverted`, with `targetId` the group's `roomId`.
- `delayedProcedures` = patients in `outpatient_scan`/`surgical` groups that are not
  `ok`.
- `kind` is one of `patient_zero`, `device_infected`, `service_down`, `diversion`.

## The bridge — `sim_core.app_bridge` and `sim_core.app_policy`

`app_bridge` maps the app hospital ⇄ the engine. Decisions (all disclosed as `[S]`
notes in the response `assumptions`):

- **Device kinds:** `server_rack`→`srv` (role `domain_controller`→`dc`),
  `workstation`/`nurse_station`→`ws`, medical types→vendor appliances that never
  encrypt.
- **Windows medical consoles:** a medical device whose `os` is Windows (e.g. the
  demo's Windows-7 MRI 2) is modeled as an attackable IT node, so it can be patient
  zero; its vendor scanner still never encrypts.
- **Lateral movement:** `smb`/`rdp` links carry admin-class reach; `https`/`dicom`/
  `hl7` stay application-layer.
- **Identity layer:** `domains`/`accounts`/`trusts` are used when the hospital
  supplies them; otherwise a single domain, its DC, and a domain-admin are
  **synthesized** (invented inputs, labeled `[S]`).

`app_policy.apply_policy(hospital, policy=None, challenges=())` returns an
`AppliedPolicy(hospital, removed_flows, protected_broken)`: the hospital carrying
only the active, kept flows, plus the removed and protected-and-broken flow ids in
file order. It is a line-for-line port of the retired `sim-core` `policy.ts`
(`keptFlowIds`, `protectedBroken`), with challenge activation mirroring
`extraActiveFlowIds`. A policy is validated by a strict local pydantic model
`AppPolicy`; a selector naming a zone, type, role or VLAN the hospital lacks, or an
unsupported challenge, raises a `PolicyError` (the transports' `422 invalid_policy`).
`SUPPORTED_CHALLENGES = ("unknown_device_imaging",)`.

Programmatic entry points (`app_bridge.py`):

- `to_scenario(hospital) -> BridgeResult`, `to_campaign(pz, scenario, *, window=200)`,
  `run(hospital, pz, plan=None) -> (ReplayResult, BridgeResult)` — the engine-native,
  lever-based path used by backtests.
- `entry_points(hospital) -> list[str]` — the device ids the engine accepts as
  patient zero (an executing Windows host that is not a vendor medical appliance),
  in file order. Served by `POST /app/entry_points`.
- `run_session(hospital, pz, plan=None, *, policy=None, challenges=()) -> dict` — the
  UI sim rows with the `frames[]` timeline (the `POST /app/session` body).
- `to_run_result(session, hospital) -> dict` — pure: derives the agents' `RunResult`
  from a `run_session` output, so the agents' numbers equal the screen's. `hospital`
  only supplies the static patient-group counts.
- `run_result(hospital, pz, *, policy=None, challenges=()) -> dict` —
  `to_run_result(run_session(...), hospital)`; what `hippo-sim` and
  `POST /app/run_result` return.

## How the app wires in

- **Live run (the path the web uses):** the run watcher subscribes to `run` rows.
  On a `requested` run it calls `POST /app/session`, caches the `AppSession`, and
  applies frame 0 through `run_frames_apply`; then it sends one frame per beat at
  `TICK_MS / speed` (`apps/watcher/src/run.ts`). The module checks every frame and
  writes the rows; the browser subscribes with `NEXT_PUBLIC_STDB_URI` set and renders
  them. There is no direct browser → engine call. An engine refusal becomes
  `run_fail` → `run.detail`, shown verbatim (rule 14).
- **Entry points:** the watcher also calls `POST /app/entry_points` for each new
  session and stores the list through `session_entry_points_set`; the UI dims every
  other device so a judge can only start an attack the engine will run.
- **Agents:** the uAgents call `hippo-sim` (`HIPPO_SIM_BIN`) and expect a
  `RunResult`; `app_bridge.run_result` produces that contract.
- **CUH backtest viewer:** the separate `/replay` screen under `apps/web/app/replay`
  posts `POST /replay` directly. It is outside the demo flow.

## Output contracts (summary)

- **`run_session` / `POST /app/session`**: the object above, including `frames[]`.
- **`TickFrame`**: the per-tick shape above (`spacetime/src/ingest.ts`,
  `apps/watcher/src/engine.ts`).
- **`RunResult`** (agents, `agents/protocol.py`; `POST /app/run_result`, `hippo-sim`):
  `ticks` (= `finalTick`), `infectedCount`, `infectedDevices[{id,tick}]`,
  `servicesDown[{id,downSinceTick,ticksDown}]` (`ticksDown = ticks - downSinceTick + 1`),
  `patientCounts{ok,delayed,disrupted,diverted}`, `protectedBroken[]`, `removedFlows[]`.
- **`ReplayResult`** (backtest, `sim_core/schema.py`): `cache_key`, `trace[]`,
  `services[]`, `levels{}`, `summary{}`, `event_effects[]`.

## Honesty boundaries

Deterministic (no RNG, no clock on the replay path; identical bytes across the Python
call, `POST /app/session`, `hippo-sim`, and the CLI/HTTP/WS/cache backtest paths).
Medical devices never encrypt. On a hospital with no identity layer the credentials
are synthesized and disclosed as `[S]` notes. The HSE and British Library checks are
reported unsupported, never fitted. See `RESEARCH_DECISIONS.md`.
