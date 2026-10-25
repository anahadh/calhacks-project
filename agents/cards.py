"""ASI:One interactive cards for the orchestrator's chat replies, built in code.

Each reply is a ChatMessage with a short text bubble and a MetadataContent block that
ASI:One renders as a card (Agentverse "agent-driven interactive cards", element-tree
primitives: section, group, heading, text, badge, list, button, divider; depth <= 8).
A button's `selection` comes back as a ChatMessage whose text is that JSON object;
chat.parse() reads it.

Every value on a card comes from the hospital file or from the messages the
Coordinator saw (rule 16). Agent acceptance is never called approval (rule 9).
"""

import json
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from uagents_core.contrib.protocols.chat import ChatMessage, MetadataContent, TextContent

from facts import AGENT_NAMES, ROLE_NAMES
from logic.hospital import HospitalIndex

CARD_PROTOCOL_VERSION = "1"
SOURCE = "hippocratech"
PICK_DEVICES = ("mri_2", "ct_1", "srv_pacs", "srv_file", "ws_er_1", "ns_icu")

Node = dict[str, Any]


# --- primitives ---


def section(title: str, children: list[Node], subtitle: str | None = None) -> Node:
    node: Node = {"type": "section", "title": title, "children": children}
    if subtitle:
        node["subtitle"] = subtitle
    return node


def group(children: list[Node], direction: str = "column", gap: int = 8) -> Node:
    return {"type": "group", "direction": direction, "gap": gap, "children": children}


def heading(value: str, level: int = 3) -> Node:
    return {"type": "heading", "value": value, "level": level}


def text(value: str, style: str = "body") -> Node:
    return {"type": "text", "value": value, "style": style}


def badge(label: str, variant: str = "info") -> Node:
    return {"type": "badge", "label": label, "variant": variant}


def button(label: str, action: str, primary: bool = False, **fields: str) -> Node:
    return {"type": "button", "label": label, "primary": primary,
            "action": {"selection": {"action": action, "source": SOURCE, **fields}}}


def item(children: list[Node], action: str | None = None, **fields: str) -> Node:
    node: Node = {"children": children}
    if action:
        node["action"] = {"selection": {"action": action, "source": SOURCE, **fields}}
    return node


DIVIDER: Node = {"type": "divider"}


def message(bubble: str, root: Node, interactive: bool = False) -> ChatMessage:
    """A ChatMessage carrying the text bubble and the card."""
    return ChatMessage(
        timestamp=datetime.now(timezone.utc),
        msg_id=uuid4(),
        content=[TextContent(type="text", text=bubble), MetadataContent(type="metadata", metadata=metadata(root, interactive))],
    )


def metadata(root: Node, interactive: bool = False) -> dict[str, str]:
    return {
        "card_protocol_version": CARD_PROTOCOL_VERSION,
        "requires_card_interaction": "true" if interactive else "false",
        "card_kind": "custom",
        "card_payload": json.dumps({"root": root}),
    }


def depth(node: Any) -> int:
    """Nesting depth of an element tree (the root counts as 1); ASI:One allows 8."""
    if isinstance(node, dict):
        kids = node.get("children", []) + [c for i in node.get("items", []) for c in i.get("children", [])]
        return 1 + max((depth(k) for k in kids), default=0)
    return 0


# --- names ---


def device_name(h: HospitalIndex, device_id: str) -> str:
    return h.devices[device_id]["name"] if device_id in h.devices else device_id


def flow_label(h: HospitalIndex, flow_id: str) -> str:
    f = h.flows.get(flow_id)
    if f is None:
        return flow_id
    return f"{device_name(h, f['from'])} → {device_name(h, f['to'])}" + (f" ({f['purpose']})" if f.get("purpose") else "")


def target_label(h: HospitalIndex, kind: str, ids: list[str], most: int = 2) -> str:
    """What a rejection needs, short enough for a chat card: the first `most` targets by
    name and a count for the rest (the full list is on the round's live room page)."""
    def few(names: list[str], what: str) -> str:
        if len(names) <= most:
            return ", ".join(names)
        return f"{len(names)} {what}, including {', '.join(names[:most])}"
    if kind == "keep_flow":
        return "keep " + few([flow_label(h, i) for i in ids], "protected flows")
    if kind == "keep_service":
        return "keep up " + few([h.services[i]["name"] if i in h.services else i for i in ids], "services")
    if kind == "confirm_device":
        return "a human confirms " + few([device_name(h, i) for i in ids], "devices")
    return "fewer rules"


def plural(n: int, word: str) -> str:
    return f"{n} {word}" if n == 1 else f"{n} {word}s"


