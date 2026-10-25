"""The Coordinator's chat (ASI:One) in plain code: what a message asks for, which device
it names, and the replies. No language model reads the user's text (rule 7), and no
reply calls a plan approved: humans sign off. Pure functions; coordinator.py sends.
"""

import difflib
import json
import re
from dataclasses import dataclass

from facts import AGENT_NAMES, ROLE_NAMES
from logic.hospital import HospitalIndex
from logic.inventory import dormant

DEMO_SEED = 1337
EXAMPLE = "simulate ransomware from MRI 2"

SIMULATE = [
    re.compile(r"\b(?:simulate|start|run|launch|begin|try)\b.*?\b(?:from|on|at|via|with)\s+(?P<device>.+)$", re.I),
    re.compile(r"\b(?:infect|attack|compromise|hit)\s+(?P<device>.+)$", re.I),
    re.compile(r"\bpatient zero\b\s*(?:is|=|:)?\s*(?P<device>.+)$", re.I),
]


LOOKUP = re.compile(r"^(?:what(?:'s| is)(?: an?| the)?|tell me about|info(?:rmation)? (?:on|about)|look ?up|about|describe)\s+(?P<device>.+?)\??$", re.I)
DEVICES = re.compile(r"^(?:(?:list|show)(?: me)?(?: all)?(?: the)? devices|devices|all devices|what devices.*|where can (?:an |the )?attack start.*)\??$", re.I)
PROTECTED = re.compile(r"^(?:(?:list|show)(?: me)?(?: the)? )?(?:protected(?: clinical)? flows?|protected|clinical flows|what flows are protected.*)\??$", re.I)
ACTIONS = {"simulate", "lookup", "devices", "protected", "status", "help"}


@dataclass(frozen=True)
class Command:
    kind: str  # "simulate", "lookup", "devices", "protected", "status" or "help"
    device: str | None = None


def selection(text: str) -> Command | None:
    """A card button's selection, sent back as JSON text (direct chat) or, through
    ASI:One's planner, as prose naming the action and device."""
    t = text.strip()
    if t.startswith("{") and t.endswith("}"):
        try:
            data = json.loads(t)
        except json.JSONDecodeError:
            data = None
        if isinstance(data, dict) and data.get("action") in ACTIONS:
            device = data.get("device")
            return Command(data["action"], device if isinstance(device, str) else None)
    m = re.search(r"\baction\W+(?P<action>simulate|lookup|devices|protected|status|help)\b", t, re.I)
    if m:
        d = re.search(r"\bdevice\W+(?P<device>[a-z0-9_]+)", t, re.I)
        return Command(m.group("action").lower(), d.group("device") if d else None)
    return None


def parse(text: str) -> Command:
    t = " ".join(text.strip().split())
    picked = selection(t)
    if picked is not None:
        return picked
    if DEVICES.fullmatch(t):
        return Command("devices")
    if PROTECTED.fullmatch(t):
        return Command("protected")
    if re.fullmatch(r"(?:what(?:'s| is) the )?(?:status|state)\??", t, re.I):
        return Command("status")
    for pattern in SIMULATE:
        m = pattern.search(t)
        if m:
            device = re.sub(r"^(?:the|device)\s+", "", m.group("device").strip(" .!?\"'`"), flags=re.I)
            return Command("simulate", device or None)
    m = LOOKUP.match(t)
    if m:
        device = re.sub(r"^(?:the|device)\s+", "", m.group("device").strip(" .!?\"'`"), flags=re.I)
        return Command("lookup", device or None)
    # A bare device name ("MRI 2", "PACS", "ct1") opens that device's card: a few words
    # with a digit or an all-caps token, so greetings still get the help card.
    bare = t.strip(" .!?\"'`")
    if bare and len(bare.split()) <= 4 and (re.search(r"\d", bare) or re.search(r"\b[A-Z]{2,}\b", bare)):
        return Command("lookup", bare)
    return Command("help")


FILLER_WORDS = ("the", "a", "an", "device", "machine", "machines", "scanner", "server", "workstation",
                "station", "unit", "system", "room", "please")
FILLER = re.compile(r"\b(?:%s)\b" % "|".join(FILLER_WORDS), re.I)


