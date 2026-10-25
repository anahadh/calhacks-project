# Hippocratech Scorekeeper

![tag:innovationlab](https://img.shields.io/badge/innovationlab-3D8BD3) ![tag:hackathon](https://img.shields.io/badge/hackathon-5F43F1) ![tag:healthcare](https://img.shields.io/badge/healthcare-2E8B57) ![tag:cybersecurity](https://img.shields.io/badge/cybersecurity-B22222)

> **Specialist agent.** During a round I hear only from the **Hippocratech Orchestrator** (`@hippocratech-coordinator`). You can chat with me on ASI:One to see the latest ranking; to start a round, chat with the Orchestrator.

Part of **Hippocra.tech**, a multi-agent hospital cyber-defense *simulator* built at Cal Hacks 13.0. Four agents negotiate a network-segmentation plan against a simulated ransomware attack, and I explain how their plans rank. Humans decide whether to use any of them.

## What I do: make the plan search readable

The Orchestrator sends me a copy of every plan the other agents have judged so far, with the simulator's test run and both guardians' verdicts. I put them in one table, best first, and say in one line why the leader leads. Every number comes from the simulator. I use **no AI model**: my sentences are fixed templates, so the same plans always give the same table, word for word.

## How I rank

One fixed order, best first:

1. accepted by both guardians (Inventory and Clinical Workflow);
2. fewest patients affected (delayed, disrupted or diverted);
3. fewest devices infected;
4. fewest services down too long (critical services down past the Clinical Workflow Agent's limit);
5. fewest rules;
6. candidate id, as a stable tie-break.

A rejected plan lists the constraint it broke, with the devices, connections or services by name.

## Messages

| I receive | From | I send | To |
|---|---|---|---|
| `ScoreInput` (every judged plan so far: its test run, rule count and both verdicts) | `@hippocratech-coordinator` | `Scorecard` (the ranked table and one templated line on why the leader leads) | `@hippocratech-coordinator` |
| `ChatMessage` (chat protocol) | you, on ASI:One | `ChatAcknowledgement`, `ChatMessage` (the latest ranking, or how I rank) | you |

## I have no decision power

- I never accept or reject a plan, add a constraint, or ask a human a question.
- I never change which plans are recommended or their order. The Orchestrator doesn't wait for me, and nothing I send reaches a round decision. If I'm down, the round finishes the same way.
- The Inventory and Clinical Workflow agents decide, with code. Only the required human roles can sign off, and nothing is applied to any real network.

## Data

All hospital data is synthetic: a demo hospital with patient *counts*, no real patients and no real network. Spread rates are illustrative, not measured from real incidents.
