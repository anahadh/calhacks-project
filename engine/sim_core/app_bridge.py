"""Bridge the app's hospital.json onto the causal engine and back.

The live product's hospital file (``data/hospitals/*.json``: devices, flows,
services, patients) has no identity layer and is protocol-typed, while this engine
runs on credentials, reachability and trust. This module translates between them so
the engine can drive app runs (via the watcher) and score agent plans.

Two honesty boundaries, both disclosed as ``[S]`` assumptions in the returned
``notes``:

* **Identity layer.** If the hospital carries ``domains``/``accounts``/``trusts``,
  they are used as-is. Otherwise a single domain, its DC, and one domain-admin with
  sessions on the workstations are *synthesized* — invented inputs, not measured.
* **Windows medical consoles.** A medical device that runs Windows (e.g. a Windows-7
  MRI console) is modeled as an attackable IT node; the vendor scanner never
  encrypts. So an MRI console can be patient zero, but the scanner only loses its
  dependencies.

Lateral movement maps to the real channels: SMB/RDP links carry admin-class reach;
HTTPS/DICOM/HL7 stay application-layer.
"""

from __future__ import annotations

from typing import Any

from .engine import Level
from .replay import replay
from .schema import (
    Account,
    Campaign,
    Domain,
    Event,
    HostProfile,
    Link,
    Node,
    Plan,
    ReplayResult,
    Scenario,
    Service,
    Trust,
)

MEDICAL_TYPES = {"mri", "ct", "patient_monitor", "infusion_pump", "anesthesia_machine", "lab_analyzer", "pharmacy_cabinet"}
PORT_CLASS = {"smb": "file_share", "rdp": "remote_desktop", "https": "app", "http": "app", "dicom": "imaging", "hl7": "app", "other": "app"}
LATERAL_PROTOCOLS = {"smb", "rdp"}


class BridgeResult:
    """A scenario built from a hospital, plus the disclosed assumptions behind it."""

    def __init__(self, scenario: Scenario, notes: list[str], service_ids: list[str]) -> None:
        self.scenario = scenario
        self.notes = notes
        self.service_ids = service_ids


def _device_to_node(device: dict) -> Node:
    device_type = device["type"]
    role = device.get("role")
    medical = device_type in MEDICAL_TYPES
    os = str(device.get("os", ""))
    if role == "domain_controller":
        kind, os_family, joined, medical = "dc", "windows", True, False
    elif device_type == "server_rack":
        kind, os_family, joined, medical = "srv", "windows", True, False
    elif device_type in {"workstation", "nurse_station"}:
        kind, os_family, joined, medical = "ws", "windows", True, False
    elif medical and os.startswith("windows"):
        # The Windows console of a medical device is attackable; the scanner is not.
        kind, os_family, joined, medical = "ws", "windows", True, False
    elif medical:
        kind, os_family, joined = device_type, "vendor_embedded", False
    else:  # badge_reader, hvac, anything else non-Windows
        kind, os_family, joined = "appliance", "appliance", False
    return Node(
        id=device["id"],
        dept=device.get("roomId", "unknown"),
        org="hospital",
        domain="H" if joined else None,
        kind=kind,
        host=HostProfile(
            os_family=os_family,
            domain_joined=joined,
            service_classes=["remote_access"] if kind in {"srv", "dc"} else [],
        ),
        medical_device=medical,
        mail_client=(kind == "ws"),
    )


