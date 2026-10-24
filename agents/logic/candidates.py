"""Flow Agent: candidate plans built from the attack itself, in code (rule 8).

Each candidate is a set of connections to cut, chosen from the baseline run: the
connections the attack actually crossed, the walls around the zone it started in,
the doors into the server room, and cross-zone file sharing and remote desktop.
A cut set becomes a Policy (an allow-list, as the engine reads it: a flow is kept
when some rule matches its source, destination, protocol and port), so the
engine's test run is the judge of what each plan does.

Connections a keep_flow constraint names are never cut. The Flow Agent is not told
which flows are protected (the Clinical Workflow Agent rejects plans that cut
them, and the constraint it adds is respected from then on).
"""

from protocol import Candidate, Constraint, Policy, PolicyRule, RunResult, Selector

from .hospital import HospitalIndex, Row

MAX_RULES = 40  # protocol.Policy.rules
LATERAL = ("smb", "rdp")  # file sharing and remote desktop: how ransomware moves between machines

ZONE_NAMES = {
    "critical_care": "critical care", "imaging": "imaging", "it_core": "the server room", "clinical_support": "lab and pharmacy",
    "inpatient": "the wards", "business": "admin", "public": "public areas",
}


def zone_name(zone: str) -> str:
    return ZONE_NAMES.get(zone, zone.replace("_", " "))


def kept_by_constraints(constraints: list[Constraint]) -> set[str]:
    return {f for c in constraints if c.kind == "keep_flow" for f in c.targetIds}


def active_flows(h: HospitalIndex) -> list[Row]:
    return [f for fid, f in sorted(h.flows.items()) if f.get("active", True)]


def attack_path(h: HospitalIndex, result: RunResult) -> set[str]:
    """Connections the attack could have crossed: each infected device's flows to a
    device infected at an earlier tick (the engine reports when, not from where)."""
    tick = {d.id: d.tick for d in result.infectedDevices}
    out = set()
    for f in active_flows(h):
        a, b = tick.get(f["from"]), tick.get(f["to"])
        if a is not None and b is not None and a != b:
            out.add(f["id"])
    return out


def cross_zone(h: HospitalIndex, f: Row) -> bool:
    return h.zone(f["from"]) != h.zone(f["to"])


def zone_wall(h: HospitalIndex, zone: str) -> set[str]:
    return {f["id"] for f in active_flows(h) if cross_zone(h, f) and zone in (h.zone(f["from"]), h.zone(f["to"]))}


def server_room_doors(h: HospitalIndex, entered_from: set[str]) -> set[str]:
    """Cross-zone connections into the server room over file sharing or remote desktop,
    plus every connection into it from a zone the attack reached."""
    return {
        f["id"] for f in active_flows(h)
        if h.zone(f["to"]) == "it_core" and cross_zone(h, f)
        and (f["protocol"] in LATERAL or h.zone(f["from"]) in entered_from)
    }


def lateral(h: HospitalIndex) -> set[str]:
    return {f["id"] for f in active_flows(h) if cross_zone(h, f) and f["protocol"] in LATERAL}


# --- a cut set as an allow-list ---


def selector(h: HospitalIndex, device_id: str) -> Selector:
    d = h.devices[device_id]
    return Selector(zone=h.zone(device_id), deviceType=d["type"], role=d.get("role"), vlan=d["vlan"])


def _matches(s: Selector, h: HospitalIndex, device_id: str) -> bool:
    d = h.devices[device_id]
    return ((s.zone is None or s.zone == h.zone(device_id)) and (s.deviceType is None or s.deviceType == d["type"])
            and (s.role is None or s.role == d.get("role")) and (s.vlan is None or s.vlan == d["vlan"]))


def kept(h: HospitalIndex, rules: list[PolicyRule]) -> set[str]:
    """The flows an allow-list keeps, as the engine reads it (sim_core.app_policy.kept_flow_ids)."""
    return {
        f["id"] for f in active_flows(h)
        if any((r.protocol is None or r.protocol == f["protocol"]) and (r.port is None or r.port == f["port"])
               and _matches(r.from_, h, f["from"]) and _matches(r.to, h, f["to"]) for r in rules)
    }


