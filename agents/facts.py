"""Facts for llm.py: what a message may say, built by code from the RunResult, the
constraint and the hospital. Human names and purposes instead of raw ids, and every
number the text is allowed to use. Pure functions; nothing here decides anything.
"""

from logic import clinical
from logic.hospital import HospitalIndex
from logic.inventory import device_flows
from protocol import Constraint, Policy, Proposal, Question, Recommendation, Revision, RunResult, Verdict

AGENT_NAMES = {
    "inventory": "Inventory Agent",
    "flow": "Flow Agent",
    "clinical_workflow": "Clinical Workflow Agent",
    "coordinator": "Sign-off Coordinator",
    "scorekeeper": "Scorekeeper",
}
ROLE_NAMES = {"security": "Security", "clinical_engineering": "Clinical engineering", "operations": "Operations"}
TYPE_NAMES = {
    "mri": "MRI scanner", "ct": "CT scanner", "workstation": "workstation", "nurse_station": "nurse station",
    "patient_monitor": "patient monitor", "infusion_pump": "infusion pump", "server_rack": "server",
    "pharmacy_cabinet": "pharmacy cabinet", "lab_analyzer": "lab analyzer", "anesthesia_machine": "anesthesia machine",
    "badge_reader": "badge reader", "hvac": "HVAC controller", "unknown": "unidentified device",
}


def device(h: HospitalIndex, device_id: str) -> str:
    d = h.devices[device_id]
    return f"{d['name']} ({TYPE_NAMES[d['type']]}, {h.rooms[d['roomId']]['name']})"


def flow(h: HospitalIndex, flow_id: str) -> str:
    f = h.flows[flow_id]
    text = f"{h.devices[f['from']]['name']} → {h.devices[f['to']]['name']}, {f['protocol'].upper()}"
    return text + (f", '{f['purpose']}'" if f.get("purpose") else "")


def service(h: HospitalIndex, service_id: str) -> str:
    s = h.services[service_id]
    return f"{s['name']} ('{s['consequence']}')"


def constraint(h: HospitalIndex, c: Constraint) -> str:
    if c.kind == "keep_flow":
        return "keep " + "; ".join(flow(h, f) for f in c.targetIds)
    if c.kind == "keep_service":
        return "keep " + "; ".join(service(h, s) for s in c.targetIds) + " running"
    if c.kind == "confirm_device":
        return "don't touch " + "; ".join(device(h, d) for d in c.targetIds) + " until a human names it"
    return f"at most {c.limit} rules"


def numbers(h: HospitalIndex, r: RunResult, baseline: RunResult | None = None) -> dict:
    """The run's headline numbers, and the same without a plan when the baseline is known."""
    not_ok = r.patientCounts.delayed + r.patientCounts.disrupted + r.patientCounts.diverted
    down = clinical.services_down_too_long(r, h)
    # Names a model can't misread: "affected" patients are ones whose care is delayed,
    # disrupted or diverted (never "protected"). Differences are given, since the
    # text may only use numbers that appear here.
    out = {
        "infectedDevicesWithPlan": r.infectedCount,
        "patientsWithCareDelayedOrDisruptedWithPlan": not_ok,
        "servicesOfflineWithPlan": len(r.servicesDown),
        "connectionsCut": len(r.removedFlows),
        "protectedFlowsBroken": len(r.protectedBroken),
        "criticalServicesDownTooLong": [service(h, s) for s in down],
    }
    if baseline is not None:
        p = baseline.patientCounts
        before = p.delayed + p.disrupted + p.diverted
        out["infectedDevicesWithoutPlan"] = baseline.infectedCount
        out["patientsWithCareDelayedOrDisruptedWithoutPlan"] = before
        out["servicesOfflineWithoutPlan"] = len(baseline.servicesDown)
        out["infectionsPreventedByPlan"] = max(0, baseline.infectedCount - r.infectedCount)
        out["patientsSparedDisruptionByPlan"] = max(0, before - not_ok)
    return out


