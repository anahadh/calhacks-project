# Hippocra.tech

An autonomous, multi-agent hospital cyber-defense simulator.

1. **Watch the attack.** Load a synthetic hospital, infect one device, and watch ransomware spread through a 3D model of the building, tick by tick, live on every screen.
2. **Watch the agents talk.** Four Fetch.ai agents argue out a defense on screen. A graph optimizer finds candidates, a Factory Droid writes and tests each one, and Claude explains every move.
3. **See the solution.** The same attack replays side by side, with and without the plan. Humans approve before anything is exported.

Built at Cal Hacks 13.0. All hospital data is synthetic. Sponsor tracks: **Fetch.ai, Armadin, Microsoft, Factory, Anthropic, SpacetimeDB.**

## Run it

```bash
pnpm install
cp .env.example .env.local           # fill in keys; see the comments
spacetime publish hippocratech        # terminal 1: the SpacetimeDB module (simulation + shared state)
pnpm --filter web dev                 # terminal 2: the app, Droid runner, memo and export routes
pnpm --filter watcher dev             # terminal 3: watchers connecting SpacetimeDB to the agents
cd agents && python run_all.py        # terminal 4: the four uAgents
```

Open the app and choose **Demo hospital**. Infect MRI 2, press **Run**, then **Defend**, then **Show the solution**.

## How the simulation runs (SpacetimeDB)

The simulation runs inside the SpacetimeDB module. A scheduled reducer, `run_tick`, advances the attack one tick at a time and writes device, service and patient state, plus every spread attempt. Every laptop subscribes to the same rows, so everyone watches the same attack live.

The same engine (`sim-core`) is built into the `hippo-sim` CLI, which the agents and the Droid use for fast test runs.

## How the agents work (Fetch.ai)

| Agent | Goal | Decides with |
|---|---|---|
| Inventory | Never act on a device nobody can name | Rejects cuts touching unidentified devices and asks a human what they are |
| Flow | Minimize spread | Optimizer candidates (Claude as fallback), written and tested by the Droid with `hippo-sim` |
| Clinical Workflow | Keep care running | Rejects if a protected flow breaks or a critical service goes down beyond the threshold |
| Sign-off Coordinator | Reach a plan humans can approve | Runs up to 4 rounds, pauses for human answers, and picks which roles must approve each recommendation. Cannot approve |

- All four are uAgents registered on Agentverse, talking over uAgents messaging.
- **Watchers** (SpacetimeDB subscription clients in `apps/watcher`) wake the agents when a run ends, a challenge appears, or a human answers. They also mirror every message into SpacetimeDB, and the Agent Room animates the conversation live from there. [Agentverse addresses here.]

## How Droid is used (Factory)

- **Trigger:** the Flow Agent sends each optimizer candidate to `/api/droid`.
- **Sandbox:** a per-request folder with `hospital.json`, `candidate.json`, and `policies/`. The Droid can read it, write only to `policies/`, and run only `hippo-sim`. It has no network access and cannot apply anything.
- **Work:** it writes the policy as a diff, runs the simulation, and refines up to twice if the policy is invalid or breaks a constraint.
- **Visible:** its diffs and results appear as messages in the agent conversation.

## How Claude is used, and where it could go wrong (Anthropic)

- Claude proposes alternative policies for the Flow Agent. It also writes every agent's reasons, the questions agents ask humans, and the decision memo.
- **Agents decide with code; Claude explains.** Accept and reject verdicts, and every number, come from the simulation.

| Could go wrong | What prevents it |
|---|---|
| A policy cuts off clinical care (e.g. MRI → PACS) | The Clinical Workflow Agent rejects it, and the UI flags it |
| Agents guess about a device they don't recognize | The Inventory Agent blocks the change and asks a human |
| Made-up numbers | Numbers come only from the simulation; any number in Claude's text is checked against it |
| Agent agreement treated as a decision | Only human role reviews can mark a policy ready |
| Touching a real network | Agents and the Droid act only inside the simulation, with no network access |

## Features and owners

| Feature | Owner | Sponsor(s) |
|---|---|---|
| Base app (schema, `sim-core`, SpacetimeDB sim, 3D scene) | Lead | SpacetimeDB |
| F1 Agent network and conversation (uAgents, watchers, Agent Room) | Teammate 1 | Fetch.ai, SpacetimeDB |
| F2 Policy engine (optimizer, Droid, Claude) | Teammate 2 | Factory, Anthropic |
| F3 Review and export | Teammate 3 | SpacetimeDB, Microsoft, Anthropic |
| F4 Visual simulation and solution view | Lead | Microsoft, Armadin |

## Read first

1. [`hippocratech/TEAM_BRIEF.md`](hippocratech/TEAM_BRIEF.md): status, owners, deadlines
2. [`Hippocratech.md`](Hippocratech.md): the product and the build plan
3. [`hippocratech/UX.md`](hippocratech/UX.md): screens and visual rules
4. [`hippocratech/HOSPITAL_SCHEMA.md`](hippocratech/HOSPITAL_SCHEMA.md): upload and policy formats
5. [`hippocratech/CODE_REFERENCE.md`](hippocratech/CODE_REFERENCE.md): files and who owns them
6. [`AGENTS.md`](AGENTS.md): rules for coding agents
