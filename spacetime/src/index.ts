// Hippocra.tech SpacetimeDB module (TypeScript).
//
// The live state bus, not the compute. The Python engine (engine/sim_core)
// computes every visible run; the run watcher feeds its frames in through the
// server-only run_frames_apply (ingest.ts), paced at the run's speed, and every
// laptop subscribes to the rows (AGENTS.md rules 3, 4). The playback reducers
// here only change flags the watcher obeys. Reducers make no network calls (rule 7).
//
// All data is synthetic. Patient groups are counts.

import { t } from "spacetimedb/server";

import { ANNOTATING_ROLES, NOTE_MAX, ROLES, SPEEDS, TIMELINE_NOTE_MAX, TIMELINE_TICK_MAX } from "./constants";
import { hospitalOf, validateHospital } from "./hospital";
import spacetimedb, {
  BEFORE_FRAME_0, deleteRunRows, fail, getSession, isServer, keyRefusal, readRun, requirePresenter, requireServer, roundOpen,
  runsForKey, same, statusRefusal, type RunRow,
} from "./schema";

// Tables live in schema.ts; feature reducers in their own files, re-exported here.
export default spacetimedb;
export * from "./ingest";
export * from "./solution";
export * from "./agents";
export * from "./question";
export * from "./recommendation";
export * from "./views";

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
      round_state: "idle", round: 0, round_detail: "", entry_points_json: "[]", solution_pair_id: "",
    });
  },
);