def to_scenario(hospital: dict) -> BridgeResult:
    notes: list[str] = []
    nodes = [_device_to_node(device) for device in hospital["devices"]]
    host_ids = {node.id for node in nodes}

    links: list[Link] = []
    for flow in hospital["flows"]:
        if flow["from"] in host_ids and flow["to"] in host_ids:
            classes = [PORT_CLASS.get(flow["protocol"], "app")]
            if flow["protocol"] in LATERAL_PROTOCOLS:
                classes.append("admin")
            links.append(Link(a=flow["from"], b=flow["to"], port_classes=sorted(set(classes))))

    dc = next((d["id"] for d in hospital["devices"] if d.get("role") == "domain_controller"), None)
    domains = [Domain(id="H", dcs=[dc] if dc else [])]
    trusts: list[Trust] = []
    accounts: list[Account] = []
    if hospital.get("accounts"):
        # Real identity layer supplied: use it verbatim.
        accounts = [Account.model_validate(a) for a in hospital["accounts"]]
        domains = [Domain.model_validate(d) for d in hospital.get("domains", [])] or domains
        trusts = [Trust.model_validate(t) for t in hospital.get("trusts", [])]
        notes.append("[R/S] used the hospital's supplied identity layer (domains/accounts/trusts).")
    else:
        workstations = [n.id for n in nodes if n.kind == "ws"]
        accounts = [Account(id="H\\da", domain="H", tier="domain_admin", admin_to=["*"], sessions_on=workstations)]
        notes.append(f"[S] synthesized one domain-admin H\\da with a session on each of {len(workstations)} workstations and admin_to=* (identity layer invented; not in the hospital file).")

    notes.append("[S] SMB/RDP links carry admin-class (lateral) reach; HTTPS/DICOM/HL7 stay application-layer.")
    if any(n.kind == "ws" and d["type"] in MEDICAL_TYPES for n, d in zip(nodes, hospital["devices"])):
        notes.append("[S] Windows medical consoles are modeled as attackable IT nodes; the vendor scanners never encrypt.")

    services: list[Service] = []
    service_ids: list[str] = []
    for service in hospital["services"]:
        required = [h for h in service["dependsOnDevices"] if h in host_ids]
        if required:
            services.append(Service(name=service["id"], requires_all=required, paper_fallback=False))
            service_ids.append(service["id"])

    scenario = Scenario(
        scenario_id=f"app-{hospital.get('id', 'hospital')}",
        snapshot_date="2026-01-01",
        nodes=nodes,
        links=links,
        domains=domains,
        trusts=trusts,
        accounts=accounts,
        services=services,
    )
    return BridgeResult(scenario, notes, service_ids)


def to_campaign(patient_zero: str, scenario: Scenario, *, window: int = 200) -> Campaign:
    node = next((n for n in scenario.nodes if n.id == patient_zero), None)
    if node is None:
        raise ValueError(f"patient zero {patient_zero!r} is not a device in this hospital")
    if not (node.host.os_family == "windows" and not node.medical_device):
        raise ValueError(f"patient zero {patient_zero!r} ({node.kind}) is not an executing Windows host; pick an IT device or a Windows medical console")
    return Campaign(
        campaign_id=f"app-{patient_zero}",
        initial_footholds=[patient_zero],
        events=[
            Event(t="2026-01-01T00:00:00", order=0, rule="tick", budget=window),
            Event(t="2026-01-01T06:00:00", order=0, rule="R6"),
        ],
    )


def run(hospital: dict, patient_zero: str, plan: Plan | None = None) -> tuple[ReplayResult, BridgeResult]:
    bridge = to_scenario(hospital)
    campaign = to_campaign(patient_zero, bridge.scenario)
    return replay(bridge.scenario, campaign, plan or Plan()), bridge


def _patient_counts(hospital: dict, final_services: dict[str, str]) -> dict[str, int]:
    # First-cut mapping from final service state to patient state. The tick-accurate
    # escalation (duration-based delayed/disrupted/diverted) is applied by the watcher
    # when it drips rows on the tick schedule; this summary uses the final frame only.
    counts = {"ok": 0, "delayed": 0, "disrupted": 0, "diverted": 0}
    for group in hospital.get("patients", []):
        states = [final_services.get(sid) for sid in group.get("dependsOnServices", [])]
        if any(s == "down" for s in states):
            state = "diverted" if group.get("type") == "er" else "disrupted"
        elif any(s == "paper" for s in states):
            state = "delayed"
        else:
            state = "ok"
        counts[state] += int(group.get("count", 0))
    return counts


def to_run_result(hospital: dict, result: ReplayResult, bridge: BridgeResult) -> dict[str, Any]:
    """Map a ReplayResult onto the agents' RunResult contract (agents/protocol.py)."""
    controlled = {h for h, lvl in result.levels.items() if Level[lvl] >= Level.controlled}
    first_tick: dict[str, int] = {}
    for index, entry in enumerate(result.trace):
        if entry.node and entry.node in controlled and entry.node not in first_tick and entry.to_level in {"controlled", "encrypted"}:
            first_tick[entry.node] = index
    final = result.services[-1].services
    return {
        "ticks": len([e for e in result.trace if e.status == "applied" and e.rule in {"R4", "R6"}]),
        "infectedCount": len(controlled),
        "infectedDevices": sorted(({"id": h, "tick": first_tick.get(h, 0)} for h in controlled), key=lambda d: (d["tick"], d["id"])),
        "servicesDown": sorted(({"id": sid, "downSinceTick": 0, "ticksDown": 1} for sid in bridge.service_ids if final.get(sid) in {"down", "paper"}), key=lambda d: d["id"]),
        "patientCounts": _patient_counts(hospital, final),
        "protectedBroken": [],
        "removedFlows": [],
    }


