// Test-only: the run fixtures, and the exact rows the module must show after
// each frame. Shared by module.test.ts (the harness) and live.integration.test.ts
// (a real server). The expectation is read straight off the frames (frame 0 in
// full, then each frame's changes on top); nothing here computes spread.
//
// Fixtures follow the engine's TickFrame contract (INTEGRATION.md 5a):
// - frames.handwritten*.json + hospital.handwritten.json: written by hand from the contract.
// - frames.demo.mri_2*.json + hospital.demo.json: the engine's real run_session output
//   for data/hospitals/demo.json, patient zero mri_2 (baseline, and cand_keep_scans).
//   Copied in from the engine; picked up when present.

import { existsSync, readFileSync } from "node:fs";
import { KEEP_ATTEMPT_TICKS } from "../src/constants";

export type TickFrame = {
  tick: number;
  final: boolean;
  devices: { deviceId: string; infected: boolean; infectedAtTick: number; infectedBy: string }[];
  services: { serviceId: string; down: boolean; downSinceTick: number }[];
  patients: { groupId: string; state: string }[];
  attempts: { from: string; to: string; flowId: string; success: boolean }[];
  events: { kind: string; targetId: string; text: string }[];
  snapshot: { infectedCount: number; patientsAffected: number; infectedIds: string[]; servicesDown: string[]; patients: Record<string, string> };
  summary: { patientsAffected: number; devicesCompromised: number; servicesDown: number; delayedProcedures: number; chokePoints: { deviceId: string; share: number }[] };
  run?: { finalTick: number; removedFlows: string[]; protectedBroken: string[]; assumptions: string[] };
};

export type Fixture = { name: string; hospitalJson: string; patientZero: string; finalTick: number; frames: TickFrame[] };
export type Pair = { name: string; base: Fixture; plan: Fixture };

const DIR = new URL("./fixtures/", import.meta.url);
const read = (file: string) => JSON.parse(readFileSync(new URL(file, DIR), "utf8"));

/** A frames file is the engine's AppSession, or its hand-written subset { patientZero, finalTick, frames }. */
function fixture(file: string, hospitalFile: string): Fixture {
  const s = read(file);
  const frames = s.frames as TickFrame[];
  if (!Array.isArray(frames) || frames.length !== s.finalTick + 1 || frames.some((f, i) => f.tick !== i)) {
    throw new Error(`${file}: frames must be ticks 0..finalTick (${s.finalTick}).`);
  }
  return { name: file, hospitalJson: JSON.stringify(read(hospitalFile)), patientZero: s.patientZero, finalTick: s.finalTick, frames };
}

export const HANDWRITTEN: Pair = {
  name: "hand-written",
  base: fixture("frames.handwritten.json", "hospital.handwritten.json"),
  plan: fixture("frames.handwritten.plan.json", "hospital.handwritten.json"),
};

export const ENGINE_FILES = ["frames.demo.mri_2.json", "frames.demo.mri_2.keep_scans.json", "hospital.demo.json"] as const;
const engineReady = ENGINE_FILES.every((f) => existsSync(new URL(f, DIR)));

/** The engine's real frames, or undefined until they are copied into test/fixtures. */
export const ENGINE: Pair | undefined = engineReady
  ? {
      name: "engine demo mri_2",
      base: fixture(ENGINE_FILES[0], ENGINE_FILES[2]),
      plan: fixture(ENGINE_FILES[1], ENGINE_FILES[2]),
    }
  : undefined;

/** Every fixture pair present, the engine's first. */
export const PAIRS: Pair[] = ENGINE ? [ENGINE, HANDWRITTEN] : [HANDWRITTEN];

/** data/hospitals/demo.json as the session stores it: the hospital the engine's frames are computed from. */
export const DEMO_HOSPITAL_JSON = JSON.stringify(read(ENGINE_FILES[2]));

// ---------------------------------------------------------------- rows

/** A run's rows in one comparable shape: snake_case columns, JSON columns parsed, autoInc ids dropped, stable order. */
export type RunRows = {
  run: Record<string, unknown>;
  device_state: Record<string, unknown>[];
  service_state: Record<string, unknown>[];
  patient_state: Record<string, unknown>[];
  spread_attempt: Record<string, unknown>[];
  sim_event: Record<string, unknown>[];
  tick_snapshot: Record<string, unknown>[];
};

type Row = Record<string, any>;
/** Sorts rows by one column: the string key of a state row, a snapshot's tick, or an autoInc id (insertion order). */
const by = (col: string) => (a: Row, b: Row) => (a[col] < b[col] ? -1 : a[col] > b[col] ? 1 : 0);

/**
 * What the module must show for `runId` after frames 0..k of `fx` landed.
 * `status` is the run's status after frame k when it is not the final frame
 * (running under autoplay, paused otherwise); the final frame gives done.
 */
