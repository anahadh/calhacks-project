# UX

Why Hippocra.tech has its screens, and the rules for adding anything to them. Colors and fonts live in the spec's Design Language. This file decides whether a control or an animation belongs on screen. When the two disagree about a color, the spec wins. When they disagree about whether to add something, this file wins.

## The problem

A hospital team has to agree on a network change, and each member sees a different risk. Security wants the smallest blast radius. Clinical engineering wants proof that no scan, pump, or monitor loses its connection. Operations wants to know what slows down. Today they argue over spreadsheets that show none of that.

## The thesis

**Show, don't tell.** The product earns trust by letting people *watch* three things:

1. **The attack spreading** through their building.
2. **The aggregate fix** — after the attack, the agents talk their way to a defense (never while the simulation is running).
3. **The solution holding** against the same attack.

Every screen exists to make one of those three visible. The demo walks them in order on two laptops.

## Rules

1. **The human number leads.** Patients affected is the largest number on the panel. Devices compromised comes second.
2. **State colors mean state.** Orange, blue, amber, rose, and purple appear only on devices, patients, arcs, zones, and spread effects. Agents, presence, buttons, and chrome use neutral colors and the monochrome ink selection (`#E9ECEE`), never a state color.
3. **Never color alone.** Patient states have badges. Message types have shapes (◆ proposal, ● accept, ✕ reject, ↻ revision, ? question). Review verdicts have icons and words. Cut connections are dashed.
4. **Every visual is backed by data.** A pulse means a `spread_attempt` row; a flash means a `device_state` change; a message particle means an `agent_message` row. Never animate something that didn't happen.
5. **Readable before fast.** Agent messages reveal no faster than one every 1.2 seconds. Event toasts stay for at least 2 seconds. **Skip to result** is always available.
6. **The scene answers the conversation.** Whenever an agent message refers to a device, flow, or zone, that thing is highlighted in 3D while the message is on screen.
7. **A broken protected flow is always visible.** Any recommendation that breaks one shows a warning naming the flow's `purpose`, and is never styled as recommended.
8. **Humans decide.** Only review rows change a recommendation's status. Agent agreement is shown as the agents' verdict, never as approval.
9. **Shared by default.** Everyone sees the same live simulation because everyone subscribes to the same SpacetimeDB state. Follow presenter is on when you join; breaking off and rejoining are one click each.
10. **The simulation says what it is.** Under the clock: "Illustrative simulation. Spread rates are not measured from real incidents."
11. **No outcome language.** Never "deaths," "lives," "fatal," or "mortality."
12. **No game elements.** No attacker role, scores, or win states.
13. **Motion budget.** Spread pulses and fizzles, device flashes, room tints, service "down" pops, ambulance diversion, the camera follow, agent message particles, agent status dots, scene highlights, and the split-screen replay. Nothing else animates.

## The screens

### Load screen `/`

Two cards: **Demo hospital** and **Upload JSON**. **Start session** creates a new session and opens it; its link (`/s/<id>`) is what you send to the others. Under Upload: a drop zone, **Download template**, and **Download demo**. A valid file shows its summary and **Start session**; an invalid file shows every error with its path.

### Join modal (first visit to `/s/[sessionId]`)

A modal over the live, blurred session scene, so the hospital is visible right away. It asks only for a name, and shows who is already here. The person who started the session sees "Your session is ready": their name, plus the session link with **Copy link** to send to others; **Invite** in the header copies it any time. A reload rejoins with the same name. There is no role picker: everyone joins with the same role, so anyone in the session can answer an agent's question.

### Session view `/s/[sessionId]`

