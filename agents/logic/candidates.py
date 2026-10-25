"""Flow Agent: candidate plans built from the attack itself, in code (rule 8).

The plans follow real hospital segmentation practice (NIST SP 1800-30, HHS 405(d)):
clinical traffic (HL7, DICOM, HTTPS) keeps flowing between zones, and the protocols
ransomware moves through (file sharing over SMB, remote desktop over RDP) are what
gets blocked: between zones, into the server room from outside IT, around medical
devices, out of the zone the attack starts in, or along the route it took.

A plan is a set of connections to cut. It becomes a Policy (an allow-list, as the
engine reads it: a flow is kept when some rule matches its source, destination,
protocol and port), so the engine's test run is the judge of what each plan does.

Connections a keep_flow constraint names are never cut. The Flow Agent is not told
which flows are protected (the Clinical Workflow Agent rejects plans that cut
them, and the constraint it adds is respected from then on).
"""

from protocol import Candidate, Constraint, Policy, PolicyRule, RunResult, Selector

from .hospital import HospitalIndex, Row
from .segments import segment_name, segment_of

MAX_RULES = 40  # protocol.Policy.rules
LATERAL = ("smb", "rdp")  # file sharing and remote desktop: how ransomware moves between machines
CLINICAL = ("hl7", "dicom", "https", "http")  # application traffic care runs on; segmentation keeps it
MEDICAL_TYPES = {"mri", "ct", "patient_monitor", "infusion_pump", "anesthesia_machine", "lab_analyzer"}
IT_ZONES = {"business", "it_core"}  # where administrators work

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


def cross_segment(h: HospitalIndex, f: Row) -> bool:
    """Between two functional segments (logic.segments): the wall a plan builds."""
    return segment_of(h, f["from"]) != segment_of(h, f["to"])


def boundary(h: HospitalIndex, f: Row) -> bool:
    """A connection that crosses a segment wall: between functional networks (core servers,
    imaging and PACS, bedside monitoring, clinical workstations, business), wherever the
    two machines stand. Links inside a segment stay: a scanner's console with the tech's
    workstation, a nurse station with its monitors, and cutting those makes islands of
    uselessness. So a plan holds an attack to the segment it starts in; it does not promise
    that nothing beside patient zero is touched."""
    return cross_segment(h, f)


def zone_wall(h: HospitalIndex, zone: str) -> set[str]:
    return {f["id"] for f in active_flows(h) if cross_segment(h, f) and zone in (h.zone(f["from"]), h.zone(f["to"]))}


def admin_from_it_only(h: HospitalIndex) -> set[str]:
    """File sharing and remote desktop into the server room only from IT."""
    return {f["id"] for f in active_flows(h)
            if h.zone(f["to"]) == "it_core" and h.zone(f["from"]) not in IT_ZONES and f["protocol"] in LATERAL}


def medical_isolation(h: HospitalIndex) -> set[str]:
    """Medical devices keep only their clinical protocols (vendor VLAN practice)."""
    return {f["id"] for f in active_flows(h)
            if f["protocol"] not in ("hl7", "dicom") and any(h.devices[d]["type"] in MEDICAL_TYPES for d in (f["from"], f["to"]))}


def quarantine(h: HospitalIndex, zone: str) -> set[str]:
    """The zone keeps only clinical traffic to and from other zones."""
    return {
        f["id"] for f in active_flows(h)
        if cross_segment(h, f) and zone in (h.zone(f["from"]), h.zone(f["to"])) and f["protocol"] not in CLINICAL}


def holes(h: HospitalIndex, cut: set[str]) -> str:
    """The traffic a segmented device class still exchanges with the rest of the hospital, in words."""
    kinds = set()
    for f in active_flows(h):
        if f["id"] in cut or not cross_segment(h, f):
            continue
        if any(h.devices[d]["type"] in MEDICAL_TYPES for d in (f["from"], f["to"])) or "ADT" in f.get("purpose", "") or f["port"] == 123:
            kinds.add({"dicom": "DICOM to PACS", "hl7": "HL7 vitals and ADT", "other": "common time (NTP)"}.get(f["protocol"], f["protocol"].upper()))
    return ", ".join(sorted(kinds)) or "none"


def lateral(h: HospitalIndex) -> set[str]:
    return {f["id"] for f in active_flows(h) if cross_segment(h, f) and f["protocol"] in LATERAL}


def lateral_route(h: HospitalIndex, path: set[str]) -> set[str]:
    """The file-sharing and remote-desktop links on the attack's route."""
    return {fid for fid in path if h.flows[fid]["protocol"] in LATERAL}


