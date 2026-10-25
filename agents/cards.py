"""ASI:One interactive cards for the orchestrator's chat replies, built in code.

Each reply is a ChatMessage with a short text bubble and a MetadataContent block that
ASI:One renders as a card (Agentverse "agent-driven interactive cards", element-tree
primitives: section, group, heading, text, badge, list, button, divider; depth <= 8).
A button's `selection` comes back as a ChatMessage whose text is that JSON object (or,
through ASI:One's planner, prose naming it); chat.selection() reads it.

Two cards only: the device picker (the one question that is better tapped than typed)
and the recommendation (the round's result). Everything else is prose from brain.py.

Every value on a card comes from the hospital file or from the messages the
Coordinator saw (rule 16). Agent acceptance is never called approval (rule 9).
"""

import json
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from uagents_core.contrib.protocols.chat import ChatMessage, MetadataContent, TextContent

from facts import ROLE_NAMES
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


def affected(result) -> int:
    c = result.patientCounts
    return c.delayed + c.disrupted + c.diverted


# --- cards ---


def picker_card(h: HospitalIndex, on_network: list[str], bubble: str) -> ChatMessage:
    """Six devices an attack can start from, one tap each. The only card a question gets."""
    picks = [d for d in PICK_DEVICES if d in on_network] or on_network
    picks = (picks + [d for d in on_network if d not in picks])[:6]
    rows = {"type": "list", "items": [
        item([heading(device_name(h, d), 4), text(f"{h.zone(d).replace('_', ' ')} · {h.devices[d]['type']}", "muted")],
             "simulate", device=d)
        for d in picks]}
    root = section("Where should the attack start?", [rows], subtitle="Simulation only: nothing touches a real network.")
    return message(bubble, root, True)


def recommendation_card(h: HospitalIndex, session_id: str, rec, baseline, room_url: str, bubble: str) -> ChatMessage:
    """The round's result: the plan, before and after, who must sign off, the live room."""
    before = baseline
    after = rec.testResult
    pair = lambda label, b, a: group([text(label, "muted"), text(f"{b} → {a}" if b is not None else str(a))], gap=2)
    numbers = group([
        pair("Infected devices", before.infectedCount if before else None, after.infectedCount),
        pair("Patients affected", affected(before) if before else None, affected(after)),
    ], direction="row", gap=16)
    roles = group([badge(ROLE_NAMES[r], "warning") for r in rec.requiredRoles], direction="row", gap=6)
    children = [heading(rec.policy.name), numbers, text(rec.explanation), DIVIDER,
                text("Must sign off in the Hippocra.tech app (agents agreeing is not approval):", "muted"), roles,
                button("Open the live room", "open", True, url=room_url)]
    root = section("Recommendation", children, subtitle=f"Session {session_id}")
    return message(bubble, root, False)
