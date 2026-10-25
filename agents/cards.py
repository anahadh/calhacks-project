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
import re
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
    # The documented wire format (Agentverse "agent-driven interactive cards"): every card,
    # informational ones included, carries requires_card_interaction "true" (the Innovation
    # Lab examples do the same); is_terminal "true" marks a card that needs no input, so the
    # planner is not paused. A card that fails validation is shown as plain text, so the
    # tree is checked here first.
    validate(root)
    meta = {
        "card_protocol_version": CARD_PROTOCOL_VERSION,
        "requires_card_interaction": "true",
        "card_kind": "custom",
        "card_payload": json.dumps({"root": root}),
        "preferred_drawer_width_px": "560",
    }
    if not interactive:
        meta["is_terminal"] = "true"
    return meta


ELEMENTS = {"section", "group", "divider", "text", "heading", "image", "badge", "button", "input", "list", "choice_grid"}
BADGE_VARIANTS = {"info", "success", "warning"}
TEXT_STYLES = {"body", "muted", "emphasis"}
HEADING_LEVELS = {1, 2, 3}


def validate(node: Any, level: int = 1) -> None:
    """Raise ValueError when a tree breaks the element-tree schema ASI:One documents."""
    if not isinstance(node, dict) or node.get("type") not in ELEMENTS:
        raise ValueError(f"unknown element type: {node.get('type') if isinstance(node, dict) else node!r}")
    if level > 8:
        raise ValueError("nesting deeper than 8")
    t = node["type"]
    if t == "badge" and node.get("variant", "info") not in BADGE_VARIANTS:
        raise ValueError(f"badge variant {node.get('variant')!r}; allowed: {sorted(BADGE_VARIANTS)}")
    if t == "heading" and node.get("level", 2) not in HEADING_LEVELS:
        raise ValueError(f"heading level {node.get('level')!r}; allowed: 1, 2, 3")
    if t == "text" and node.get("style", "body") not in TEXT_STYLES:
        raise ValueError(f"text style {node.get('style')!r}; allowed: {sorted(TEXT_STYLES)}")
    for k in node.get("children", []):
        validate(k, level + 1)
    for i in node.get("items", []):
        for k in i.get("children", []):
            validate(k, level + 1)


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


def hospital_card(h: HospitalIndex, on_network: list[str], image: str, bubble: str) -> ChatMessage:
    """The hospital at a glance: the floor-plan image, the counts, and six devices to start an attack from."""
    picks = [d for d in PICK_DEVICES if d in on_network][:6]
    protected = sum(1 for f in h.flows.values() if f.get("protected") and f.get("active", True))
    stats = group([group([heading(str(n), 2), text(label, "muted")], gap=2) for n, label in
                   ((len(h.rooms), "rooms"), (len(h.devices), "devices"), (protected, "protected clinical flows"))],
                  direction="row", gap=24)
    rows = {"type": "list", "items": [
        item([group([badge(h.zone(d).replace("_", " "), "info"), text(device_name(h, d), "body")], direction="row", gap=8)],
             "simulate", device=d) for d in picks]}
    root = section(f"{h.name}" if hasattr(h, "name") else "Your hospital",
                   [{"type": "image", "src": image, "alt": "Floor plan of the hospital", "aspect_ratio": "3:2"}, stats, DIVIDER,
                    text("Tap a device to simulate a ransomware attack starting there:", "muted"), rows],
                   subtitle="Synthetic hospital · simulation only")
    return message(bubble, root, True)


def picker_card(h: HospitalIndex, on_network: list[str], bubble: str) -> ChatMessage:
    """Six devices an attack can start from, one tap each. The only card a question gets."""
    picks = [d for d in PICK_DEVICES if d in on_network] or on_network
    picks = (picks + [d for d in on_network if d not in picks])[:6]
    rows = {"type": "list", "items": [
        item([heading(device_name(h, d), 3), text(f"{h.zone(d).replace('_', ' ')} · {h.devices[d]['type']}", "muted")],
             "simulate", device=d)
        for d in picks]}
    root = section("Where should the attack start?", [rows], subtitle="Simulation only: nothing touches a real network.")
    return message(bubble, root, True)


TRACE_LINES = 30
AGENT_STATES = (  # the last line naming the handle decides the badge; variants are ASI:One's three
    ("rejected", "rejected", "warning"), ("accepted", "accepted", "success"), ("proposed", "proposed", "info"),
    ("revised", "revised", "info"), ("asking a human", "asking a human", "warning"), ("failed", "failed", "warning"),
    ("asked", "working", "info"), ("asking", "working", "info"), ("sent the", "judging", "info"),
)
SHORT = {"hippocratech-flow": "Flow", "hippocratech-inventory": "Inventory", "hippocratech-clinical-workflow": "Clinical",
         "hippocratech-coordinator": "Coordinator"}
TAG = re.compile(r"^\[ @(?P<handle>[a-z-]+)(?: · round (?P<round>\d+))? \] (?P<rest>.*)$")
ROUND_IN_TEXT = re.compile(r"\(round (?P<round>\d+)\)\.?$")


