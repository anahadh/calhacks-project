// The solution view's reads over the pair's two run rows: which run each shared
// control acts on, the shared clock, the before/after strip and what keeps
// working. Pure, so it is tested on its own. Every number is a run row's summary
// column, copied (AGENTS.md rule 3): nothing here simulates or recomputes.

import { MOCK_REFUSAL } from "@/features/agents/defend";
import { finalOf, notFinalYet } from "@/features/flow/final";
import { controlRefusal, runProgress, solutionRefusal, type PlaybackControl } from "@/lib/stdb/run-status";
import type { DeviceStateRow, Flow, Hospital, Point, RunRow, RunView, ServiceStateRow, SessionSnapshot } from "@/lib/stdb/types";

type ShowInputs = Pick<SessionSnapshot, "source" | "isPresenter" | "activeRun" | "runs" | "roundState" | "recommendations">;

/**
 * Why Show the solution would be refused for this recommendation, or null.
 * Mirrors solution_start: presenter only, the round finished, no session run
 * computing or playing, and a baseline to rerun.
 */
export function showBlocker(s: ShowInputs, recommendationId: string): string | null {
  if (s.source === "mock") return MOCK_REFUSAL;
  return solutionRefusal(s, recommendationId);
}

const NO_ROWS: RunView = {
  devices: [], services: [], patients: [], attempts: [], events: [], snapshots: [], chokePoints: [],
  totals: { patientsAffected: 0, devicesCompromised: 0, servicesDown: 0, delayedProcedures: 0 },
};

/**
 * The session as one scene shows it: the session's hospital and people, with
 * one run's rows in place of the active run's. With no view, the building is
 * clean (no run), as while the presenter picks a new patient zero.
 */
export function sceneOf(s: SessionSnapshot, view: RunView = NO_ROWS): SessionSnapshot {
  return {
    ...s,
    activeRun: view.run,
    activeRunId: view.run?.id ?? "",
    devices: view.devices,
    services: view.services,
    patients: view.patients,
    attempts: view.attempts,
    events: view.events,
    snapshots: view.snapshots,
    chokePoints: view.chokePoints,
    totals: view.totals,
    delayedProcedures: view.totals.delayedProcedures,
  };
}

type Sides = readonly (RunRow | undefined)[];

/**
 * The run one shared control is sent to. The module moves every run under the
 * pair's key, but it checks the status of the run it is given, and the two
 * sides can finish at different steps. So play and step go to a side that is
 * paused, pause to one that is playing, reset to one that is not computing.
 */
export function pairTarget(control: PlaybackControl | "speed", sides: Sides): RunRow | undefined {
  const runs = sides.filter((r): r is RunRow => !!r);
  const first = (status: RunRow["status"]) => runs.find((r) => r.status === status);
  switch (control) {
    case "play":
    case "step":
      return first("paused") ?? first("running") ?? runs[0];
    case "pause":
      return first("running") ?? runs[0];
    case "reset":
      return runs.find((r) => r.status !== "requested") ?? runs[0];
    case "speed":
      return runs[0];
  }
}

/** Why a shared control can't act on the pair now, or null. The same checks as the session's own run. */
export function pairRefusal(control: PlaybackControl, sides: Sides): string | null {
  if (!sides.some(Boolean)) return "The rerun hasn't started yet.";
  return controlRefusal(control, pairTarget(control, sides));
}

/** The shared clock: the furthest step either side has reached, out of the longer run. */
export function pairClock(sides: Sides): { tick: number; finalTick: number; line: string } {
  const runs = sides.filter((r): r is RunRow => !!r);
  const tick = Math.max(0, ...runs.map((r) => r.tick));
  const finalTick = Math.max(0, ...runs.map((r) => r.finalTick));
  if (runs.length < sides.length || runs.some((r) => r.status === "requested")) {
    return { tick, finalTick, line: "Computing the rerun…" };
  }
  const failed = runs.find((r) => r.status === "error");
  if (failed) return { tick, finalTick, line: runProgress(failed) };
  return { tick, finalTick, line: `Step ${tick} of ${finalTick}` };
}

export type Delta = {
  label: string;
  /** No segmentation's final value, or undefined until that run is done. */
  before?: number;
  /** The plan's final value, or undefined until that run is done. */
  after?: number;
  /** A line under the numbers ("Lab results to charts", "4 allow rules"). */
  note?: string;
};

/**
 * "What segmentation saved": the 2×2 grid, from the two run rows' summary
 * columns and the plan's removed flows, plus the plan's rule count. A side's
 * numbers fill in only once its run is done: part way through, a run row holds
 * the numbers at that step, and the two sides finish at different steps, so
 * mid-run columns would compare unlike things. Connections are the hospital's
 * flows minus the ones the plan removed (a property of the plan, not a step).
 */