def verdict(h: HospitalIndex, v: Verdict, msg: Proposal | Revision, plan_name: str | None,
            baseline: RunResult | None = None) -> dict:
    r = msg.testResult
    f = {
        "agent": AGENT_NAMES[v.agent],
        "decision": v.decision,
        "plan": plan_name or v.policyId,
        "round": v.round,
        **numbers(h, r, baseline),
    }
    if r.protectedBroken:
        f["brokenProtectedFlows"] = [flow(h, x) for x in sorted(r.protectedBroken)]
    if v.constraint is not None:
        f["constraintAdded"] = constraint(h, v.constraint)
    if v.agent == "clinical_workflow" and v.constraint is not None:
        from logic.clinical import department_of
        from logic.candidates import zone_name
        ids = v.constraint.targetIds
        ends = [d for i in ids for d in ((h.flows[i]["from"], h.flows[i]["to"]) if i in h.flows else h.services.get(i, {}).get("dependsOnDevices", []))]
        f["departmentReviewedThisRound"] = zone_name(department_of(h, ends))
        f["reviewOrder"] = "one department per round, most critical first; the next department's turn comes once this is fixed"
    if v.agent == "inventory":
        touched = sorted(h.touched(r))
        f["devicesThisPlanChanges"] = len(touched)
        if v.constraint is not None and v.constraint.kind == "confirm_device":
            f["unidentifiedDevices"] = [device(h, d) for d in v.constraint.targetIds]
        if v.constraint is not None and v.constraint.kind == "max_rules":
            rules = len(msg.rules) if hasattr(msg, "rules") else None
            f["ruleBudget"] = v.constraint.limit
            if rules is not None:
                f["ruleCount"] = rules
            f["why"] = "the switches carry at most this many allow rules as ACLs; fold rules department to department"
    return f


def plan(h: HospitalIndex, policy: Policy, r: RunResult, baseline: RunResult | None, round: int) -> dict:
    return {
        "agent": AGENT_NAMES["flow"],
        "plan": policy.name,
        "strategy": policy.strategy.replace("_", " "),
        "segmentsAndHoles": policy.rationale,
        "round": round,
        "rules": [rule.plain for rule in policy.rules[:6]],
        "ruleCount": len(policy.rules),
        "cutConnections": [flow(h, x) for x in r.removedFlows[:6]],
        **numbers(h, r, baseline),
    }


def revision(h: HospitalIndex, policy: Policy, r: RunResult, baseline: RunResult | None, round: int,
             constraints: list[Constraint], added: list[str], removed: list[str]) -> dict:
    keep = [f for c in constraints if c.kind == "keep_flow" for f in c.targetIds]
    return {
        **plan(h, policy, r, baseline, round),
        "constraintsToMeet": [constraint(h, c) for c in constraints],
        "protectedFlowsToKeep": [flow(h, f) for f in keep],
        "protectedFlowsToKeepCount": len(keep),
        "rulesAdded": added,
        "rulesRemovedCount": len(removed),
    }


def recommendation(h: HospitalIndex, rec: Recommendation, baseline: RunResult | None, round: int) -> dict:
    return {
        "agent": AGENT_NAMES["coordinator"],
        "plan": rec.policy.name,
        "segmentsAndHoles": rec.policy.rationale,
        "round": round,
        "rules": [rule.plain for rule in rec.policy.rules[:6]],
        "requiredSignOff": [ROLE_NAMES[x] for x in rec.requiredRoles],
        "agentsInAgreement": [AGENT_NAMES[v.agent] for v in rec.verdicts if v.decision == "accept"],
        **numbers(h, rec.testResult, baseline),
    }


def question(h: HospitalIndex, q: Question, challenges=()) -> dict:
    d = h.devices[q.targetId]
    links = []
    for f in device_flows(h, q.targetId, challenges):
        other = f["to"] if f["from"] == q.targetId else f["from"]
        links.append(f"{h.devices[other]['name']} over {f['protocol'].upper()}")
    return {
        "agent": AGENT_NAMES["inventory"],
        "device": d["name"],
        "room": h.rooms[d["roomId"]]["name"],
        "connectedTo": links,
        "choices": [TYPE_NAMES[c] for c in q.choices],
        "whoCanAnswer": [ROLE_NAMES[r] for r in q.allowedRoles],
    }
