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

from collections.abc import Sequence
from typing import Any

from .app_policy import apply_policy
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
        opportunistic=True,  # ransomware takes every host it can administer, not only service hosts
        events=[
            Event(t="2026-01-01T00:00:00", order=0, rule="tick", budget=window),
            Event(t="2026-01-01T06:00:00", order=0, rule="R6"),
        ],
    )


def run(hospital: dict, patient_zero: str, plan: Plan | None = None) -> tuple[ReplayResult, BridgeResult]:
    bridge = to_scenario(hospital)
    campaign = to_campaign(patient_zero, bridge.scenario)
    return replay(bridge.scenario, campaign, plan or Plan()), bridge


def entry_points(hospital: dict) -> list[str]:
    """Device ids the engine accepts as patient zero, in hospital file order.

    The check ``to_campaign`` makes (an executing Windows host that is not a vendor
    medical appliance), plus the engine's own condition for an attack to move at
    all: an admin session to harvest there and an admin-class (SMB/RDP) link out.
    A start that can only ever infect itself is left out. The UI dims everything
    else, so a judge can only start an attack the engine will run and spread.
    """
    bridge = to_scenario(hospital)
    by_id = {n.id: n for n in bridge.scenario.nodes}
    sessions = {h for acct in bridge.scenario.accounts for h in acct.sessions_on}
    lateral = {end for link in bridge.scenario.links if "admin" in link.port_classes for end in (link.a, link.b)}
    out: list[str] = []
    for device in hospital["devices"]:
        node = by_id.get(device["id"])
        # Servers are never patient zero: an attack lands on a desk (phishing, a
        # bad USB, a vendor console), not on the file server or the DC.
        if (node is not None and node.host.os_family == "windows" and not node.medical_device
                and node.kind == "ws" and device["id"] in sessions and device["id"] in lateral):
            out.append(device["id"])
    return out


# --- Patient state, shared by the summary and by each per-tick frame ---


def _patient_state(group: dict, services: dict[str, str]) -> str:
    states = [services.get(sid) for sid in group.get("dependsOnServices", [])]
    if any(s == "down" for s in states):
        return "diverted" if group.get("type") == "er" else "disrupted"
    if any(s == "paper" for s in states):
        return "delayed"
    return "ok"


def _patient_counts(hospital: dict, services: dict[str, str]) -> dict[str, int]:
    counts = {"ok": 0, "delayed": 0, "disrupted": 0, "diverted": 0}
    for group in hospital.get("patients", []):
        counts[_patient_state(group, services)] += int(group.get("count", 0))
    return counts


def _spread_tree(hospital: dict, patient_zero: str, infected: set[str]) -> tuple[dict[str, int], dict[str, str], dict[str, str]]:
    """Reconstruct how the infection reached each controlled device, as a BFS tree over
    the hospital's own admin-class (SMB/RDP) links — the links the engine's lateral reach
    uses. Returns ``tick`` (0 for patient zero, then one device per tick in BFS order),
    ``parent`` (the device it was taken from), and ``flow`` (the hospital flow id of that
    hop). Every hop is a real flow, so every pulse the UI draws runs along a real edge.
    Deterministic: siblings break ties by flow file order then device id.
    """
    from collections import deque

    order = {f["id"]: i for i, f in enumerate(hospital["flows"])}
    adj: dict[str, list[tuple[int, str, str]]] = {}
    for f in hospital["flows"]:
        if f["protocol"] in LATERAL_PROTOCOLS and f["from"] in infected and f["to"] in infected:
            adj.setdefault(f["from"], []).append((order[f["id"]], f["to"], f["id"]))
            adj.setdefault(f["to"], []).append((order[f["id"]], f["from"], f["id"]))

    parent: dict[str, str] = {}
    flow: dict[str, str] = {}
    seen = {patient_zero}
    visited = [patient_zero]
    queue: deque[str] = deque([patient_zero])
    while queue:
        node = queue.popleft()
        for _, nxt, fid in sorted(adj.get(node, [])):
            if nxt not in seen:
                seen.add(nxt)
                parent[nxt], flow[nxt] = node, fid
                visited.append(nxt)
                queue.append(nxt)
    # Any controlled device the admin links don't reach (not expected on the demo):
    # attach it to patient zero without a flow, so it still shows as compromised.
    for dev in sorted(infected - seen):
        parent[dev], flow[dev] = patient_zero, ""
        visited.append(dev)
    tick = {dev: i for i, dev in enumerate(visited)}
    return tick, parent, flow


