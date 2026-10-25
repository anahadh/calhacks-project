# UX

Why Hippocra.tech has its screens, and the rules for adding anything to them. Colors and fonts live in the spec's Design Language. This file decides whether a control or an animation belongs on screen. When the two disagree about a color, the spec wins. When they disagree about whether to add something, this file wins.

## The problem

A hospital team has to agree on a network change, and each member sees a different risk. Security wants the smallest blast radius. Clinical engineering wants proof that no scan, pump, or monitor loses its connection. Operations wants to know what slows down. Today they argue over spreadsheets that show none of that.

## The thesis

**Show, don't tell.** The product earns trust by letting people *watch* three things:

1. **The attack spreading** through their building.
2. **The segmentation plan** — after the attack, the agents talk their way to a defense (never while the simulation is running).
3. **The solution holding** against the same attack.

Every screen exists to make one of those three visible. The demo walks them in order on two laptops.

## Rules

1. **The spread leads on the simulation; people lead on the plan.** On the simulation view, devices infected is the largest number, and every system that goes down says what it means for patients ("36 patients in Emergency and ER waiting depend on it"). On the Agents tab, the solution view and the memo, patients affected stays the largest number.
2. **State colors mean state.** Orange, blue, red, amber, rose, and purple appear only on devices, patients, arcs, zones, and spread effects. Patient zero has its own red (`#FF3B3B`) with an ink ring. Agents, presence, buttons, and chrome use neutral colors and the monochrome ink selection (`#E9ECEE`). One exception: **Create segmentation plan** is filled with infected orange, because it is the answer to the spread on screen.
3. **Never color alone.** Patient states have badges. Message types have shapes (◆ proposal, ● accept, ✕ reject, ↻ revision, ? question). Review verdicts have icons and words. Cut connections are dashed.
4. **Every visual is backed by data.** A pulse means a `spread_attempt` row; a flash means a `device_state` change; a message particle means an `agent_message` row. Never animate something that didn't happen.
5. **Readable before fast.** Agent messages reveal no faster than one every 1.2 seconds. Event toasts stay for at least 2 seconds. **Skip to result** is always available.
6. **The scene answers the conversation.** Whenever an agent message refers to a device, flow, or zone, that thing is highlighted in 3D while the message is on screen.
7. **A broken protected flow is always visible.** Any recommendation that breaks one shows a warning naming the flow's `purpose`, and is never styled as recommended.
8. **Humans decide.** Only review rows change a recommendation's status. Agent agreement is shown as the agents' verdict, never as approval.
9. **Shared by default.** Everyone sees the same live simulation because everyone subscribes to the same SpacetimeDB state. Follow presenter is on when you join; breaking off and rejoining are one click each.
10. **The simulation says what it is.** In the footer of every screen: "Illustrative simulation. Spread rates are not measured from real incidents."
11. **No outcome language.** Never "deaths," "lives," "fatal," or "mortality."
12. **No game elements.** No attacker role, scores, or win states.
13. **Motion budget.** Spread pulses and fizzles, device flashes, room tints, service "down" pops, ambulance diversion, the camera follow, agent message particles, agent status dots, scene highlights, and the split-screen replay. Nothing else animates.

## The screens

### Load screen `/`

"Run a simulation", then **My hospitals**: one row per hospital with a drawn model of the building (every floor and device, from the file), its counts ("2 floors · 11 rooms · 48 devices"), **Edit hospital**, and **Simulate attacks**, which creates a new session and opens it; its link (`/s/<id>`) is what you send to the others. Under the list, a dashed **Add hospital** row opens the JSON upload: **Download template**, **Download demo**, a valid file shows its summary, an invalid file shows every error with its path. Add hospital waits for the schema validator, and Edit hospital is not built yet; both show as disabled until then.

### Join modal (first visit to `/s/[sessionId]`)

A modal over the live, blurred session scene, so the hospital is visible right away. It asks for a name and a role, and shows who is already here with their roles. The role picker is required and has four choices: **Chief Information Security Officer**, **Network Engineer**, **Clinical IT Team** and **Hospital Management** (role ids `security`, `network`, `clinical_engineering` and `operations`; the agents' allowed and required roles use the existing three, so a Network Engineer can pin devices but isn't asked to answer questions or sign off). The person who started the session sees "Your session is ready": their name and role, plus the session link with **Copy link** to send to others; **Invite** in the header copies it any time. A reload rejoins with the same name and role.

The role is a lens, not a permission on the truth. Every role sees the same infection: device states, pulses, the infection path and services going down. What changes is the hovered device's card and which connections are drawn (see the session view). Roles still decide who can answer an agent's question and whose sign-off a plan needs; if no one present has a question's allowed role, the question card says so.

### Session view `/s/[sessionId]`