def _plain_side(h: HospitalIndex, s: Selector) -> str:
    kind = (s.role or s.deviceType or "device").replace("_", " ")
    return f"{zone_name(s.zone)} {kind}s" if s.zone else "any device"


def allow_list(h: HospitalIndex, cut: set[str]) -> list[PolicyRule]:
    """Rules that keep every active flow except `cut`. A zone none of whose outgoing
    flows are cut keeps everything in one rule; otherwise one rule per kept
    (source kind, destination kind, protocol, port)."""
    flows = active_flows(h)
    rules: list[PolicyRule] = []
    zones = sorted({h.zone(f["from"]) for f in flows})
    whole = {z for z in zones if not any(f["id"] in cut for f in flows if h.zone(f["from"]) == z)}
    for z in sorted(whole):
        rules.append(PolicyRule(id=f"r_{z}", **{"from": Selector(zone=z)}, to=Selector(),
                                plain=f"Devices in {zone_name(z)} keep all their connections."))
    seen = set()
    for f in flows:
        if f["id"] in cut or h.zone(f["from"]) in whole:
            continue
        src, dst = selector(h, f["from"]), selector(h, f["to"])
        key = (src.json(), dst.json(), f["protocol"], f["port"])
        if key in seen:
            continue
        seen.add(key)
        rules.append(PolicyRule(
            id=f"r_{len(rules)}", **{"from": src}, to=dst, protocol=f["protocol"], port=f["port"],
            plain=f"{_plain_side(h, src).capitalize()} may reach {_plain_side(h, dst)} over {f['protocol'].upper()} ({f['port']}).",
        ))
    return rules


def candidate(h: HospitalIndex, id: str, strategy: str, name: str, cut: set[str], keep: set[str],
              rationale: str, tradeoff: str) -> Candidate | None:
    """None when the cut set is empty after keeping `keep`, or needs more than MAX_RULES rules."""
    cut = cut - keep
    if not cut:
        return None
    rules = allow_list(h, cut)
    if len(rules) > MAX_RULES:
        return None
    return Candidate(id=id, policy=Policy(strategy=strategy, name=name, rules=rules, rationale=rationale, tradeoff=tradeoff))


def generate(h: HospitalIndex, baseline: RunResult, patient_zero: str, constraints: list[Constraint],
             path: set[str] | None = None) -> list[Candidate]:
    """The candidate plans for this attack. `path` overrides the attack path (the Flow
    Agent widens it with each test run, as the attack reroutes around a cut)."""
    keep = kept_by_constraints(constraints)
    start = h.zone(patient_zero)
    reached = {h.zone(d.id) for d in baseline.infectedDevices}
    path = attack_path(h, baseline) if path is None else path
    out = [
        candidate(h, "cut_attack_path", "max_containment", "Cut the attack's path", path, keep,
                  "Cuts the connections the attack crossed in the test run.",
                  "Only the connections the attack used are cut, so everything else keeps working."),
        candidate(h, f"wall_{start}", "max_containment", f"Wall off {zone_name(start)}", zone_wall(h, start), keep,
                  f"The attack starts in {zone_name(start)}; this cuts its connections to every other zone.",
                  f"Devices in {zone_name(start)} can only talk to each other."),
        candidate(h, "shield_server_room", "protect_critical_care", "Shield the server room",
                  server_room_doors(h, reached - {"it_core"}), keep,
                  "Keeps the attack away from the shared servers (health records, files, scans, logins).",
                  "Some workstations lose file sharing or remote desktop to the servers."),
        candidate(h, "no_lateral_movement", "least_disruption", "Block file sharing and remote desktop between zones",
                  lateral(h), keep,
                  "Ransomware moves between machines over file sharing and remote desktop; this stops that across zones.",
                  "Cross-zone file shares and remote sessions stop working."),
    ]
    return [c for c in out if c is not None]
