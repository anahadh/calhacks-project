// Hippocra.tech SpacetimeDB module (TypeScript).
//
// The simulation runs here. `run_tick` is a scheduled reducer that advances
// visible runs one tick at a time with sim-core, the same engine hippo-sim
// uses, and writes the rows every laptop subscribes to. Clients never compute
// ticks (AGENTS.md rules 3-5). Reducers make no network calls (rule 6).
//
// All data is synthetic. Patient groups are counts.

import { t, ScheduleAt } from "spacetimedb/server";
import type { Timestamp } from "spacetimedb";
import {
  initialState, isSettled, protectedBroken, step, summarize,
  type Hospital, type HospitalFile, type Policy, type SimState, type StepResult,
} from "@hippo/sim-core";

import {
  ANNOTATING_ROLES, KEEP_ATTEMPT_TICKS, NOTE_MAX, ROLES, SPEEDS, TICK_MS, TIMELINE_NOTE_MAX, TIMELINE_TICK_MAX,
} from "./constants";
import spacetimedb, { fail, getSession, isServer, same, tick_timer } from "./schema";

// Tables live in schema.ts; feature reducers in their own files, re-exported here.
export default spacetimedb;
export * from "./agents";
export * from "./question";
export * from "./recommendation";

type RunRow = ReturnType<typeof readRun>;

// ---------------------------------------------------------------- helpers

function readRun(ctx: any, runId: string) {
  const r = ctx.db.run.id.find(runId);
  if (!r) fail(`Run "${runId}" does not exist.`);
  return r as {
    id: string; session_id: string; pair_id: string; label: string; seed: number; patient_zero: string;
    policy_json: string; tick: number; status: string; speed: number; patients_affected: number;
    devices_compromised: number; services_down: number; delayed_procedures: number;
    choke_points_json: string; protected_broken_json: string; started_at: Timestamp;
  };
}

/** Run controls: the presenter (spec 7.3) or the server identity. */
function requirePresenter(ctx: any, sessionId: string): void {
  const s = getSession(ctx, sessionId);
  if (!same(s.presenter, ctx.sender) && !isServer(ctx)) fail("Only the presenter can control playback.");
}

function hospitalOf(ctx: any, sessionId: string): Hospital {
  return (JSON.parse(getSession(ctx, sessionId).hospital_json) as HospitalFile).hospital;
}

function policyOf(r: { policy_json: string }): Policy | null {
  return r.policy_json ? (JSON.parse(r.policy_json) as Policy) : null;
}

function key(...parts: (string | number)[]): string {
  return parts.join(":");
}

function intervalMicros(speed: number): bigint {
  return BigInt(Math.round((TICK_MS / speed) * 1000));
}

function timerKey(r: { id: string; pair_id: string }): string {
  return r.pair_id || r.id;
}

function stopTimer(ctx: any, k: string): void {
  for (const row of [...ctx.db.tick_timer.iter()]) if (row.key === k) ctx.db.tick_timer.delete(row);
}

function startTimer(ctx: any, k: string, speed: number): void {
  stopTimer(ctx, k);
  ctx.db.tick_timer.insert({ scheduled_id: 0n, scheduled_at: ScheduleAt.interval(intervalMicros(speed)), key: k });
}

function deleteRunRows(ctx: any, runId: string): void {
  for (const tbl of ["device_state", "service_state", "patient_state", "spread_attempt", "sim_event", "tick_snapshot"]) {
    for (const row of [...ctx.db[tbl].run_id.filter(runId)]) ctx.db[tbl].delete(row);
  }
  const st = ctx.db.run_state.run_id.find(runId);
  if (st) ctx.db.run_state.delete(st);
}

