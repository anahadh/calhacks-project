# Hippocra.tech

> An autonomous, multi-agent hospital cyber-defense simulator. Hospitals can watch a ransomware attack spread through their building, watch AI agents argue out a defense, and see the solution contain the attack without breaking patient care.

Cal Hacks 13.0 scope. This document is the build target. If a feature is not in [Hackathon scope](#hackathon-scope), do not build it.

All hospital data is synthetic. Never use, ask for, or accept real patient data.

**Sponsor tracks: Fetch.ai, Armadin, Microsoft, Factory, Anthropic, SpacetimeDB.** No other sponsor tracks are in scope.

---

## Table of Contents

1. [One-Liner](#one-liner)
2. [The Three Things Judges Must See](#the-three-things-judges-must-see)
3. [Event and Judging](#event-and-judging)
4. [Hackathon Scope](#hackathon-scope)
5. [The Problem](#the-problem)
6. [Who It Is For](#who-it-is-for)
7. [What Makes It Different](#what-makes-it-different)
8. [Core Features](#core-features)
9. [The Agents](#the-agents)
10. [Simulation in SpacetimeDB](#simulation-in-spacetimedb)
11. [Watchers](#watchers)
12. [Policy Optimizer](#policy-optimizer)
13. [Sponsor Plan](#sponsor-plan)
14. [System Architecture](#system-architecture)
15. [Tech Stack](#tech-stack)
16. [Design Language](#design-language)
17. [Data Model](#data-model)
18. [API Surface](#api-surface)
19. [Build Plan](#build-plan)
20. [Demo Script](#demo-script)
21. [Devpost Write-Up Draft](#devpost-write-up-draft)
22. [Risks](#risks)
23. [Out of Scope](#out-of-scope)
24. [Open Questions](#open-questions)
25. [Decision Log](#decision-log)
26. [Glossary](#glossary)

---

## One-Liner

Load a synthetic hospital, infect one device, and watch ransomware spread through a 3D model of the building, tick by tick. Then watch four Fetch.ai agents talk through a defense:
- an **Inventory Agent** blocks any change to a device nobody has identified, and asks a human;
- a **Flow Agent** proposes cuts to risky connections;
- a **Clinical Workflow Agent** rejects anything that breaks patient care;
- a **Sign-off Coordinator** finds alternatives and routes the result to the right people.

Each agent handles one of the four reasons real segmentation plans stall: an incomplete inventory, unclear flows, fragile clinical workflows, and slow sign-off. The finished plan is shown as a solution view: the same attack replayed side by side, with and without the fix. Humans approve before anything is exported.

---

## The Three Things Judges Must See

Every design and build decision serves these three moments. If something doesn't make one of them clearer, it waits.

1. **The attack, visibly spreading.** Infection travels along network links, devices flash and turn orange, rooms fill, services go dark, patients' badges change, and ambulances turn away. See [7.3](#73-watch-the-attack-spread).
2. **The agents, visibly talking.** Every message between agents animates from sender to receiver and lands in a readable conversation. The 3D scene highlights whatever each message is about. See [7.4](#74-watch-the-agents-talk).
3. **The solution, visibly working.** A split screen replays the same attack with and without the plan, in lockstep. The zones, kept connections and cut connections are drawn on the building, and the before/after numbers sit underneath. See [7.6](#76-see-the-solution).

---

## Event and Judging

| Item | Value |
|---|---|
| Event | Cal Hacks 13.0, Palace of Fine Arts, San Francisco, Oct 23–25, 2026 |
| Team | 1–4 people. All work starts during the event (MLH Code of Conduct) |
| Draft | Devpost draft submitted by **Saturday night** |
| Deadline | Devpost by **Sunday Oct 25, 9:00 AM PST**. Late projects are not judged |
| Judging | Table judging, **Sunday 10:30 AM–12:30 PM**. **The whole team stays at the table the entire time** |
| Pitch | The official guide says about **2 minutes, with a live demo (required)**. Our script runs 3:00; see [Demo Script](#demo-script) for the 2-minute cut |
| General factors | Impact, quality, technical complexity, creativity |
| Sponsor criteria | Posted on the Live Site at the start. Re-check every track marked **confirm** |

---

## Hackathon Scope

The loop: **load a hospital → infect a device → watch it spread → watch the agents talk → see the solution contain the same attack → a new challenge comes in, and the agents adapt → humans approve → export.**

**In**

- The demo hospital, or a user-uploaded hospital JSON file that passes validation ([HOSPITAL_SCHEMA.md](hippocratech/HOSPITAL_SCHEMA.md)).
- A highly visual 3D hospital, with a 2D fallback, and a live dashboard.
- **The simulation runs inside SpacetimeDB.** A scheduled reducer advances each tick, and every laptop subscribes to the same live state.
- Four Fetch.ai uAgents on Agentverse, connected to SpacetimeDB through **watchers**. Their whole conversation is stored and animated live.
- A graph-based policy optimizer, Factory Droid writing and testing policy files in a sandbox, and Claude for proposals, explanations and questions.
- A solution view: synchronized before/after replay, the zones drawn on the building, and the plan in plain language.
- **New challenge:** an unidentified device appears, the agents pause to ask a human, then adapt.
- Human review: role approvals, then a memo and ruleset export.

**Out**

See [Out of Scope](#out-of-scope).

---

## The Problem

- Hospital networks connect hundreds of systems: MRIs, EHRs, infusion pumps, lab equipment. One compromised device can spread ransomware across the hospital and delay patient care.
- Ransomware in hospitals is a patient-safety problem. A Medicare-claims study found in-hospital mortality rose 34–38% for patients already admitted when an attack began (Neprash, McGlave & Nikpay, *American Economic Journal: Economic Policy*). This goes in the pitch, cited. It never appears in the simulation.
- Segmentation contains the spread, but blocking too much is its own outage. Isolating an MRI stops ransomware, and it also stops radiologists from getting the scans.
- Real plans stall in four places: an incomplete asset inventory, unclear communication flows, fragile clinical workflows, and slow cross-team sign-off.

---

## Who It Is For

**Named community:** security, clinical engineering, and operations teams at mid-size community hospitals that can't afford segmentation consultants.

| Role | Needs |
|---|---|
| Security | Contain the blast radius |
| Clinical engineering | Keep device and imaging workflows working; identify unknown devices |
| Operations | Keep scans, surgeries, and the ER moving |

---

## What Makes It Different

- Existing platforms (Illumio, Claroty, ORDR, Akamai Guardicore) find risky connections and enforce isolation. Hippocra.tech is the planning layer that comes before them.
- **Agents with genuinely conflicting objectives** have to negotiate, and you can watch them do it. The Flow Agent wants fewer connections. The Clinical Workflow Agent protects the connections care depends on. The Inventory Agent refuses to act on devices nobody can name.
- **Agents bring humans in mid-negotiation.** When the inventory is unclear, they pause and ask a person instead of guessing.
- **Every policy is tested** against the same simulated attack. Nothing rests on an LLM's say-so.
- **Impact is in clinical terms** (patients, procedures, services), so administrators and clinicians can weigh the tradeoffs together.

---

## Core Features

### 7.1 Load a hospital

- Two cards: **Demo hospital** and **Upload JSON** (up to 2 MB, validated in the browser, then again in the server reducer).
- Every error is listed with its JSON path, and nothing loads from an invalid file.
- A valid file shows a summary, then **Start session**.
- Unknown fields are rejected, and patients are counts with no identity fields.

### 7.2 The 3D hospital

- A dollhouse cutaway: floors stacked with a gap, low walls, labeled rooms.
- Detailed models for key equipment (MRI, CT, server rack, nurse station, infusion pump, anesthesia machine), and a small box for every other device, so the drawn count equals the real count.
- Patient figures in beds, on OR tables, and in waiting areas, capped at 12 per room with a `+N` label.
- Room chips showing `infected / total`, and network arcs floating above the building. Only active arcs are drawn; others appear on hover.
- A 2D top-down fallback that shows the same live state.

### 7.3 Watch the attack spread

Click a device to make it patient zero, then press **Run**. The simulation runs in SpacetimeDB (see [Simulation in SpacetimeDB](#simulation-in-spacetimedb)), and every laptop renders the same live state.

What judges see each tick (one tick is 15 simulated minutes; at 1× a tick lasts 1 second):

| Element | Visual |
|---|---|
| Spread | A bright pulse travels along the arc from the infecting device to its target over the tick. On arrival, the target flashes white, then turns orange and keeps a slow pulse |
| Failed attempts | A short pulse that fizzles halfway, so judges see the attack trying and failing |
| Rooms | The floor tint deepens as more of the room's devices are infected. The room chip counts up with a flip animation |
| Services | A service icon floats over its room. When the service goes down, the icon dims, gets a "down" badge, and a label pops up ("Radiology reading offline") |
| Patients | Figures change color and get badges: a clock for delayed, "!" for disrupted. ER diversion turns arriving ambulances around at the entrance |
| Event toasts | A short label anchored at the device in 3D ("PACS compromised"), also logged in the event feed |
| Camera | On the demo hospital, the camera follows the front of the infection, then pulls back to a wide shot. Anyone can take over with the mouse |
| Dashboard | Patients affected (delayed, disrupted, diverted) as the headline number, then devices compromised, services down, delayed procedures, and choke points, all counting up live |
| Timeline | A scrubber with event markers ("PACS falls") and a thin heat strip showing infected count over time |

Playback controls: play, pause, step, speed (0.5×, 1×, 2×, 4×), reset, and scrub. The presenter controls playback for everyone.

### 7.4 Watch the agents talk

Pressing **Defend**, or the end of a run, starts a negotiation round (see [The Agents](#the-agents)). The point of this feature is that judges can follow the agents' reasoning as a conversation.

**The Agent Room** (right panel, Agents tab; expands to a large overlay with one click):

- **Agent map:** the four agents as nodes in a diamond, with the Droid and a "Humans" node beside them. Each node shows the agent's name, role icon, and live status: idle, thinking (animated dots), speaking, or waiting for a human.
- **Messages in flight:** every message animates as a particle traveling along a line from sender to receiver. Its shape depends on type: proposal, accept, reject, revision, or question.
- **Conversation thread:** under the map, each message lands as a speech bubble from its sender. A bubble shows:
  - a one- or two-sentence Claude-written reason;
  - the constraint it adds, if it's a rejection;
  - an expandable payload with the rules, or the Droid's diff.
- **Round header:** "Round 2 of 4 · waiting for Clinical engineering", for example.
- **Readable pace:** messages are revealed no faster than one every 1.2 seconds, even if the agents work faster. **Skip to result** jumps to the end.

**The scene reacts to the conversation.** When a message arrives, the 3D hospital highlights what it is about:

| Message | Scene highlight |
|---|---|
| Flow Agent proposal | The connections it would cut flash as purple dashed lines; the zones it would create glow faintly |
| Clinical Workflow rejection | The protected flow it cites glows blue with a "keep" label (e.g. MRI → PACS: "Scans to radiologists") |
| Inventory rejection or question | The unidentified device gets a pulsing outline and a "?" marker |
| Droid test result | A small "tested" check on the candidate, with the patients-affected number for that candidate |
| Accepted recommendation | The zones settle into solid purple outlines |

**Questions to humans.** When an agent needs a fact it can't compute, a question card appears in the Agents tab and as a banner on every screen. For example: "Is `dev_unknown_7` in Imaging a workstation or a scanner?" Only allowed roles can answer. The round waits, then resumes, and the answer appears in the conversation as a message from the human.

**Recommendations.** Each finished round produces up to three recommendation cards. Each card shows:
- its rules in plain language;
- verified numbers on the same attack;
- each agent's verdict;
- a "why this works" explanation;
- the human roles that must sign off;
- a **Show the solution** button.

### 7.5 New challenge

- **Change conditions** offers three presets:
  - an unidentified device appears on the network in Imaging (`unknown_device_imaging`, the demo preset);
  - a vendor remote-access link to MRI 3 (`vendor_link_mri3`);
  - a device marked vulnerable (`mark_vulnerable_ehr`).
- The change appears in 3D (the new device drops in, outlined, marked "Unidentified"), and the agents reassess on their own.

**Done well:** the agreed policy is challenged, the agents pause to ask a human, adapt, and the solution view updates.

### 7.6 See the solution

**Show the solution** opens the solution view for a recommendation. It's the payoff of the demo.

- **Split screen, in lockstep:** left is "No segmentation," right is the chosen plan. Both run the same attack with the same seed in SpacetimeDB, tick by tick in sync. Judges watch the left side spread across both floors while the right side stops at the zone edge.
- **The plan on the building:**
  - zones as solid purple outlines with labels;
  - kept connections as thin blue lines labeled with their purpose ("Scans to radiologists");
  - cut connections as dashed gray lines with a ✕ where the infection was stopped.
- **The plan in words:** the rules in plain language. Hovering a rule highlights its zone and connections in 3D.
- **Before/after strip:** patients affected, devices compromised, services down, delayed procedures, protected flows broken, and rules, for both sides, with the difference called out (e.g. "212 → 9 patients affected").
- **What keeps working:** every protected flow and critical service, each with a check.
- **Sign-off:** the required roles and their status, with Approve, Concerns, or Block on each.

### 7.7 Review, approve, export

- **Shared session:** every laptop sees the same simulation, conversation, and solution live, because they all subscribe to the same SpacetimeDB state. Follow presenter is on by default.
- **Presence:** an avatar for each person, showing their name and role.
- **Review row:** each required role picks Approve, Concerns, or Block, with a reason.
  - Required roles are per recommendation. The Sign-off Coordinator picks them from what the policy touches: Security always; Clinical engineering for imaging, clinical devices or protected flows; Operations for the ER, OR, ICU or pharmacy.
  - The agents' agreement never counts as approval. **Ready to deploy** needs every required human role.
- **Export:** a one-page memo (drafted by Claude, approved by a human) plus the ruleset as allow-list JSON and as ACL-style text.

---

## The Agents

Four independent Fetch.ai **uAgents**, registered on **Agentverse**, talk to each other with typed messages. **Watchers** connect them to the live SpacetimeDB world (see [Watchers](#watchers)), so every message is stored and every laptop sees the conversation as it happens.

Agents decide with code and explain with Claude. Every accept, reject, or question is computed from the inventory, simulation results, and constraints. Claude writes the text in plain language.

**Why these four.** Human-led segmentation plans stall in four places, and each agent owns one:

| Agent | Stall point | Objective | Decides with | Can |
|---|---|---|---|---|
| **Inventory Agent** | Incomplete asset inventory | Never act on a device nobody can name | Code: devices with `type: "unknown"`, missing make or model, no flows, or unclear criticality | Reject with `confirm_device`; send a `Question` to humans |
| **Flow Agent** | Unclear communication flows | Minimize spread | Rates flows by spread risk and use (`observed`). Gets candidates from the optimizer, with Claude for alternatives. Each candidate goes to the Droid to be written and tested | Propose, revise |
| **Clinical Workflow Agent** | Fragile clinical workflows | Keep care running | Rejects if a protected flow is removed or a critical service is down past `MAX_SERVICE_LOSS` | Accept; reject with `keep_flow` or `keep_service` |
| **Sign-off Coordinator** | Slow, unclear sign-off | Reach a plan humans can approve | Runs rounds, merges constraints, pauses for human answers, picks the required roles | Start, pause, resume rounds; publish recommendations. **Cannot approve** |

**Message models** (in `agents/protocol.py`, mirrored in SpacetimeDB's `agent_message` table):

| Model | Fields |
|---|---|
| `Proposal` | round, policy id, rules, rationale, test result |
| `Verdict` | round, policy id, agent, accept or reject, reason, constraint |
| `Constraint` | kind (`keep_flow`, `keep_service`, `confirm_device`, `max_rules`), target ids |
| `Revision` | round, policy id, diff, test result |
| `Question` | round, agent, device or flow id, text, choices, allowed roles |
| `Answer` | question id, author, role, choice |
| `Recommendation` | policy, test result, verdicts, explanation, required roles |

**Round:**
1. The Inventory Agent checks the infection path and sends `Question`s for anything unidentified.
2. The Coordinator asks the Flow Agent for a proposal. The Flow Agent asks the optimizer, and the Droid writes and tests the candidate.
3. The Clinical Workflow and Inventory agents return verdicts.
4. The Coordinator adds each rejection's constraint and asks the Flow Agent to revise.
5. If a question is open, the round pauses (`waiting_for_human`) until a human answers, then resumes.

The round ends when both guardians accept, or after `MAX_ROUNDS = 4`. The Coordinator attaches the required roles and publishes the recommendation.

**Human approval:** agents create and test policies only inside the simulation. Nothing reaches a real network. Approval and export are human actions.

---

## Simulation in SpacetimeDB

The simulation is the live, shared world. It runs inside the SpacetimeDB module, so every laptop and every watcher sees the same state at the same moment.

**One engine, two uses.**
- The spread logic is one library, `sim-core`.
- The SpacetimeDB module uses it to run **visible runs** tick by tick: the baseline, "Run this," and both sides of the solution view.
- The `hippo-sim` command-line tool is built from the same library. The Droid and the agents use it for **test runs**, which are many and fast and are never animated.
- A candidate's numbers from `hippo-sim` always equal what the visible run shows.

**How a visible run works:**
- `run_start` creates a `run` row: hospital, seed, patient zero, policy (or none), challenge set, speed. It writes tick 0.
- A **scheduled reducer**, `run_tick`, fires every `TICK_MS / speed`. It advances one tick using the seeded RNG state stored on the run, and writes:
  - `device_state` (infected, infected at tick, infected by);
  - `service_state`;
  - `patient_state`;
  - `spread_attempt` rows (from, to, success), which drive the pulses and fizzles;
  - `sim_event` rows (e.g. "PACS compromised").
- Each tick also appends a compact `tick_snapshot`, so scrubbing and replay read history without re-running.
- Pause, speed, step, and reset are reducers. Only the presenter can call them while others are following.
- The solution view starts two runs with a shared `pair_id`. `run_tick` advances both in the same reducer call, so they stay in lockstep.

**Spread model:**

```
p = min(P_CAP, BASE[protocol] × (target.vulnerable ? VULN_MULT : 1.0))
```

| Protocol | `BASE` | Both ways |
|---|---|---|
| smb | 0.60 | yes |
| rdp | 0.45 | yes |
| http / https | 0.20 | no |
| dicom | 0.10 | no |
| hl7 | 0.08 | no |
| other | 0.05 | no |

`VULN_MULT = 1.8` and `P_CAP = 0.95`. These values are illustrative and labeled as such in the UI.

**Determinism:** a mulberry32 RNG seeded from the run's seed, stored on the run, and edges tried in sorted order. The same inputs give the same ticks, in the module and in `hippo-sim`. A test asserts they match.

**Impact:**
- **Services:** a service is down while any device it depends on is infected.
- **Procedures:** delayed procedures are counted from the patient groups whose services are down.
- **Patients:** escalate `ok → delayed → disrupted → diverted`. Only `er` patients reach `diverted`.
- **Choke points:** each device's share of the downstream infections.

**Policies:** a policy is a list of label-based allow rules. Applying it removes every flow no rule allows, and reports `protectedBroken`.

**Hard rule:** no deaths or clinical outcomes, anywhere.

---

## Watchers

A **watcher** is a long-running SpacetimeDB client. It subscribes to specific tables and acts when rows change. Watchers are how the Fetch.ai agents see and act in the live world without polling.

| Watcher | Subscribes to | Does |
|---|---|---|
| **Round watcher** | `run` (status → `done`), `defend_request`, `challenge` | Wakes the Sign-off Coordinator uAgent to start or reassess a round |
| **Answer watcher** | `question` (answer set) | Sends the `Answer` to the Coordinator, which resumes the round |
| **Message relay** | — (receives from uAgents) | Every message a uAgent sends or receives is written to `agent_message` through `agent_message_add`. The UI animates it from there |
| **Status relay** | — (receives from uAgents) | Writes each agent's live status (idle, thinking, speaking, waiting) to `agent_status`, which drives the Agent Room nodes |

- Watchers run in one Node process, `apps/watcher`, using the SpacetimeDB TypeScript SDK. They connect with the server identity stored in the module's `config` table, and only that identity can call the server-only reducers.
- **Agent-to-agent traffic still goes over Fetch.ai** (uAgents messaging via Agentverse). The relay mirrors it into SpacetimeDB, so the conversation is persistent and visible.
- **Agents read the live world through the watcher.** For example, the Clinical Workflow Agent can ask for the current `service_state` of a visible run.

---

## Policy Optimizer

A graph algorithm in `packages/optimizer` (TypeScript), with a `hippo-opt` CLI.

- **Input:** the hospital graph, the infected set from the baseline run, the critical services, and constraints (`keep_flow`, `keep_service`, `confirm_device`, `max_rules`).
- **Method:** group devices into zones by room zone and device type. Find a small set of cross-zone edges whose removal separates the infected zone from the critical-service devices. Never cut a `keep_flow` edge, or an edge touching a `confirm_device` device. Prefer cutting SMB and RDP first.
- **Output:** a candidate policy and its cut edges. Deterministic.

The optimizer finds candidates, and `hippo-sim` judges them. The optimizer never reports impact numbers.

---

## Sponsor Plan

Six tracks. Nothing else is in scope.

| Track | What they judge (confirm on Live Site) | How Hippocra.tech meets it | Feature |
|---|---|---|---|
| **Fetch.ai** | Meaningful use of uAgents and Agentverse; agents that communicate and act on their own | Four uAgents on Agentverse, each owning a real reason segmentation stalls, with conflicting goals. Watchers wake them from live SpacetimeDB events. Their conversation is animated live, including pauses to ask humans | F1 |
| **Factory: Best Use of the Droid SDK** | Droid does real work in the running product; a designed trigger; scoped control; visible plans, steps, diffs, and results | The Flow Agent sends each candidate to a Droid. In a sandbox, the Droid writes the policy file, runs `hippo-sim`, and refines it. Its diffs appear as bubbles in the agent conversation | F2 |
| **Anthropic** | A named community, a real problem, it works, and thoughtful use of Claude, including where it could go wrong | Named community above, plus a quote from a real hospital IT/biomed person. Claude writes the Flow Agent's alternatives, every agent's reasons, the questions to humans, and the memo. Verdicts and numbers come from code. Humans approve | F2, F3 |
| **SpacetimeDB** | **Confirm**. Earlier criteria: SpacetimeDB must be the **core** real-time backend, not an add-on; they like shared simulations, live dashboards, multi-user planning tools, and AI agents coordinating in persistent shared state | **The simulation itself runs in SpacetimeDB**, as scheduled reducers that advance ticks every laptop subscribes to. Watchers connect the Fetch.ai agents to that world, and the whole agent conversation, the human questions, and the approval gate live there too | Base, F1, F3 |
| **Microsoft: Built for the Real World** + Customer Impact Award | Customer understanding, measurable usefulness, path to production, responsible design, end-to-end | The solution view shows before and after on the same attack. Upload a real inventory, export a ruleset. Synthetic data, no outcome simulation, human approval, no real-network access | F3, F4 |
| **Armadin: Best Security Hack** | **Confirm** | The whole product: a visible attack path, a defense the agents argue out, and a proof that it holds | All |

General Cal Hacks prizes we qualify for with no extra build: Best People-First Hack, Most Technically Complex Hack, Most Creative Hack, Overall.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│ BROWSER (Next.js + React Three Fiber) — one per laptop               │
│ 3D hospital · dashboard · Agent Room · solution view · review        │
│ subscribes to SpacetimeDB; renders state, never computes spread      │
└───────────┬────────────────────────────────────────┬────────────────┘
            │ SpacetimeDB SDK (subscriptions,        │ POST /api/memo, /api/export
            │ reducer calls)                         │
┌───────────▼─────────────────────────────┐  ┌──────▼──────────────────────┐
│ SpacetimeDB module (spacetime/)          │  │ Next.js Node server         │
│ sim-core inside: run_start, run_tick     │  │ Droid runner (sandbox,      │
│ (scheduled), device/service/patient      │  │ policies/, hippo-sim)       │
│ state, spread_attempt, tick_snapshot     │  │ Claude memo · export        │
│ session, presence, agent_message,        │  └──────▲──────────────────────┘
│ agent_status, question, recommendation,  │         │ /api/droid
│ review                                   │         │
└───────────▲─────────────────────────────┘         │
            │ subscriptions + server reducers        │
┌───────────┴─────────────────────────────┐         │
│ Watchers (apps/watcher, Node)            │         │
│ round · answer · message relay · status  │         │
└───────────▲─────────────────────────────┘         │
            │ REST (wake, resume) / relay            │
┌───────────┴───────────────────────────────────────┴──────────────────┐
│ Fetch.ai uAgents (Python), registered on Agentverse                   │
│ Inventory · Flow · Clinical Workflow · Sign-off Coordinator           │
│ talk over uAgents messaging · call hippo-sim, hippo-opt, Claude, Droid│
└───────────────────────────────────────────────────────────────────────┘
```

- **The browser renders; SpacetimeDB simulates.** Two laptops agree by construction, because they read the same rows.
- **One engine:** `sim-core` runs in the module and in `hippo-sim`.
- **The demo runs on our laptops.** The SpacetimeDB module is published to Maincloud (or `spacetime start` locally as a fallback). Watchers, the Node server, and the agents run on the demo laptop.
- **Secrets stay server-side:** the Node server, the watcher, and the agents' environment.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js, React, TypeScript, Tailwind, IBM Plex |
| 3D | React Three Fiber, drei, postprocessing (bloom on infected devices) |
| Simulation | `sim-core` in the SpacetimeDB module language (Rust by default; TypeScript if the starter pack confirms TypeScript modules), plus the `hippo-sim` CLI built from it |
| Shared state and live sim | SpacetimeDB (module in `spacetime/`, client bindings from `spacetime generate`) |
| Watchers | Node + SpacetimeDB TypeScript SDK (`apps/watcher`) |
| Agents | Fetch.ai uAgents (Python), Agentverse |
| Optimizer | TypeScript (`packages/optimizer`), `hippo-opt` CLI |
| Model | Claude (Anthropic SDK) |
| Policy files | Factory Droid SDK, run from a Next.js Node route |
| Validation | zod (TS), Pydantic (Python) |

Skip auth, Postgres, Redis, Docker, physics, rigged characters, and PDF libraries.

---

## Design Language

| Token | Hex | Use |
|---|---|---|
| Background | `#0B0F14` | App |
| Healthy device | `#5AA9FF` | Uninfected; kept connections in the solution view |
| Infected device | `#FF6B3D` | Infected devices, spread pulses |
| Patient OK | `#E8ECF1` | Figures |
| Patient delayed | `#F5B942` + clock badge | Delayed |
| Patient disrupted | `#FF4D6D` + "!" badge | Disrupted, diverted |
| Segment zone | `#B79CFF` | Zones, proposed cuts |

- Use blue and orange, never red and green, and always pair color with a badge or shape.
- **Agents:** each has a neutral node and an icon (Inventory: tag; Flow: network; Clinical Workflow: heartbeat line; Coordinator: checklist). Message particles use one shape per type (proposal ◆, accept ●, reject ✕, revision ↻, question ?), so type never depends on color alone.
- **Motion budget:** spread pulses, device flashes, room tints, agent message particles, the camera follow, and the split-screen replay. Nothing else animates.
- Fonts: IBM Plex Sans, plus IBM Plex Mono for numbers and ids.
- Lead with the human number. Never write "deaths," "lives," "fatal," or "mortality."
- The reference design is the canvas "Hippocra.tech screens."

---

## Data Model

SpacetimeDB tables (in `spacetime/`):

```
session         { id, hospital, hospitalSummary, presenterId, activeRunId, challenges[],
                  roundState: idle|running|waiting_for_human|done, memo { draft, status, approvedBy } }
run             { id, sessionId, pairId?, seed, rngState, patientZero, policyId?, challenges[],
                  tick, status: running|paused|done, speed, startedAt }
device_state    { runId, deviceId, infected, infectedAtTick?, infectedBy? }
service_state   { runId, serviceId, down, downSinceTick? }
patient_state   { runId, groupId, state }
spread_attempt  { runId, tick, from, to, flowId, success }
sim_event       { runId, tick, kind, targetId, text }
tick_snapshot   { runId, tick, infectedBitset, servicesDown[], patientCounts }
presence        { sessionId, name, role, focus, following, lastSeen }
agent_message   { sessionId, round, seq, from, to, type, payload, reason, createdAt }
agent_status    { sessionId, agent, status: idle|thinking|speaking|waiting, updatedAt }
question        { sessionId, round, agent, targetId, text, choices[], allowedRoles[],
                  answer { choice, author, role }?, createdAt }
recommendation  { sessionId, round, name, rules[], explanation, diff, verified { … },
                  agentVerdicts[], requiredRoles[], status: draft|ready }
review          { sessionId, recommendationId, role, author, verdict, reason, createdAt }
config          { serverIdentity }
```

- `recommendation.status` is written only by the `review_submit` reducer.
- `device_state`, `service_state` and `patient_state` hold the current tick only. `tick_snapshot` holds history for scrubbing.

---

## API Surface

**SpacetimeDB reducers:**

```
session_create · presence_heartbeat · set_presenter
run_start · run_tick (scheduled) · run_pause · run_resume · run_set_speed · run_step · run_reset · run_seek
solution_start (two runs, shared pair_id)
defend_request · challenge_add
agent_message_add (server) · agent_status_set (server) · question_add (server) · question_answer (allowed roles)
recommendation_upsert (server) · round_state_set (server)
review_submit · memo_save_draft (server) · memo_approve
```

**Next.js Node routes:**

```
POST /api/droid   { sessionId, candidate }  → called by the Flow Agent; Droid writes + tests in the sandbox
POST /api/memo    { sessionId }             → Claude drafts the memo, checks numbers, calls memo_save_draft
GET  /api/export/[sessionId]                → approved memo + ruleset
```

**Agents:** the Sign-off Coordinator exposes REST handlers `start_round`, `reassess`, and `resume`, called by the watchers. Agent-to-agent traffic goes over uAgents messaging via Agentverse.

---

## Build Plan

**Base app first (lead).** These are built fast with coding agents, before anything is handed off:
- the hospital schema and validator, plus the demo hospital;
- `sim-core`, plus the SpacetimeDB module with `run_start` and the scheduled `run_tick`;
- `hippo-sim`;
- the 3D scene subscribed to live state;
- basic dashboard and playback;
- a hand-written test policy.

When two laptops show the same spreading attack, the shared contracts are frozen: the hospital schema, the table and reducer signatures, the `sim-core` interface, `hippo-sim` flags, and the message models. Then the features are handed off.

**Features:**

| Feature | Owner | What it covers | Sponsor(s) |
|---|---|---|---|
| **F1 Agent network and conversation** | Teammate 1 | The four uAgents; the watchers; `agent_message` and `agent_status`; the Agent Room (map, particles, thread, scene highlights); questions and answers; challenge reassessment; a cached demo round | **Fetch.ai**, **SpacetimeDB** |
| **F2 Policy engine** | Teammate 2 | The optimizer, the Droid sandbox and `/api/droid`, Claude's proposals and explanations, recommendation cards | **Factory**, **Anthropic** |
| **F3 Review and export** | Teammate 3 | Join and roles, presence, follow presenter, the review row and gate, the memo, the export | **SpacetimeDB**, **Microsoft**, **Anthropic** |
| **F4 Visual simulation and solution view** | Lead after base (Teammate 3 helps) | Spread pulses and fizzles, device flashes, room tints, service icons, patient badges, ambulances, event toasts, camera follow; the solution view (lockstep split screen, plan on the building, before/after strip); the challenge UI; the 2D fallback | **Microsoft**, **Armadin**, general prizes |
| **Pitch and integration** | Lead | Merges, the real-person quote, README, Devpost draft by Saturday night, video, rehearsals | **Anthropic**, **Microsoft**, **Armadin** |

**Milestones, in order:**
1. A spreading attack runs in SpacetimeDB, and two laptops show it identically.
2. The agents finish one round with a rejection and a revision, visible in the Agent Room.
3. The solution view shows the split-screen replay containing the attack.
4. Approval and export work. Record the first demo video.
5. The new-challenge beat works, including the human question.

**If behind, cut in this order:**
1. The 3D key-equipment models (keep boxes).
2. The second and third challenge presets.
3. Follow presenter.
4. The memo (keep the ruleset export behind the gate).
5. Human questions mid-round (the Inventory Agent rejects and the device stays uncut).

**Never cut:** the spread visuals, the Agent Room conversation, the solution view, human approval before export, and the 2D fallback.

---

## Demo Script

The brief's script runs **3:00**. The official guide says about **2 minutes**. For a 2-minute slot, trim beat 1 and cut beat 5 to one sentence.

1. **(0:00–0:30) The hospital.** The 3D hospital, everything healthy and blue. "[Quote from the hospital IT/biomed person.] One bad rule can stop scans reaching radiologists, so hospitals don't segment."
2. **(0:30–1:00) The attack.** Infect MRI 2. Pulses race along the links, devices flash orange, PACS falls ("Radiology reading offline"), and the camera follows the infection across both floors. Ambulances turn away at the ER. "212 patients affected." *(Placeholder: use the real number.)*
3. **(1:00–1:40) The agents talk.** Open the Agent Room. Messages fly between the agents:
   - the Flow Agent proposes, and the cut lines flash in the building;
   - the Clinical Workflow Agent **rejects** it, and MRI → PACS glows "keep: scans to radiologists";
   - the Droid's diff lands in the thread, and the Flow Agent revises.
4. **(1:40–2:20) The solution.** Press **Show the solution**. On the split screen, the left side spreads everywhere while the right side stops at the purple zone edge, tick for tick. "212 → 9 patients affected. Every protected flow still working." *(Placeholder.)*
5. **(2:20–3:00) A new challenge.** An unidentified device drops into Imaging. The Inventory Agent pauses: "Is this a workstation or a scanner?" Clinical engineering answers on the second laptop. The agents resume, update the plan, and route it to Security and Clinical engineering, who both approve. Export. "Agents do the homework. Humans decide."

**Backup:** a recorded run, plus a cached agent round for the demo seed.

---

## Devpost Write-Up Draft

### Inspiration
[Quote.] Segmentation stops ransomware from spreading, but blocking the wrong connection is its own outage, so hospitals stall.

### What it does
Hippocra.tech shows ransomware spreading through a 3D hospital in real time, and reports the damage in patients and procedures. Four Fetch.ai agents then argue out a defense on screen, one for each reason real plans stall: inventory, flows, clinical workflows, and sign-off. They stop to ask humans when they hit a device nobody can name. A graph optimizer finds candidates, a Factory Droid writes and tests each one, and Claude explains every move. The solution view replays the same attack side by side, with and without the plan. Humans approve and export the ruleset.

### How we built it
[The simulation runs inside SpacetimeDB as scheduled reducers, so every laptop watches the same live attack. Watchers connect it to Fetch.ai uAgents on Agentverse. The same engine is compiled to a CLI that the agents and the Droid use for fast tests. Claude handles proposals and explanations. Built with Next.js and React Three Fiber.]

### Challenges / What we learned
[Fill in.]

### What's next
Import from real asset inventories, connect to existing segmentation tools, and calibrate the spread model against published incident data.

---

## Risks

| Risk | What to do |
|---|---|
| The sim in SpacetimeDB is late | It's the base app's critical path. Keep `sim-core` small; animate in the client from `spread_attempt` rows |
| Ticks stutter over venue Wi-Fi | Run SpacetimeDB locally (`spacetime start`) on the demo laptop as a fallback; test on a phone hotspot |
| The module language is unfamiliar (Rust) | Check whether the starter pack supports TypeScript modules first. Keep `sim-core` small either way |
| Agents are slow or flaky on stage | A cached demo round, replayed through the same Agent Room at readable pace, labeled "Cached run" |
| The conversation is too fast to follow | Minimum 1.2 s per message, plus **Skip to result** |
| The LLM makes up numbers | Verdicts and numbers come from `hippo-sim`; Claude only writes explanations |
| A teammate is missing at judging | The whole team stays at the table from 10:30 AM |

---

## Out of Scope

- Any sponsor track other than Fetch.ai, Armadin, Microsoft, Factory, Anthropic, and SpacetimeDB.
- Real network access, discovery, or enforcement. Agents act only inside the simulation.
- Real patient data, and simulated deaths or clinical outcomes.
- Accounts, auth, and game elements.
- Voice, threat-intel scraping, log analytics.
- An in-app hospital editor, formats other than JSON, physics, and pathfinding.

---

## Open Questions

| Question | Default |
|---|---|
| SpacetimeDB module language | Rust, unless the starter pack confirms TypeScript modules |
| How the Coordinator picks required roles | Security always; Clinical engineering for imaging, clinical devices or protected flows; Operations for ER, OR, ICU or pharmacy |
| `MAX_SERVICE_LOSS` threshold | No critical service (ICU, ER, OR, imaging reading) down for more than 2 ticks |
| Live Site criteria for Fetch.ai, Armadin, Microsoft, Factory, SpacetimeDB, and Anthropic's prize | Re-check Friday evening and record the results here |
| Final pitch length: 2:00 (guide) or 3:00 (our script) | Rehearse both |

---

## Decision Log

| Date | Decision |
|---|---|
| Oct 22, 2026 | Product name **Hippocra.tech**; upload in scope; one simulation engine |
| Oct 23, 2026 | Collaborative review; human approval gate; table judging with the whole team present |
| Oct 23, 2026 | Sponsor tracks: Fetch.ai, Armadin, Microsoft, Factory, Anthropic, SpacetimeDB. All others dropped |
| Oct 23, 2026 | Agents mapped to the four places human-led segmentation stalls: Inventory, Flow, Clinical Workflow, Sign-off Coordinator. `Question`/`Answer` messages; per-recommendation required roles |
| Oct 23, 2026 | Claude powers the Flow Agent's alternatives and all explanations; the Droid writes and tests policy files for the Flow Agent |
| Oct 23, 2026 | **The simulation runs in SpacetimeDB** (scheduled `run_tick`), replacing the browser-only sim. The browser renders subscribed state. `sim-core` also builds `hippo-sim` for fast agent and Droid tests |
| Oct 23, 2026 | **Watchers** (SpacetimeDB subscription clients) connect the Fetch.ai agents to the live world and mirror their conversation into `agent_message` |
| Oct 23, 2026 | Three must-see moments: the visible spread, the visible agent conversation (Agent Room), and the solution view (lockstep split screen) |
| Oct 23, 2026 | `implementation-steps.md` removed. The build plan lives in this spec, plus the owner and file map in `hippocratech/CODE_REFERENCE.md` |

---

## Glossary

- **uAgent.** A Fetch.ai agent process; ours are registered on Agentverse.
- **Watcher.** A long-running SpacetimeDB client that subscribes to tables and acts when rows change.
- **Reducer.** A SpacetimeDB server function. A **scheduled reducer** runs on a timer; `run_tick` advances the simulation.
- **Visible run.** A simulation run inside SpacetimeDB that everyone watches. A **test run** is a fast `hippo-sim` run the agents and the Droid use, never animated.
- **Round.** One cycle of inventory check, proposal, Droid test, verdicts, constraints, and revision, pausing for human answers when needed.
- **Constraint.** What a rejecting agent requires: keep a flow, keep a service, confirm a device, stay under a rule count.
- **Question.** An agent asking a human for a fact it can't compute, usually what an unidentified device is.
- **Agent Room.** The UI that shows the agents as nodes, their messages in flight, and the conversation thread.
- **Solution view.** The lockstep before/after replay, with the plan drawn on the building.
- **Protected flow.** A flow that clinical engineering marks as must-keep.
- **Ready to deploy.** Every required human role approved it.
- **Tick.** 15 simulated minutes.
