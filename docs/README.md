# Hippocra.tech

A security team for hospitals that can't afford one. Hippocra.tech simulates ransomware spreading through a hospital network, and Fetch.ai agents negotiate a segmentation plan that contains it without disrupting patient care.

Built at Cal Hacks 13.0. All hospital data is synthetic.

## How it works

1. **Watch the attack.** Pick a device to infect and watch ransomware spread through a 3D model of the hospital.
2. **Agents negotiate a fix.** Four Fetch.ai uAgents argue out a segmentation plan. Flow proposes rules, Inventory checks every device, and Clinical Workflow rejects anything that breaks care.
3. **See the result.** The same attack replays with and without the plan. A human approves before anything is used.

Every number comes from one deterministic simulation engine. The AI writes explanations; code makes the decisions.

## The agents

| Agent | Job | Handle |
|---|---|---|
| Coordinator | Runs the negotiation; talks to you on ASI:One | `@hippocratech-coordinator` |
| Flow | Proposes plans that stop the spread | `@hippocratech-flow` |
| Inventory | Refuses to touch devices nobody can identify | `@hippocratech-inventory` |
| Clinical Workflow | Rejects plans that break clinical connections | `@hippocratech-clinical-workflow` |

On [ASI:One](https://asi1.ai), message `@hippocratech-coordinator show me my hospital`.

## Run it

```bash
npm install
cp .env.example .env.local                       # fill in keys
spacetime start && spacetime publish --server local hippocratech
cd engine && uv run uvicorn sim_core.api:app     # simulation engine
npm run dev -w watcher
npm run dev -w web
cd agents && python run_all.py                   # the four agents
```

Open the app, choose **Demo hospital**, infect MRI 2, press **Run**, then **Create segmentation plan**.

## Built with

Fetch.ai uAgents and ASI:One · Anthropic Claude · SpacetimeDB · Next.js and Three.js · Python

## More

- [`Hippocratech.md`](Hippocratech.md): product and build plan
- [`engine/README.md`](../engine/README.md): the simulation engine
- [`AGENTS.md`](AGENTS.md): rules for coding agents