def affected(result) -> int:
    c = result.patientCounts
    return c.delayed + c.disrupted + c.diverted


# --- cards ---


def help_card(h: HospitalIndex, on_network: list[str]) -> ChatMessage:
    picks = [d for d in PICK_DEVICES if d in on_network] or on_network[:6]
    devices = {"type": "list", "items": [
        item([group([heading(device_name(h, d)), text(f"{h.rooms[h.devices[d]['roomId']]['name']} · {h.devices[d]['type'].replace('_', ' ')}", "muted")], gap=4),
              button("Simulate from here", "simulate", True, device=d)])
        for d in picks
    ]}
    root = section(
        "Hippocra.tech Orchestrator",
        [
            text("I orchestrate three specialist agents (Inventory, Flow, Clinical Workflow) that negotiate a network "
                 "segmentation plan against a simulated ransomware attack on a synthetic hospital. Humans sign off."),
            heading("Where should the attack start?", 2),
            devices,
            DIVIDER,
            group([button("All devices", "devices"), button("Protected clinical flows", "protected"),
                   button("Last round", "status")], direction="row"),
        ],
        subtitle="Simulation only: nothing touches a real network.",
    )
    return message("Pick a device to start a simulated attack from, or type \"simulate ransomware from MRI 2\".", root, True)


def devices_card(h: HospitalIndex, on_network: list[str]) -> ChatMessage:
    by_room: dict[str, list[str]] = {}
    for d in on_network:
        by_room.setdefault(h.rooms[h.devices[d]["roomId"]]["name"], []).append(d)
    rows = {"type": "list", "items": [
        item([heading(room), text(", ".join(device_name(h, d) for d in ds), "muted")])
        for room, ds in sorted(by_room.items())
    ]}
    root = section(f"{len(on_network)} devices on the network", [rows, DIVIDER, button("Pick a device", "help", True)])
    return message("Here is every device an attack can start from. Ask \"what is PACS?\" for details on one.", root)


def protected_card(h: HospitalIndex) -> ChatMessage:
    flows = [f for f in h.flows.values() if f.get("protected") and f.get("active", True)]
    rows = {"type": "list", "items": [
        item([heading(f"{device_name(h, f['from'])} → {device_name(h, f['to'])}"),
              text(f"{f.get('purpose') or 'Protected flow'} · {f['protocol'].upper()}", "muted")])
        for f in flows
    ]}
    root = section(f"{len(flows)} protected clinical flows", [
        text("Clinical engineering marked these as flows care needs. The Clinical Workflow Agent rejects any plan that cuts one."),
        rows,
    ])
    return message("These are the connections no plan may cut.", root)


def device_card(h: HospitalIndex, device_id: str) -> ChatMessage:
    d = h.devices[device_id]
    room = h.rooms[d["roomId"]]
    flows = h.flows_by_device.get(device_id, ())
    services = [s for s in h.services.values() if device_id in s.get("dependsOnDevices", [])]
    badges = [badge(d["type"].replace("_", " ")), badge(f"VLAN {d['vlan']}"), badge(f"{d['criticality']} criticality",
              "warning" if d["criticality"] in ("high", "critical") else "info")]
    if d.get("vulnerable"):
        badges.append(badge("vulnerable", "warning"))
    talks = {"type": "list", "items": [
        item([text(f"{device_name(h, f['from'])} → {device_name(h, f['to'])}"),
              text(f"{f['protocol'].upper()}" + (f" · {f['purpose']}" if f.get("purpose") else "") + (" · protected" if f.get("protected") else ""), "muted")])
        for f in flows
    ]}
    children = [group(badges, direction="row"), heading(f"Talks to ({len(flows)} flows)")]
    children.append(talks if flows else text("No active connections.", "muted"))
    if services:
        children += [heading("Services that depend on it"), text(", ".join(s["name"] for s in services))]
    children += [DIVIDER, button(f"Simulate ransomware from {d['name']}", "simulate", True, device=device_id)]
    root = section(d["name"], children, subtitle=f"{room['name']} · {room['zone'].replace('_', ' ')}")
    return message(f"{d['name']} sits in {room['name']}.", root, True)

# --- the four agents, from the round's events ---

Lane = tuple[str, list[Node]]  # agent name, its badges


def count(events: list[tuple[str, object]], *types: str) -> int:
    return sum(1 for t, _ in events if t in types)


def message_count(events: list[tuple[str, object]]) -> int:
    """Every uAgents message the Coordinator exchanged: a proposal or revision arrives from
    Flow and goes out to both guardians (3), a verdict or a question is one, a
    recommendation goes to the app, not an agent."""
    return sum(3 if t in ("proposal", "revision") else 1 if t in ("verdict", "question") else 0 for t, _ in events)