/** The engine's legal patient zeros for this hospital, written by the watcher. The UI dims the rest. */
export const session_entry_points_set = spacetimedb.reducer(
  { session_id: t.string(), entry_points_json: t.string() },
  (ctx, { session_id, entry_points_json }) => {
    requireServer(ctx);
    const s = getSession(ctx, session_id);
    let ids: unknown;
    try {
      ids = JSON.parse(entry_points_json);
    } catch {
      fail("entry_points_json is not valid JSON.");
    }
    if (!Array.isArray(ids) || !ids.every((x) => typeof x === "string")) fail("entry_points_json must be a list of device ids.");
    if (new Set(ids).size !== ids.length) fail("entry_points_json lists a device twice.");
    const devices = new Set(hospitalOf(ctx, session_id).devices.map((d) => d.id));
    for (const id of ids as string[]) if (!devices.has(id)) fail(`Device "${id}" does not exist.`);
    ctx.db.session.id.update({ ...s, entry_points_json: JSON.stringify(ids) });
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
// Status machine (INTEGRATION.md 5b): run_start, solution_start and run_reset
// leave a run `requested`; the watcher's frame 0 makes it running or paused (by
// autoplay); run_fail makes it `error`; the final frame makes it `done`.
// While an aggregate-fix round is open, no run starts, resumes or steps (rule 5).

/** Rule 5, the other way round from defend_request: agents talking means no run plays. */
function refuseDuringRound(ctx: any, sessionId: string, what: string): void {
  if (roundOpen(getSession(ctx, sessionId))) fail(`Wait for the agents to finish negotiating before ${what}.`);
}

/** A new run, waiting for the engine. Writes no state rows: frame 0 does. */
export const run_start = spacetimedb.reducer(
  {
    session_id: t.string(), run_id: t.string(), label: t.string(), patient_zero: t.string(),
    seed: t.u32(), speed: t.f64(), policy_json: t.string(), pair_id: t.string(), autoplay: t.bool(),
  },
  (ctx, a) => {
    requirePresenter(ctx, a.session_id);
    refuseDuringRound(ctx, a.session_id, "starting an attack");
    if (ctx.db.run.id.find(a.run_id)) fail(`Run "${a.run_id}" already exists.`);
    if (!(SPEEDS as readonly number[]).includes(a.speed)) fail("Speed must be 0.5, 1, 2 or 4.");
    const s = getSession(ctx, a.session_id);
    const h = hospitalOf(ctx, a.session_id);
    if (!h.devices.some((d) => d.id === a.patient_zero)) fail(`Device "${a.patient_zero}" does not exist.`);
    // The engine's own rule decides the list (session_entry_points_set); the module only checks membership.
    const entryPoints = JSON.parse(s.entry_points_json) as string[];
    if (entryPoints.length && !entryPoints.includes(a.patient_zero)) {
      fail(`"${a.patient_zero}" is not one of the engine's entry points for this hospital. Pick a highlighted device.`);
    }
    if (a.policy_json) {
      try {
        JSON.parse(a.policy_json);
      } catch {
        fail("The policy is not valid JSON.");
      }
    }
    ctx.db.run.insert({
      ...BEFORE_FRAME_0,
      id: a.run_id, session_id: a.session_id, pair_id: a.pair_id, label: a.label || "Run", seed: a.seed,
      patient_zero: a.patient_zero, policy_json: a.policy_json, speed: a.speed, autoplay: a.autoplay,
      challenges_json: "[]", recommendation_id: "", started_at: ctx.timestamp,
    });
    if (!a.pair_id) ctx.db.session.id.update({ ...getSession(ctx, a.session_id), active_run_id: a.run_id });
  },
);

/**
 * Pause or resume every run under the key that is in `from`. Others keep their
 * status. A step asked for before the change is dropped, so a run paused again
 * never takes a frame nobody asked for.
 */
function setStatus(ctx: any, runs: RunRow[], from: string, to: string): void {
  for (const x of runs) if (x.status === from) ctx.db.run.id.update({ ...x, status: to, step_pending: false });
}

export const run_pause = spacetimedb.reducer({ run_id: t.string() }, (ctx, { run_id }) => {
  const r = readRun(ctx, run_id);
  requirePresenter(ctx, r.session_id);
  setStatus(ctx, runsForKey(ctx, r), "running", "paused");
});

/** Through either run of a pair: the side that already finished doesn't block its partner. */
export const run_resume = spacetimedb.reducer({ run_id: t.string() }, (ctx, { run_id }) => {
  const r = readRun(ctx, run_id);
  requirePresenter(ctx, r.session_id);
  refuseDuringRound(ctx, r.session_id, "playing a run");
  const runs = runsForKey(ctx, r);
  if (!runs.some((x) => x.status === "paused" || x.status === "running")) fail(keyRefusal(r, runs));
  setStatus(ctx, runs, "paused", "running");
});

export const run_set_speed = spacetimedb.reducer({ run_id: t.string(), speed: t.f64() }, (ctx, { run_id, speed }) => {
  const r = readRun(ctx, run_id);
  requirePresenter(ctx, r.session_id);
  if (!(SPEEDS as readonly number[]).includes(speed)) fail("Speed must be 0.5, 1, 2 or 4.");
  for (const x of runsForKey(ctx, r)) ctx.db.run.id.update({ ...x, speed });
});

/** One step while paused: the watcher sees step_pending and applies the next frame. */
export const run_step = spacetimedb.reducer({ run_id: t.string() }, (ctx, { run_id }) => {
  const r = readRun(ctx, run_id);
  requirePresenter(ctx, r.session_id);
  refuseDuringRound(ctx, r.session_id, "playing a run");
  const runs = runsForKey(ctx, r);
  if (runs.some((x) => x.status === "running")) fail("Pause the run before stepping.");
  if (!runs.some((x) => x.status === "paused")) fail(keyRefusal(r, runs));
  for (const x of runs) if (x.status === "paused") ctx.db.run.id.update({ ...x, step_pending: true });
});

/** Back to `requested` with every row cleared. The engine is deterministic, so the watcher recomputes the same run. */
export const run_reset = spacetimedb.reducer({ run_id: t.string() }, (ctx, { run_id }) => {
  const r = readRun(ctx, run_id);
  requirePresenter(ctx, r.session_id);
  if (r.status === "requested") fail(statusRefusal(r.status));
  for (const x of runsForKey(ctx, r)) {
    deleteRunRows(ctx, x.id);
    ctx.db.run.id.update({ ...x, ...BEFORE_FRAME_0, autoplay: false });
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
    if (!hospitalOf(ctx, session_id).devices.some((d) => d.id === target_id)) fail(`Device "${target_id}" does not exist.`);
    if (note.length > NOTE_MAX) fail(`Notes are at most ${NOTE_MAX} characters.`);
    for (const a of [...ctx.db.annotation.session_id.filter(session_id)]) {
      if (a.active && a.target_id === target_id && same(a.author, ctx.sender)) fail("You already have a focus on this device.");
    }
    ctx.db.annotation.insert({
      id: 0n, session_id, run_id: s.active_run_id, kind: "focus", target_id, note: note.trim(),
      author: ctx.sender, author_name: p.name, role: p.role, active: true, created_at: ctx.timestamp, cleared_by: "",
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
