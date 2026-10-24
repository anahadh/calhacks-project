# Hippocratech Flow Agent

Part of **Hippocra.tech**, a multi-agent hospital cyber-defense *simulator* built at Cal Hacks 13.0. Four agents negotiate a network-segmentation plan against a simulated ransomware attack. Humans decide whether to use it.

## The stall point I own: unclear communication flows

I want the smallest blast radius. For each round I get candidate plans from a graph optimizer, test every one against the same simulated attack, and propose the best one that meets the constraints the other agents have set. I am not told which connections clinical staff depend on: I learn that only when the Clinical Workflow Agent rejects a plan.

## Messages

| I receive | From | I send | To |
|---|---|---|---|
| `ProposalRequest` (round, baseline run, constraints so far) | Sign-off Coordinator | `Proposal` (round 1: a plan, its rules and its test run) | Sign-off Coordinator |
| | | `Revision` (later rounds: the rules added and removed, and the new test run) | Sign-off Coordinator |

## Code decides; Claude only words it

- **Code decides** which candidate to send: the lowest number of infected devices, then the most patients unaffected, then the fewest rules, among the candidates that break no constraint. If none qualifies, I send the one that breaks the fewest, and the other agents reject it.
- **Every number comes from the simulator's test run**, never from a language model.
- **Claude (Anthropic) writes only** the one-sentence "why this plan" that goes with each Proposal and Revision. Code checks it. If the check fails, or no key is set, a labeled template sentence is used.

## Humans decide

A plan I propose is a candidate, not a decision. Only the required human roles can sign off, and nothing is applied to any real network.

## Data

All hospital data is synthetic. Plans are allow-rules over the demo hospital's zones, device types, roles and VLANs, tested only inside the simulation.
