"""Clinical Workflow Agent: keep care running."""

from protocol import Constraint, RunResult, Verdict

from .hospital import HospitalIndex

AGENT = "clinical_workflow"
# No critical service may be down for more than this many ticks (spec: Open Questions default).
MAX_SERVICE_LOSS = 2


def unavoidable_services(result: RunResult, hospital: HospitalIndex) -> set[str]:
    """Services that depend on patient zero (the device infected at tick 0).

    A service is down while any device it depends on is infected, so these are down
    from tick 0 under every policy. No policy can keep them up, so they are not held
    against one. Without this, a patient zero inside a critical service (MRI 2 in the
    demo) would make every candidate fail the service-loss check.
    """
    patient_zero = {d.id for d in result.infectedDevices if d.tick == 0}
    return {
        sid for sid, svc in hospital.services.items() if patient_zero & set(svc["dependsOnDevices"])
    }


def services_down_too_long(result: RunResult, hospital: HospitalIndex, service_ids=None) -> list[str]:
    """Critical services (or the given ones) down past MAX_SERVICE_LOSS, sorted."""
    exempt = unavoidable_services(result, hospital)
    out = []
    for s in result.servicesDown:
        wanted = hospital.services[s.id].get("critical", False) if service_ids is None else s.id in service_ids
        if wanted and s.ticksDown > MAX_SERVICE_LOSS and s.id not in exempt:
            out.append(s.id)
    return sorted(out)


# Clinical engineering reviews a plan one department at a time, most critical first:
# the first department with a broken protected connection or a critical service down
# too long is the round's objection, and the next department's turn comes once that
# one is fixed. So a plan that breaks care in two places takes two rounds to settle.
REVIEW_ORDER = ("critical_care", "imaging", "clinical_support", "inpatient", "business", "public", "it_core")


def department_of(hospital: HospitalIndex, device_ids) -> str:
    """The most critical department among the devices' zones (REVIEW_ORDER's first)."""
    zones = {hospital.zone(d) for d in device_ids if d in hospital.devices}
    rank = lambda z: REVIEW_ORDER.index(z) if z in REVIEW_ORDER else len(REVIEW_ORDER)
    return min(zones, key=rank) if zones else REVIEW_ORDER[-1]


def objections(result: RunResult, hospital: HospitalIndex) -> list[tuple[str, str, list[str]]]:
    """(department, kind, target ids) in review order: protected flows broken and services
    down too long, grouped by the department they serve."""
    by: dict[str, dict[str, list[str]]] = {}
    for fid in sorted(result.protectedBroken):
        f = hospital.flows.get(fid)
        dept = department_of(hospital, (f["from"], f["to"])) if f else REVIEW_ORDER[-1]
        by.setdefault(dept, {}).setdefault("keep_flow", []).append(fid)
    for sid in services_down_too_long(result, hospital):
        dept = department_of(hospital, hospital.services[sid].get("dependsOnDevices", []))
        by.setdefault(dept, {}).setdefault("keep_service", []).append(sid)
    rank = lambda z: REVIEW_ORDER.index(z) if z in REVIEW_ORDER else len(REVIEW_ORDER)
    return [(dept, kind, ids) for dept in sorted(by, key=rank) for kind in ("keep_flow", "keep_service") if (ids := by[dept].get(kind))]


def check(session_id: str, round: int, policy_id: str, result: RunResult, hospital: HospitalIndex) -> Verdict:
    def verdict(decision, constraint=None):
        return Verdict(
            sessionId=session_id, round=round, policyId=policy_id, agent=AGENT, decision=decision, reason="[reason]", constraint=constraint
        )

    found = objections(result, hospital)
    if found:
        _, kind, ids = found[0]
        return verdict("reject", Constraint(kind=kind, targetIds=ids))
    return verdict("accept")
