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


def started_card(device: str, device_label: str, session_id: str, room_url: str, fixture: bool) -> ChatMessage:
    lanes = {"type": "list", "items": [
        item([group([heading("Flow Agent"), text("Proposing a segmentation plan and testing it in the simulator", "muted")], gap=4), badge("working", "info")]),
        item([group([heading("Inventory Agent"), text("Checking every device the plan touches can be named", "muted")], gap=4), badge("working", "info")]),
        item([group([heading("Clinical Workflow Agent"), text("Will review the plan against protected clinical flows", "muted")], gap=4), badge("waiting", "info")]),
    ]}
    children = [text(f"Ransomware starts at {device_label}. I'm coordinating the three agents now and will send the result here."),
                lanes]
    if fixture:
        children.append(text("Test numbers come from fixture files while the simulator isn't connected.", "muted"))
    children += [DIVIDER, button("Check progress", "status")]
    root = section(f"Round started: {device_label}", children, subtitle=f"Session {session_id}")
    return message(f"Started. Watch the agents negotiate live: [{room_url}]({room_url})", root)


def plan_block(policy_id: str, title: str, what: str, result, reason: str | None, by_policy: dict[str, tuple[Node, Node]]) -> Node:
    """One plan on the table: title, its tested numbers, the Flow Agent's reason, and an
    (initially empty) row the guardians' verdict badges go into; their reasons follow it."""
    children = [heading(title),
                text(f"{what} · tested: {plural(affected(result), 'patient')} affected, "
                     f"{plural(result.infectedCount, 'device')} compromised", "muted")]
    if reason:
        children.append(text(f"Flow Agent: {reason.strip()}", "muted"))
    row = group([], direction="row")
    children.append(row)
    block = item(children)
    by_policy[policy_id] = (block, row)
    return block


def traffic_line(events: list[tuple[str, object]], round: int) -> str:
    """"4 agents · 11 messages over Agentverse · 2 rounds": every uAgents message the
    Coordinator exchanged in the round, counted from what it saw. A proposal or revision
    arrives from Flow and goes out to both guardians (3 messages); a verdict or a question
    is one; a recommendation goes to the app, not an agent."""
    n = sum(3 if t in ("proposal", "revision") else 1 if t in ("verdict", "question") else 0 for t, _ in events)
    return f"4 agents · {plural(n, 'message')} over Agentverse · {plural(round, 'round')}"


def summary_card(h: HospitalIndex, session_id: str, device_label: str, events: list[tuple[str, object]],
                 state: str, round: int, fixture: bool, room_url: str) -> ChatMessage:
    """The round as a card: a header with how many agents and messages it took, one block
    per plan the Flow Agent put on the table (the lead plan and its alternatives, each
    with its test result and each guardian's verdict and reason), then the options for
    humans (or no agreement). events as chat.summary takes them."""
    plans: list[Node] = []
    by_policy: dict[str, tuple[Node, Node]] = {}  # policy id → (its block, its badge row), so a verdict lands on the plan it judged
    recommendations = []
    for type, m in events:
        if type in ("proposal", "revision"):
            title = f"Round {m.round} · {m.name}" if type == "proposal" else f"Round {m.round} · revised plan"
            rules = len(m.rules) if type == "proposal" else len(m.diff.added) + len(m.diff.removed)
            what = plural(rules, "rule") if type == "proposal" else plural(rules, "change")
            plans.append(plan_block(m.policyId, title, what, m.testResult, m.reason, by_policy))
            for a in m.alternatives:
                plans.append(plan_block(a.policyId, f"Round {m.round} · also tested: {a.name}", plural(len(a.rules), "rule"),
                                        a.testResult, a.reason, by_policy))
        elif type == "verdict" and plans:
            block, row = by_policy.get(m.policyId, next(reversed(by_policy.values())))
            who = AGENT_NAMES[m.agent]
            row["children"].append(badge(f"✓ {who}" if m.decision == "accept" else f"✕ {who}",
                                         "success" if m.decision == "accept" else "warning"))
            said = m.reason.strip() if m.reason else ""
            if m.decision == "reject" and m.constraint:
                need = target_label(h, m.constraint.kind, m.constraint.targetIds)
                block["children"].append(text(f"{who}: {said} Needs: {need}." if said else f"{who} needs: {need}", "muted"))
            elif said:
                block["children"].append(text(f"{who}: {said}", "muted"))
        elif type == "question" and plans:
            next(reversed(by_policy.values()))[1]["children"].append(badge("? asked a human", "warning"))
        elif type == "recommendation":
            recommendations.append(m)
    children: list[Node] = [text(traffic_line(events, round), "emphasis")]
    if plans:
        children.append({"type": "list", "items": plans})
    if recommendations:
        children += [DIVIDER, heading(f"{plural(len(recommendations), 'option')} for humans to choose from", 2)]
        options = []
        for r in sorted(recommendations, key=lambda x: x.option):
            options.append(item([
                heading(f"Option {r.option}: {r.policy.name}"),
                text(r.explanation),
                text(f"{plural(affected(r.testResult), 'patient')} affected · {plural(r.testResult.infectedCount, 'device')} compromised · "
                     f"{plural(len(r.testResult.removedFlows), 'connection')} cut", "emphasis"),
                group([badge(f"{ROLE_NAMES[x]} must sign off", "warning") for x in r.requiredRoles], direction="row"),
            ]))
        children.append({"type": "list", "items": options})
        names = ", ".join(f"\"{r.policy.name}\"" for r in sorted(recommendations, key=lambda x: x.option))
        bubble = (f"The agents agree on {plural(len(recommendations), 'option')}: {names}. "
                  "Humans choose one and sign off; agent agreement is not approval.")
    elif state == "done":
        children += [DIVIDER, text(f"No agreement after {round} rounds, so there is no recommendation.", "emphasis")]
        bubble = f"No agreement after {round} rounds."
    else:
        children += [DIVIDER, text(f"The round is {state.replace('_', ' ')} (round {round}).", "emphasis")]
        bubble = f"The round is {state.replace('_', ' ')}."
    if fixture:
        children.append(text("Numbers come from fixture files (the simulator isn't connected yet).", "muted"))
    children += [text("Nothing is applied to any real network.", "muted"),
                 group([button("Try another device", "help", True), button("Last round", "status")], direction="row")]
    root = section(f"Result: attack from {device_label}", children, subtitle=f"Session {session_id}")
    return message(f"{bubble} Replay the negotiation: [{room_url}]({room_url})", root, True)
