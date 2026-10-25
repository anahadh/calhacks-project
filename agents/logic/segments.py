"""The functional segments a plan builds: networks by what a machine does, not by the
room it stands in (the advice behind it: segment the PACS and imaging network, the
bedside monitors and pumps, the core servers; poke holes only for the minimum viable
clinical traffic; never make islands of uselessness). apps/web/features/solution/segments.ts
is the same partition for the map, keep the two in step."""

from .hospital import HospitalIndex

SEGMENT_NAMES = {
    "core": "core servers",
    "imaging": "imaging and PACS",
    "monitoring": "bedside monitoring",
    "clinical": "clinical workstations",
    "business": "business and public",
}
ORDER = ("core", "imaging", "monitoring", "clinical", "business")


def segment_of(h: HospitalIndex, device_id: str) -> str:
    d = h.devices[device_id]
    t, role, zone = d["type"], d.get("role"), h.zone(device_id)
    if t in ("mri", "ct") or role == "pacs" or (t == "workstation" and zone == "imaging"):
        return "imaging"
    if t == "server_rack":
        return "core"
    if t in ("patient_monitor", "infusion_pump", "anesthesia_machine", "nurse_station"):
        return "monitoring"
    if zone in ("business", "public") or t in ("hvac", "badge_reader"):
        return "business"
    return "clinical"  # workstations in care areas, lab analyzers, pharmacy cabinets


def segment_name(seg: str) -> str:
    return SEGMENT_NAMES.get(seg, seg)