- **Header:** the Hippocra.tech mark, the hospital name, two view tabs (**1 Simulation**, **2 Agents**; the keys 1 and 2 switch), and **Invite**. The Log drawer is not built yet.
- **Simulation tab:** one simulation panel (about two-thirds) beside a side column.
  - **Transport row:** back to start, play/pause (ink filled), forward 15 minutes, **Add note** (then click anywhere on the track to write a note at that moment; everyone sees the ▼ marker live; Esc stops), the clock as a light `T+h:mm` readout, and speed (0.5× 1× 2× 4×) as a segmented control. Presence avatars (initials, `+N` past three, the presenter ringed in ink, hover for name, role and "you") sit in the header beside Invite, so everyone connected shows on both views from the moment they join, before any run. Only the presenter and the run's starter change that run.
  - **Track:** a 14px row of ▼ note markers (hover shows who, their role, the time and the note), the scrubber, a segmented heat strip of infected count over time, and labels `T+0:00`, the midpoint, and "Settles T+4:30" (or "Spreading" while it runs).
  - **Scene:** on scene-ground, a floor picker ("All floors · 48 devices", or one floor) and the legend (healthy, patient zero, infected, infection path, delayed, disrupted), then the live 3D hospital (see "The attack spreading" below). Hovering a device shows a short card over the scene, built for the demo: its name and state (badge and word, not color alone), one line of type and room, then **at most three lines for the viewer's role**, with lists cut to the first item and "+N more". The **CISO** sees risk (vulnerable or patched, and the OS), what infected it, and its SMB/RDP exposure; the **Network Engineer** sees VLAN and zone, and its ports; **Clinical IT** sees criticality, its clinical flow and the services it supports; **Hospital Management** sees, in plain language, how many patients depend on it and what stops if it fails (including ER diversion). The mapping lives in `spacetime/src/role_views.ts`, served per person by the `my_device_card` and `my_arcs` views.

Only two kinds of line are drawn, so the building stays readable. **The infection path**, for everyone: hops from the last two ticks are bright (the spread happening now) and older hops fade to a faint trail. **The hovered device's connections**, styled by role: the CISO sees SMB and RDP links (lateral movement) strong and the rest faint; the Network Engineer sees each flow with its protocol and port; Clinical IT sees protected and clinical flows strong with their purpose and the rest thin; Hospital Management sees no device-to-device arcs, only lines to the services that rely on the device, labeled. While a device is hovered, devices it isn't connected to fade back (keeping their state color). The mapping lives in `spacetime/src/role_views.ts`, served per person by the `my_device_card` and `my_arcs` views.
  - **Side column:** **Devices infected** (large readout, `/ 48`, share, orange bar) with **Services offline** and one pip per service under it; **Relevant systems down**, newest first: each card has the time, the devices behind it with how many are infected ("MRI scanners 1/3"), the service, what stops working, and how many patients depend on it; ER diversion appears here too. At the bottom, **Create segmentation plan** (writes `defend_request` and opens the Agents tab; disabled with its reason while any run is `running`; reads "Watch the agents negotiate" during a round).
- **Agents tab:** a counter strip (patients affected first and largest), then three columns: the agents and the humans in the session, with **Create segmentation plan** (writes `defend_request`; disabled while a visible run is `running`) and **Skip to result**; the Agent Room thread (see "The agents talking" below); and **Recommendations**, up to three cards. Each card shows its rules, the "why this works" explanation, verified numbers, each agent's verdict, the required roles with their review status, and **Show the solution**.
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

- **When it is live:** only during an segmentation-plan round, after **Create segmentation plan**. While a simulation run is `running`, all agent nodes stay **idle** and no new messages appear.
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
- Devices infected is shown bigger than patients affected anywhere but the simulation view.
- Agent agreement is styled like human approval, or anyone but the required humans can make a plan Ready.
- A follower can move the presenter's playback.
- A second drawer, or a third panel. (The Agent Room overlay and the solution view are the only full-screen moments.)
- Any game element, or any outcome language.

## How to check a UI change

Open the demo session on two laptops with different roles (or four, one per role: hover the same device in each and check the card and the connections differ), and walk the demo script:

1. Infect MRI 2 and run. Both laptops show the same pulses, flashes, and services going down.
2. Let the run finish (or pause it). Press **Create segmentation plan** and expand the Agent Room. Follow the particles and bubbles; check that each message highlights its target in the scene.
3. Open **Show the solution**. The split screen runs in lockstep, and the right side stops at the zone edge.
4. Apply **Change conditions → unidentified device**. The question banner appears on both laptops; answer it on laptop 2.
5. Approve from each required role, then draft, approve, and export the memo.

Then break off on laptop 2, scrub, and rejoin. Switch to 2D and repeat the run. A screenshot is not the check.
