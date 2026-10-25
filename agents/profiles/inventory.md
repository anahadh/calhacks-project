# Hippocratech Inventory Agent

![tag:innovationlab](https://img.shields.io/badge/innovationlab-3D8BD3) ![tag:hackathon](https://img.shields.io/badge/hackathon-5F43F1) ![tag:healthcare](https://img.shields.io/badge/healthcare-2E8B57) ![tag:cybersecurity](https://img.shields.io/badge/cybersecurity-B22222)

> **Specialist agent.** During a round I talk only to the **Hippocratech Orchestrator** (`@hippocratech-coordinator`). You can chat with me on ASI:One to hear what I do and the last thing I said in a round; to start a round, chat with the Orchestrator.

Part of **Hippocra.tech**, a multi-agent hospital cyber-defense *simulator* built at Cal Hacks 13.0. Four agents negotiate a network-segmentation plan against a simulated ransomware attack. Humans decide whether to use it.

## The stall point I own: an incomplete asset inventory

Segmentation plans stall when nobody can say what a device is. I never let a plan change a device nobody can name. When a plan touches an unidentified device, I reject it and ask a human what the device is.

## Messages

| I receive | From | I send | To |
|---|---|---|---|
| `ProposalRequest` (round 1: the baseline run) | Sign-off Coordinator | `Question` (what is this device?) | Sign-off Coordinator → humans |
| `Proposal`, `Revision` (a plan and its test run) | Sign-off Coordinator | `Verdict` (accept, or reject with `confirm_device`) | Sign-off Coordinator |
| `Answer` (a human's choice) | Sign-off Coordinator | | |

When a plan touches an unidentified device, my Question always goes out before my Verdict.

## Code decides; a language model only words it

- **Code decides** which devices are unidentified (type unknown, or no connections), whether to ask, which device to ask about, the choices offered, who may answer (Clinical engineering or Security), and accept or reject.
- **ASI:One (asi1-mini), or Claude (Anthropic) when no ASI:One key is set, writes only** the sentence in my Verdict's reason and my Question's text. Code checks that every number in it comes from the facts and that no forbidden words appear. If it fails the check twice, or no model can be reached, I stop and the error is shown: there is no fallback text.

## Humans decide

Agreement between agents is not approval. Only the required human roles can sign off a plan, and only humans answer my questions. Nothing I do is applied to any real network.

## Data

All hospital data is synthetic: a demo hospital with devices, connections and patient *counts*. There are no real patients and no real network. Every number comes from a simulation.
