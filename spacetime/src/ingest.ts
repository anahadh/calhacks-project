// Run ingestion (AGENTS.md rules 3, 4). The Python engine computes each visible
// run; the run watcher feeds its frames in here, one tick per beat, through the
// server-only run_frames_apply. The module checks every frame against the run
// and the session's hospital, then writes the rows every laptop subscribes to.
// It never computes spread, impact or patient states.
//
// A frame is the engine's TickFrame (HOSPITAL_SCHEMA.md "Run frames"; INTEGRATION.md 5a).
// Every export here must be a reducer (index.ts re-exports this file).

import { t } from "spacetimedb/server";

import { DETAIL_MAX, EVENT_TARGETS, FRAMES_MAX, KEEP_ATTEMPT_TICKS, PATIENT_STATES } from "./constants";
import { hospitalIndex, hospitalOf, type HospitalIndex } from "./hospital";
import spacetimedb, { deleteRunRows, fail, readRun, requireServer, rowKey, type RunRow } from "./schema";

type DeviceChange = { deviceId: string; infected: boolean; infectedAtTick: number; infectedBy: string };
type ServiceChange = { serviceId: string; down: boolean; downSinceTick: number };
type PatientChange = { groupId: string; state: string };
type Attempt = { from: string; to: string; flowId: string; success: boolean };
type FrameEvent = { kind: string; targetId: string; text: string };
type Snapshot = {
  infectedCount: number; patientsAffected: number; infectedIds: string[]; servicesDown: string[]; patients: Record<string, string>;
};
type Summary = {
  patientsAffected: number; devicesCompromised: number; servicesDown: number; delayedProcedures: number;
  chokePoints: { deviceId: string; share: number }[];
};
type RunInfo = { finalTick: number; removedFlows: string[]; protectedBroken: string[]; assumptions: string[] };
type TickFrame = {
  tick: number; final: boolean; devices: DeviceChange[]; services: ServiceChange[]; patients: PatientChange[];
  attempts: Attempt[]; events: FrameEvent[]; snapshot: Snapshot; summary: Summary; run?: RunInfo;
};

// ---------------------------------------------------------------- strict readers
// Each one names the path it failed on, so the watcher's run_fail detail says what broke.

const U32_MAX = 0xffffffff;
const I32_MAX = 0x7fffffff;

function record(v: unknown, path: string): Record<string, unknown> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) fail(`${path} must be an object.`);
  return v as Record<string, unknown>;
}

function obj(v: unknown, path: string, keys: readonly string[], optional: readonly string[] = []): Record<string, unknown> {
  const o = record(v, path);
  for (const k of Object.keys(o)) if (!keys.includes(k) && !optional.includes(k)) fail(`${path} has an unknown field "${k}".`);
  for (const k of keys) if (!(k in o)) fail(`${path}.${k} is missing.`);
  return o;
}

function list(v: unknown, path: string): unknown[] {
  if (!Array.isArray(v)) fail(`${path} must be a list.`);
  return v;
}

function str(v: unknown, path: string): string {
  if (typeof v !== "string") fail(`${path} must be a string.`);
  return v;
}

function bool(v: unknown, path: string): boolean {
  if (typeof v !== "boolean") fail(`${path} must be true or false.`);
  return v;
}

function int(v: unknown, path: string, min: number, max: number): number {
  if (typeof v !== "number" || !Number.isInteger(v) || v < min || v > max) fail(`${path} must be a whole number from ${min} to ${max}.`);
  return v;
}

function known(id: string, set: Set<string>, path: string, what: string): string {
  if (!set.has(id)) fail(`${path} names ${what} "${id}", which is not in the session's hospital.`);
  return id;
}

function idList(v: unknown, path: string, set: Set<string>, what: string): string[] {
  const out = list(v, path).map((x, i) => known(str(x, `${path}[${i}]`), set, `${path}[${i}]`, what));
  if (new Set(out).size !== out.length) fail(`${path} lists an id twice.`);
  return out;
}

/** Reads a list of per-id changes, with each id at most once. */
function changes<T>(v: unknown, path: string, read: (x: unknown, p: string) => T, id: (x: T) => string): T[] {
  const out = list(v, path).map((x, i) => read(x, `${path}[${i}]`));
  if (new Set(out.map(id)).size !== out.length) fail(`${path} lists an id twice.`);
  return out;
}

