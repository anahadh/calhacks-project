"""Inventory Agent: never act on a device nobody can name."""

from typing import get_args

from protocol import Constraint, DeviceType, Question, RunResult, Verdict

from .hospital import HospitalIndex

AGENT = "inventory"
# Every type a human can name a device as. "unknown" is what we're asking about.
CHOICES = [t for t in get_args(DeviceType) if t != "unknown"]
ALLOWED_ROLES = ["clinical_engineering", "security"]


def flagged_devices(hospital: HospitalIndex, confirmed: dict[str, str]) -> set[str]:
    """Devices nobody can name: type "unknown" (unless a human confirmed a type) or no flows.

    TODO: once data/hospitals/demo.json gives devices a make and model, also flag
    devices missing either (spec: The Agents). The mock has neither on any device,
    so flagging them now would flag everything (AGENT_NOTES.md, note b).
    """
    out = set()
    for device_id, device in hospital.devices.items():
        unknown = device["type"] == "unknown" and device_id not in confirmed
        if unknown or not hospital.flows_by_device[device_id]:
            out.add(device_id)
    return out


def question(session_id: str, round: int, device_id: str) -> Question:
    return Question(
        sessionId=session_id,
        id=f"q-r{round}-{device_id}",
        round=round,
        agent=AGENT,
        targetId=device_id,
        text="[question]",
        choices=CHOICES,
        allowedRoles=ALLOWED_ROLES,
    )


def preflight(
    session_id: str, round: int, baseline: RunResult, hospital: HospitalIndex, confirmed: dict[str, str]
) -> list[Question]:
    """One question per flagged device on the baseline's infection path: an infected
    device, or the other end of a flow touching one."""
    infected = {d.id for d in baseline.infectedDevices}
    path = set(infected)
    for device_id in infected:
        path |= hospital.endpoints(f["id"] for f in hospital.flows_by_device[device_id])
    return [question(session_id, round, d) for d in sorted(flagged_devices(hospital, confirmed) & path)]


def check(
    session_id: str, round: int, policy_id: str, result: RunResult, hospital: HospitalIndex, confirmed: dict[str, str]
) -> tuple[Verdict, Question | None]:
    """Reject a policy that touches a flagged device, and ask about the first one.
    When several are touched, the others are asked about on later checks, one at a time."""
    touched = sorted(flagged_devices(hospital, confirmed) & hospital.touched(result))
    if not touched:
        return Verdict(sessionId=session_id, round=round, policyId=policy_id, agent=AGENT, decision="accept", reason="[reason]"), None
    verdict = Verdict(
        sessionId=session_id,
        round=round,
        policyId=policy_id,
        agent=AGENT,
        decision="reject",
        reason="[reason]",
        constraint=Constraint(kind="confirm_device", targetIds=touched),
    )
    return verdict, question(session_id, round, touched[0])
