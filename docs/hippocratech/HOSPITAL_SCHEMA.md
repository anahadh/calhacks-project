# Hospital schema

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
    "patients": [ /* PatientGroup */ ]
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

## Template

`data/hospitals/template.json` is the smallest useful valid file: one floor, three rooms, eight devices, one protected flow, two services, three patient groups. Keep it valid; a test checks it.