/** Writes tick 0 for a run: every device, service and patient row, plus history. */
function writeInitial(ctx: any, h: Hospital, r: RunRow): void {
  const res = initialState(h, r.patient_zero, r.seed);
  const s = res.state;
  for (const d of h.devices) {
    const inf = s.infected[d.id];
    ctx.db.device_state.insert({
      id: key(r.id, d.id), run_id: r.id, device_id: d.id, infected: !!inf,
      infected_at_tick: inf ? inf.atTick : -1, infected_by: inf?.by ?? "",
    });
  }
  for (const svc of h.services) {
    const since = s.serviceDownSince[svc.id];
    ctx.db.service_state.insert({
      id: key(r.id, svc.id), run_id: r.id, service_id: svc.id,
      down: since !== undefined, down_since_tick: since ?? -1,
    });
  }
  for (const g of h.patients) {
    ctx.db.patient_state.insert({ id: key(r.id, g.id), run_id: r.id, group_id: g.id, state: s.patients[g.id] ?? "ok" });
  }
  ctx.db.run_state.insert({ run_id: r.id, state_json: JSON.stringify(s) });
  writeTickOutputs(ctx, h, r, res, null);
}

/** Writes what one tick changed, plus events, attempts, snapshot and the run's summary. */
function writeTickOutputs(ctx: any, h: Hospital, r: RunRow, res: StepResult, prev: SimState | null): void {
  const s = res.state;
  if (prev) {
    for (const [id, inf] of Object.entries(s.infected)) {
      if (prev.infected[id]) continue;
      const row = ctx.db.device_state.id.find(key(r.id, id));
      if (row) ctx.db.device_state.id.update({ ...row, infected: true, infected_at_tick: inf.atTick, infected_by: inf.by ?? "" });
    }
    for (const [id, since] of Object.entries(s.serviceDownSince)) {
      if (prev.serviceDownSince[id] !== undefined) continue;
      const row = ctx.db.service_state.id.find(key(r.id, id));
      if (row) ctx.db.service_state.id.update({ ...row, down: true, down_since_tick: since });
    }
    for (const [id, st] of Object.entries(s.patients)) {
      if (prev.patients[id] === st) continue;
      const row = ctx.db.patient_state.id.find(key(r.id, id));
      if (row) ctx.db.patient_state.id.update({ ...row, state: st });
    }
    const st = ctx.db.run_state.run_id.find(r.id);
    ctx.db.run_state.run_id.update({ ...st, state_json: JSON.stringify(s) });
  }

  for (const old of [...ctx.db.spread_attempt.run_id.filter(r.id)]) {
    if (old.tick + KEEP_ATTEMPT_TICKS <= s.tick) ctx.db.spread_attempt.delete(old);
  }
  for (const a of res.attempts) {
    ctx.db.spread_attempt.insert({
      id: 0n, run_id: r.id, tick: a.tick, from_device: a.from, to_device: a.to, flow_id: a.flowId, success: a.success,
    });
  }
  for (const e of res.events) {
    ctx.db.sim_event.insert({ id: 0n, run_id: r.id, tick: e.tick, kind: e.kind, target_id: e.targetId, text: e.text });
  }

  const sum = summarize(h, s);
  ctx.db.tick_snapshot.insert({
    id: key(r.id, s.tick), run_id: r.id, tick: s.tick,
    infected_count: sum.devicesCompromised, patients_affected: sum.patientsAffected,
    infected_ids_json: JSON.stringify(Object.keys(s.infected).sort()),
    services_down_json: JSON.stringify(sum.servicesDown),
    patients_json: JSON.stringify(s.patients),
  });

  const policy = policyOf(r);
  const done = isSettled(h, s, { policy });
  ctx.db.run.id.update({
    ...readRun(ctx, r.id),
    tick: s.tick,
    status: done ? "done" : readRun(ctx, r.id).status,
    patients_affected: sum.patientsAffected,
    devices_compromised: sum.devicesCompromised,
    services_down: sum.servicesDown.length,
    delayed_procedures: sum.delayedProcedures,
    choke_points_json: JSON.stringify(sum.chokePoints),
  });
}

/** Advances one run by one tick. Returns false if the run is already done. */
function advance(ctx: any, runId: string): boolean {
  const r = readRun(ctx, runId);
  if (r.status === "done") return false;
  const h = hospitalOf(ctx, r.session_id);
  const prev = JSON.parse(ctx.db.run_state.run_id.find(r.id).state_json) as SimState;
  const res = step(h, prev, { policy: policyOf(r) });
  writeTickOutputs(ctx, h, r, res, prev);
  return true;
}

function runsForKey(ctx: any, k: string): RunRow[] {
  return [...ctx.db.run.iter()].filter((r: RunRow) => r.id === k || (r.pair_id !== "" && r.pair_id === k));
}