# --- the optimizer: fewest lateral cuts so no attack spreads beyond LIMIT devices ---

INFECTABLE = {"workstation", "nurse_station", "server_rack"}  # plus Windows medical consoles (the engine's rule)


def infectable(h: HospitalIndex, device_id: str) -> bool:
    d = h.devices[device_id]
    return d["type"] in INFECTABLE or (d["type"] in MEDICAL_TYPES and str(d.get("os", "")).startswith("windows"))


def reach(h: HospitalIndex, start: str, open_links: list[Row]) -> set[str]:
    """Devices an attack from `start` can reach over the open file-sharing and remote-desktop links."""
    adj: dict[str, set[str]] = {}
    for f in open_links:
        if infectable(h, f["from"]) and infectable(h, f["to"]):
            adj.setdefault(f["from"], set()).add(f["to"])
            adj.setdefault(f["to"], set()).add(f["from"])
    seen, todo = {start}, [start]
    while todo:
        for n in adj.get(todo.pop(), ()):
            if n not in seen:
                seen.add(n)
                todo.append(n)
    return seen


def optimized_cuts(h: HospitalIndex, starts: list[str], keep: set[str], limit: int = 3) -> set[str]:
    """Greedy: while an attack from some start can reach a machine outside its own segment, cut
    the boundary link whose removal most reduces the total reach over every start. Links inside a
    segment and links in `keep` are never cut. The engine's test run then judges the result."""
    links = [f for f in active_flows(h) if f["protocol"] in LATERAL]
    cut: set[str] = set()
    total = lambda open_: sum(len(reach(h, s, open_)) for s in starts)
    escapes = lambda open_: any(segment_of(h, d) != segment_of(h, s) for s in starts for d in reach(h, s, open_))
    while True:
        open_ = [f for f in links if f["id"] not in cut]
        if not escapes(open_):
            return cut
        options = [f for f in open_ if f["id"] not in keep and boundary(h, f)]
        if not options:
            return cut
        best = min(options, key=lambda f: (total([g for g in open_ if g is not f]), f["id"]))
        cut.add(best["id"])


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


def allow_list(h: HospitalIndex, cut: set[str], limit: int | None = None) -> list[PolicyRule]:
    """Rules that keep every active flow except `cut`. A zone none of whose outgoing
    flows are cut keeps everything in one rule; otherwise one rule per kept
    (source kind, destination kind, protocol, port). With a `limit` (a max_rules
    constraint), rules are folded department to department, coarsest tier that
    fits: by protocol and port, then by protocol, then any traffic, as long as a
    folded rule re-allows nothing in `cut`."""
    flows = active_flows(h)
    zones = sorted({h.zone(f["from"]) for f in flows})
    whole = {z for z in zones if not any(f["id"] in cut for f in flows if h.zone(f["from"]) == z)}
    base: list[PolicyRule] = [
        PolicyRule(id=f"r_{z}", **{"from": Selector(zone=z)}, to=Selector(), plain=f"Devices in {zone_name(z)} keep all their connections.")
        for z in sorted(whole)
    ]
    rest = [f for f in flows if f["id"] not in cut and h.zone(f["from"]) not in whole]
    cuts = [h.flows[i] for i in cut if i in h.flows]

    def fine(f: Row) -> tuple[tuple, PolicyRule]:
        src, dst = selector(h, f["from"]), selector(h, f["to"])
        return (src.json(), dst.json(), f["protocol"], f["port"]), PolicyRule(
            id="r", **{"from": src}, to=dst, protocol=f["protocol"], port=f["port"],
            plain=f"{_plain_side(h, src).capitalize()} may reach {_plain_side(h, dst)} over {f['protocol'].upper()} ({f['port']}).")

    def coarse(f: Row, tier: int) -> tuple[tuple, PolicyRule] | None:
        """A department-to-department rule at `tier` (1: protocol and port, 2: protocol, 3: any), or None if it would re-allow a cut."""
        sz, dz = h.zone(f["from"]), h.zone(f["to"])
        proto = f["protocol"] if tier <= 2 else None
        port = f["port"] if tier == 1 else None
        reallows = any(h.zone(c["from"]) == sz and h.zone(c["to"]) == dz and (proto is None or c["protocol"] == proto) and (port is None or c["port"] == port) for c in cuts)
        if reallows:
            return None
        over = f" over {proto.upper()}" + (f" ({port})" if port else "") if proto else " (all traffic)"
        return (sz, dz, proto, port), PolicyRule(id="r", **{"from": Selector(zone=sz)}, to=Selector(zone=dz), protocol=proto, port=port,
                                               plain=f"{zone_name(sz).capitalize()} may reach {zone_name(dz)}{over}.")

    def build(tier: int) -> list[PolicyRule]:
        seen: dict[tuple, PolicyRule] = {}
        for f in rest:
            key, rule = (coarse(f, tier) if tier else None) or fine(f)
            seen.setdefault(key, rule)
        return base + [r.copy(update={"id": f"r_{i}"}) for i, r in enumerate(seen.values(), start=len(base))]

    rules = build(0)
    if limit is not None and len(rules) > limit:
        for tier in (1, 2, 3):
            rules = build(tier)
            if len(rules) <= limit:
                break
    return rules