function readFrame(v: unknown, path: string, ix: HospitalIndex): TickFrame {
  const f = obj(v, path, ["tick", "final", "devices", "services", "patients", "attempts", "events", "snapshot", "summary"], ["run"]);
  const tick = int(f.tick, `${path}.tick`, 0, U32_MAX);

  const devices = changes(f.devices, `${path}.devices`, (x, p) => {
    const d = obj(x, p, ["deviceId", "infected", "infectedAtTick", "infectedBy"]);
    const row = {
      deviceId: known(str(d.deviceId, `${p}.deviceId`), ix.devices, `${p}.deviceId`, "device"),
      infected: bool(d.infected, `${p}.infected`),
      infectedAtTick: int(d.infectedAtTick, `${p}.infectedAtTick`, -1, tick),
      infectedBy: str(d.infectedBy, `${p}.infectedBy`),
    };
    if (row.infectedBy) known(row.infectedBy, ix.devices, `${p}.infectedBy`, "device");
    if (row.infected && row.infectedAtTick < 0) fail(`${p} is infected but has no infectedAtTick.`);
    if (!row.infected && (row.infectedAtTick !== -1 || row.infectedBy)) fail(`${p} is not infected, so infectedAtTick must be -1 and infectedBy "".`);
    return row;
  }, (d) => d.deviceId);

  const services = changes(f.services, `${path}.services`, (x, p) => {
    const s = obj(x, p, ["serviceId", "down", "downSinceTick"]);
    const row = {
      serviceId: known(str(s.serviceId, `${p}.serviceId`), ix.services, `${p}.serviceId`, "service"),
      down: bool(s.down, `${p}.down`),
      downSinceTick: int(s.downSinceTick, `${p}.downSinceTick`, -1, tick),
    };
    if (row.down !== row.downSinceTick >= 0) fail(`${p}: downSinceTick must be -1 exactly when the service is up.`);
    return row;
  }, (s) => s.serviceId);

  const patients = changes(f.patients, `${path}.patients`, (x, p) => {
    const g = obj(x, p, ["groupId", "state"]);
    return {
      groupId: known(str(g.groupId, `${p}.groupId`), ix.groups, `${p}.groupId`, "patient group"),
      state: patientState(g.state, `${p}.state`),
    };
  }, (g) => g.groupId);

  const attempts = list(f.attempts, `${path}.attempts`).map((x, i) => {
    const p = `${path}.attempts[${i}]`;
    const a = obj(x, p, ["from", "to", "flowId", "success"]);
    return {
      from: known(str(a.from, `${p}.from`), ix.devices, `${p}.from`, "device"),
      to: known(str(a.to, `${p}.to`), ix.devices, `${p}.to`, "device"),
      flowId: known(str(a.flowId, `${p}.flowId`), ix.flows, `${p}.flowId`, "flow"),
      success: bool(a.success, `${p}.success`),
    };
  });

  const events = list(f.events, `${path}.events`).map((x, i) => {
    const p = `${path}.events[${i}]`;
    const e = obj(x, p, ["kind", "targetId", "text"]);
    const kind = str(e.kind, `${p}.kind`);
    if (!Object.prototype.hasOwnProperty.call(EVENT_TARGETS, kind)) fail(`${p}.kind must be one of: ${Object.keys(EVENT_TARGETS).join(", ")}.`);
    const target: keyof HospitalIndex = EVENT_TARGETS[kind as keyof typeof EVENT_TARGETS];
    return {
      kind,
      targetId: known(str(e.targetId, `${p}.targetId`), ix[target], `${p}.targetId`, target.slice(0, -1)),
      text: str(e.text, `${p}.text`),
    };
  });

  const sp = `${path}.snapshot`;
  const s = obj(f.snapshot, sp, ["infectedCount", "patientsAffected", "infectedIds", "servicesDown", "patients"]);
  const snapPatients: Record<string, string> = {};
  for (const [g, st] of Object.entries(record(s.patients, `${sp}.patients`))) {
    snapPatients[known(g, ix.groups, `${sp}.patients`, "patient group")] = patientState(st, `${sp}.patients.${g}`);
  }
  const snapshot = {
    infectedCount: int(s.infectedCount, `${sp}.infectedCount`, 0, U32_MAX),
    patientsAffected: int(s.patientsAffected, `${sp}.patientsAffected`, 0, U32_MAX),
    infectedIds: idList(s.infectedIds, `${sp}.infectedIds`, ix.devices, "device"),
    servicesDown: idList(s.servicesDown, `${sp}.servicesDown`, ix.services, "service"),
    patients: snapPatients,
  };

  const mp = `${path}.summary`;
  const m = obj(f.summary, mp, ["patientsAffected", "devicesCompromised", "servicesDown", "delayedProcedures", "chokePoints"]);
  const summary = {
    patientsAffected: int(m.patientsAffected, `${mp}.patientsAffected`, 0, U32_MAX),
    devicesCompromised: int(m.devicesCompromised, `${mp}.devicesCompromised`, 0, U32_MAX),
    servicesDown: int(m.servicesDown, `${mp}.servicesDown`, 0, U32_MAX),
    delayedProcedures: int(m.delayedProcedures, `${mp}.delayedProcedures`, 0, U32_MAX),
    chokePoints: list(m.chokePoints, `${mp}.chokePoints`).map((x, i) => {
      const p = `${mp}.chokePoints[${i}]`;
      const c = obj(x, p, ["deviceId", "share"]);
      if (typeof c.share !== "number" || !(c.share >= 0 && c.share <= 1)) fail(`${p}.share must be a number from 0 to 1.`);
      return { deviceId: known(str(c.deviceId, `${p}.deviceId`), ix.devices, `${p}.deviceId`, "device"), share: c.share };
    }),
  };

  let run: RunInfo | undefined;
  if (f.run !== undefined) {
    const rp = `${path}.run`;
    const r = obj(f.run, rp, ["finalTick", "removedFlows", "protectedBroken", "assumptions"]);
    run = {
      finalTick: int(r.finalTick, `${rp}.finalTick`, 0, I32_MAX),
      removedFlows: idList(r.removedFlows, `${rp}.removedFlows`, ix.flows, "flow"),
      protectedBroken: idList(r.protectedBroken, `${rp}.protectedBroken`, ix.flows, "flow"),
      assumptions: list(r.assumptions, `${rp}.assumptions`).map((x, i) => str(x, `${rp}.assumptions[${i}]`)),
    };
  }

  return {
    tick, final: bool(f.final, `${path}.final`), devices, services, patients, attempts, events, snapshot, summary, run,
  };
}