export function beforeAfter(
  hospital: Pick<Hospital, "flows">,
  none: RunRow | undefined,
  plan: RunRow | undefined,
  rules: number | undefined,
): Delta[] {
  const b = finalOf(none);
  const a = finalOf(plan);
  const purpose = new Map(hospital.flows.map((f) => [f.id, f.purpose]));
  const cutPurposes = [...new Set((plan?.protectedBroken ?? []).map((id) => purpose.get(id)).filter((p): p is string => !!p))];
  const total = hospital.flows.length;
  return [
    { label: "Devices infected", before: b?.devicesCompromised, after: a?.devicesCompromised },
    { label: "Patients affected", before: b?.patientsAffected, after: a?.patientsAffected },
    { label: "Services offline", before: b?.servicesDown, after: a?.servicesDown },
    {
      label: "Protected flows cut",
      before: b?.protectedBroken.length,
      after: a?.protectedBroken.length,
      note: cutPurposes.length ? cutPurposes.join(", ") : undefined,
    },
    {
      label: "Connections",
      before: none ? total : undefined,
      after: plan ? total - plan.removedFlows.length : undefined,
      note: rules === undefined ? undefined : `${rules} allow ${rules === 1 ? "rule" : "rules"}`,
    },
  ];
}

/**
 * How many devices the baseline had infected by the plan's step: counted from
 * the baseline run's device rows (infected_at_tick) when they are subscribed,
 * else that run's summary column. Undefined until the baseline row exists.
 */
export function withoutSegmentation(
  none: RunRow | undefined,
  noneDevices: readonly DeviceStateRow[],
  tick: number,
): number | undefined {
  if (!none) return undefined;
  if (noneDevices.length) return noneDevices.filter((d) => d.infected && (d.infectedAtTick ?? 0) <= tick).length;
  return none.status === "requested" ? undefined : none.devicesCompromised;
}

/**
 * The cut connections the infection reached: a removed flow with an infected
 * device at either end, from the plan run's device rows. Each gets a ✕ on the
 * building, where the spread stopped at the wall (UX "Solution view").
 */
export function cutStops(cut: readonly Flow[], devices: readonly DeviceStateRow[]): Flow[] {
  const infected = new Set(devices.filter((d) => d.infected).map((d) => d.deviceId));
  return cut.filter((f) => infected.has(f.from) || infected.has(f.to));
}

/** The plan's flows, split into the ones it kept and the ones it removed (run.removed_flows_json). */
export function planFlows(hospital: Pick<Hospital, "flows">, plan: RunRow | undefined): { kept: Flow[]; cut: Flow[] } {
  const removed = new Set(plan?.removedFlows ?? []);
  const flows = hospital.flows.filter((f) => f.active !== false);
  return { kept: flows.filter((f) => !removed.has(f.id)), cut: flows.filter((f) => removed.has(f.id)) };
}

// --- Segments: the hospital's room zones, as the plan view draws and lists them ---

export type Segment = {
  zone: string;
  name: string;
  color: string;
  /** "Both floors", or the floor's name. */
  floors: string;
  floorIds: string[];
  deviceIds: string[];
  total: number;
  infected: number;
};

/** State colors are allowed on zones (UX rule 2); chrome stays neutral. */
export const ZONE_STYLE: Record<string, { name: string; color: string }> = {
  imaging: { name: "Imaging", color: "#B08CFF" },
  critical_care: { name: "Critical care", color: "#3ECFB2" },
  it_core: { name: "IT core", color: "#FFC53D" },
  clinical_support: { name: "Clinical support", color: "#FF4778" },
  inpatient: { name: "Inpatient", color: "#8BD346" },
  business: { name: "Business", color: "#7D858B" },
  public: { name: "Public", color: "#7D858B" },
};
const ZONE_ORDER = Object.keys(ZONE_STYLE);