export function expectedRows(runId: string, fx: Fixture, k: number, status = "running"): RunRows {
  const landed = fx.frames.slice(0, k + 1);
  const devices = new Map<string, Row>();
  const services = new Map<string, Row>();
  const patients = new Map<string, Row>();
  for (const f of landed) {
    for (const d of f.devices) {
      devices.set(d.deviceId, { id: `${runId}:${d.deviceId}`, run_id: runId, device_id: d.deviceId, infected: d.infected,
        infected_at_tick: d.infectedAtTick, infected_by: d.infectedBy });
    }
    for (const s of f.services) {
      services.set(s.serviceId, { id: `${runId}:${s.serviceId}`, run_id: runId, service_id: s.serviceId, down: s.down,
        down_since_tick: s.downSinceTick });
    }
    for (const g of f.patients) patients.set(g.groupId, { id: `${runId}:${g.groupId}`, run_id: runId, group_id: g.groupId, state: g.state });
  }
  const f = fx.frames[k];
  const run0 = fx.frames[0].run!;
  return {
    run: {
      id: runId, tick: k, status: k === fx.finalTick ? "done" : status, final_tick: run0.finalTick, step_pending: false,
      patients_affected: f.summary.patientsAffected, devices_compromised: f.summary.devicesCompromised,
      services_down: f.summary.servicesDown, delayed_procedures: f.summary.delayedProcedures,
      choke_points: f.summary.chokePoints, removed_flows: run0.removedFlows, protected_broken: run0.protectedBroken,
      assumptions: run0.assumptions,
    },
    device_state: [...devices.values()].sort(by("id")),
    service_state: [...services.values()].sort(by("id")),
    patient_state: [...patients.values()].sort(by("id")),
    // Attempts older than KEEP_ATTEMPT_TICKS are pruned as later frames land.
    spread_attempt: landed.filter((x) => x.tick > k - KEEP_ATTEMPT_TICKS).flatMap((x) => x.attempts.map((a) => ({
      run_id: runId, tick: x.tick, from_device: a.from, to_device: a.to, flow_id: a.flowId, success: a.success,
    }))),
    sim_event: landed.flatMap((x) => x.events.map((e) => ({ run_id: runId, tick: x.tick, kind: e.kind, target_id: e.targetId, text: e.text }))),
    tick_snapshot: landed.map((x) => ({
      id: `${runId}:${x.tick}`, run_id: runId, tick: x.tick, infected_count: x.snapshot.infectedCount,
      patients_affected: x.snapshot.patientsAffected, infected_ids: x.snapshot.infectedIds, services_down: x.snapshot.servicesDown,
      patients: x.snapshot.patients,
    })),
  };
}

const pick = (r: Row, keys: string[]) => Object.fromEntries(keys.map((k) => [k, r[k]]));

/**
 * The rows a client or the harness holds for `runId`, in the expectedRows shape.
 * `table(name)` returns that table's rows with snake_case columns.
 */
export function actualRows(runId: string, table: (name: string) => Row[]): RunRows {
  const of = (name: string) => table(name).filter((r) => r.run_id === runId);
  const r = table("run").find((x) => x.id === runId) ?? {};
  return {
    run: {
      ...pick(r, ["id", "tick", "status", "final_tick", "step_pending", "patients_affected", "devices_compromised", "services_down", "delayed_procedures"]),
      choke_points: JSON.parse(r.choke_points_json ?? "null"), removed_flows: JSON.parse(r.removed_flows_json ?? "null"),
      protected_broken: JSON.parse(r.protected_broken_json ?? "null"), assumptions: JSON.parse(r.assumptions_json ?? "null"),
    },
    device_state: of("device_state").map((x) => pick(x, ["id", "run_id", "device_id", "infected", "infected_at_tick", "infected_by"])).sort(by("id")),
    service_state: of("service_state").map((x) => pick(x, ["id", "run_id", "service_id", "down", "down_since_tick"])).sort(by("id")),
    patient_state: of("patient_state").map((x) => pick(x, ["id", "run_id", "group_id", "state"])).sort(by("id")),
    spread_attempt: of("spread_attempt").sort(by("id")).map((x) => pick(x, ["run_id", "tick", "from_device", "to_device", "flow_id", "success"])),
    sim_event: of("sim_event").sort(by("id")).map((x) => pick(x, ["run_id", "tick", "kind", "target_id", "text"])),
    tick_snapshot: of("tick_snapshot").sort(by("tick")).map((x) => ({
      ...pick(x, ["id", "run_id", "tick", "infected_count", "patients_affected"]),
      infected_ids: JSON.parse(x.infected_ids_json), services_down: JSON.parse(x.services_down_json), patients: JSON.parse(x.patients_json),
    })),
  };
}

/** How many rows a run's frames have written, across the six row tables. */
export function rowCount(runId: string, table: (name: string) => Row[]): number {
  return ["device_state", "service_state", "patient_state", "spread_attempt", "sim_event", "tick_snapshot"]
    .reduce((n, name) => n + table(name).filter((r) => r.run_id === runId).length, 0);
}
