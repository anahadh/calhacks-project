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


def check(round: int, policy_id: str, result: RunResult, hospital: HospitalIndex) -> Verdict:
    def verdict(decision, constraint=None):
        return Verdict(
            round=round, policyId=policy_id, agent=AGENT, decision=decision, reason="[reason]", constraint=constraint
        )

    if result.protectedBroken:
        return verdict("reject", Constraint(kind="keep_flow", targetIds=sorted(result.protectedBroken)))
    down = services_down_too_long(result, hospital)
    if down:
        return verdict("reject", Constraint(kind="keep_service", targetIds=down))
    return verdict("accept")
