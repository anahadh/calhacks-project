"""Flow Agent: minimize spread, within the constraints the guardians set."""

from protocol import Constraint, Policy, RuleDiff, RunResult

from .clinical import services_down_too_long
from .hospital import HospitalIndex


def violates(
    result: RunResult, constraints: list[Constraint], hospital: HospitalIndex, rule_count: int | None = None
) -> bool:
    """True if a candidate breaks any constraint: removes a keep_flow flow, touches a
    confirm_device device, keeps a keep_service service down past MAX_SERVICE_LOSS,
    or has more rules than a max_rules limit.

    max_rules needs the candidate's rule count; without it, a max_rules constraint
    counts as violated rather than silently passing.
    """
    removed = set(result.removedFlows)
    touched = hospital.touched(result)
    for c in constraints:
        targets = set(c.targetIds)
        if c.kind == "keep_flow" and removed & targets:
            return True
        if c.kind == "confirm_device" and touched & targets:
            return True
        if c.kind == "keep_service" and services_down_too_long(result, hospital, targets):
            return True
        if c.kind == "max_rules" and (rule_count is None or rule_count > c.limit):
            return True
    return False


def rank(
    candidates: list[tuple[Policy, RunResult]], constraints: list[Constraint], hospital: HospitalIndex
) -> list[tuple[Policy, RunResult]]:
    """Drop candidates that break a constraint; sort the rest by fewest infected devices,
    most patients ok, fewest rules, then name. The full policy JSON breaks any remaining tie."""
    ok = [(p, r) for p, r in candidates if not violates(r, constraints, hospital, len(p.rules))]
    return sorted(
        ok,
        key=lambda pr: (
            pr[1].infectedCount,
            -pr[1].patientCounts.ok,
            len(pr[0].rules),
            pr[0].name,
            pr[0].json(sort_keys=True),
        ),
    )


def diff(old: Policy, new: Policy) -> RuleDiff:
    """Rules in `new` that are not identical in `old` are added; ids from `old` that
    are gone or changed are removed. A changed rule appears in both."""
    old_by_id = {r.id: r for r in old.rules}
    new_by_id = {r.id: r for r in new.rules}
    added = [r for r in new.rules if old_by_id.get(r.id) != r]
    removed = sorted(rid for rid, r in old_by_id.items() if new_by_id.get(rid) != r)
    return RuleDiff(added=added, removed=removed)


def apply_diff(rules: list, d: RuleDiff) -> list:
    """Inverse of diff(): old rules in order minus `removed`, then `added`."""
    gone = set(d.removed)
    return [r for r in rules if r.id not in gone] + list(d.added)
