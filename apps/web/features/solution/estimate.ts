// The conclusion card's reads: what the plan saved (two run rows' summary
// columns), an illustrative money estimate over those counts, and the plan's
// segments as a diagram (zones joined by the connections the plan kept, split
// by the ones it cut). Pure, tested on its own. Nothing here simulates: every
// count is a run row's column or the hospital's topology (AGENTS.md rule 3),
// and the dollar figures are stated unit costs times those counts.

import type { DeviceStateRow, Hospital, RunRow } from "@/lib/stdb/types";
import { zoneName, ZONE_STYLE } from "./pair";

/**
 * Illustrative unit costs, in US dollars. They are assumptions, shown as such
 * on the card ("How this is estimated"), not measurements. Change them here.
 */
export const UNIT = {
  /** Writing, testing and deploying one allow rule on the switches. */
  rule: 1_500,
  /** Validating one segment with clinical engineering before it is enforced. */
  segment: 6_000,
  /** Change management, monitoring and a rollback plan for the whole project. */
  project: 20_000,
  /** Rebuilding one compromised machine (re-image, re-certify, return to service). */
  device: 4_500,
  /** One patient whose care is delayed, disrupted or diverted during the outage. */
  patient: 1_800,
  /** One clinical service offline for the attack's duration (manual fallback, overtime). */
  service: 60_000,
} as const;

export type Saved = {
  /** Machines the plan kept clean: devices infected without it minus with it. */
  machines: number;
  /** Patients kept on normal care: affected without it minus with it. */
  patients: number;
  /** Clinical services kept running. */
  services: number;
  /** Protected clinical connections still working under the plan. */
  flowsIntact: number;
  flowsTotal: number;
  before: { devices: number; patients: number; services: number };
  after: { devices: number; patients: number; services: number };
};

/** Both sides' final numbers, as differences. Undefined until both runs are done. */
export function savedBy(hospital: Pick<Hospital, "flows">, none: RunRow | undefined, plan: RunRow | undefined): Saved | undefined {
  if (!none || !plan || none.status !== "done" || plan.status !== "done") return undefined;
  const total = hospital.flows.filter((f) => f.protected && f.active !== false).length;
  return {
    machines: Math.max(0, none.devicesCompromised - plan.devicesCompromised),
    patients: Math.max(0, none.patientsAffected - plan.patientsAffected),
    services: Math.max(0, none.servicesDown - plan.servicesDown),
    flowsIntact: Math.max(0, total - plan.protectedBroken.length),
    flowsTotal: total,
    before: { devices: none.devicesCompromised, patients: none.patientsAffected, services: none.servicesDown },
    after: { devices: plan.devicesCompromised, patients: plan.patientsAffected, services: plan.servicesDown },
  };
}

export type Money = {
  /** Cost to put the plan in place. */
  implement: number;
  /** Cost this attack would have added without the plan. */
  avoided: number;
  /** Each line of both sums, for "How this is estimated". */
  lines: { side: "implement" | "avoided"; label: string; count: number; unit: number; total: number }[];
};

/** Unit costs times counts. `segments` is how many segments the plan draws. */
export function moneyOf(rules: number, segments: number, saved: Saved): Money {
  const lines: Money["lines"] = [
    { side: "implement", label: "allow rules", count: rules, unit: UNIT.rule, total: rules * UNIT.rule },
    { side: "implement", label: "segments validated", count: segments, unit: UNIT.segment, total: segments * UNIT.segment },
    { side: "implement", label: "project overhead", count: 1, unit: UNIT.project, total: UNIT.project },
    { side: "avoided", label: "machines rebuilt", count: saved.machines, unit: UNIT.device, total: saved.machines * UNIT.device },
    { side: "avoided", label: "patients disrupted", count: saved.patients, unit: UNIT.patient, total: saved.patients * UNIT.patient },
    { side: "avoided", label: "services offline", count: saved.services, unit: UNIT.service, total: saved.services * UNIT.service },
  ];
  const sum = (side: Money["lines"][number]["side"]) => lines.filter((l) => l.side === side).reduce((a, l) => a + l.total, 0);
  return { implement: sum("implement"), avoided: sum("avoided"), lines };
}

/** "$1.2M", "$48k", "$900". */
export function dollars(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 10_000) return `$${Math.round(n / 1_000)}k`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n}`;
}

// --- The segment diagram: zones as nodes, the plan's kept and cut connections as edges ---

export type DiagramNode = {
  zone: string;
  name: string;
  color: string;
  devices: number;
  infected: number;
  /** Devices in the zone the plan keeps clean (infected without it, clean with it). */
  x: number;
  y: number;
};

export type DiagramEdge = {
  from: string;
  to: string;
  /** Connections between the two zones the plan kept. */
  kept: number;
  /** Connections between them the plan cut. */
  cut: number;
  /** Protected clinical connections among the kept ones. */
  protectedKept: number;
};

export type Diagram = { nodes: DiagramNode[]; edges: DiagramEdge[]; width: number; height: number };

/**
 * One node per zone with devices, placed on a ring; one edge per pair of zones
 * with any connection between them, counting kept and cut. Links inside a zone
 * are not drawn: the plan segments between zones. Topology only.
 */
export function diagramOf(hospital: Hospital, planDevices: readonly DeviceStateRow[], removedFlows: readonly string[], width = 560, height = 360): Diagram {
  const room = new Map(hospital.rooms.map((r) => [r.id, r]));
  const zoneOf = new Map(hospital.devices.map((d) => [d.id, room.get(d.roomId)?.zone ?? "other"]));
  const infected = new Set(planDevices.filter((d) => d.infected).map((d) => d.deviceId));
  const order = Object.keys(ZONE_STYLE);
  const zones = [...new Set(hospital.devices.map((d) => zoneOf.get(d.id)!))].sort(
    (a, b) => (order.includes(a) ? order.indexOf(a) : order.length) - (order.includes(b) ? order.indexOf(b) : order.length) || a.localeCompare(b),
  );
  const removed = new Set(removedFlows);
  const edges = new Map<string, DiagramEdge>();
  for (const f of hospital.flows) {
    if (f.active === false) continue;
    const a = zoneOf.get(f.from);
    const b = zoneOf.get(f.to);
    if (!a || !b || a === b) continue;
    const [p, q] = a < b ? [a, b] : [b, a];
    const key = `${p}|${q}`;
    const e = edges.get(key) ?? { from: p, to: q, kept: 0, cut: 0, protectedKept: 0 };
    if (removed.has(f.id)) e.cut += 1;
    else {
      e.kept += 1;
      if (f.protected) e.protectedKept += 1;
    }
    edges.set(key, e);
  }
  const cx = width / 2;
  const cy = height / 2;
  const r = Math.min(width, height) / 2 - 56;
  const nodes = zones.map((zone, i) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / zones.length;
    const ids = hospital.devices.filter((d) => zoneOf.get(d.id) === zone).map((d) => d.id);
    return {
      zone,
      name: zoneName(zone),
      color: ZONE_STYLE[zone]?.color ?? "#7D858B",
      devices: ids.length,
      infected: ids.filter((id) => infected.has(id)).length,
      x: Math.round(cx + r * Math.cos(angle)),
      y: Math.round(cy + r * Math.sin(angle)),
    };
  });
  return { nodes, edges: [...edges.values()], width, height };
}