def candidate(h: HospitalIndex, id: str, strategy: str, name: str, cut: set[str], keep: set[str],
              rationale: str, tradeoff: str, limit: int | None = None) -> Candidate | None:
    """None when the cut set is empty after keeping `keep`, or needs more than MAX_RULES rules.
    `limit` (a max_rules constraint) folds the rules department to department."""
    cut = {fid for fid in cut - keep if fid in h.flows and boundary(h, h.flows[fid])}
    if not cut:
        return None
    rules = allow_list(h, cut, limit)
    if len(rules) > MAX_RULES:
        return None
    return Candidate(id=id, policy=Policy(strategy=strategy, name=name, rules=rules, rationale=rationale, tradeoff=tradeoff))


def proposal_facts(h: HospitalIndex, baseline: RunResult, patient_zero: str, constraints: list[Constraint]) -> dict:
    """What the model sees to design plans: every connection (no protected flags or purposes:
    the Flow Agent learns those only from rejections), where the attack went, and what it must keep."""
    keep = kept_by_constraints(constraints)
    name = lambda d: h.devices[d]["name"]
    return {
        "attackStartsAt": f"{name(patient_zero)} ({zone_name(h.zone(patient_zero))}, {segment_name(segment_of(h, patient_zero))} segment)",
        "segments": {segment_name(k): sorted(name(d) for d in h.devices if segment_of(h, d) == k) for k in ("core", "imaging", "monitoring", "clinical", "business")},
        "attackReached": [f"{name(d.id)} ({zone_name(h.zone(d.id))}) at step {d.tick}" for d in baseline.infectedDevices],
        "connections": [
            {"id": f["id"], "from": f"{name(f['from'])} [{h.devices[f['from']]['type']}, {zone_name(h.zone(f['from']))}]",
             "to": f"{name(f['to'])} [{h.devices[f['to']]['type']}, {zone_name(h.zone(f['to']))}]", "protocol": f["protocol"]}
            for f in active_flows(h)
        ],
        "mustKeep": sorted(keep),
    }


def rule_limit(constraints: list[Constraint]) -> int | None:
    """The lowest max_rules limit in force, or None."""
    return min((c.limit for c in constraints if c.kind == "max_rules" and c.limit), default=None)


def from_proposal(h: HospitalIndex, i: int, name: str, strategy: str, rationale: str, tradeoff: str,
                  cut: list[str], keep: set[str], limit: int | None = None) -> Candidate | None:
    """A model-proposed plan as a Candidate (the cut becomes an allow-list; kept links are never cut)."""
    return candidate(h, f"proposed_{i}", strategy, name, set(cut), keep, rationale, tradeoff, limit)


def generate(h: HospitalIndex, baseline: RunResult, patient_zero: str, constraints: list[Constraint],
             path: set[str] | None = None, starts: list[str] | None = None) -> list[Candidate]:
    """The algorithmic candidate: the optimizer over every start. (The other plans come from the model.)"""
    keep = kept_by_constraints(constraints)
    out = [
        candidate(h, "optimized_min_cuts", "least_disruption", "Optimized: fewest cuts that keep every attack in its segment",
                  optimized_cuts(h, starts or [patient_zero], keep), keep,
                  "The fewest file-sharing and remote-desktop links to cut between the functional networks (core servers, imaging and PACS, "
                  "bedside monitoring, clinical workstations, business) so an attack from any workstation stays in its own segment; "
                  "DICOM to PACS, HL7 vitals and ADT, charts over HTTPS and common time still cross.",
                  "Chosen by an optimizer over every starting point, not just this one.", rule_limit(constraints)),
    ]
    return [c for c in out if c is not None]