- **Header:** hospital name, two view tabs (**1 Simulation**, **2 Agents**; the keys 1 and 2 switch), presence avatars, and **Log**.
- **Simulation tab**, top to bottom:
  - **Timeline rail:** **Annotate** (then click anywhere on the track to write a note at that moment; everyone sees the note marker live; Esc stops), play/pause, the sim clock with the run and patient zero, speed, **Following [name]** / **Rejoin**, a track with event markers and an infected-count heat strip, and the current beat (the latest events) with "Illustrative simulation…" under it. Only the presenter's controls change the shared run.
  - **Demo steps:** 1 Run the attack → 2 Create aggregate fix (agents negotiate) → 3 Show the solution, with one line saying what to do next. Step 2 is disabled while a run is `running`.
  - **Scene (about 65%):** the live 3D hospital (see "The attack spreading" below), with **Change conditions** and the 3D/2D toggle in its header and a legend under it.
  - **Side column (about 35%):** **Patients affected** (headline and split, then devices compromised and delayed procedures), **Clinical services** (one tile per service, running or down), and **Inspector** (the hovered device's record; choke points when nothing is hovered).
- **Agents tab:** a counter strip (patients affected first and largest), then three columns: the agents and the humans in the session, with **Create aggregate fix** (writes `defend_request`; disabled while a visible run is `running`) and **Skip to result**; the Agent Room thread (see "The agents talking" below); and **Recommendations**, up to three cards. Each card shows its rules, the "why this works" explanation, verified numbers, each agent's verdict, the required roles with their review status, and **Show the solution**.
- **Question banner:** when an agent asks a human something, a banner appears across the top of every screen until it is answered.
- **Log drawer:** human decisions, the memo editor, **Approve memo**, and **Export**. This is the only drawer allowed.

#### The attack spreading

- A pulse travels along the arc from the infecting device to its target, over the length of the tick. On arrival the target flashes white, turns orange, and keeps a slow pulse.
- A failed attempt is a short pulse that fizzles halfway.
- Room floors deepen in tint as their infected share rises, and room chips count up.
- Service icons over rooms dim and get a "down" badge, with a label ("Radiology reading offline").
- Patient figures change color and badge. ER diversion turns arriving ambulances around.
- Event toasts appear anchored at the device ("PACS compromised").
- On the demo hospital, the camera follows the infection front, then pulls back wide. The mouse always takes over.

#### The agents talking (Agent Room)

- **When it is live:** only during an aggregate-fix round, after **Create aggregate fix**. While a simulation run is `running`, all agent nodes stay **idle** and no new messages appear.
- **Map:** four agent nodes in a diamond (Inventory, Flow, Clinical Workflow, Sign-off Coordinator), plus a Humans node. Each node shows its icon, its name, and a live status from `agent_status`: idle, thinking (animated dots), speaking, or waiting for a human.
- **Particles:** each message travels sender → receiver as a shaped particle, then lands in the thread.
- **Thread:** a speech bubble per message, with the sender's icon, a one- or two-sentence reason, the constraint added (for rejections), and an expandable payload (the rules, or what a revision changed, as a diff).
- **Round header:** e.g. "Round 2 of 4 · waiting for Clinical engineering."
- **Expand:** one click turns the Agent Room into a large overlay over the scene, with the scene still visible and highlighting behind it. This is for the demo moment.
- **Scene highlights while a message is shown:**
  - proposal: the cuts flash as purple dashed lines;
  - Clinical Workflow rejection: the cited flow glows blue with a "keep" label;
  - Inventory rejection or question: the device gets a pulsing outline and "?";
  - test result: a "tested" check with that candidate's patient number.
- **Question card:** the agent, the device (outlined in the scene), the question, and the choices. Only allowed roles can answer; others see who can. The answer posts into the thread as a message from the human.

### Solution view `/s/[sessionId]/solution/[recommendationId]`

The payoff screen. It opens from **Show the solution**, and followers follow.

- **Split screen:** "No segmentation" on the left, the chosen plan on the right. Both are live SpacetimeDB runs, same seed, advancing in lockstep, with one shared play control and clock.
- **The plan on the building (right side):** purple zones with labels, kept connections as thin blue lines labeled with their purpose, and cut connections as dashed gray lines with ✕ where the infection stopped.
- **Rules list:** plain-language rules. Hovering one highlights its zone and connections on the right.
- **Before/after strip:** patients affected, devices, services down, delayed procedures, protected flows broken, and rules, with each difference called out ("212 → 9").
- **What keeps working:** each protected flow and critical service with a check.
- **Sign-off:** the required roles, their review rows, and **Export** once it is Ready.

### Memo `/s/[sessionId]/memo`

A printable page: the hospital, patient zero, and seed; the chosen plan and its numbers against no segmentation; each role's review; the ruleset (JSON and ACL text); the illustrative-simulation line; and who approved it, when.

## What would make the UX wrong

- The spread happens with no visible pulses, or devices change color without a cause on screen.
- Agent messages appear while a visible simulation is still running.
- The agents' messages are hidden, summarized, or shown only as a final answer.
- Messages scroll by faster than someone can read them.
- An agent message refers to a device or flow and the scene doesn't show which one.
- The solution is shown only as numbers, without the side-by-side replay.
- Devices compromised is shown bigger than patients affected.
- Agent agreement is styled like human approval, or anyone but the required humans can make a plan Ready.
- A follower can move the presenter's playback.
- A second drawer, or a third panel. (The Agent Room overlay and the solution view are the only full-screen moments.)
- Any game element, or any outcome language.

## How to check a UI change

Open the demo session on two laptops with different roles, and walk the demo script:

1. Infect MRI 2 and run. Both laptops show the same pulses, flashes, and services going down.
2. Let the run finish (or pause it). Press **Create aggregate fix** and expand the Agent Room. Follow the particles and bubbles; check that each message highlights its target in the scene.
3. Open **Show the solution**. The split screen runs in lockstep, and the right side stops at the zone edge.
4. Apply **Change conditions → unidentified device**. The question banner appears on both laptops; answer it on laptop 2.
5. Approve from each required role, then draft, approve, and export the memo.

Then break off on laptop 2, scrub, and rejoin. Switch to 2D and repeat the run. A screenshot is not the check.