def lanes(events: list[tuple[str, object]], state: str, round: int) -> list[Lane]:
    """One lane per agent with what it did, as badges: the Coordinator's rounds and messages,
    Flow's plans and revisions, each guardian's accepts, rejects and questions. While the
    round runs, the agent whose turn it is shows "working"."""
    live = state not in ("done", "idle")
    last = events[-1][0] if events else None
    plans = sum(1 + len(m.alternatives) for t, m in events if t in ("proposal", "revision"))
    revisions = count(events, "revision")
    out: list[Lane] = []
    coord = [badge(f"round {round}" if live else plural(round, "round"), "info"),
             badge(f"{plural(message_count(events), 'message')} over Agentverse", "info")]
    if state == "waiting_for_human":
        coord.append(badge("waiting for a human", "warning"))
    elif live:
        coord.append(badge("running", "success"))
    out.append((AGENT_NAMES["coordinator"], coord))
    flow = []
    if plans:
        flow.append(badge(f"tested {plural(plans, 'plan')} in the simulator", "info"))
    if revisions:
        flow.append(badge(f"revised {plural(revisions, 'time')}", "info"))
    if live and (last is None or (last == "verdict" and events[-1][1].decision == "reject")):
        flow.append(badge("working", "success"))
    out.append((AGENT_NAMES["flow"], flow or [badge("waiting", "info")]))
    for who in ("inventory", "clinical_workflow"):
        mine = [m for t, m in events if t == "verdict" and m.agent == who]
        asked = sum(1 for t, m in events if t == "question" and m.agent == who)
        row = []
        ok = sum(1 for m in mine if m.decision == "accept")
        no = len(mine) - ok
        if ok:
            row.append(badge(f"✓ accepted {ok}", "success"))
        if no:
            row.append(badge(f"✕ rejected {no}", "warning"))
        if asked:
            row.append(badge(f"? asked a human {asked}×" if asked > 1 else "? asked a human", "warning"))
        if live and last in ("proposal", "revision"):
            row.append(badge("reviewing", "success"))
        out.append((AGENT_NAMES[who], row or [badge("waiting", "info")]))
    return out


def lanes_list(rows: list[Lane]) -> Node:
    return {"type": "list", "items": [item([heading(name), group(badges, direction="row", gap=6)]) for name, badges in rows]}


def numbers(result, baseline=None) -> list[Node]:
    """A plan's tested numbers as badges. Devices turn green when the plan contains the
    attack better than no plan did."""
    better = baseline is not None and result.infectedCount < baseline.infectedCount
    return [badge(f"{plural(result.infectedCount, 'device')} compromised", "success" if better else "info"),
            badge(f"{plural(affected(result), 'patient')} affected", "info"),
            badge(f"{plural(len(result.removedFlows), 'connection')} cut", "info")]


def started_card(device: str, device_label: str, session_id: str, room_url: str, fixture: bool) -> ChatMessage:
    rows = lanes([], "running", 1)
    children = [text(f"Ransomware starts at {device_label}. The four agents are on it; the result lands here when they finish."),
                lanes_list(rows)]
    if fixture:
        children.append(text("Test numbers come from fixture files while the simulator isn't connected.", "muted"))
    children += [DIVIDER, button("Check progress", "status", True)]
    root = section(f"Round started: {device_label}", children, subtitle=f"Session {session_id}")
    return message(f"Started. Watch the agents negotiate live: [{room_url}]({room_url})", root, True)


def progress_card(session_id: str, device_label: str, events: list[tuple[str, object]], state: str, round: int,
                  room_url: str) -> ChatMessage:
    """The round so far: the four lanes from what the Coordinator has seen."""
    rows = lanes(events, state, round)
    what = "waiting for a human to answer a question" if state == "waiting_for_human" else f"round {round} running"
    children = [lanes_list(rows), DIVIDER, button("Check again", "status", True)]
    root = section(f"In progress: attack from {device_label}", children, subtitle=f"Session {session_id} · {what}")
    return message(f"Still going: {what}. Live: [{room_url}]({room_url})", root, True)


def plan_block(policy_id: str, title: str, result, baseline, by_policy: dict[str, tuple[Node, Node]]) -> Node:
    """One plan on the table: title, its tested numbers, and a verdict row that starts
    with Flow (it proposed) and fills with each guardian's badge."""
    row = group([badge("Flow Agent · proposed", "info")], direction="row", gap=6)
    block = item([heading(title), group(numbers(result, baseline), direction="row", gap=6), row])
    by_policy[policy_id] = (block, row)
    return block


