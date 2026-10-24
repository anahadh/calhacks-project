// The one spread engine (AGENTS.md rule 3). The SpacetimeDB module calls it
// for visible runs, and hippo-sim calls it for test runs. Pure and
// deterministic: the only randomness is the seeded mulberry32 state carried
// in SimState (rule 5). No clock, no Math.random.

import { keptFlowIds } from "./policy";
import { nextFloat, seedState } from "./rng";
import type { Hospital, PatientGroupType, PatientStateValue, Policy, Protocol } from "./types";

export const TICK_MINUTES = 15;

/** Illustrative values, labeled as such in the UI. Not measured from real incidents. */
export const BASE: Record<Protocol, number> = {
  smb: 0.6, rdp: 0.45, http: 0.2, https: 0.2, dicom: 0.1, hl7: 0.08, other: 0.05,
};
export const BOTH_WAYS: ReadonlySet<Protocol> = new Set<Protocol>(["smb", "rdp"]);
export const VULN_MULT = 1.8;
export const P_CAP = 0.95;

/** Patient escalation, in ticks a needed service has been down. */
export const DELAYED_AFTER = 1;
export const DISRUPTED_AFTER = 4;
export const DIVERTED_AFTER = 6; // `er` groups only

export type InfectionInfo = { atTick: number; by: string | null };

export type SimState = {
  tick: number;
  rng: number;
  infected: Record<string, InfectionInfo>;
  /** Down services and the tick they went down. Services never recover within a run. */
  serviceDownSince: Record<string, number>;
  patients: Record<string, PatientStateValue>;
};

export type SpreadAttempt = { tick: number; from: string; to: string; flowId: string; success: boolean };

export type SimEventKind = "patient_zero" | "device_infected" | "service_down" | "diversion";
export type SimEvent = { tick: number; kind: SimEventKind; targetId: string; text: string };

export type StepOptions = {
  policy?: Policy | null;
  /** Flows with `active: false` that a challenge has switched on. */
  extraActiveFlowIds?: readonly string[];
  /** Devices a challenge has marked vulnerable. */
  extraVulnerableIds?: readonly string[];
};

export type StepResult = { state: SimState; attempts: SpreadAttempt[]; events: SimEvent[] };

type Edge = { flowId: string; from: string; to: string; protocol: Protocol };