export function zoneName(zone: string): string {
  return ZONE_STYLE[zone]?.name ?? zone.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

/**
 * One segment per room zone: its devices (the devices in rooms of that zone),
 * the floors it spans, and how many of its devices a run's rows show infected.
 * Listed in the design's order, with any other zone after, by name.
 */
export function segmentsOf(hospital: Hospital, devices: readonly DeviceStateRow[]): Segment[] {
  const infected = new Set(devices.filter((d) => d.infected).map((d) => d.deviceId));
  const room = new Map(hospital.rooms.map((r) => [r.id, r]));
  const level = new Map(hospital.floors.map((f) => [f.id, f.level]));
  const by = new Map<string, Segment>();
  for (const d of hospital.devices) {
    const r = room.get(d.roomId);
    if (!r) continue;
    const s = by.get(r.zone) ?? {
      zone: r.zone, name: zoneName(r.zone), color: ZONE_STYLE[r.zone]?.color ?? "#7D858B",
      floors: "", floorIds: [], deviceIds: [], total: 0, infected: 0,
    };
    s.deviceIds.push(d.id);
    s.total += 1;
    if (infected.has(d.id)) s.infected += 1;
    if (!s.floorIds.includes(r.floorId)) s.floorIds.push(r.floorId);
    by.set(r.zone, s);
  }
  const rank = (z: string) => (ZONE_ORDER.includes(z) ? ZONE_ORDER.indexOf(z) : ZONE_ORDER.length);
  return [...by.values()]
    .map((s) => {
      s.floorIds.sort((a, b) => (level.get(a) ?? 0) - (level.get(b) ?? 0));
      const all = hospital.floors.length > 1 && s.floorIds.length === hospital.floors.length;
      s.floors = all
        ? hospital.floors.length === 2 ? "Both floors" : "All floors"
        : s.floorIds.map((id) => hospital.floors.find((f) => f.id === id)?.name ?? id).join(" · ");
      return s;
    })
    .sort((a, b) => rank(a.zone) - rank(b.zone) || a.name.localeCompare(b.name));
}

/**
 * The outline drawn around a segment's devices on one floor: their convex hull
 * (monotone chain), pushed out by `pad` so the line clears the dots. One or
 * two devices get a padded box instead, so every segment has an outline.
 */
export function hullOf(points: readonly Point[], pad = 1.6): Point[] {
  const pts = [...new Map(points.map((p) => [`${p[0]},${p[1]}`, p])).values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length === 0) return [];
  if (pts.length < 3) {
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs) - pad, Math.max(...xs) + pad, Math.min(...ys) - pad, Math.max(...ys) + pad];
    return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  }
  const cross = (o: Point, a: Point, b: Point) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Point[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Point[] = [];
  for (const p of [...pts].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  const hull = [...lower.slice(0, -1), ...upper.slice(0, -1)];
  if (hull.length < 3) return hullOf(hull, pad);
  const cx = hull.reduce((a, p) => a + p[0], 0) / hull.length;
  const cy = hull.reduce((a, p) => a + p[1], 0) / hull.length;
  return hull.map(([x, y]) => {
    const d = Math.hypot(x - cx, y - cy) || 1;
    return [x + ((x - cx) / d) * pad, y + ((y - cy) / d) * pad];
  });
}

/** Which side the strip is still waiting for, and where it is ("No segmentation paused at step 5 of 14"), or null. */
export function stripPending(none: RunRow | undefined, plan: RunRow | undefined): string | null {
  const sides: [string, string | null][] = [["No segmentation", notFinalYet(none)], ["With the plan", notFinalYet(plan)]];
  const waiting = sides.filter(([, note]) => note !== null).map(([side, note]) => `${side} ${note}`);
  return waiting.length ? waiting.join(" · ") : null;
}

export type KeptFlow = { purpose: string; flowIds: string[]; broken: string[] };
export type KeptService = { id: string; name: string; down: boolean };

/**
 * "What keeps working" on the plan side: each protected flow, grouped by its
 * purpose, with the ones the plan removed (run.protected_broken_json); and each
 * critical service with its service_state row.
 */
export function keptWorking(
  hospital: Hospital,
  plan: RunRow | undefined,
  services: readonly ServiceStateRow[],
): { flows: KeptFlow[]; services: KeptService[] } {
  const broken = new Set(plan?.protectedBroken ?? []);
  const name = new Map(hospital.devices.map((d) => [d.id, d.name]));
  const flows = new Map<string, KeptFlow>();
  for (const f of hospital.flows) {
    if (!f.protected) continue;
    // A protected flow without a purpose is named by its two ends.
    const purpose = f.purpose ?? `${name.get(f.from) ?? f.from} → ${name.get(f.to) ?? f.to}`;
    const g = flows.get(purpose) ?? { purpose, flowIds: [], broken: [] };
    g.flowIds.push(f.id);
    if (broken.has(f.id)) g.broken.push(f.id);
    flows.set(purpose, g);
  }
  const down = new Map(services.map((s) => [s.serviceId, s.down]));
  return {
    flows: [...flows.values()],
    services: hospital.services.filter((s) => s.critical).map((s) => ({ id: s.id, name: s.name, down: !!down.get(s.id) })),
  };
}

const MEDICAL_TYPES = new Set(["mri", "ct", "patient_monitor", "infusion_pump", "anesthesia_machine", "lab_analyzer"]);
const SEGMENT_COLORS = ["#B08CFF", "#4DB0FF", "#3DD68C", "#F2C14E", "#FF5C5C", "#5FD3D3", "#E07BE0", "#A1A8AE"];

/**
 * The plan's segments as an attacker would meet them: machines still joined by file-sharing or
 * remote-desktop links after the plan's cuts form one segment (the reach an attack would have).
 * Topology from the hospital file and the run's removed flows; no spread is computed here.
 * Named after the zones each one spans, largest first. Machines with no such link are left out.
 */
export function planSegmentsOf(hospital: Hospital, devices: readonly DeviceStateRow[], removedFlows: readonly string[]): Segment[] {
  const infected = new Set(devices.filter((d) => d.infected).map((d) => d.deviceId));
  const removed = new Set(removedFlows);
  const room = new Map(hospital.rooms.map((r) => [r.id, r]));
  const level = new Map(hospital.floors.map((f) => [f.id, f.level]));
  const dev = new Map(hospital.devices.map((d) => [d.id, d]));
  const attackable = (id: string) => {
    const d = dev.get(id);
    return !!d && (["workstation", "nurse_station", "server_rack"].includes(d.type) || (MEDICAL_TYPES.has(d.type) && String(d.os ?? "").startsWith("windows")));
  };
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    parent.set(x, r);
    return r;
  };
  for (const f of hospital.flows) {
    if (removed.has(f.id) || (f.protocol !== "smb" && f.protocol !== "rdp") || f.active === false) continue;
    if (!attackable(f.from) || !attackable(f.to)) continue;
    for (const x of [f.from, f.to]) if (!parent.has(x)) parent.set(x, x);
    parent.set(find(f.from), find(f.to));
  }
  const groups = new Map<string, string[]>();
  for (const id of parent.keys()) groups.set(find(id), [...(groups.get(find(id)) ?? []), id]);
  return [...groups.values()]
    .filter((ids) => ids.length > 1)
    .sort((a, b) => b.length - a.length || a[0].localeCompare(b[0]))
    .map((ids, i) => {
      const zones = [...new Set(ids.map((id) => room.get(dev.get(id)!.roomId)?.zone ?? ""))];
      const floorIds = [...new Set(ids.map((id) => room.get(dev.get(id)!.roomId)?.floorId ?? ""))].sort((a, b) => (level.get(a) ?? 0) - (level.get(b) ?? 0));
      const all = hospital.floors.length > 1 && floorIds.length === hospital.floors.length;
      return {
        zone: `seg_${i}`,
        name: zones.length > 2 ? `${zoneName(zones[0])} + ${zones.length - 1} zones` : zones.map(zoneName).join(" + "),
        color: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
        floors: all ? "Both floors" : floorIds.map((id) => hospital.floors.find((f) => f.id === id)?.name ?? id).join(" · "),
        floorIds, deviceIds: ids, total: ids.length, infected: ids.filter((id) => infected.has(id)).length,
      };
    });
}


