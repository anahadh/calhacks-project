# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: security, clinical engineering, and operations teams at mid-size community hospitals that can't afford segmentation consultants. They sit together (often on separate laptops in one shared session) to agree on a network segmentation change, and each sees a different risk:

- **Security** wants the smallest blast radius.
- **Clinical engineering** wants proof that no scan, pump, or monitor loses its connection, and owns identifying unknown devices.
- **Operations** wants to know what slows down: scans, surgeries, the ER.

Operating context for now: the Cal Hacks 13.0 table demo (Sun Oct 25, 2026), where judges watch the team walk the loop live on two laptops in 2–3 minutes. Design decisions serve the hospital teams; the demo is the situation the product must perform flawlessly in.

## Product Purpose

Hippocra.tech is a multi-agent hospital cyber-defense simulator and the planning layer that comes before enforcement tools (Illumio, Claroty, ORDR, Akamai Guardicore). It replaces arguments over spreadsheets with three things a team can watch:

1. **The attack spreading** through a 3D model of their building, tick by tick.
2. **The aggregate fix being negotiated**: after the attack, four Fetch.ai uAgents (Inventory, Flow, Clinical Workflow, Sign-off Coordinator) talk their way to one segmentation plan that contains every run in the session.
3. **The solution holding**: the same attack replayed side by side, with and without the plan.

Success: the team leaves with a plan every required role has reviewed and approved, exported as a memo and ruleset, and trusts it because they saw it tested.

## Positioning

Agents with genuinely conflicting objectives negotiate in the open, and every policy is tested against the same seeded attack. The Flow Agent wants fewer connections, the Clinical Workflow Agent protects the connections care depends on, the Inventory Agent refuses to act on devices nobody can name and asks a human instead of guessing. Impact is stated in clinical terms (patients, procedures, services) so administrators and clinicians weigh tradeoffs together. Verdicts come from simulation results and code, never from an LLM's say-so; humans decide deployment.

## Operating Context

- Loop: load a hospital (demo or validated JSON upload) → start a session and share its link → one or more baseline runs, each from a different patient zero → **Create aggregate fix** → Agent Room negotiation (may pause to ask a human a `Question`) → **Show the solution** split screen → optional new challenge (unidentified device) → role reviews → memo approval → export.
- Shared by default: everyone subscribes to the same SpacetimeDB state; follow-presenter is on at join. Only the presenter and a run's starter control that run.
- Screens: load `/`, join modal, session view `/s/[sessionId]` (Simulation and Agents tabs, Log drawer), solution view, printable memo. See `docs/hippocratech/UX.md`.
- Simulation and agent rounds never overlap: no agent traffic while a visible run is `running`.

## Capabilities and Constraints

Authoritative sources: `docs/Hippocratech.md` (spec), `docs/hippocratech/UX.md` (what belongs on screen), `docs/AGENTS.md` (hard rules), `docs/hippocratech/CODE_REFERENCE.md` (file ownership by feature F1–F4).

- **Synthetic data only.** Patients are counts; no field identifies a person.
- **No outcome language.** Never "deaths," "lives," "fatal," "mortality"; nothing computes or shows clinical outcomes.
- **Visuals come from data.** Every pulse, flash, particle, and highlight is backed by a row (`spread_attempt`, `sim_event`, `agent_message`, `agent_status`). The browser only renders; spread logic lives in `sim-core`.
- **Humans approve.** Agent agreement is shown as the agents' verdict, never as approval; never say "approved," "ready," or "safe to deploy" for agent output. Only `review_submit` sets a recommendation's status.
- **The human number leads.** Patients affected is the largest number; devices compromised is second.
- **State color means state; never color alone.** Badges, message shapes, icons, and dashed cuts carry meaning alongside color. The palette itself lives in the spec's Design Language.
- **Readable before fast.** Agent messages reveal no faster than one per 1.2 s; toasts stay ≥ 2 s; **Skip to result** is always available.
- **Fixed motion budget**, one drawer (Log), and only two full-screen moments (Agent Room overlay, solution view).
- **No game elements**: no attacker role, scores, or win states. No accounts or auth; everyone joins by name with the same role.
- **No faking a sponsor.** Integration failures show the error; the only exception is a cached demo round labeled "Cached run."
- **Sponsor scope:** Fetch.ai, Anthropic (Claude), SpacetimeDB (plus Armadin and Microsoft tracks). No other integrations.
- Out of scope: real network access or enforcement, real patient data, voice, an in-app hospital editor, non-JSON formats.
- Open (see spec Open Questions): required-roles rule, `MAX_SERVICE_LOSS`, sponsor Live Site criteria, pitch length (2:00 vs 3:00).

## Brand Commitments

- Name: **Hippocra.tech**.
- Every screen states what the simulation is: "Illustrative simulation. Spread rates are not measured from real incidents."
- Voice: plain, specific, short. Agent reasons are one or two sentences readable in a chat bubble, using only numbers present in the data.
- An existing visual direction is committed in the spec's Design Language and mirrored in `apps/web/tailwind.config.ts`, `apps/web/app/globals.css`, `apps/web/lib/colors.ts`.

## Evidence on Hand

- Demo hospital: `data/hospitals/demo.json` (synthetic), schema in `docs/hippocratech/HOSPITAL_SCHEMA.md`.
- Pitch statistic (pitch only, cited, never in the simulation): in-hospital mortality rose 34–38% for patients already admitted when an attack began (Neprash, McGlave & Nikpay, *American Economic Journal: Economic Policy*).
- No customers, testimonials, deployments, or measured spread rates exist. Do not fabricate them.

## Product Principles

1. **Show, don't tell.** Trust comes from watching the attack, the negotiation, and the containment, not from numbers alone.
2. **Patients before devices.** Express impact in clinical terms that every role at the table can weigh.
3. **Tested, not asserted.** Every recommendation carries simulation results; no model output sets a verdict.
4. **Humans decide.** Agents propose and ask; people approve and deploy.
5. **One shared truth.** Every laptop sees the same live state, and nothing on screen happens without a row behind it.

## Accessibility & Inclusion

Meaning never depends on color alone (badges, shapes, icons, dashed lines). Blue/orange state pairing, never red/green. Pace limits keep agent messages readable. A 2D fallback shows the same live state as the 3D scene.