function patientState(v: unknown, path: string): string {
  const s = str(v, path);
  if (!(PATIENT_STATES as readonly string[]).includes(s)) fail(`${path} must be one of: ${PATIENT_STATES.join(", ")}.`);
  return s;
}

// ---------------------------------------------------------------- run rules

/** Status machine (INTEGRATION.md 5b): frame 0 on a requested run, then each next tick while running or stepping. */
function checkAgainstRun(r: RunRow, f: TickFrame, ix: HospitalIndex, path: string): void {
  let finalTick = r.final_tick;
  if (r.status === "requested") {
    if (f.tick !== 0) fail(`${path}: run "${r.id}" is waiting for frame 0, not tick ${f.tick}.`);
    if (!f.run) fail(`${path}: frame 0 must carry run (finalTick, removedFlows, protectedBroken, assumptions).`);
    finalTick = f.run.finalTick;
    const covers = (got: number, want: number, what: string) => {
      if (got !== want) fail(`${path}: frame 0 must list every ${what} (${want}), not ${got}.`);
    };
    covers(f.devices.length, ix.devices.size, "device");
    covers(f.services.length, ix.services.size, "service");
    covers(f.patients.length, ix.groups.size, "patient group");
  } else {
    if (r.status !== "running" && r.status !== "paused") fail(`${path}: run "${r.id}" is ${r.status} and takes no frames.`);
    if (f.run) fail(`${path}: only frame 0 carries run.`);
    if (f.tick !== r.tick + 1) fail(`${path}: run "${r.id}" is at tick ${r.tick}, so the next frame is tick ${r.tick + 1}, not ${f.tick}.`);
    if (r.status === "paused" && !r.step_pending) fail(`${path}: run "${r.id}" is paused and no step was asked for.`);
  }
  if (f.tick > finalTick) fail(`${path}: tick ${f.tick} is past the final tick ${finalTick}.`);
  if (f.final !== (f.tick === finalTick)) fail(`${path}: final must be true exactly on tick ${finalTick}.`);
}

