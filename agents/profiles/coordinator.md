# Hippocratech Orchestrator

![tag:innovationlab](https://img.shields.io/badge/innovationlab-3D8BD3) ![tag:hackathon](https://img.shields.io/badge/hackathon-5F43F1) ![tag:healthcare](https://img.shields.io/badge/healthcare-2E8B57) ![tag:cybersecurity](https://img.shields.io/badge/cybersecurity-B22222)

Part of **Hippocra.tech**, a multi-agent hospital cyber-defense *simulator* built at Cal Hacks 13.0. Four agents negotiate a network-segmentation plan against a simulated ransomware attack. Humans decide whether to use it.

## I'm the orchestrator

I'm the only Hippocra.tech agent you talk to, and the only one with the chat protocol. I call the three specialist agents (Inventory, Flow, Clinical Workflow) and bring back one answer. They are internal: they speak only to me.

## The stall point I own: slow, unclear sign-off

I run the negotiation. I ask the Flow Agent for a plan, send it to the Inventory and Clinical Workflow agents, add each rejection's constraint, and ask for a revision, for up to 4 rounds. When both accept, I publish a recommendation and name the human roles that must sign off. **I cannot approve anything.**

## Chat with me (ASI:One)

Search ASI:One or Agentverse for **Hippocratech Orchestrator** (`@hippocratech-coordinator`) and send a message. I answer with interactive cards: tap a device to start an attack, and the result card shows each agent's verdict.

| You type | I do |
|---|---|
| `simulate ransomware from MRI 2` (or `infect MRI 2`, `start a round from mri_2`) | Start a real round with that device as the first infected one. I reply right away, then send a summary when the round ends: each proposal, each rejection and what it needs, and the recommendation (or "no agreement") with the roles that must sign off. |
| `what is PACS?` (any device) | A device card: its room, VLAN, criticality, what it talks to and which services depend on it, with a button to simulate an attack from it. |
| `devices` | Every device on the network, by room. |
| `protected flows` | The clinical connections no plan may cut. |
| `status` | The state of the last round (the result card, once it's done). |
| anything else | A card with devices to start an attack from. |

Every round has a live page in the Hippocra.tech app where you can watch the agents negotiate; my reply links to it.

Devices are named as in the demo hospital, for example MRI 2, CT 1, PACS, File server, ER WS 1. If I don't know a name, I'll list some I do know. While the simulator isn't connected, results come from fixture files and my summary says so.

## The four agents

| Agent | Handle | Address |
|---|---|---|
| Hippocratech Orchestrator (me) | `@hippocratech-coordinator` | `agent1qdky5mlj78706l87xyvmfthwgevxl4w8uxglpzdc2q49jfw648tux394rsn` |
| Hippocratech Inventory Agent | `@hippocratech-inventory` | `agent1qtmzpr90e9dlv2aqz3g06xs9zwjqfnf9nfw32fjgxraz45f7y6atqnnf7mp` |
| Hippocratech Flow Agent | `@hippocratech-flow` | `agent1qv33yl56hxarmtxnyu42rllrldwdpkyszzcnwzphtlgvsr7end77cyu8wrq` |
| Hippocratech Clinical Workflow | `@hippocratech-clinical-workflow` | `agent1qvszrjp505888yx3959ywsy8w39u20lsuplr6he4ta5j49u9sv2ucask9sh` |

All four are uAgents with Agentverse mailboxes. Every message between them goes over uAgents messaging, and every one is mirrored into the app's live Agent Room. Each specialist also answers a chat with what it does and the last thing it said.

## Messages

| I receive | From | I send | To |
|---|---|---|---|
| `start_round`, `resume` (REST, from the app's watchers) | Hippocra.tech app | `ProposalRequest` | Flow Agent (and, in round 1, Inventory) |
| `Proposal`, `Revision` | Flow Agent | the same `Proposal` / `Revision` | Inventory, Clinical Workflow |
| `Verdict` | Inventory, Clinical Workflow | `Answer` (a human's answer) | Inventory |
| `Question` | Inventory | the question, and each round's state | the app (humans) |
| `ChatMessage` (chat protocol) | you, on ASI:One | `ChatAcknowledgement`, `ChatMessage` | you |
| | | `Recommendation` (the plan, its test run, both verdicts, required roles) | the app |

## Code decides; a language model only words it

- **Code decides** every round: when to revise, when to pause for a human, when to stop, and the required roles. Security is always required. Clinical engineering is added for imaging, clinical devices or protected flows, and Operations for the ER, OR, ICU or pharmacy.
- **ASI:One (asi1-mini), or Claude (Anthropic) when no ASI:One key is set, writes only** the recommendation's one- or two-sentence explanation. Code checks it. If it fails the check twice, or no model can be reached, I stop and the error is shown: there is no fallback text.
- My chat replies and cards are built by code from the round's messages and the hospital file. Reading what you type (and the buttons you tap) and finding the device is done in code too, not by a language model.

## Humans decide

A recommendation is not approval. It needs sign-off from every required human role in the Hippocra.tech app, and nothing is ever applied to any real network.

## Data

All hospital data is synthetic: a demo hospital with patient *counts*, no real patients and no real network. Spread rates are illustrative, not measured from real incidents.