def run_session(hospital: dict, patient_zero: str, plan: Plan | None = None) -> dict[str, Any]:
    """Run our engine and emit the UI's sim rows (devices/services/patients + a
    per-tick attempts/events/snapshots timeline) so the 3D scene can animate it.

    Note a faithful difference from the probability engine: a merely *controlled*
    host does not degrade a service here; services fail at encryption (R6) or on a
    lost dependency. So the animation shows spread during the window, then services
    drop at detonation, rather than degrading gradually.
    """
    result, bridge = run(hospital, patient_zero, plan)
    flow_id = {}
    for f in hospital["flows"]:
        flow_id.setdefault((f["from"], f["to"]), f["id"])
        flow_id.setdefault((f["to"], f["from"]), f["id"])
    name = {d["id"]: d["name"] for d in hospital["devices"]}

    infected_at: dict[str, int] = {patient_zero: 0}
    infected_by: dict[str, str | None] = {patient_zero: None}
    attempts: list[dict] = []
    events: list[dict] = [{"tick": 0, "kind": "patient_zero", "targetId": patient_zero, "text": f"{name.get(patient_zero, patient_zero)} infected (patient zero)"}]
    tick = 0
    for entry in result.trace:
        if entry.rule == "R4" and entry.node:
            if entry.status == "applied" and entry.source:
                tick += 1
                infected_at.setdefault(entry.node, tick)
                infected_by.setdefault(entry.node, entry.source)
                attempts.append({"tick": tick, "from": entry.source, "to": entry.node, "flowId": flow_id.get((entry.source, entry.node), ""), "success": True})
                events.append({"tick": tick, "kind": "device_infected", "targetId": entry.node, "text": f"{name.get(entry.node, entry.node)} compromised"})

    det_tick = tick + 1
    final = result.services[-1].services
    down_services = [sid for sid in bridge.service_ids if final.get(sid) in {"down", "paper"}]
    for sid in down_services:
        events.append({"tick": det_tick, "kind": "service_down", "targetId": sid, "text": f"{sid} offline"})

    infected_ids = {h for h, lvl in result.levels.items() if Level[lvl] >= Level.footholded} | set(infected_at)
    devices = [
        {"deviceId": h, "infected": True, "infectedAtTick": infected_at.get(h, 0), "infectedBy": infected_by.get(h) or ""}
        if h in infected_ids else {"deviceId": h, "infected": False}
        for h in (d["id"] for d in hospital["devices"])
    ]
    services = [{"serviceId": sid, "down": True, "downSinceTick": det_tick} if sid in down_services else {"serviceId": sid, "down": False} for sid in bridge.service_ids]

    groups = {}
    for group in hospital.get("patients", []):
        states = [final.get(sid) for sid in group.get("dependsOnServices", [])]
        if any(s == "down" for s in states):
            groups[group["id"]] = "diverted" if group.get("type") == "er" else "disrupted"
        elif any(s == "paper" for s in states):
            groups[group["id"]] = "delayed"
        else:
            groups[group["id"]] = "ok"
    patients = [{"groupId": gid, "state": st} for gid, st in groups.items()]

    total_ticks = det_tick
    snapshots = [{"tick": k, "infectedCount": sum(1 for v in infected_at.values() if v <= k)} for k in range(total_ticks + 1)]
    by_counts: dict[str, int] = {}
    for src in infected_by.values():
        if src:
            by_counts[src] = by_counts.get(src, 0) + 1
    total_by = sum(by_counts.values()) or 1
    choke = [{"deviceId": d, "share": round(c / total_by, 2)} for d, c in sorted(by_counts.items(), key=lambda x: -x[1])[:3]]
    delayed = sum(1 for st in groups.values() if st != "ok")

    return {
        "patientZero": patient_zero,
        "finalTick": total_ticks,
        "devices": devices,
        "services": services,
        "patients": patients,
        "attempts": attempts,
        "events": events,
        "snapshots": snapshots,
        "chokePoints": choke,
        "delayedProcedures": delayed,
        "assumptions": bridge.notes,
        "encryptedHosts": len(result.summary["encrypted_hosts"]),
        "medicalDevicesEncrypted": result.summary["medical_devices_encrypted"],
    }


__all__ = ["BridgeResult", "to_scenario", "to_campaign", "run", "run_session", "to_run_result", "MEDICAL_TYPES", "PORT_CLASS"]
