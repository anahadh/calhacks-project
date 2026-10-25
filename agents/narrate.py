"""Live narration for the ASI:One thread: one status line per negotiation event, built in
code from the message the Coordinator just saw. No model: the line must land within a
second of the event, and the reasons it quotes were already worded and checked when the
round ran. Every number comes from the message (rule 16); agents are named by their
Agentverse handle so a judge sees who is speaking.
"""

import re
from logic.hospital import HospitalIndex
from protocol import Proposal, Question, Recommendation, Revision, RunResult, Verdict
from runtime import PROFILES

import cards


def handle(agent: str) -> str:
    return "@" + PROFILES[agent].handle


def _tag(agent: str, round: int | None = None) -> str:
    return f"[ {handle(agent)} · round {round} ]" if round is not None else f"[ {handle(agent)} ]"


def started(h: HospitalIndex, baseline: RunResult) -> str:
    return (f"Without any segmentation, the attack reaches {baseline.infectedCount} devices in {baseline.ticks} ticks. "
            f"Asking {handle('flow')} for a plan…")


MARK = {"hippocratech-flow": ("🟦", "Flow"), "hippocratech-inventory": ("🟨", "Inventory"),
        "hippocratech-clinical-workflow": ("🟩", "Clinical Workflow"), "hippocratech-coordinator": ("🟪", "Coordinator")}
_TAG = re.compile(r"^\[ @(?P<h>[a-z-]+)(?: · round (?P<r>\d+))? \] (?P<rest>.*)$")


def pretty(line: str) -> str:
    """A trace line for people: a colored marker and the agent's name in bold, then what it did."""
    m = _TAG.match(line)
    if not m or m.group("h") not in MARK:
        return line
    if m.group("h") == "hippocratech-coordinator" and m.group("rest").startswith("MCP "):
        return f"🔧 **MCP** — {m.group('rest')[4:]}"
    dot, name = MARK[m.group("h")]
    rnd = f" · round {m.group('r')}" if m.group("r") else ""
    return f"{dot} **{name}**{rnd} — {m.group('rest')}"


def render(lines: list[str]) -> str:
    """The trace as chat text: plain-English lines, one paragraph each (ASI:One renders
    markdown). The Coordinator's handoffs stay on the card only; MCP calls are shown."""
    keep = [l for l in lines if not (l.startswith("[ @hippocratech-coordinator ]") and " MCP " not in l
                                     and "agree on" not in l)]
    return "\n\n".join(pretty(l) for l in keep)


def failed(agent: str, error: str) -> str:
    return f"{_tag(agent)} failed: {error}"


def mcp(tool: str, arg: str, result: str) -> str:
    """A visible MCP call the Coordinator made."""
    return f"{_tag('coordinator')} MCP hospital.{tool}({arg}) → {result}."


def handoff(to: str, type: str, round: int) -> str:
    """The Coordinator handing work to a specialist: one line per message it sends, so the
    thread shows every call between agents, not only their answers."""
    what = {
        "proposal_request": "asked {to} for a plan" if round == 1 else "asked {to} to revise the plan",
        "proposal": "sent the plan to {to} for a verdict",
        "revision": "sent the revised plan to {to} for a verdict",
        "answer": "passed a human's answer to {to}",
    }.get(type, f"sent {type} to {{to}}")
    return f"{_tag('coordinator')} {what.format(to=handle(to))} (round {round})."


def line(h: HospitalIndex, type: str, msg, baseline: RunResult | None = None) -> str:
    """type: proposal | revision | verdict | question | recommendation."""
    if type == "proposal":
        assert isinstance(msg, Proposal)
        without = f", {baseline.infectedCount} without" if baseline is not None else ""
        return f'{_tag("flow", msg.round)} proposed "{msg.name}": {msg.testResult.infectedCount} devices infected with it{without}.'
    if type == "revision":
        assert isinstance(msg, Revision)
        named = f', now "{msg.name}"' if msg.name else ""
        why = f" {msg.reason}" if msg.reason else ""
        without = f", {baseline.infectedCount} without" if baseline is not None else ""
        return (f"{_tag('flow', msg.round)} revised the plan{named}:{why} "
                f"{msg.testResult.infectedCount} devices infected with it{without}.")
    if type == "verdict":
        assert isinstance(msg, Verdict)
        if msg.decision == "accept":
            return f"{_tag(msg.agent, msg.round)} accepted."
        needs = f" Needs: {cards.target_label(h, msg.constraint.kind, msg.constraint.targetIds)}." if msg.constraint else ""
        return f"{_tag(msg.agent, msg.round)} rejected: {msg.reason}{needs}"
    if type == "question":
        assert isinstance(msg, Question)
        return f"{_tag(msg.agent, msg.round)} asking a human to confirm {cards.device_name(h, msg.targetId)}."
    if type == "recommendation":
        assert isinstance(msg, Recommendation)
        return f'{_tag("coordinator")} the agents agree on "{msg.policy.name}".'
    raise ValueError(f"no narration for {type}")