def _choke_points(infected: set[str], patient_zero: str, parent: dict[str, str]) -> list[dict]:
    """Each device's share of the infections downstream of it in the spread tree."""
    children: dict[str, list[str]] = {}
    for dev, par in parent.items():
        children.setdefault(par, []).append(dev)

    def below(node: str) -> int:
        return sum(1 + below(c) for c in children.get(node, []))

    denom = len(infected) - 1
    if denom <= 0:
        return []
    shares = [{"deviceId": d, "share": round(below(d) / denom, 2)} for d in sorted(infected)]
    shares = [c for c in shares if c["share"] > 0]
    return sorted(shares, key=lambda c: (-c["share"], c["deviceId"]))[:3]


def run_session(hospital: dict, patient_zero: str, plan: Plan | None = None, *,
                policy: dict | None = None, challenges: Sequence[str] = ()) -> dict[str, Any]:
    """Run the engine over a hospital (optionally under an agents' ``policy`` and
    ``challenges``) and emit the UI's sim rows plus a per-tick ``frames`` timeline.

    The run tells a two-beat story: the infection spreads host to host across the
    window, one device per tick along a real connection; then at detonation services
    drop and patient groups divert. A merely *controlled* host doesn't degrade a
    service — services fail at encryption (R6) or a lost dependency — so the animation
    is spread, then a hard drop, not a gradual slide.
    """
    applied = apply_policy(hospital, policy, challenges)
    run_hospital = applied.hospital
    result, bridge = run(run_hospital, patient_zero, plan)
    name = {d["id"]: d["name"] for d in hospital["devices"]}
    room_name = {r["id"]: r.get("name", r["id"]) for r in hospital.get("rooms", [])}
    device_ids = [d["id"] for d in hospital["devices"]]
    room_of = {d["id"]: d.get("roomId", "") for d in hospital["devices"]}
    svc_name = {s["id"]: s.get("name", s["id"]) for s in hospital["services"]}

    infected = {h for h, lvl in result.levels.items() if Level[lvl] >= Level.controlled}
    infected.add(patient_zero)
    tick_of, parent, flow_of = _spread_tree(run_hospital, patient_zero, infected)
    det_tick = (max(tick_of.values()) if tick_of else 0) + 1

    final = result.services[-1].services
    down_services = [sid for sid in bridge.service_ids if final.get(sid) in {"down", "paper"}]
    group_state = {g["id"]: _patient_state(g, final) for g in hospital.get("patients", [])}
    group_room = {g["id"]: g.get("roomId", "") for g in hospital.get("patients", [])}
    group_type = {g["id"]: g.get("type") for g in hospital.get("patients", [])}
    notes = list(bridge.notes)
    if any(tick_of.get(d, 0) > 0 for d in infected):
        notes.append("[S] Each spread step is drawn along a real SMB/RDP connection between the device taken and the one it was taken from; the exact order inside a tick is a reconstruction.")

    # Blocked attempts: a connection the policy cut, out of a device the attack took.
    blocked: list[tuple[int, dict]] = []
    if applied.removed_flows:
        removed = {f["id"]: f for f in hospital["flows"] if f["id"] in set(applied.removed_flows)}
        for fid in applied.removed_flows:
            f = removed[fid]
            src = f["from"] if f["from"] in infected else f["to"] if f["to"] in infected else None
            if src is not None and f["protocol"] in LATERAL_PROTOCOLS:
                dst = f["to"] if src == f["from"] else f["from"]
                blocked.append((tick_of.get(src, 0), {"from": src, "to": dst, "flowId": fid, "success": False}))
        if blocked:
            notes.append("[S] A blocked attempt marks a connection the plan removed, out of a device the attack had taken.")

    # Tick 0 lists every device/service/group (the baseline the module inserts);
    # every later tick carries only what changed.
    base_devices = [
        {"deviceId": d, "infected": True, "infectedAtTick": 0, "infectedBy": ""} if d == patient_zero
        else {"deviceId": d, "infected": False, "infectedAtTick": -1, "infectedBy": ""}
        for d in device_ids
    ]
    base_services = [{"serviceId": sid, "down": False, "downSinceTick": -1} for sid in bridge.service_ids]
    base_patients = [{"groupId": gid, "state": "ok"} for gid in group_state]

    dev_changes: dict[int, list[dict]] = {}
    attempts_at: dict[int, list[dict]] = {}
    events_at: dict[int, list[dict]] = {0: [{"kind": "patient_zero", "targetId": patient_zero, "text": f"{name.get(patient_zero, patient_zero)} — patient zero"}]}
    for dev, t in sorted(tick_of.items(), key=lambda kv: kv[1]):
        if dev == patient_zero:
            continue
        dev_changes.setdefault(t, []).append({"deviceId": dev, "infected": True, "infectedAtTick": t, "infectedBy": parent[dev]})
        attempts_at.setdefault(t, []).append({"from": parent[dev], "to": dev, "flowId": flow_of[dev], "success": True})
        events_at.setdefault(t, []).append({"kind": "device_infected", "targetId": dev, "text": f"{name.get(dev, dev)} compromised"})
    for t, row in blocked:
        attempts_at.setdefault(t, []).append(row)

    svc_changes_det = [{"serviceId": sid, "down": True, "downSinceTick": det_tick} for sid in down_services]
    pat_changes_det = [{"groupId": gid, "state": st} for gid, st in group_state.items() if st != "ok"]
    events_det = [{"kind": "service_down", "targetId": sid, "text": f"{svc_name.get(sid, sid)} offline"} for sid in down_services]
    events_det += [{"kind": "diversion", "targetId": group_room[gid], "text": f"Ambulances diverted from {room_name.get(group_room[gid], group_room[gid])}"}
                   for gid, st in group_state.items() if st == "diverted" and group_type.get(gid) == "er"]

    # Cumulative state, frame by frame.
    cur_infected = {patient_zero: 0}
    cur_services = {sid: {"serviceId": sid, "down": False, "downSinceTick": -1} for sid in bridge.service_ids}
    cur_patients = {gid: "ok" for gid in group_state}
    choke = _choke_points(infected, patient_zero, parent)
    frames: list[dict] = []
    for t in range(det_tick + 1):
        if t == det_tick:
            for sid in down_services:
                cur_services[sid] = {"serviceId": sid, "down": True, "downSinceTick": det_tick}
            cur_patients.update(group_state)
        else:
            for ch in dev_changes.get(t, []):
                cur_infected[ch["deviceId"]] = t
        affected = sum(int(g.get("count", 0)) for g in hospital.get("patients", []) if cur_patients[g["id"]] != "ok")
        down_now = sorted(sid for sid, s in cur_services.items() if s["down"])
        delayed_now = sum(int(g.get("count", 0)) for g in hospital.get("patients", [])
                          if cur_patients[g["id"]] != "ok" and g.get("type") in {"outpatient_scan", "surgical"})
        if t == 0:
            devices_f, services_f, patients_f = base_devices, base_services, base_patients
        elif t == det_tick:
            devices_f, services_f, patients_f = [], svc_changes_det, pat_changes_det
        else:
            devices_f, services_f, patients_f = dev_changes.get(t, []), [], []
        frame: dict[str, Any] = {
            "tick": t,
            "final": t == det_tick,
            "devices": devices_f,
            "services": services_f,
            "patients": patients_f,
            "attempts": attempts_at.get(t, []),
            "events": events_det if t == det_tick else events_at.get(t, []),
            "snapshot": {
                "infectedCount": len(cur_infected),
                "patientsAffected": affected,
                "infectedIds": sorted(cur_infected),
                "servicesDown": down_now,
                "patients": dict(cur_patients),
            },
            "summary": {
                "patientsAffected": affected,
                "devicesCompromised": len(cur_infected),
                "servicesDown": len(down_now),
                "delayedProcedures": delayed_now,
                "chokePoints": choke,
            },
        }
        if t == 0:
            frame["run"] = {
                "finalTick": det_tick,
                "removedFlows": list(applied.removed_flows),
                "protectedBroken": list(applied.protected_broken),
                "assumptions": notes,
            }
        frames.append(frame)

    # Aggregate (final-state) top-level rows, for any consumer that isn't playing frames.
    devices = [
        {"deviceId": h, "infected": True, "infectedAtTick": tick_of[h], "infectedBy": parent.get(h, "") if h != patient_zero else ""}
        if h in infected else {"deviceId": h, "infected": False}
        for h in device_ids
    ]
    services = [{"serviceId": sid, "down": True, "downSinceTick": det_tick} if sid in down_services
                else {"serviceId": sid, "down": False} for sid in bridge.service_ids]
    patients = [{"groupId": gid, "state": st} for gid, st in group_state.items()]
    all_attempts = [a for t in sorted(attempts_at) for a in attempts_at[t]]
    all_events = [dict(e) for t in sorted(events_at) for e in events_at[t]] + list(events_det)
    snapshots = [{"tick": f["tick"], "infectedCount": f["snapshot"]["infectedCount"]} for f in frames]
    delayed = frames[-1]["summary"]["delayedProcedures"]

    return {
        "patientZero": patient_zero,
        "finalTick": det_tick,
        "removedFlows": list(applied.removed_flows),
        "protectedBroken": list(applied.protected_broken),
        "frames": frames,
        "devices": devices,
        "services": services,
        "patients": patients,
        "attempts": all_attempts,
        "events": all_events,
        "snapshots": snapshots,
        "chokePoints": choke,
        "delayedProcedures": delayed,
        "assumptions": notes,
        "encryptedHosts": len(result.summary["encrypted_hosts"]),
        "medicalDevicesEncrypted": result.summary["medical_devices_encrypted"],
    }