def agent_state(lines: list[str], handle: str) -> tuple[str, str]:
    """(label, variant) for one agent from the trace: what the last line about it says."""
    for line in reversed(lines):
        if handle not in line:
            continue
        for needle, label, variant in AGENT_STATES:
            if needle in line:
                return label, variant
        return "working", "info"
    return "idle", "info"


AGENT_OF_HANDLE = {"hippocratech-flow": "flow", "hippocratech-inventory": "inventory",
                   "hippocratech-clinical-workflow": "clinical_workflow"}


def trace_row(line: str) -> Node:
    """One trace line as a list row: who (badge) and what (text). A specialist's row is
    tappable: the tap asks that agent to explain the line. The Coordinator's handoffs are
    muted and not tappable."""
    m = TAG.match(line)
    if not m:
        return item([text(line, "emphasis")])
    who = SHORT.get(m.group("handle"), m.group("handle"))
    rest = ROUND_IN_TEXT.sub("", m.group("rest")).strip()
    agent = AGENT_OF_HANDLE.get(m.group("handle"))
    if agent is None:
        return item([text(f"{who}: {rest}", "muted")])
    label, variant = agent_state([line], "@" + m.group("handle"))
    return item([group([badge(who, variant), text(rest, "body")], direction="row", gap=8)], "ask", agent=agent, about=line)


def round_of(line: str, current: int) -> int:
    m = TAG.match(line)
    if m and m.group("round"):
        return int(m.group("round"))
    m2 = ROUND_IN_TEXT.search(line)
    return int(m2.group("round")) if m2 else current


def trace_card(h: HospitalIndex, session_id: str, device_label: str, lines: list[str], round: int, state: str,
               room_url: str, image: str | None = None) -> ChatMessage:
    """The live negotiation as a card: each agent's state as a badge, then the trace grouped
    by round (who did what, in order), then the live-room button. The bubble is the whole
    trace as text, so the one message ASI:One shows per turn carries everything so far."""
    from runtime import PROFILES
    import narrate
    lanes = {"type": "list", "items": [
        item([group([badge(*agent_state(lines, "@" + PROFILES[a].handle)), text("@" + PROFILES[a].handle, "muted"),
                     text("tap to ask", "muted")], direction="row", gap=8)], "ask", agent=a, about="")
        for a in ("flow", "inventory", "clinical_workflow")]}
    children: list[Node] = ([{"type": "image", "src": image, "alt": "Where the attack spreads with no plan", "aspect_ratio": "3:2"}]
                            if image else []) + [lanes, DIVIDER]
    current, open_round = 0, None
    shown = [l for l in lines if not (l.startswith("[ @hippocratech-coordinator ]") and " MCP " not in l and "agree on" not in l)]
    for line in shown[-TRACE_LINES:]:
        r = round_of(line, current)
        if r != current or open_round is None:
            if r != current:
                current = r
            open_round = {"type": "list", "items": []}
            children += [heading(f"Round {current}" if current else "Start", 3), open_round]
        open_round["items"].append(trace_row(line))
    root = section(f"Negotiation · round {round} · {state.replace('_', ' ')}", children,
                   subtitle=f"Attack from {device_label} · session {session_id}")
    return message(narrate.render(lines), root, False)


def recommendation_card(h: HospitalIndex, session_id: str, rec, baseline, room_url: str, bubble: str,
                        chart: str | None = None, floor: str | None = None) -> ChatMessage:
    """The round's result: the plan, before and after, who must sign off, and a button per
    agent to ask it why (the link out to the web app is gone: judges stay in ASI:One)."""
    from runtime import PROFILES
    before = baseline
    after = rec.testResult
    pair = lambda label, b, a: group([text(label, "muted"), text(f"{b} → {a}" if b is not None else str(a))], gap=2)
    numbers = group([
        pair("Infected devices", before.infectedCount if before else None, after.infectedCount),
        pair("Patients affected", affected(before) if before else None, affected(after)),
    ], direction="row", gap=16)
    roles = group([badge(ROLE_NAMES[r], "warning") for r in rec.requiredRoles], direction="row", gap=6)
    children = ([{"type": "image", "src": floor, "alt": "The attack without and with the plan", "aspect_ratio": "8:3"}] if floor else []) + \
               ([{"type": "image", "src": chart, "alt": "Devices infected per plan the agents negotiated", "aspect_ratio": "16:9"}]
                if chart else []) + [heading(rec.policy.name), numbers, text(rec.explanation), DIVIDER,
                text("Must sign off in the Hippocra.tech app (agents agreeing is not approval):", "muted"), roles, DIVIDER,
                text("Ask an agent why:", "muted"),
                group([button(f"Ask {SHORT[PROFILES[a].handle]}", "ask", False, agent=a, about="")
                       for a in ("flow", "inventory", "clinical_workflow")], direction="row", gap=8)]
    root = section("Recommendation", children, subtitle=f"Session {session_id}")
    return message(bubble, root, False)