function validateHospital(json: string): HospitalFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    fail("The hospital file is not valid JSON.");
  }
  const f = parsed as Partial<HospitalFile>;
  // Full validation (every path, every rule) lives in packages/schema and runs
  // in the browser first. This is the server-side backstop for the essentials.
  if (f?.schemaVersion !== 1 || !f.hospital) fail("Expected { schemaVersion: 1, hospital: {...} }.");
  const h = f.hospital;
  for (const k of ["floors", "rooms", "devices", "flows", "services", "patients"] as const) {
    if (!Array.isArray(h[k])) fail(`hospital.${k} must be a list.`);
  }
  const ids = new Set(h.devices.map((d) => d.id));
  for (const fl of h.flows) if (!ids.has(fl.from) || !ids.has(fl.to)) fail(`Flow "${fl.id}" refers to a missing device.`);
  for (const g of h.patients as any[]) {
    for (const banned of ["name", "age", "birthDate", "mrn", "diagnosis"]) {
      if (banned in g) fail(`Patient group "${g.id}" has "${banned}". Patient groups hold counts only.`);
    }
  }
  if (json.length > 2 * 1024 * 1024) fail("The hospital file is larger than 2 MB.");
  return f as HospitalFile;
}

// ---------------------------------------------------------------- lifecycle

/** The identity that publishes the module becomes the server identity (watchers, Node server). */
export const init = spacetimedb.init((ctx) => {
  ctx.db.config.insert({ id: 0, server_identity: ctx.sender });
});

/** Hand the server identity to another token. Only the current server identity can. */
export const config_set_server = spacetimedb.reducer({ identity: t.identity() }, (ctx, { identity }) => {
  if (!isServer(ctx)) fail("Only the server identity can change the server identity.");
  ctx.db.config.id.update({ id: 0, server_identity: identity });
});

export const on_disconnect = spacetimedb.clientDisconnected((ctx) => {
  const p = ctx.db.presence.identity.find(ctx.sender);
  if (p) ctx.db.presence.identity.delete(ctx.sender);
});

// ---------------------------------------------------------------- sessions and presence

export const session_create = spacetimedb.reducer(
  { session_id: t.string(), hospital_json: t.string() },
  (ctx, { session_id, hospital_json }) => {
    if (!/^[a-z0-9_-]{2,40}$/.test(session_id)) fail("Session ids are 2-40 characters: a-z, 0-9, _ or -.");
    if (ctx.db.session.id.find(session_id)) fail(`Session "${session_id}" already exists.`);
    const file = validateHospital(hospital_json);
    ctx.db.session.insert({
      id: session_id, hospital_json, hospital_name: file.hospital.name,
      presenter: ctx.sender, active_run_id: "", created_at: ctx.timestamp,
      round_state: "idle", round: 0, round_detail: "",
    });
  },
);

export const presence_join = spacetimedb.reducer(
  { session_id: t.string(), name: t.string(), role: t.string() },
  (ctx, { session_id, name, role }) => {
    getSession(ctx, session_id);
    if (!(ROLES as readonly string[]).includes(role)) fail(`Role must be one of: ${ROLES.join(", ")}.`);
    const clean = name.trim().slice(0, 40);
    if (!clean) fail("Enter a name.");
    const row = { identity: ctx.sender, session_id, name: clean, role, following: true, last_seen: ctx.timestamp };
    if (ctx.db.presence.identity.find(ctx.sender)) ctx.db.presence.identity.update(row);
    else ctx.db.presence.insert(row);
  },
);

export const presence_heartbeat = spacetimedb.reducer({ following: t.bool() }, (ctx, { following }) => {
  const p = ctx.db.presence.identity.find(ctx.sender) ?? fail("Join the session first.");
  ctx.db.presence.identity.update({ ...p, following, last_seen: ctx.timestamp });
});

export const set_presenter = spacetimedb.reducer(
  { session_id: t.string(), presenter: t.identity() },
  (ctx, { session_id, presenter }) => {
    requirePresenter(ctx, session_id);
    const s = getSession(ctx, session_id);
    ctx.db.session.id.update({ ...s, presenter });
  },
);

// ---------------------------------------------------------------- runs

