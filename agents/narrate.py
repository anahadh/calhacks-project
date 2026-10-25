"""Live narration for the ASI:One thread: one status line per negotiation event, built in
code from the message the Coordinator just saw. No model: the line must land within a
second of the event, and the reasons it quotes were already worded and checked when the
round ran. Every number comes from the message (rule 16); agents are named by their
Agentverse handle so a judge sees who is speaking.
"""

from logic.hospital import HospitalIndex
from protocol import Proposal, Question, Recommendation, Revision, RunResult, Verdict
from runtime import PROFILES

import cards


def handle(agent: str) -> str:
    return "@" + PROFILES[agent].handle


def _tag(agent: str, round: int | None = None) -> str:
    return f"[ {handle(agent)} · round {round} ]" if round is not None else f"[ {handle(agent)} ]"


def started(h: HospitalIndex, baseline: RunResult) -> str:
    return (f"Baseline: {baseline.infectedCount} devices infected over {baseline.ticks} ticks. "
            f"Asking {handle('flow')} for a plan…")


def failed(agent: str, error: str) -> str:
    return f"{_tag(agent)} failed: {error}"


def line(h: HospitalIndex, type: str, msg, baseline: RunResult | None = None) -> str:
    """type: proposal | revision | verdict | question | recommendation."""
    if type == "proposal":
        assert isinstance(msg, Proposal)
        without = f", {baseline.infectedCount} without" if baseline is not None else ""
        return f'{_tag("flow", msg.round)} proposed "{msg.name}": {msg.testResult.infectedCount} devices infected with it{without}.'
    if type == "revision":
        assert isinstance(msg, Revision)
        change = f"{len(msg.diff.added)} rules added, {len(msg.diff.removed)} removed"
        return f"{_tag('flow', msg.round)} revised: {change}, {msg.testResult.infectedCount} infected."
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