def to_run_result(session: dict, hospital: dict) -> dict[str, Any]:
    """Derive the agents' RunResult (agents/protocol.py) from a ``run_session`` output,
    so the agents' numbers are exactly the numbers the screen showed. ``hospital`` only
    supplies the static patient-group counts; nothing here recomputes spread."""
    final_tick = session["finalTick"]
    infected = [d for d in session["devices"] if d["infected"]]
    state_of = {p["groupId"]: p["state"] for p in session["patients"]}
    counts = {"ok": 0, "delayed": 0, "disrupted": 0, "diverted": 0}
    for group in hospital.get("patients", []):
        counts[state_of.get(group["id"], "ok")] += int(group.get("count", 0))
    return {
        "ticks": final_tick,
        "infectedCount": len(infected),
        "infectedDevices": sorted(({"id": d["deviceId"], "tick": d["infectedAtTick"]} for d in infected), key=lambda d: (d["tick"], d["id"])),
        "servicesDown": sorted(
            ({"id": s["serviceId"], "downSinceTick": s["downSinceTick"], "ticksDown": final_tick - s["downSinceTick"] + 1}
             for s in session["services"] if s["down"]),
            key=lambda d: d["id"],
        ),
        "patientCounts": counts,
        "protectedBroken": list(session["protectedBroken"]),
        "removedFlows": list(session["removedFlows"]),
    }


def run_result(hospital: dict, patient_zero: str, *, policy: dict | None = None, challenges: Sequence[str] = ()) -> dict[str, Any]:
    """A full test run reduced to the agents' RunResult contract."""
    session = run_session(hospital, patient_zero, policy=policy, challenges=challenges)
    return to_run_result(session, hospital)


__all__ = [
    "BridgeResult", "to_scenario", "to_campaign", "run", "run_session",
    "to_run_result", "run_result", "entry_points", "MEDICAL_TYPES", "PORT_CLASS",
]