def traffic_line(events: list[tuple[str, object]], round: int) -> str:
    return f"4 agents · {plural(message_count(events), 'message')} over Agentverse · {plural(round, 'round')}"


def summary_card(h: HospitalIndex, session_id: str, device_label: str, events: list[tuple[str, object]],
                 state: str, round: int, fixture: bool, room_url: str, baseline=None) -> ChatMessage:
    """The round as a card, numbers and badges first: the decision strip (no plan → best
    option), the four agents' lanes, one block per plan the Flow Agent put on the table
    with its numbers and each agent's verdict, then the options side by side. Text is
    one line per rejection (what it needs) and one per option."""
    plans: list[Node] = []
    by_policy: dict[str, tuple[Node, Node]] = {}  # policy id → (its block, its verdict row)
    recommendations = []
    for type, m in events:
        if type in ("proposal", "revision"):
            name = m.name or "revised plan"
            title = f"Round {m.round} · {name}"
            plans.append(plan_block(m.policyId, title, m.testResult, baseline, by_policy))
            for a in m.alternatives:
                plans.append(plan_block(a.policyId, f"Round {m.round} · also tested: {a.name}", a.testResult, baseline, by_policy))
        elif type == "verdict" and plans:
            block, row = by_policy.get(m.policyId, next(reversed(by_policy.values())))
            who = AGENT_NAMES[m.agent]
            row["children"].append(badge(f"✓ {who}" if m.decision == "accept" else f"✕ {who}",
                                         "success" if m.decision == "accept" else "warning"))
            if m.decision == "reject" and m.constraint:
                need = target_label(h, m.constraint.kind, m.constraint.targetIds)
                block["children"].append(text(f"{who} needs: {need}.", "muted"))
        elif type == "question" and plans:
            next(reversed(by_policy.values()))[1]["children"].append(badge(f"? {AGENT_NAMES[m.agent]} asked a human", "warning"))
        elif type == "recommendation":
            recommendations.append(m)
    recommendations.sort(key=lambda x: x.option)
    children: list[Node] = []
    # Decision strip
    if recommendations:
        best = min(r.testResult.infectedCount for r in recommendations)
        if baseline is not None:
            children.append(heading(f"{baseline.infectedCount} → {best} devices compromised", 2))
            children.append(text(f"No plan vs the best of {plural(len(recommendations), 'option')} the agents agreed on", "muted"))
        else:
            children.append(heading(f"{plural(len(recommendations), 'option')} agreed · best holds it to {plural(best, 'device')}", 2))
    elif state == "done":
        children.append(heading(f"No agreement after {plural(round, 'round')}", 2))
        if baseline is not None:
            children.append(text(f"Without a plan the attack reached {plural(baseline.infectedCount, 'device')}.", "muted"))
    else:
        children.append(heading(f"Round {round} · {state.replace('_', ' ')}", 2))
    children.append(group([badge(traffic_line(events, round), "info")], direction="row"))
    # The four agents
    children += [heading("The agents"), lanes_list(lanes(events, state, round))]
    if plans:
        children += [heading("Plans tested"), {"type": "list", "items": plans}]
    if recommendations:
        children += [DIVIDER, heading(f"{plural(len(recommendations), 'option')} for humans to choose from", 2)]
        options = []
        for r in recommendations:
            options.append(item([
                heading(f"Option {r.option}: {r.policy.name}"),
                group(numbers(r.testResult, baseline) + [badge(plural(len(r.policy.rules), "rule"), "info")], direction="row", gap=6),
                group([badge(f"{ROLE_NAMES[x]} signs off", "warning") for x in r.requiredRoles], direction="row", gap=6),
                text(r.explanation, "muted"),
            ]))
        children.append({"type": "list", "items": options})
        names = ", ".join(f"\"{r.policy.name}\"" for r in recommendations)
        bubble = (f"The agents agree on {plural(len(recommendations), 'option')}: {names}. "
                  "Humans choose one and sign off; agent agreement is not approval.")
    elif state == "done":
        bubble = f"No agreement after {round} rounds."
    else:
        bubble = f"The round is {state.replace('_', ' ')}."
    if fixture:
        children.append(text("Numbers come from fixture files (the simulator isn't connected yet).", "muted"))
    children += [text("Nothing is applied to any real network.", "muted"),
                 button("Try another device", "help", True)]
    root = section(f"Result: attack from {device_label}", children, subtitle=f"Session {session_id}")
    return message(f"{bubble} Replay the negotiation: [{room_url}]({room_url})", root, True)