export const run_start = spacetimedb.reducer(
  {
    session_id: t.string(), run_id: t.string(), label: t.string(), patient_zero: t.string(),
    seed: t.u32(), speed: t.f64(), policy_json: t.string(), pair_id: t.string(), autoplay: t.bool(),
  },
  (ctx, a) => {
    requirePresenter(ctx, a.session_id);
    if (ctx.db.run.id.find(a.run_id)) fail(`Run "${a.run_id}" already exists.`);
    if (!(SPEEDS as readonly number[]).includes(a.speed)) fail("Speed must be 0.5, 1, 2 or 4.");
    const h = hospitalOf(ctx, a.session_id);
    if (!h.devices.some((d) => d.id === a.patient_zero)) fail(`Device "${a.patient_zero}" does not exist.`);
    let policy: Policy | null = null;
    if (a.policy_json) {
      try {
        policy = JSON.parse(a.policy_json) as Policy;
      } catch {
        fail("The policy is not valid JSON.");
      }
    }
    const row = {
      id: a.run_id, session_id: a.session_id, pair_id: a.pair_id, label: a.label || "Run", seed: a.seed,
      patient_zero: a.patient_zero, policy_json: a.policy_json, tick: 0,
      status: a.autoplay ? "running" : "paused", speed: a.speed,
      patients_affected: 0, devices_compromised: 0, services_down: 0, delayed_procedures: 0,
      choke_points_json: "[]", protected_broken_json: JSON.stringify(protectedBroken(h, policy).map((f) => f.id)),
      started_at: ctx.timestamp,
    };
    ctx.db.run.insert(row);
    writeInitial(ctx, h, row);
    if (!a.pair_id) {
      const s = getSession(ctx, a.session_id);
      ctx.db.session.id.update({ ...s, active_run_id: a.run_id });
    }
    if (a.autoplay) startTimer(ctx, timerKey(row), a.speed);
  },
);

/** Scheduled. Advances every running run under this timer's key, in one transaction (lockstep). */
export const run_tick = spacetimedb.reducer({ arg: tick_timer.rowType }, (ctx, { arg }) => {
  // The scheduler calls with the module's own identity. (In spacetimedb 2.13,
  // senderAuth.isInternal is false for scheduled calls on a real server, so
  // checking it alone rejects every tick.)
  const fromScheduler = ctx.senderAuth.isInternal || ctx.sender.isEqual(ctx.identity);
  if (!fromScheduler) fail("run_tick runs only on the scheduler.");
  const runs = runsForKey(ctx, arg.key).filter((r) => r.status === "running");
  for (const r of runs) advance(ctx, r.id);
  const stillRunning = runsForKey(ctx, arg.key).some((r) => r.status === "running");
  if (!stillRunning) stopTimer(ctx, arg.key);
});

function setStatus(ctx: any, k: string, status: "running" | "paused"): void {
  for (const r of runsForKey(ctx, k)) if (r.status !== "done") ctx.db.run.id.update({ ...r, status });
}

export const run_pause = spacetimedb.reducer({ run_id: t.string() }, (ctx, { run_id }) => {
  const r = readRun(ctx, run_id);
  requirePresenter(ctx, r.session_id);
  setStatus(ctx, timerKey(r), "paused");
  stopTimer(ctx, timerKey(r));
});

export const run_resume = spacetimedb.reducer({ run_id: t.string() }, (ctx, { run_id }) => {
  const r = readRun(ctx, run_id);
  requirePresenter(ctx, r.session_id);
  if (r.status === "done") fail("This run has finished. Reset it to play again.");
  setStatus(ctx, timerKey(r), "running");
  startTimer(ctx, timerKey(r), r.speed);
});

export const run_set_speed = spacetimedb.reducer({ run_id: t.string(), speed: t.f64() }, (ctx, { run_id, speed }) => {
  const r = readRun(ctx, run_id);
  requirePresenter(ctx, r.session_id);
  if (!(SPEEDS as readonly number[]).includes(speed)) fail("Speed must be 0.5, 1, 2 or 4.");
  for (const x of runsForKey(ctx, timerKey(r))) ctx.db.run.id.update({ ...x, speed });
  if (r.status === "running") startTimer(ctx, timerKey(r), speed);
});

