# Team brief

The short version for Cal Hacks 13.0. The product and the build plan are in [`../Hippocratech.md`](../Hippocratech.md).

Updated Friday, Oct 23, 2026.

## Status right now

- Nothing is built. The spec, the schema, the UX rules, and a design canvas ("Hippocra.tech screens") exist.
- **Sponsor tracks: Fetch.ai, Armadin, Microsoft, Anthropic, SpacetimeDB.** Nothing else.
- **The simulation runs inside SpacetimeDB.** Watchers connect it to the Fetch.ai agents.
- **Open:** the required-roles rule; `MAX_SERVICE_LOSS`; Live Site criteria; pitch length (the guide says 2:00, our script is 3:00).

## What judges must see

1. **The attack, visibly spreading.** Pulses race along network links, devices flash orange, services go dark, and ambulances turn away. The same view is live on both laptops.
2. **The aggregate fix, visibly negotiated.** After the attack (not during it), the human presses **Create aggregate fix**. Messages fly between the four agents in the Agent Room and land as a readable conversation. The building highlights what each message is about, and the agents stop to ask a human about an unidentified device when needed.
3. **The solution, visibly working.** A split screen replays the same attack with and without the plan. The left side spreads everywhere; the right stops at the purple zone edge.

## How the build works

1. **Base app (lead).** The schema, the demo hospital, `sim-core`, the SpacetimeDB module with the scheduled `run_tick`, `hippo-sim`, and a 3D scene subscribed to live state. When two laptops show the same spreading attack, the shared contracts freeze.
2. **Handoff.** Each teammate takes their feature and works only in their files ([`CODE_REFERENCE.md`](CODE_REFERENCE.md)).
3. **Integration.** The lead merges, builds F4, and runs the pitch.

## Who owns what

| Person | Feature | Sponsor(s) | Prep while the base app is built |
|---|---|---|---|
| Lead | Base app, F4 Visual simulation and solution view, pitch | SpacetimeDB, Microsoft, Armadin, Anthropic | — |
| Teammate 1 | F1 Agent network and conversation (uAgents, watchers, Agent Room) | **Fetch.ai**, **SpacetimeDB** | Register a uAgent on Agentverse; build a watcher that subscribes to a test table; write `AGENT_NOTES.md` |
| Teammate 2 | F2 Policy engine (optimizer, Claude) | **Anthropic** | Draft the Claude prompts; sketch the optimizer's zone graph on the demo hospital |
| Teammate 3 | F3 Review and export (then helps F4) | **SpacetimeDB**, **Microsoft**, **Anthropic** | Read the SpacetimeDB starter pack; memo template and ACL format |

## Milestones, in order

1. A spreading attack runs in SpacetimeDB, and two laptops show it identically. Team target: Saturday morning.
2. After a completed baseline run, **Create aggregate fix** starts a round with a rejection and a revision, visible in the Agent Room.
3. The solution view shows the split-screen replay containing the attack.
4. Approval and export work. Record the first demo video.
5. The new-challenge beat works, including the human question.

## Hard deadlines (event)

| When (PST) | What |
|---|---|
| Saturday night | Devpost **draft** submitted |
| Sun Oct 25, 9:00 AM | Final Devpost. Late projects are not judged |
| Sun 10:30 AM–12:30 PM | Table judging. **The whole team stays at the table** |

## Setup

1. Run `npm install`, then `cp .env.example .env.local`, then fill in the keys.
2. Run `spacetime publish hippocratech` (or `spacetime start` for local), `npm run dev -w web`, and `npm run dev -w watcher`. Start the agents with `cd agents && python run_all.py`.
3. Read [`../AGENTS.md`](../AGENTS.md) before pointing a coding agent at the repo.

## If you change the plan

- A frozen contract changes only with the lead's approval, plus a line in the spec's Decision Log.
- Adding a sponsor track needs the whole team to agree first.
