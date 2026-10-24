"""Explicit event scheduling, deterministic exports and plan counterfactuals."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timedelta

from . import RULES_VERSION
from .engine import Engine, PRIVILEGED_TIERS
from .schema import Campaign, Event, EventEffect, Level, Plan, ReplayResult, Scenario, TraceEntry


def canonical_json(value: object) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False)


def fingerprint(scenario: Scenario, campaign: Campaign, plan: Plan) -> str:
    """Campaign is part of the key; never expose campaign-derived keys to planners."""
    payload = {"scenario": scenario.model_dump(mode="json"), "campaign": campaign.model_dump(mode="json"), "plan": plan.model_dump(mode="json"), "rules_version": RULES_VERSION}
    return hashlib.sha256(canonical_json(payload).encode()).hexdigest()


def _instant(event: Event) -> datetime:
    value = event.t.split("/")[0] if event.rule == "idle" else event.t
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError as exc:
        raise ValueError(f"invalid authored event time: {event.t}") from exc
    if parsed.tzinfo is not None:
        raise ValueError("use one declared local campaign clock; offsets are not mixed into the replay")
    return parsed


def schedule(campaign: Campaign) -> list[Event]:
    """Require a total authored order; never resolve missing precision from outcomes."""
    by_day: dict[str, set[bool]] = {}
    keys: set[tuple[datetime, int]] = set()
    idle_ranges: list[tuple[datetime, datetime, bool]] = []
    for event in campaign.events:
        instant = _instant(event)
        key = instant, event.order
        if key in keys:
            raise ValueError("duplicate normalized event time/order")
        keys.add(key)
        by_day.setdefault(instant.date().isoformat(), set()).add("T" in event.t)
        if event.rule == "idle" and "/" in event.t:
            start, end = event.t.split("/")
            begin, finish = datetime.fromisoformat(start), datetime.fromisoformat(end)
            if finish.tzinfo is not None:
                raise ValueError("dormancy uses the declared local campaign clock without offsets")
            if finish < begin:
                raise ValueError("reversed dormancy interval")
            date_only_end = "T" not in end
            if date_only_end:
                finish += timedelta(days=1)
            idle_ranges.append((begin, finish, date_only_end))
    for day, precisions in by_day.items():
        if len(precisions) > 1:
            raise ValueError(f"mixed date-only/timed events on {day}; author the missing sub-day times first")
    for event in campaign.events:
        if event.rule in {"idle", "observation"}:
            continue
        if any(start <= _instant(event) and (_instant(event) < end if exclusive else _instant(event) <= end) for start, end, exclusive in idle_ranges):
            raise ValueError("an executable event falls inside a declared dormancy interval")
    return sorted(campaign.events, key=lambda e: (_instant(e), e.order))


def _require(event: Event, *fields: str) -> None:
    for field in fields:
        if getattr(event, field) is None:
            raise ValueError(f"{event.rule} needs explicit {field}; missing evidence is not a plan blocker")


def advance(engine: Engine, t: str, budget: int) -> None:
    """Bounded host-level window; dated historical events never imply free ticks."""
    for _ in range(budget):
        changed = engine.tick(t)
        if changed:
            continue
        if not engine.goals() or all(engine.states[h].level >= Level.controlled for h in engine.goals()):
            return
        if engine.detours_used >= engine.campaign.detour_budget:
            return
        before = engine.detours_used
        engine.try_next_route(t)
        if before == engine.detours_used:
            return
    engine.trace.append(TraceEntry(t=t, rule="budget", technique_label="host-level window", reason="authored microstep budget exhausted; remaining goals are unresolved", status="observation"))


def apply_event(engine: Engine, event: Event) -> None:
    rule, t = event.rule, event.t
    trace_start = len(engine.trace)
    if rule == "R1":
        _require(event, "target", "mode")
        engine.initial_access(event.target, event.mode, t, event.credential)
    elif rule == "R2":
        _require(event, "target")
        engine.harvest(event.target, t)
    elif rule == "R3":
        engine.adopt_credentials(t)
    elif rule == "R4":
        _require(event, "target")
        engine.lateral(event.target, t)
    elif rule == "R5":
        _require(event, "source_domain", "target_domain")
        engine.trust_hop(event.source_domain, event.target_domain, t)
    elif rule == "R6":
        engine.detonate(t)
    elif rule == "D1":
        _require(event, "org")
        engine.evict(event.org, t)
    elif rule == "D2":
        _require(event, "org")
        engine.protect(event.org, t, event.coverage)
    elif rule == "D3":
        if not event.cut_links:
            raise ValueError("D3 needs explicit cut links, not an org-name heuristic")
        engine.disconnect(event.cut_links, t)
    elif rule == "tick":
        advance(engine, t, event.budget)
    else:
        engine.trace.append(TraceEntry(t=t, rule=rule, technique_label=event.label or rule, reason=event.label or "dated observation; no attacker transitions", status="observation"))
    if len(engine.trace) == trace_start:
        engine.trace.append(TraceEntry(t=t, rule=rule, technique_label=event.label or rule, node=event.target, reason="authored event made no state change", status="no_change"))
    if rule != "tick":
        engine.rollup(t)


def replay(scenario: Scenario, campaign: Campaign, plan: Plan | None = None) -> ReplayResult:
    plan = plan or Plan()
    events = schedule(campaign)
    engine = Engine(scenario, plan, campaign)
    effects = []
    # Pre-attack service loss belongs to the plan, and must appear even when R1 fails.
    initial = engine.rollup(events[0].t if events else scenario.snapshot_date)
    initial.phase = "pre_attack"
    for event_index, event in enumerate(events):
        before_levels = {h: s.level for h, s in engine.states.items()}
        before_creds, before_privileges, before_domains = set(engine.creds), set(engine.privileges), set(engine.domains_held)
        trace_start = len(engine.trace)
        apply_event(engine, event)
        for entry in engine.trace[trace_start:]:
            entry.event_index = event_index
        effects.append(EventEffect(event_index=event_index, t=event.t, rule=event.rule, target=event.target, level_changes={h: (before_levels[h].name, state.level.name) for h, state in sorted(engine.states.items()) if before_levels[h] != state.level}, creds_added=sorted(engine.creds - before_creds), creds_removed=sorted(before_creds - engine.creds), privileges_added=sorted(engine.privileges - before_privileges), domains_added=sorted(engine.domains_held - before_domains)))
    encrypted = sorted(h for h, state in engine.states.items() if state.level == Level.encrypted)
    authored_targets = {engine.nodes[e.target].org for e in events if e.rule in {"R1", "R4"} and e.target in engine.nodes}
    authored_domains = {e.target_domain for e in events if e.rule == "R5"}
    authored_targets.update(n.org for n in scenario.nodes if n.domain in authored_domains)
    authored_targets.update(engine.nodes[h].org for h in engine.campaign.initial_footholds)
    if any(e.rule == "tick" for e in events):
        authored_targets.update(engine.nodes[h].org for h in engine.goals())
    targeted = sorted(set(campaign.targeted_orgs) or authored_targets)
    orgs = sorted({n.org for n in scenario.nodes if not n.external})
    org_outcomes = {}
    for org in orgs:
        hosts = [n.id for n in scenario.nodes if n.org == org and n.encryptable]
        count = len(set(hosts) & set(encrypted))
        org_outcomes[org] = {"encrypted_hosts": count, "eligible_hosts": len(hosts), "encrypted_share": count / len(hosts) if hosts else None}
    blocked = [entry.model_dump(mode="json") for entry in engine.trace if entry.status == "blocked"]
    final_services = engine.frames[-1].services
    ever_creds = set(campaign.initial_creds) | {a for effect in effects for a in effect.creds_added}
    ever_privileges = set(campaign.initial_privileges) | {a for effect in effects for a in effect.privileges_added}
    summary = {
        "rules_version": RULES_VERSION,
        "encrypted_hosts": encrypted,
        "orgs": org_outcomes,
        "targeted_orgs": targeted,
        "untargeted_orgs_are_negatives": False,
        "privileged_accounts_held": len([a for a in engine.privileges if engine.accounts[a].tier in PRIVILEGED_TIERS]),
        "privileged_accounts_ever_used": len([a for a in ever_privileges if engine.accounts[a].tier in PRIVILEGED_TIERS]),
        "privileged_accounts_ever_harvested": len([a for a in ever_creds if engine.accounts[a].tier in PRIVILEGED_TIERS]),
        "services_down": sorted(s for s, state in final_services.items() if state == "down"),
        "services_on_paper": sorted(s for s, state in final_services.items() if state == "paper"),
        "medical_devices_encrypted": sum(engine.states[n.id].level == Level.encrypted for n in scenario.nodes if n.medical_device),
        "corrupted_backups": sorted(engine.corrupted_backups),
        "offline_backups": sorted(engine.offline_backups),
        "blocked_steps": blocked,
        "assumptions": [a.model_dump(mode="json") for a in scenario.assumptions + campaign.assumptions],
    }
    return ReplayResult(cache_key=fingerprint(scenario, campaign, plan), trace=engine.trace, services=engine.frames, levels={h: state.level.name for h, state in sorted(engine.states.items())}, summary=summary, event_effects=effects)


def _effect_atoms(effect: EventEffect) -> set[str]:
    if effect.rule.startswith("D") or effect.rule in {"idle", "observation"}:
        return set()
    return {f"level:{host}:{new}" for host, (_, new) in effect.level_changes.items()} | {f"credential:{a}" for a in effect.creds_added} | {f"privilege:{a}" for a in effect.privileges_added} | {f"domain:{d}" for d in effect.domains_added}


def compare_plan(scenario: Scenario, campaign: Campaign, plan: Plan) -> dict[str, object]:
    """Paired counterfactual plus leave-one-lever-out causal attribution.

    A lever gets credit for an avoided encrypted host only when removing that
    lever from the full plan restores that host's encryption. Interacting levers
    may have no individual credit; this is necessity-in-context, not Shapley credit.
    """
    baseline = replay(scenario, campaign)
    defended = replay(scenario, campaign, plan)
    avoided = set(baseline.summary["encrypted_hosts"]) - set(defended.summary["encrypted_hosts"])
    attribution = {}
    # Match authored event indices, rather than timestamps or text explanations;
    # several rules/microsteps can occur at the same clock time.
    lost_effects = {b.event_index: _effect_atoms(b) - _effect_atoms(d) for b, d in zip(baseline.event_effects, defended.event_effects)}
    event_attribution: dict[str, dict[str, list[str]]] = {}
    for lever in plan.levers:
        without = plan.model_copy(update={"levers": [item for item in plan.levers if item.id != lever.id]}, deep=True)
        result = replay(scenario, campaign, without)
        attribution[lever.id] = sorted(avoided & set(result.summary["encrypted_hosts"]))
        for effect in result.event_effects:
            restored = lost_effects[effect.event_index] & _effect_atoms(effect)
            if restored:
                event_attribution.setdefault(str(effect.event_index), {})[lever.id] = sorted(restored)
    pre_attack = defended.services[0]
    baseline_pre = baseline.services[0]
    return {"baseline": baseline, "defended": defended, "avoided_encryption": sorted(avoided), "necessary_levers_in_context": attribution, "event_effects_restored_without_lever": event_attribution, "plan_induced_service_loss": {name: state for name, state in pre_attack.services.items() if state != "up" and baseline_pre.services[name] == "up"}}