export const run_step = spacetimedb.reducer({ run_id: t.string() }, (ctx, { run_id }) => {
  const r = readRun(ctx, run_id);
  requirePresenter(ctx, r.session_id);
  if (r.status === "running") fail("Pause the run before stepping.");
  for (const x of runsForKey(ctx, timerKey(r))) advance(ctx, x.id);
});

export const run_reset = spacetimedb.reducer({ run_id: t.string() }, (ctx, { run_id }) => {
  const r = readRun(ctx, run_id);
  requirePresenter(ctx, r.session_id);
  const k = timerKey(r);
  stopTimer(ctx, k);
  for (const x of runsForKey(ctx, k)) {
    deleteRunRows(ctx, x.id);
    const fresh = { ...x, tick: 0, status: "paused" };
    ctx.db.run.id.update(fresh);
    writeInitial(ctx, hospitalOf(ctx, x.session_id), fresh);
  }
});

// ---------------------------------------------------------------- focus annotations (spec 7.8)

export const annotation_add = spacetimedb.reducer(
  { session_id: t.string(), target_id: t.string(), note: t.string() },
  (ctx, { session_id, target_id, note }) => {
    const s = getSession(ctx, session_id);
    const p = ctx.db.presence.identity.find(ctx.sender);
    if (!p || p.session_id !== session_id) fail("Join the session before adding a focus.");
    if (!(ANNOTATING_ROLES as readonly string[]).includes(p.role)) fail("Observers can see focus pins but can't add them.");
    const h = (JSON.parse(s.hospital_json) as HospitalFile).hospital;
    if (!h.devices.some((d) => d.id === target_id)) fail(`Device "${target_id}" does not exist.`);
    if (note.length > NOTE_MAX) fail(`Notes are at most ${NOTE_MAX} characters.`);
    for (const a of [...ctx.db.annotation.session_id.filter(session_id)]) {
      if (a.active && a.target_id === target_id && same(a.author, ctx.sender)) fail("You already have a focus on this device.");
    }
    ctx.db.annotation.insert({
      id: 0n, session_id, run_id: s.active_run_id, kind: "focus", target_id, note: note.trim(),
      author: ctx.sender, author_name: p.name, role: p.role, active: true, created_at: ctx.timestamp, cleared_by: "",
      tick: -1,
    });
  },
);

/** A note at a tick on the active run's timeline, written by anyone who has joined. */
export const annotation_add_note = spacetimedb.reducer(
  { session_id: t.string(), tick: t.u32(), note: t.string() },
  (ctx, { session_id, tick, note }) => {
    const s = getSession(ctx, session_id);
    const p = ctx.db.presence.identity.find(ctx.sender);
    if (!p || p.session_id !== session_id) fail("Join the session before adding a note.");
    if (!(ANNOTATING_ROLES as readonly string[]).includes(p.role)) fail("Observers can see notes but can't add them.");
    if (!s.active_run_id) fail("Run the attack first. Notes mark a moment in a run.");
    if (tick > TIMELINE_TICK_MAX) fail(`Notes can mark ticks 0 to ${TIMELINE_TICK_MAX}.`);
    const text = note.trim();
    if (!text) fail("Write something in the note.");
    if (text.length > TIMELINE_NOTE_MAX) fail(`Notes are at most ${TIMELINE_NOTE_MAX} characters.`);
    ctx.db.annotation.insert({
      id: 0n, session_id, run_id: s.active_run_id, kind: "note", target_id: "", note: text,
      author: ctx.sender, author_name: p.name, role: p.role, active: true, created_at: ctx.timestamp, cleared_by: "",
      tick,
    });
  },
);

export const annotation_clear = spacetimedb.reducer({ annotation_id: t.u64() }, (ctx, { annotation_id }) => {
  const a = ctx.db.annotation.id.find(annotation_id) ?? fail("That focus no longer exists.");
  if (!a.active) return;
  const s = getSession(ctx, a.session_id);
  const allowed = same(a.author, ctx.sender) || same(s.presenter, ctx.sender) || isServer(ctx);
  if (!allowed) fail("Only the author or the presenter can clear this focus.");
  ctx.db.annotation.id.update({ ...a, active: false, cleared_by: ctx.sender.toHexString() });
});
