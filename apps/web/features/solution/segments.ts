// The functional segments a plan builds: networks by what a machine does, not by the
// room it stands in (segment the PACS and imaging network, the bedside monitors and
// pumps, the core servers; poke holes only for the minimum viable clinical traffic).
// agents/logic/segments.py is the same partition for the optimizer: keep the two in step.

import type { Device, DeviceStateRow, Hospital } from "@/lib/stdb/types";
import type { Segment } from "./pair";

export type FunctionalSegment = "core" | "imaging" | "monitoring" | "clinical" | "business";

export const SEGMENT: Record<FunctionalSegment, { name: string; color: string }> = {
  core: { name: "Core servers", color: "#FFC53D" },
  imaging: { name: "Imaging & PACS", color: "#B08CFF" },
  monitoring: { name: "Bedside monitoring", color: "#3ECFB2" },
  clinical: { name: "Clinical workstations", color: "#4DB0FF" },
  business: { name: "Business & public", color: "#A1A8AE" },
};
export const SEGMENT_ORDER: FunctionalSegment[] = ["core", "imaging", "monitoring", "clinical", "business"];

export function segmentOf(d: Device, zone: string): FunctionalSegment {
  if (d.type === "mri" || d.type === "ct" || d.role === "pacs" || (d.type === "workstation" && zone === "imaging")) return "imaging";
  if (d.type === "server_rack") return "core";
  if (d.type === "patient_monitor" || d.type === "infusion_pump" || d.type === "anesthesia_machine" || d.type === "nurse_station") return "monitoring";
  if (zone === "business" || zone === "public" || d.type === "hvac" || d.type === "badge_reader") return "business";
  return "clinical";
}

/** One segment per functional network, with its machines and how many of them a run shows infected. */
export function functionalSegmentsOf(hospital: Hospital, devices: readonly DeviceStateRow[]): Segment[] {
  const infected = new Set(devices.filter((d) => d.infected).map((d) => d.deviceId));
  const room = new Map(hospital.rooms.map((r) => [r.id, r]));
  const level = new Map(hospital.floors.map((f) => [f.id, f.level]));
  const by = new Map<FunctionalSegment, Segment>();
  for (const d of hospital.devices) {
    const r = room.get(d.roomId);
    if (!r) continue;
    const key = segmentOf(d, r.zone);
    const s = by.get(key) ?? { zone: key, name: SEGMENT[key].name, color: SEGMENT[key].color, floors: "", floorIds: [], deviceIds: [], total: 0, infected: 0 };
    s.deviceIds.push(d.id);
    s.total += 1;
    if (infected.has(d.id)) s.infected += 1;
    if (!s.floorIds.includes(r.floorId)) s.floorIds.push(r.floorId);
    by.set(key, s);
  }
  return SEGMENT_ORDER.filter((k) => by.has(k)).map((k) => {
    const s = by.get(k)!;
    s.floorIds.sort((a, b) => (level.get(a) ?? 0) - (level.get(b) ?? 0));
    const rooms = new Set(s.deviceIds.map((id) => hospital.devices.find((d) => d.id === id)?.roomId));
    s.floors = `${rooms.size} ${rooms.size === 1 ? "room" : "rooms"}`;
    return s;
  });
}