/**
 * A rounded outline around points: the convex hull grown by `r` with round corners
 * (one machine → a circle, two → a pill, more → a blob). For the plan's clusters on the map.
 */
export function roundedHullOf(points: readonly Point[], r = 1.6, arc = 6): Point[] {
  const pts = [...new Map(points.map((p) => [`${p[0]},${p[1]}`, p])).values()];
  if (!pts.length) return [];
  const core = pts.length >= 3 ? hullOf(pts, 0) : pts;
  const out: Point[] = [];
  const n = core.length;
  if (n === 1) {
    for (let i = 0; i < 24; i++) out.push([core[0][0] + r * Math.cos((2 * Math.PI * i) / 24), core[0][1] + r * Math.sin((2 * Math.PI * i) / 24)]);
    return out;
  }
  // Walk the hull counter-clockwise; at each vertex sweep the arc from the incoming edge's outward normal to the outgoing one's.
  const ccw = n >= 3 && core.reduce((a, p, i) => a + (p[0] * core[(i + 1) % n][1] - core[(i + 1) % n][0] * p[1]), 0) < 0 ? [...core].reverse() : core;
  const normal = (a: Point, b: Point): number => Math.atan2(-(b[0] - a[0]), b[1] - a[1]); // left of a→b … outward for a ccw hull
  for (let i = 0; i < ccw.length; i++) {
    const prev = ccw[(i - 1 + ccw.length) % ccw.length];
    const cur = ccw[i];
    const next = ccw[(i + 1) % ccw.length];
    let a0 = normal(prev, cur);
    let a1 = normal(cur, next);
    if (ccw.length === 2) a1 = a0 + Math.PI; // a pill: half a circle at each end
    while (a1 < a0) a1 += 2 * Math.PI;
    for (let k = 0; k <= arc; k++) {
      const t = a0 + ((a1 - a0) * k) / arc;
      out.push([cur[0] + r * Math.cos(t), cur[1] + r * Math.sin(t)]);
    }
  }
  return out;
}
