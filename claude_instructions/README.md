# HSE / Conti propagation engine: write-up and test data

Handoff package for building the attack-propagation engine behind the backtest. It has no code yet, and no agent code (Fetch.ai agents are built separately).

## What's here

| Path | What it is |
|---|---|
| `IMPLEMENTATION.md` | The spec: data model, rules R1–R6 and D1–D3, clinical roll-up, determinism, agent interface, verification plan, build order |
| `data/scenarios/cuh_hospital.json` | Pre-incident snapshot (13 May 2021) of the simplified Cork hospital: 95 nodes (incl. switches and external links), each with a machine profile (OS, end-of-life, domain membership, protection, patch state, services); 97 links, 8 services, accounts, trust, posture, levers. Same graph as the Floor demo |
| `data/scenarios/hse_national_orgs.json` | Org-level snapshot: HSE + PwC letters + DoH, trusts, posture |
| `data/scenarios/hse_conti_campaign.json` | **Held-out** campaign with dated steps and the three historical defender actions. Planners must never read it |
| `data/scenarios/british_library_2023.json` | Small out-of-sample scenario from the British Library review |
| `data/ground_truth/hse_org_outcomes.csv` | Per org: targeted, date compromised, entry route, encrypted or not, defender action |
| `data/ground_truth/hse_timeline.csv` | Dated events from PwC |
| `data/ground_truth/hse_calibration_targets.json` | Numeric targets: 180 systems, 33 privileged accounts, 2,800+ servers, etc. |
| `data/ground_truth/cuh_press_outcomes.csv` | What CUH and nearby hospitals told the public, per service |
| `data/ground_truth/cross_incident_patterns.csv` | The same rule seen in other incidents (British Library, Waikato, Düsseldorf, Newfoundland) |
| `data/tests/calibration.yaml` | Expected outcomes for checks 1–6 |
| `data/hospitals-real/` | 49 HSE acute hospitals with 2021 group and coordinates (Wikipedia, CC BY-SA) |
| `SOURCES.md` | Where every fact comes from |

## Provenance tags

`R` reported in the PwC review · `P` public record (press, other reviews) · `I` inferred · `S` synthetic reconstruction · `X` redacted, never filled (AV product, IR provider, CVE, hospital letter identities, patient zero, ransom amount).

PwC hospital letters are never mapped to real hospitals. IPs are RFC 5737 documentation ranges.

## Safety

The model is abstract and defensive. Techniques are ATT&CK labels on state changes; nothing here runs, describes or enables a real attack.
