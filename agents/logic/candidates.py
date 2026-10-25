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


def zone_wall(h: HospitalIndex, zone: str) -> set[str]:
    return {f["id"] for f in active_flows(h) if cross_zone(h, f) and zone in (h.zone(f["from"]), h.zone(f["to"]))}


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
        if cross_zone(h, f) and zone in (h.zone(f["from"]), h.zone(f["to"])) and f["protocol"] not in CLINICAL}


def holes(h: HospitalIndex, cut: set[str]) -> str:
    """The traffic a segmented device class still exchanges with the rest of the hospital, in words."""
    kinds = set()
    for f in active_flows(h):
        if f["id"] in cut or not cross_zone(h, f) and not any(h.devices[d]["type"] in MEDICAL_TYPES for d in (f["from"], f["to"])):
            continue
        if any(h.devices[d]["type"] in MEDICAL_TYPES for d in (f["from"], f["to"])) or "ADT" in f.get("purpose", "") or f["port"] == 123:
            kinds.add({"dicom": "DICOM to PACS", "hl7": "HL7 vitals and ADT", "other": "common time (NTP)"}.get(f["protocol"], f["protocol"].upper()))
    return ", ".join(sorted(kinds)) or "none"


def lateral(h: HospitalIndex) -> set[str]:
    return {f["id"] for f in active_flows(h) if cross_zone(h, f) and f["protocol"] in LATERAL}


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
    """Greedy: while some start can reach more than `limit` devices, cut the lateral link whose
    removal most reduces the total reach over every start. Links in `keep` are never cut.
    The engine's test run then judges the result like any other plan."""
    links = [f for f in active_flows(h) if f["protocol"] in LATERAL]
    cut: set[str] = set()
    total = lambda open_: sum(len(reach(h, s, open_)) for s in starts)
    while True:
        open_ = [f for f in links if f["id"] not in cut]
        if max((len(reach(h, s, open_)) for s in starts), default=0) <= limit:
            return cut
        options = [f for f in open_ if f["id"] not in keep]
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
             path: set[str] | None = None, starts: list[str] | None = None) -> list[Candidate]:
    """The candidate plans for this attack. `path` overrides the attack path (the Flow
    Agent widens it with each test run, as the attack reroutes around a cut)."""
    keep = kept_by_constraints(constraints)
    start = h.zone(patient_zero)
    path = attack_path(h, baseline) if path is None else path
    out = [
        candidate(h, "clinical_only_between_zones", "least_disruption", "Allow only clinical traffic between zones", lateral(h), keep,
                  "Zones keep talking over HL7, DICOM and HTTPS; file sharing and remote desktop stop at zone boundaries.",
                  "Shared drives in other zones stop working."),
        candidate(h, "admin_from_it_only", "protect_critical_care", "Server admin access from IT only", admin_from_it_only(h), keep,
                  "Only IT workstations may open file shares or remote desktop on the servers, so a compromised ward PC can't reach them.",
                  "Clinical workstations lose their mapped shared drive."),
        candidate(h, "medical_device_segments", "protect_critical_care", "Medical device segments (imaging, monitors, pumps)",
                  medical_isolation(h), keep,
                  f"Imaging, monitors and pumps each sit on their own segment with minimum holes: {holes(h, medical_isolation(h) - keep)}.",
                  "Vendor file shares and remote support to medical devices stop."),
        candidate(h, f"quarantine_{start}", "max_containment", f"Quarantine {zone_name(start)}", quarantine(h, start), keep,
                  f"The attack starts in {zone_name(start)}; that zone keeps only clinical traffic to the rest of the hospital.",
                  f"{zone_name(start).capitalize()} loses file shares and remote access outside the zone."),
        candidate(h, "optimized_min_cuts", "least_disruption", "Optimized: fewest cuts that hold every attack",
                  optimized_cuts(h, starts or [patient_zero], keep), keep,
                  "The fewest file-sharing and remote-desktop links to cut so an attack from any workstation reaches at most 3 devices.",
                  "Chosen by an optimizer over every starting point, not just this one."),
        candidate(h, "block_attack_route", "max_containment", "Block the attack's file-sharing route", lateral_route(h, path), keep,
                  "An emergency cut: the file-sharing and remote-desktop links the attack used in the test run.",
                  "Targeted to this attack; a different starting point may need a different cut."),
    ]
    return [c for c in out if c is not None]
