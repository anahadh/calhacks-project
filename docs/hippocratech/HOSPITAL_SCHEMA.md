# Hospital schema

## Standalone propagation/backtest contract (current)

The user-requested `claude_instructions/IMPLEMENTATION.md` is implemented by the
strict Pydantic models in [`engine/sim_core/schema.py`](../../engine/sim_core/schema.py).
These are the engine-native, lever-based backtest contract. The app's visible runs
use the same engine through `sim_core.app_bridge`, which **does** convert the
engine's five-level state to the app's `infected`/`down` booleans and the per-tick
frames — see [App run contract](#app-run-contract) below.

- `Scenario`: hosts/profiles, typed consumer→provider dependencies, network links,
  domains, directed trusts, account grants/sessions/optional org ownership,
  services/required consumers, levers and disclosed assumptions.
- `Campaign`: attacker credentials/prior execution context, intent, authored
  events with time/order, bounded host-level windows, explicit alternative entry
  routes and assumptions. It is never planner-visible.
- `Plan`: `plan_id` and listed levers; segmentation uses directed functional
  `(source zone, target zone, port class)` allow-flows. Unlisted departments are
  singleton zones. Only segmentation accepts zones/allow fields.
- `ReplayResult`: deterministic cache key, ordered transition trace with
  `event_index`, ordered service/device frames with `pre_attack` phase, final
  levels, summary, and per-authored-event credential/domain/level effects.

Levels: clean < footholded < cred_holder < controlled < encrypted. Service states
are up/paper/down; medical-device states are operational/dependency_outage.
Only encryption or lost dependencies disrupt services. Medical flags override
Windows profiles. The replay makes no injury/mortality predictions.

CUH's supplied dialect is strictly validated by `load_cuh`; all added flow/domain/
consumer assumptions are exported. Raw national HSE and British Library data are
not complete canonical inputs; missing facts must be reported, not derived from
expected outcomes. [Research decisions](../../engine/RESEARCH_DECISIONS.md) and
[handoff](../../engine/HANDOFF.md) document these adapters and the decisions behind
them.

### Transport and console contracts

The adapters serialize the contract above; none of them computes a transition, and
all export the same deterministic replay (`ReplayResult.model_dump_json()`).

- **CLI.** `hippo-backtest replay --scenario S --campaign C [--plan P] [--compare] [--cache-dir D]`
  prints the `ReplayResult` JSON (or, with `--compare`, a `compare_plan` bundle via a Pydantic
  encoder) to stdout; validation errors go to stderr with a nonzero exit. `hippo-backtest sensitivity
  --scenario S --seed N` is the only seeded command. The CUH dialect loads via `load_cuh`; a
  canonical scenario via the strict models, which reject an embedded `campaign`/`expected`.
- **HTTP.** `POST /replay` takes a strict `{scenario, campaign, plan?}` (or server-owned
  `{scenario_id, campaign_id}`) and returns the `ReplayResult` body with `X-Cache-Key` and
  `X-Cache: hit|miss`. Invalid data is 413/422/404; a valid replay whose trace contains `blocked`
  entries is a normal 200. Explicit bounds cap body bytes, node count and event count.
- **WebSocket.** `/replay/{cache_key}/trace` streams the already-cached result as ordered
  messages — `meta`, each `trace`, each `service_frame`, each `event_effect`, then a final
  `summary` (levels + summary) — which reassemble to a byte-identical `ReplayResult`.
- **Planner boundary.** A planner receives only the canonical `Scenario` and
  `Plan.model_json_schema()`; a scenario upload embedding `campaign`/`expected` is rejected, not
  stripped, so a held-out answer cannot ride in through the planner surface.
- **Console adapter** (the separate CUH backtest `/replay` viewer, `apps/web/app/replay`; see `engine/HANDOFF.md`). Maps level→colour (controlled = amber,
  encrypted = red), device `dependency_outage` = violet, and service up/paper/down, keeping
  labels. It renders bundled `ReplayResult` output only and never ticks in the browser. (The app's
  visible run is a different path: `app_bridge.run_session` converts the five-level state to the
  `infected`/`down` booleans and per-tick frames — see [App run contract](#app-run-contract).)

## Earlier scene/upload contract

The contract for the demo hospital and every uploaded file. `packages/schema` implements it in zod. When this file and the code disagree, fix both in the same change.

All data is synthetic. The schema has no field for a person's identity, and unknown fields are rejected, so a real record cannot be uploaded by accident.

## File

One JSON object, at most 2 MB.

```jsonc
{
  "schemaVersion": 1,
  "hospital": {
    "id": "demo_general",          // [a-z0-9_]{3,40}
    "name": "Bayview General (demo)",
    "floors":   [ /* Floor */ ],
    "rooms":    [ /* Room */ ],
    "devices":  [ /* Device */ ],
    "flows":    [ /* Flow */ ],
    "services": [ /* Service */ ],
    "patients": [ /* PatientGroup */ ],
    "domains":  [ /* Domain, optional */ ],
    "trusts":   [ /* Trust, optional */ ],
    "accounts": [ /* Account, optional */ ]
  }
}
```

## Types

### Floor
| Field | Type | Rule |
|---|---|---|
| `id` | string | unique |
| `name` | string | 1–40 chars |
| `level` | integer | 0 = ground; unique |

### Room
| Field | Type | Rule |
|---|---|---|
| `id` | string | unique |
| `floorId` | string | must exist |
| `name` | string | 1–40 chars |
| `type` | enum | `imaging`, `er`, `icu`, `pharmacy`, `or`, `server`, `lab`, `admin`, `waiting`, `ward`, `other` |
| `zone` | string | policy label, e.g. `imaging`, `critical_care`, `it_core` |
| `polygon` | `[x, y][]` | 3–32 points, meters, on the floor plane |

### Device
| Field | Type | Rule |
|---|---|---|
| `id` | string | unique |
| `roomId` | string | must exist |
| `type` | enum | `mri`, `ct`, `workstation`, `nurse_station`, `patient_monitor`, `infusion_pump`, `server_rack`, `pharmacy_cabinet`, `lab_analyzer`, `anesthesia_machine`, `badge_reader`, `hvac`, `unknown` (an unidentified device; the Inventory Agent won't let a policy touch it until a human names it) |
| `role` | enum, optional | for `server_rack` only: `pacs`, `ehr_engine`, `file_server`, `domain_controller`, `other` |
| `name` | string | 1–40 chars, e.g. "MRI 2" |
| `make` | string, optional | manufacturer, e.g. "Siemens" |
| `model` | string, optional | model name |
| `os` | string | e.g. `windows_7`, `linux`, `rtos`, `windows_11` |
| `vulnerable` | boolean | unpatched or end-of-life. The `mark_vulnerable_*` challenge can set it during a session |
| `vulnerabilityReasons` | `{ source, id, summary }[]`, optional | `source` is `manual` or an advisory id; shown on hover |
| `criticality` | enum | `low`, `medium`, `high`, `life_support` |
| `vlan` | integer | 1–4094 |
| `position` | `[x, y]` | meters; must fall inside its room's polygon |

### Flow
| Field | Type | Rule |
|---|---|---|
| `id` | string | unique |
| `from` | string | device id, must exist |
| `to` | string | device id, must exist, not equal to `from` |
| `protocol` | enum | `smb`, `rdp`, `http`, `https`, `dicom`, `hl7`, `other` |
| `port` | integer | 1–65535 |
| `protected` | boolean | clinical engineering says it must keep working |
| `observed` | boolean, optional | default `true`. `true` = seen in traffic; `false` = documented only. The Flow Agent weighs unobserved flows as safer to cut |
| `purpose` | string, optional | one line, shown when the flow is broken ("Scans to radiologists") |
| `active` | boolean, optional | default `true`. `false` = exists only for a challenge (e.g. `vendor_link_mri3`), off until that challenge is applied |

### Identity layer (`domains`, `trusts`, `accounts`), optional

Who can administer what, and where their credentials are cached. The engine uses it
verbatim (`sim_core.app_bridge.to_scenario`). Without it the bridge invents one domain
admin with a session on every workstation, so every patient zero ends in the same
place; with it, how far an attack gets depends on whose credentials are cached where it
lands. The demo hospital carries one: a clinical help desk whose account is cached on
every nurse station and clinical PC, a diagnostics help desk cached on the lab, pharmacy,
imaging and reading PCs, an EHR interface service account cached on the EHR server and
three clinical PCs, a PACS admin cached in Imaging, Reading and one IT desk, a backup
service account on the file server, an IT help desk cached only on Admin WS 2 and 3, and
one domain admin whose sessions sit only on the domain controller and Admin WS 1. So a
ward start takes the clinical floor and the EHR, a lab start takes diagnostics and the
servers, an IT desk takes everything but the DC, and only Admin WS 1 or the DC gives the
domain admin. The app's campaign is opportunistic (`Campaign.opportunistic`): like
ransomware it takes every host it can administer, not only the ones a service needs.

| Field | Type | Rule |
|---|---|---|
| `domains[].id` | string | the Windows domain; the demo has one, `H` |
| `domains[].dcs` | string[] | device ids of its domain controllers |
| `accounts[].id` | string | unique, e.g. `H\\helpdesk_er` |
| `accounts[].domain` | string | a `domains[].id` |
| `accounts[].tier` | enum | `user`, `service`, `service_desk_admin`, `administrator`, `domain_admin`, … (`sim_core.schema.Account`) |
| `accounts[].admin_to` | string[] | device ids this account can administer; `"*"` = every joined host in its domain |
| `accounts[].sessions_on` | string[] | device ids where its credentials are cached; taking one of them hands the attacker the account |
| `trusts` | `{ source, target }[]` | directed domain trusts; empty in the demo |

A device is a legal patient zero only if it is a workstation, nurse station or Windows
medical console (never a server or the DC), some account has a session on it, and it has
an SMB/RDP link out (`POST /app/entry_points`).

### Service
| Field | Type | Rule |
|---|---|---|
| `id` | string | unique |
| `name` | string | e.g. "MRI imaging" |
| `dependsOnDevices` | string[] | device ids, at least 1, all must exist |
| `consequence` | string | one line shown when down ("Radiologists can't view images") |
| `critical` | boolean, optional | default `false`. Critical services are what the Clinical Workflow Agent protects (`MAX_SERVICE_LOSS`) |

### PatientGroup
| Field | Type | Rule |
|---|---|---|
| `roomId` | string | must exist |
| `type` | enum | `icu`, `er`, `surgical`, `outpatient_scan`, `waiting` |
| `count` | integer | 1–200 |
| `dependsOnServices` | string[] | service ids, all must exist |

A patient group is a count. There is no name, age, birth date, record number, or diagnosis, and adding one fails validation.

## Limits

| Item | Max |
|---|---|
| File size | 2 MB |
| Floors | 8 |
| Rooms | 60 |
| Devices | 1,500 |
| Flows | 6,000 |
| Services | 100 |
| Total patients | 2,000 |

## Validation errors

Every error has a JSON path and a sentence. Report all errors, not the first one.

```json
[
  { "path": "hospital.devices[14].roomId", "message": "Room \"rm_icu_9\" does not exist." },
  { "path": "hospital.patients[3].name",   "message": "Unknown field. Patient groups hold counts only." }
]
```

## Policy

What the agent returns and the simulation applies. Anything not allowed by a rule is blocked.

```jsonc
{
  "strategy": "protect_critical_care",   // least_disruption | max_containment | protect_critical_care | fastest_deploy
  "name": "Critical care first",
  "rules": [
    {
      "id": "r1",
      "from": { "zone": "imaging", "deviceType": "mri" },   // zone, deviceType, role, vlan: any subset
      "to":   { "role": "pacs" },
      "protocol": "dicom",                                  // optional; omitted = any
      "port": 104,                                          // optional
      "plain": "MRI scanners may send images to PACS on port 104. Nothing else."
    }
  ],
  "rationale": "…",
  "tradeoff": "…"
}
```

- A flow is kept if at least one rule matches its source, destination, protocol, and port. Every other flow is removed.
- A selector field that names a zone, type, role, or VLAN the hospital does not have is a validation error.
- `fastest_deploy` rules may select only by `vlan` and `port`, since that is what existing ACLs express. The validator enforces this.
- Maximum 40 rules per policy.

## App run contract

The live visible run. The run watcher POSTs this to the engine
(`POST /app/session`, `engine/sim_core/api.py`), which returns the sim rows plus a
per-tick `frames[]` timeline; the watcher drips the frames into SpacetimeDB. Full
engine reference: [`../engine.md`](../engine.md) and
[`INTEGRATION.md`](INTEGRATION.md) §5a.

**Request** — `AppSessionRequest`, strict (any extra key is `422 invalid_request`):

```jsonc
{
  "hospital": { /* the app hospital object: this file's "hospital" */ },
  "patient_zero": "mri_2",      // an executing Windows host (IT, or a Windows medical console)
  "policy": null,               // optional: the agents' by-alias Policy; null/omitted = no segmentation
  "challenges": []              // optional: supported ids, e.g. ["unknown_device_imaging"]
}
```

`POST /app/run_result` takes the same request and returns the `RunResult` below
(the HTTP twin of the `hippo-sim` CLI). `POST /app/entry_points {hospital}` returns
`{ "entryPoints": [deviceId, …] }`, the device ids the engine accepts as patient
zero, in file order.

**Response** (`200`) — the `run_session` output (`app_bridge.run_session`):

```jsonc
{
  "patientZero": "mri_2",
  "finalTick": 15,
  "removedFlows": [],                 // flow ids the policy removed; [] with no policy
  "protectedBroken": [],              // removed ∩ protected
  "frames": [ /* TickFrame, finalTick + 1 of them, ticks 0..finalTick */ ],
  "devices":  [ { "deviceId", "infected": true, "infectedAtTick": 3, "infectedBy": "mri_2" }, … ],
  "services": [ { "serviceId": "svc_mri", "down": true, "downSinceTick": 15 }, … ],
  "patients": [ { "groupId": "pg_er", "state": "ok|delayed|disrupted|diverted" }, … ],
  "attempts": [ { "tick", "from", "to", "flowId", "success" }, … ],
  "events":   [ { "tick", "kind", "targetId", "text" }, … ],
  "snapshots":[ { "tick", "infectedCount" }, … ],
  "chokePoints": [ { "deviceId", "share" }, … ],
  "delayedProcedures": 6,
  "assumptions": [ "[S] …", … ],
  "encryptedHosts": 14,
  "medicalDevicesEncrypted": 0
}
```

Errors use one envelope, `{ "error": { "type", "detail" } }`: `413`
`body_too_large`/`too_many_nodes`; `422` `invalid_request`, `invalid_hospital`,
`invalid_policy` (an `apply_policy` error), `invalid_app_input` (e.g. a refused
patient zero). The top-level `devices`/`services`/… arrays are the final-state
aggregate; the watcher replays `frames` instead.

### Run frames (`TickFrame`)

One frame per tick, `0..finalTick` in order. Tick 0 lists every device, service and
group (the baseline the module inserts); every later tick carries only what changed.
Only frame 0 carries `run`; `final` is true only on tick `finalTick`. The watcher
parses it in `apps/watcher/src/engine.ts` and the module in `spacetime/src/ingest.ts`.

```jsonc
{
  "tick": 3,                          // 0..finalTick, contiguous
  "final": false,                     // true only on tick == finalTick
  "devices":  [ { "deviceId": "ws_lab", "infected": true, "infectedAtTick": 3, "infectedBy": "ws_img_1" } ],
                                      // tick 0: EVERY device; later: only devices that changed
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

- `events[].kind` is one of `patient_zero`, `device_infected`, `service_down`,
  `diversion`; its `targetId` names a device (first two), service, or room (`diversion`).
- Patient state comes from each tick's service state; services fail only at
  detonation, so groups are `ok` until `finalTick`. No duration escalation.
- Every successful attempt names a real `flowId`; a blocked attempt (`success:false`)
  marks a removed `smb`/`rdp` flow out of a compromised device, disclosed by an `[S]`
  note.

## Run ingestion

How a visible run reaches SpacetimeDB. The module stores and reveals; it computes
nothing. Reducers and columns are in `spacetime/src/schema.ts`,
`ingest.ts`, `solution.ts` and `index.ts`.

**`run` columns** (public; new engine columns default so an existing database
migrates):

| Column | Type | Meaning |
|---|---|---|
| `id` | string PK | — |
| `session_id` | string | the session |
| `pair_id` | string | `""` unless part of a solution-view pair |
| `label`, `patient_zero`, `policy_json` | string | `policy_json` `""` = no segmentation; opaque to the module |
| `seed` | u32 | accepted and ignored (the engine has no RNG) |
| `tick` | u32 | the last frame applied |
| `status` | string | `requested \| running \| paused \| done \| error` |
| `speed` | f64 | `0.5 \| 1 \| 2 \| 4` |
| `patients_affected`, `devices_compromised`, `services_down`, `delayed_procedures` | u32 | the latest frame's summary |
| `choke_points_json` | string | the latest frame's choke points |
| `final_tick` | u32 | from frame 0 |
| `detail` | string | engine/watcher error (rule 14); never `session.round_detail` |
| `autoplay` | bool | frame 0 leaves the run `running` (true) or `paused` |
| `step_pending` | bool | the presenter asked for one step while paused |
| `challenges_json`, `removed_flows_json`, `assumptions_json` | string | `removed_flows_json`/`assumptions_json` from frame 0 |
| `recommendation_id` | string | set on a solution rerun's plan side |
| `started_at` | timestamp | — |

The per-tick rows the frames write: `device_state`, `service_state`,
`patient_state`, `spread_attempt` (pruned after `KEEP_ATTEMPT_TICKS`), `sim_event`,
`tick_snapshot`.

**Status machine**

```
run_start / solution_start / run_reset ──► requested ──(watcher: frame 0 via run_frames_apply)──► running | paused  (by autoplay)
requested ──(watcher: run_fail)──► error
running ──run_pause──► paused ──run_resume──► running
paused ──run_step──► paused + step_pending ──(watcher applies one frame)──► paused
running | paused ──(frame.final)──► done
any (except requested) ──run_reset──► requested (tick 0, rows cleared, autoplay false)
```

**Ingestion reducers**

| Reducer | Auth | Args | Behavior |
|---|---|---|---|
| `run_frames_apply` | server only | `{ frames_json }` = `[{ runId, frame: TickFrame }]` | One transaction (a pair lands atomically). Checks each frame against the run and the session's hospital, then writes the six row sets and updates the `run` row. Size ≤ 256 KiB. |
| `run_fail` | server only | `{ run_id, detail }` | Sets `status:'error'` and `detail` (≤ 500 chars). |
| `solution_start` | presenter | `{ session_id, recommendation_id, speed }` | Inserts **two** `requested` runs under one `pair_id` (`No segmentation` and `With plan: <name>`), both `autoplay`. Leaves `active_run_id` put (rule 9: writes no `recommendation.status`); sets `session.solution_pair_id`. |
| `solution_close` | presenter | `{ session_id }` | Clears `session.solution_pair_id`; keeps the runs. |
| `session_entry_points_set` | server only | `{ session_id, entry_points_json }` | Stores the engine's legal patient zeros (device ids in the session's hospital). |

`run_start`, `run_pause`, `run_resume`, `run_set_speed`, `run_step` and `run_reset`
(presenter) only change flags the watcher obeys; they write no state rows.

## RunResult (the live contract)

What `hippo-sim` prints for one test run, as one JSON object on stdout, and what
`POST /app/run_result` returns. The agents read it (`agents/protocol.py`,
`RunResult`), and it is the `testResult` on `Proposal`, `Revision` and
`Recommendation`. `app_bridge.to_run_result` derives it from the same `run_session`
output the screen shows, so the agents' numbers equal the visible run's. Every number
comes from the Python engine. Unknown fields are rejected.

```jsonc
{
  "ticks": 15,                       // = finalTick
  "infectedCount": 14,               // devices infected at the end
  "infectedDevices": [ { "id": "mri_2", "tick": 0 }, { "id": "ws_img_1", "tick": 2 } /* … */ ],
  "servicesDown": [ { "id": "svc_mri", "downSinceTick": 15, "ticksDown": 1 } ],
  "patientCounts": { "ok": 30, "delayed": 0, "disrupted": 26, "diverted": 14 },
  "protectedBroken": [ "fl_2" ],     // protected flow ids the policy removed
  "removedFlows": [ "fl_8", "fl_9" ] // every flow id the policy removed
}
```

| Field | Type | Rule |
|---|---|---|
| `ticks` | integer | ≥ 0; the run's `finalTick` |
| `infectedCount` | integer | ≥ 0; equals the length of `infectedDevices` |
| `infectedDevices` | `{ id, tick }[]` | device id and the tick (`infectedAtTick`) it was infected |
| `servicesDown` | `{ id, downSinceTick, ticksDown }[]` | services down at the end; `ticksDown = ticks - downSinceTick + 1` (down from `downSinceTick` through `ticks` inclusive) |
| `patientCounts` | `{ ok, delayed, disrupted, diverted }` | patients in each state at the end; the four add up to the hospital's total |
| `protectedBroken` | string[] | flow ids the policy removed that were `protected` |
| `removedFlows` | string[] | flow ids; empty when there is no policy |

## Template

`data/hospitals/template.json` is the smallest useful valid file: one floor, three rooms, eight devices, one protected flow, two services, three patient groups. Keep it valid; a test checks it.