/** The same eight writes for every frame: three state tables, attempts (prune + insert), events, snapshot, the run row. */
function applyFrame(ctx: any, r: RunRow, f: TickFrame): void {
  const first = f.tick === 0;
  if (first) deleteRunRows(ctx, r.id); // nothing should be there; a stale row would block the inserts

  for (const d of f.devices) {
    const row = { id: rowKey(r.id, d.deviceId), run_id: r.id, device_id: d.deviceId, infected: d.infected,
      infected_at_tick: d.infectedAtTick, infected_by: d.infectedBy };
    if (first) ctx.db.device_state.insert(row);
    else ctx.db.device_state.id.update(row);
  }
  for (const s of f.services) {
    const row = { id: rowKey(r.id, s.serviceId), run_id: r.id, service_id: s.serviceId, down: s.down, down_since_tick: s.downSinceTick };
    if (first) ctx.db.service_state.insert(row);
    else ctx.db.service_state.id.update(row);
  }
  for (const g of f.patients) {
    const row = { id: rowKey(r.id, g.groupId), run_id: r.id, group_id: g.groupId, state: g.state };
    if (first) ctx.db.patient_state.insert(row);
    else ctx.db.patient_state.id.update(row);
  }

  for (const old of [...ctx.db.spread_attempt.run_id.filter(r.id)]) {
    if (old.tick + KEEP_ATTEMPT_TICKS <= f.tick) ctx.db.spread_attempt.delete(old);
  }
  for (const a of f.attempts) {
    ctx.db.spread_attempt.insert({
      id: 0n, run_id: r.id, tick: f.tick, from_device: a.from, to_device: a.to, flow_id: a.flowId, success: a.success,
    });
  }
  for (const e of f.events) {
    ctx.db.sim_event.insert({ id: 0n, run_id: r.id, tick: f.tick, kind: e.kind, target_id: e.targetId, text: e.text });
  }

  ctx.db.tick_snapshot.insert({
    id: rowKey(r.id, f.tick), run_id: r.id, tick: f.tick,
    infected_count: f.snapshot.infectedCount, patients_affected: f.snapshot.patientsAffected,
    infected_ids_json: JSON.stringify(f.snapshot.infectedIds),
    services_down_json: JSON.stringify(f.snapshot.servicesDown),
    patients_json: JSON.stringify(f.snapshot.patients),
  });

  const next: RunRow = {
    ...r,
    tick: f.tick,
    step_pending: false,
    patients_affected: f.summary.patientsAffected,
    devices_compromised: f.summary.devicesCompromised,
    services_down: f.summary.servicesDown,
    delayed_procedures: f.summary.delayedProcedures,
    choke_points_json: JSON.stringify(f.summary.chokePoints),
  };
  if (f.run) {
    next.final_tick = f.run.finalTick;
    next.protected_broken_json = JSON.stringify(f.run.protectedBroken);
    next.removed_flows_json = JSON.stringify(f.run.removedFlows);
    next.assumptions_json = JSON.stringify(f.run.assumptions);
    next.status = r.autoplay ? "running" : "paused";
  }
  if (f.final) next.status = "done";
  ctx.db.run.id.update(next);
}

// ---------------------------------------------------------------- reducers

/**
 * The run watcher's one write path. `frames_json` is `[{ runId, frame: TickFrame }]`,
 * one item per run (both runs of a pair go in one call). Everything is checked
 * before anything is written, and the call is one transaction: all items land
 * or none do.
 */
export const run_frames_apply = spacetimedb.reducer({ frames_json: t.string() }, (ctx, { frames_json }) => {
  requireServer(ctx);
  if (frames_json.length > FRAMES_MAX) fail(`frames_json is larger than ${FRAMES_MAX / 1024} KiB. Send fewer frames per call.`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(frames_json);
  } catch {
    fail("frames_json is not valid JSON.");
  }
  const items = list(parsed, "frames");
  if (!items.length) fail("frames_json holds no frames.");

  const indexes = new Map<string, HospitalIndex>();
  const seen = new Set<string>();
  const batch = items.map((x, i) => {
    const path = `frames[${i}]`;
    const item = obj(x, path, ["runId", "frame"]);
    const runId = str(item.runId, `${path}.runId`);
    if (seen.has(runId)) fail(`${path}: run "${runId}" appears twice in one call.`);
    seen.add(runId);
    const r = readRun(ctx, runId);
    let ix = indexes.get(r.session_id);
    if (!ix) indexes.set(r.session_id, (ix = hospitalIndex(hospitalOf(ctx, r.session_id))));
    const frame = readFrame(item.frame, `${path}.frame`, ix);
    checkAgainstRun(r, frame, ix, path);
    return { r, frame };
  });

  for (const { r, frame } of batch) applyFrame(ctx, r, frame);
});

/** The engine refused the run, or the watcher could not feed it (rule 14: show the error). */
export const run_fail = spacetimedb.reducer({ run_id: t.string(), detail: t.string() }, (ctx, { run_id, detail }) => {
  requireServer(ctx);
  const r = readRun(ctx, run_id);
  ctx.db.run.id.update({ ...r, status: "error", step_pending: false, detail: detail.slice(0, DETAIL_MAX) });
});
