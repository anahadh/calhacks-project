"""The Coordinator's chat (ASI:One) in plain code: what a message asks for, which device
it names, and the replies. No language model reads the user's text (rule 7), and no
reply calls a plan approved: humans sign off. Pure functions; coordinator.py sends.
"""

import difflib
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


@dataclass(frozen=True)
class Command:
    kind: str  # "simulate", "status" or "help"
    device: str | None = None


def parse(text: str) -> Command:
    t = " ".join(text.strip().split())
    if re.fullmatch(r"(?:what(?:'s| is) the )?(?:status|state)\??", t, re.I):
        return Command("status")
    for pattern in SIMULATE:
        m = pattern.search(t)
        if m:
            device = re.sub(r"^(?:the|device)\s+", "", m.group("device").strip(" .!?\"'`"), flags=re.I)
            return Command("simulate", device or None)
    return Command("help")


def _key(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", s.lower())


def devices_on_network(h: HospitalIndex) -> list[str]:
    """Device ids a round can start from: not dormant (a challenge-only device is off the network)."""
    return sorted(d for d in h.devices if not dormant(h, d))


def resolve_device(h: HospitalIndex, query: str) -> str | None:
    """A device id from an id or a name, ignoring case, spaces and punctuation ("mri2" = "MRI 2")."""
    wanted = _key(query)
    for d in devices_on_network(h):
        if wanted in (_key(d), _key(h.devices[d]["name"])):
            return d
    return None


def unknown_device(h: HospitalIndex, query: str) -> str:
    names = [h.devices[d]["name"] for d in devices_on_network(h)]
    close = difflib.get_close_matches(query, names, n=3, cutoff=0.5)
    some = close or [n for n in ("MRI 2", "CT 1", "PACS", "File server", "ER WS 1", "ICU nurse station") if n in names]
    return (f"I don't know a device called \"{query}\" in this hospital. "
            f"Try one of: {', '.join(some)}. For example: {EXAMPLE}.")


def help_text() -> str:
    return (
        "I'm the Hippocra.tech Sign-off Coordinator. I run four agents' negotiation over a simulated "
        "ransomware attack on a synthetic hospital. You can say:\n"
        f"• \"{EXAMPLE}\": start a round from that device (I'll send a summary when it ends)\n"
        "• \"status\": the state of the last round\n"
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
    return f": \"{text}\"" + (" (template)" if source == "template" else "")


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