/** Directed edges the infection can travel, in a fixed order. */
export function spreadEdges(h: Hospital, opts: StepOptions = {}): Edge[] {
  const extra = new Set(opts.extraActiveFlowIds ?? []);
  const active = h.flows.filter((f) => f.active !== false || extra.has(f.id));
  const kept = keptFlowIds(h, active, opts.policy);
  const edges: Edge[] = [];
  for (const f of active) {
    if (!kept.has(f.id)) continue;
    edges.push({ flowId: f.id, from: f.from, to: f.to, protocol: f.protocol });
    if (BOTH_WAYS.has(f.protocol)) edges.push({ flowId: f.id, from: f.to, to: f.from, protocol: f.protocol });
  }
  edges.sort((a, b) => (a.flowId < b.flowId ? -1 : a.flowId > b.flowId ? 1 : a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
  return edges;
}

const RANK: Record<PatientStateValue, number> = { ok: 0, delayed: 1, disrupted: 2, diverted: 3 };

function computeImpact(h: Hospital, state: SimState, tick: number, events: SimEvent[]): void {
  for (const svc of h.services) {
    const down = svc.dependsOnDevices.some((d) => d in state.infected);
    if (down && !(svc.id in state.serviceDownSince)) {
      state.serviceDownSince[svc.id] = tick;
      events.push({ tick, kind: "service_down", targetId: svc.id, text: `${svc.name} offline` });
    }
  }
  for (const g of h.patients) {
    let longest = 0;
    for (const s of g.dependsOnServices) {
      const since = state.serviceDownSince[s];
      if (since !== undefined) longest = Math.max(longest, tick - since + 1);
    }
    const computed = escalate(g.type, longest);
    const prev = state.patients[g.id] ?? "ok";
    const next = RANK[computed] > RANK[prev] ? computed : prev;
    if (next === "diverted" && prev !== "diverted") {
      events.push({ tick, kind: "diversion", targetId: g.roomId, text: "ER diverting ambulances" });
    }
    state.patients[g.id] = next;
  }
}

function escalate(type: PatientGroupType, ticksDown: number): PatientStateValue {
  if (type === "er" && ticksDown >= DIVERTED_AFTER) return "diverted";
  if (ticksDown >= DISRUPTED_AFTER) return "disrupted";
  if (ticksDown >= DELAYED_AFTER) return "delayed";
  return "ok";
}

/** Tick 0: patient zero infected, impact computed. */
export function initialState(h: Hospital, patientZero: string, seed: number): StepResult {
  const pz = h.devices.find((d) => d.id === patientZero);
  if (!pz) throw new Error(`Device "${patientZero}" does not exist.`);
  const state: SimState = {
    tick: 0,
    rng: seedState(seed),
    infected: { [patientZero]: { atTick: 0, by: null } },
    serviceDownSince: {},
    patients: Object.fromEntries(h.patients.map((g) => [g.id, "ok" as PatientStateValue])),
  };
  const events: SimEvent[] = [
    { tick: 0, kind: "patient_zero", targetId: patientZero, text: `${pz.name} infected (patient zero)` },
  ];
  computeImpact(h, state, 0, events);
  return { state, attempts: [], events };
}

/** Advance one tick. Does not mutate the input state. */
export function step(h: Hospital, prev: SimState, opts: StepOptions = {}): StepResult {
  const tick = prev.tick + 1;
  const state: SimState = {
    tick,
    rng: prev.rng,
    infected: { ...prev.infected },
    serviceDownSince: { ...prev.serviceDownSince },
    patients: { ...prev.patients },
  };
  const vulnerable = new Set([
    ...h.devices.filter((d) => d.vulnerable).map((d) => d.id),
    ...(opts.extraVulnerableIds ?? []),
  ]);
  const name = new Map(h.devices.map((d) => [d.id, d.name]));
  const attempts: SpreadAttempt[] = [];
  const events: SimEvent[] = [];
  const fresh: Record<string, InfectionInfo> = {};

  for (const e of spreadEdges(h, opts)) {
    if (!(e.from in prev.infected)) continue; // only devices infected before this tick spread
    if (e.to in prev.infected || e.to in fresh) continue;
    const p = Math.min(P_CAP, BASE[e.protocol] * (vulnerable.has(e.to) ? VULN_MULT : 1));
    const [r, next] = nextFloat(state.rng);
    state.rng = next;
    const success = r < p;
    attempts.push({ tick, from: e.from, to: e.to, flowId: e.flowId, success });
    if (success) {
      fresh[e.to] = { atTick: tick, by: e.from };
      events.push({ tick, kind: "device_infected", targetId: e.to, text: `${name.get(e.to) ?? e.to} compromised` });
    }
  }
  Object.assign(state.infected, fresh);
  computeImpact(h, state, tick, events);
  return { state, attempts, events };
}

/** True when no infected device has an edge to an uninfected one. */
export function isContained(h: Hospital, state: SimState, opts: StepOptions = {}): boolean {
  return !spreadEdges(h, opts).some((e) => e.from in state.infected && !(e.to in state.infected));
}

/**
 * True when nothing can change any more: no edge can carry the infection
 * further, and every down service has been down long enough that patient
 * states have stopped escalating. Visible runs end here (or at MAX_TICKS).
 */
export function isSettled(h: Hospital, state: SimState, opts: StepOptions = {}): boolean {
  if (!isContained(h, state, opts)) return false;
  return Object.values(state.serviceDownSince).every((since) => state.tick - since + 1 >= DIVERTED_AFTER);
}

export type ChokePoint = { deviceId: string; share: number };

export type Summary = {
  tick: number;
  patientsAffected: number;
  patientsByState: Record<PatientStateValue, number>;
  devicesCompromised: number;
  servicesDown: string[];
  delayedProcedures: number;
  chokePoints: ChokePoint[];
};

export function summarize(h: Hospital, state: SimState): Summary {
  const byState: Record<PatientStateValue, number> = { ok: 0, delayed: 0, disrupted: 0, diverted: 0 };
  let delayedProcedures = 0;
  for (const g of h.patients) {
    const s = state.patients[g.id] ?? "ok";
    byState[s] += g.count;
    if (s !== "ok" && (g.type === "outpatient_scan" || g.type === "surgical")) delayedProcedures += g.count;
  }
  const infectedIds = Object.keys(state.infected).sort();
  return {
    tick: state.tick,
    patientsAffected: byState.delayed + byState.disrupted + byState.diverted,
    patientsByState: byState,
    devicesCompromised: infectedIds.length,
    servicesDown: Object.keys(state.serviceDownSince).sort(),
    delayedProcedures,
    chokePoints: chokePoints(state),
  };
}

/** Each device's share of the infections downstream of it. */
export function chokePoints(state: SimState, top = 3): ChokePoint[] {
  const ids = Object.keys(state.infected).sort();
  if (ids.length < 2) return [];
  const children = new Map<string, string[]>();
  for (const id of ids) {
    const by = state.infected[id].by;
    if (by) children.set(by, [...(children.get(by) ?? []), id]);
  }
  const below = (id: string): number => (children.get(id) ?? []).reduce((n, c) => n + 1 + below(c), 0);
  return ids
    .map((deviceId) => ({ deviceId, share: below(deviceId) / (ids.length - 1) }))
    .filter((c) => c.share > 0)
    .sort((a, b) => b.share - a.share || (a.deviceId < b.deviceId ? -1 : 1))
    .slice(0, top);
}