def _key(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", s.lower())


def _loose(s: str) -> str:
    """A name with filler words dropped, typos included ("mri mchine 1" → "mri1"), for a second try."""
    kept = [w for w in re.findall(r"[a-z0-9]+", s.lower())
            if not (w in FILLER_WORDS or difflib.get_close_matches(w, FILLER_WORDS, n=1, cutoff=0.75))]
    return "".join(kept)


def devices_on_network(h: HospitalIndex) -> list[str]:
    """Device ids a round can start from: not dormant (a challenge-only device is off the network)."""
    return sorted(d for d in h.devices if not dormant(h, d))


def resolve_device(h: HospitalIndex, query: str) -> str | None:
    """A device id from an id or a name, ignoring case, spaces and punctuation ("mri2" = "MRI 2")."""
    wanted = _key(query)
    for d in devices_on_network(h):
        if wanted in (_key(d), _key(h.devices[d]["name"])):
            return d
    # Second try: without filler words, then the closest name by spelling (typos like
    # "mri mchine 1"), only when one name is clearly closest.
    loose = _loose(query)
    keyed = {d: (_key(d), _loose(h.devices[d]["name"])) for d in devices_on_network(h)}
    for d, keys in keyed.items():
        if loose and loose in keys:
            return d
    close = difflib.get_close_matches(loose, [k[1] for k in keyed.values()], n=2, cutoff=0.75)
    if len(close) == 1 or (len(close) == 2 and close[0] != close[1]
                           and difflib.SequenceMatcher(None, loose, close[0]).ratio() > difflib.SequenceMatcher(None, loose, close[1]).ratio()):
        return next(d for d, keys in keyed.items() if keys[1] == close[0])
    return None


def unknown_device(h: HospitalIndex, query: str) -> str:
    names = [h.devices[d]["name"] for d in devices_on_network(h)]
    close = difflib.get_close_matches(FILLER.sub(" ", query).strip(), names, n=3, cutoff=0.5)
    some = close or [n for n in ("MRI 2", "CT 1", "PACS", "File server", "ER WS 1", "ICU nurse station") if n in names]
    return (f"I don't know a device called \"{query}\" in this hospital. "
            f"Try one of: {', '.join(some)}. For example: {EXAMPLE}.")


def help_text() -> str:
    return (
        "I'm the Hippocra.tech Sign-off Coordinator. I run four agents' negotiation over a simulated "
        "ransomware attack on a synthetic hospital. You can say:\n"
        f"• \"{EXAMPLE}\": start a round from that device (I'll send a summary when it ends)\n"
        "• \"status\": the state of the last round\n"
        "• \"what is PACS?\", \"devices\", \"protected flows\": look things up in the hospital\n"
        "Nothing here touches a real network, and only humans can sign off a plan."
    )


def started(device_name: str, session_id: str, fixture: bool) -> str:
    note = " Results come from fixture files while the simulator isn't connected." if fixture else ""
    return (f"Started a round from {device_name} (session {session_id}). The Flow Agent is proposing a plan; "
            f"I'll send you a summary when the round ends.{note}")


def could_not_start(device_name: str, detail: str) -> str:
    return f"I couldn't start a round from {device_name}: {detail}"


# --- the round summary, from the messages the Coordinator saw ---


def _said(text: str | None, source: str | None) -> str:
    if not text:
        return ""
    return f": \"{text}\""


def summary(h: HospitalIndex, session_id: str, device_name: str, events: list[tuple[str, object]],
            state: str, round: int, fixture: bool) -> str:
    """events: (type, message) in the order the Coordinator saw them: proposal, revision,
    verdict, question, recommendation."""
    lines = [f"Round summary for session {session_id} (attack starting at {device_name}):"]
    recommendation = None
    for type, m in events:
        if type == "proposal":
            lines.append(f"• Round {m.round}: the Flow Agent proposed \"{m.name}\"{_said(m.reason, m.reasonSource)}")
        elif type == "revision":
            lines.append(f"• Round {m.round}: the Flow Agent revised the plan{_said(m.reason, m.reasonSource)}")
        elif type == "verdict":
            who = AGENT_NAMES[m.agent]
            if m.decision == "accept":
                lines.append(f"   ● {who} accepted{_said(m.reason, m.reasonSource)}")
            else:
                needs = f" It needs: {m.constraint.kind.replace('_', ' ')} {', '.join(m.constraint.targetIds)}." if m.constraint else ""
                lines.append(f"   ✕ {who} rejected{_said(m.reason, m.reasonSource)}{needs}")
        elif type == "question":
            lines.append(f"   ? The Inventory Agent asked a human about {h.devices[m.targetId]['name']}{_said(m.text, m.textSource)}")
        elif type == "recommendation":
            recommendation = m
    if recommendation is not None:
        roles = ", ".join(ROLE_NAMES[r] for r in recommendation.requiredRoles)
        lines.append(f"Result: the agents agree on \"{recommendation.policy.name}\""
                     f"{_said(recommendation.explanation, recommendation.explanationSource)}")
        lines.append(f"This is a recommendation, not a decision: {roles} must sign off in the Hippocra.tech app.")
    elif state == "done":
        lines.append(f"Result: no agreement after {round} rounds, so there is no recommendation.")
    else:
        lines.append(f"The round is {state.replace('_', ' ')} (round {round}).")
    if fixture:
        lines.append("Numbers come from fixture files (the simulator isn't connected yet).")
    lines.append("Nothing is applied to any real network.")
    return "\n".join(lines)


def status(last: tuple[str, str, str, int, bool] | None) -> str:
    """last: (session id, device name, state, round, has recommendation), or None."""
    if last is None:
        return f"No round has run yet. Try: {EXAMPLE}"
    session_id, device_name, state, round, has_rec = last
    result = " The agents agreed on a recommendation; humans must sign off." if has_rec else ""
    if state == "done" and not has_rec:
        result = " It ended with no agreement."
    return f"Last round: session {session_id}, attack starting at {device_name}, round {round}, {state.replace('_', ' ')}.{result}"
