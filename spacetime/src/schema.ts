// Every table of the Hippocra.tech module, plus helpers shared by the reducer
// files. Reducers live in index.ts (base) and in one file per feature
// (ingest.ts, solution.ts, agents.ts, question.ts, recommendation.ts), all
// re-exported from index.ts.
//
// The module is the live state bus, not the compute: run rows arrive as engine
// frames through run_frames_apply (ingest.ts), and every client subscribes.
//
// All data is synthetic. Patient groups are counts.

import { schema, table, t, SenderError } from "spacetimedb/server";
import type { Identity, Timestamp } from "spacetimedb";

// ---------------------------------------------------------------- tables

const config = table(
  { name: "config" }, // private
  { id: t.u32().primaryKey(), server_identity: t.identity() },
);

const session = table(
  { name: "session", public: true },
  {
    id: t.string().primaryKey(),
    hospital_json: t.string(),
    hospital_name: t.string(),
    presenter: t.identity(),
    active_run_id: t.string(),
    created_at: t.timestamp(),
    // Aggregate-fix round (spec Data Model: session.roundState). Written only by
    // round_state_set. Defaults let an existing database migrate.
    round_state: t.string().default("idle"), // idle | running | waiting_for_human | done
    round: t.u32().default(0),
    round_detail: t.string().default(""), // the Coordinator's detail, or the watcher's error
    // Device ids the engine accepts as patient zero, written by the watcher
    // (session_entry_points_set). "[]" = not known yet; run_start then accepts any device.
    entry_points_json: t.string().default("[]"),
    solution_pair_id: t.string().default(""), // the pair the solution view shows; every tab follows it
  },
);

/** One visible run. Engine columns start empty and fill from frame 0 (ingest.ts). */
const run = table(
  { name: "run", public: true },
  {
    id: t.string().primaryKey(),
    session_id: t.string().index("btree"),
    pair_id: t.string(), // "" unless part of a solution-view pair
    label: t.string(),
    seed: t.u32(), // accepted and ignored: the engine has no RNG
    patient_zero: t.string(),
    policy_json: t.string(), // "" = no segmentation; otherwise the agents' Policy, opaque here
    tick: t.u32(),
    status: t.string(), // requested | running | paused | done | error
    speed: t.f64(),
    patients_affected: t.u32(),
    devices_compromised: t.u32(),
    services_down: t.u32(),
    delayed_procedures: t.u32(),
    choke_points_json: t.string(),
    protected_broken_json: t.string(),
    started_at: t.timestamp(),
    // Defaults let an existing database migrate.
    final_tick: t.u32().default(0), // from frame 0
    detail: t.string().default(""), // the engine's or the watcher's error (rule 14); never session.round_detail
    autoplay: t.bool().default(false), // frame 0 leaves the run running (true) or paused
    step_pending: t.bool().default(false), // the presenter asked for one step while paused
    challenges_json: t.string().default("[]"),
    removed_flows_json: t.string().default("[]"), // from frame 0
    assumptions_json: t.string().default("[]"), // the engine's [S] notes, from frame 0
    recommendation_id: t.string().default(""), // set on a solution rerun's plan side
  },
);

const device_state = table(
  { name: "device_state", public: true },
  {
    id: t.string().primaryKey(), // `${run_id}:${device_id}`
    run_id: t.string().index("btree"),
    device_id: t.string(),
    infected: t.bool(),
    infected_at_tick: t.i32(), // -1 = not infected
    infected_by: t.string(), // "" = patient zero or not infected
  },
);

const service_state = table(
  { name: "service_state", public: true },
  {
    id: t.string().primaryKey(),
    run_id: t.string().index("btree"),
    service_id: t.string(),
    down: t.bool(),
    down_since_tick: t.i32(),
  },
);

const patient_state = table(
  { name: "patient_state", public: true },
  {
    id: t.string().primaryKey(),
    run_id: t.string().index("btree"),
    group_id: t.string(),
    state: t.string(), // ok | delayed | disrupted | diverted
  },
);

const spread_attempt = table(
  { name: "spread_attempt", public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    run_id: t.string().index("btree"),
    tick: t.u32(),
    from_device: t.string(),
    to_device: t.string(),
    flow_id: t.string(),
    success: t.bool(),
  },
);

const sim_event = table(
  { name: "sim_event", public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    run_id: t.string().index("btree"),
    tick: t.u32(),
    kind: t.string(),
    target_id: t.string(),
    text: t.string(),
  },
);

const tick_snapshot = table(
  { name: "tick_snapshot", public: true },
  {
    id: t.string().primaryKey(), // `${run_id}:${tick}`
    run_id: t.string().index("btree"),
    tick: t.u32(),
    infected_count: t.u32(),
    patients_affected: t.u32(),
    infected_ids_json: t.string(),
    services_down_json: t.string(),
    patients_json: t.string(),
  },
);

const presence = table(
  { name: "presence", public: true },
  {
    identity: t.identity().primaryKey(),
    session_id: t.string().index("btree"),
    name: t.string(),
    role: t.string(),
    following: t.bool(),
    last_seen: t.timestamp(),
  },
);

/**
 * Annotations. `focus`: a pin on a device (context for the agents, never an
 * order). `note`: a free-text note at a tick on the run's timeline.
 */
const annotation = table(
  { name: "annotation", public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    session_id: t.string().index("btree"),
    run_id: t.string(),
    kind: t.string(), // focus | note
    target_id: t.string(), // device id for focus; "" for note
    note: t.string(),
    author: t.identity(),
    author_name: t.string(),
    role: t.string(),
    active: t.bool(),
    created_at: t.timestamp(),
    cleared_by: t.string(), // "" while active
    tick: t.i32().default(-1), // note: the tick it marks; -1 for focus. Default lets an existing database migrate
  },
);

// ---------------------------------------------------------------- agent tables (F1, F2)

/** One row per "Create aggregate fix" press (the defend_request reducer). The round watcher wakes the Coordinator on each insert. */
const defend_request_log = table(
  { name: "defend_request_log", public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    session_id: t.string().index("btree"),
    run_id: t.string(), // the baseline run the agents read
    patient_zero: t.string(),
    seed: t.u32(),
    challenges_json: t.string(), // ChallengeId[], copied from the run ("[]" until challenge_add exists)
    requested_by: t.identity(),
    requester_name: t.string(),
    created_at: t.timestamp(),
  },
);

/** Every uAgent message, sent and received, mirrored by the watcher's relay (rule 10). */
const agent_message = table(
  { name: "agent_message", public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    session_id: t.string().index("btree"),
    round: t.u32(),
    seq: t.u32(), // per session, assigned here
    from_agent: t.string(), // agent name or "humans"
    to_agent: t.string(), // agent name, "humans" or "relay"
    type: t.string(),
    payload_json: t.string(), // the protocol model, as JSON
    reason: t.string(),
    reason_source: t.string(), // claude | template | ""
    direction: t.string(), // sent | received
    fixture: t.bool(), // numbers came from fixture files, not the engine
    created_at: t.timestamp(),
  },
);

const agent_status = table(
  { name: "agent_status", public: true },
  {
    id: t.string().primaryKey(), // `${session_id}:${agent}`
    session_id: t.string().index("btree"),
    agent: t.string(),
    status: t.string(), // idle | thinking | speaking | waiting
    updated_at: t.timestamp(),
  },
);

/** An agent asking humans for a fact it can't compute. Only allowed roles answer. */
const question = table(
  { name: "question", public: true },
  {
    id: t.string().primaryKey(), // `${session_id}:${question_id}`
    session_id: t.string().index("btree"),
    question_id: t.string(), // the agent's id; Answer.questionId refers to it
    round: t.u32(),
    agent: t.string(),
    target_id: t.string(), // device or flow id
    text: t.string(),
    text_source: t.string(), // claude | template
    choices_json: t.string(),
    allowed_roles_json: t.string(),
    answered: t.bool(),
    answer_choice: t.string(),
    answer_author: t.string(),
    answer_role: t.string(),
    created_at: t.timestamp(),
  },
);

/** The Coordinator's published plans. `status` is written only by review_submit (rule 9). */
const recommendation = table(
  { name: "recommendation", public: true },
  {
    id: t.string().primaryKey(), // `${session_id}:${round}`
    session_id: t.string().index("btree"),
    round: t.u32(),
    name: t.string(),
    policy_json: t.string(),
    explanation: t.string(),
    explanation_source: t.string(),
    verified_json: t.string(), // the RunResult from the engine (hippo-sim)
    verdicts_json: t.string(),
    required_roles_json: t.string(),
    fixture: t.bool(),
    status: t.string(), // draft | ready
    updated_at: t.timestamp(),
  },
);

const spacetimedb = schema({
  config, session, run, device_state, service_state, patient_state,
  spread_attempt, sim_event, tick_snapshot, presence, annotation,
  defend_request_log, agent_message, agent_status, question, recommendation,
});
export default spacetimedb;

// ---------------------------------------------------------------- shared helpers

export function fail(message: string): never {
  throw new SenderError(message);
}

export function same(a: Identity, b: Identity): boolean {
  return a.isEqual(b);
}

export function isServer(ctx: any): boolean {
  const c = ctx.db.config.id.find(0);
  return !!c && same(c.server_identity, ctx.sender);
}

export function getSession(ctx: any, sessionId: string) {
  return ctx.db.session.id.find(sessionId) ?? fail(`Session "${sessionId}" does not exist.`);
}

/** Server-only reducers (AGENTS.md rule 11): watchers and the Node server. */
export function requireServer(ctx: any): void {
  if (!isServer(ctx)) fail("Only the server identity can call this reducer.");
}

/** Run controls: the presenter (spec 7.3) or the server identity. */
export function requirePresenter(ctx: any, sessionId: string): void {
  const s = getSession(ctx, sessionId);
  if (!same(s.presenter, ctx.sender) && !isServer(ctx)) fail("Only the presenter can control playback.");
}

// ---------------------------------------------------------------- run helpers

export type RunRow = {
  id: string; session_id: string; pair_id: string; label: string; seed: number; patient_zero: string;
  policy_json: string; tick: number; status: string; speed: number; patients_affected: number;
  devices_compromised: number; services_down: number; delayed_procedures: number;
  choke_points_json: string; protected_broken_json: string; started_at: Timestamp;
  final_tick: number; detail: string; autoplay: boolean; step_pending: boolean; challenges_json: string;
  removed_flows_json: string; assumptions_json: string; recommendation_id: string;
};

/** The public rows a run's frames write, besides the run row itself. */
export const RUN_ROW_TABLES = ["device_state", "service_state", "patient_state", "spread_attempt", "sim_event", "tick_snapshot"] as const;

/** A run's columns before frame 0 arrives: run_start, solution_start and run_reset write these. */
export const BEFORE_FRAME_0 = {
  tick: 0, status: "requested", step_pending: false, detail: "", final_tick: 0,
  patients_affected: 0, devices_compromised: 0, services_down: 0, delayed_procedures: 0,
  choke_points_json: "[]", protected_broken_json: "[]", removed_flows_json: "[]", assumptions_json: "[]",
} as const;

export function rowKey(...parts: (string | number)[]): string {
  return parts.join(":");
}

export function readRun(ctx: any, runId: string): RunRow {
  return (ctx.db.run.id.find(runId) as RunRow | undefined) ?? fail(`Run "${runId}" does not exist.`);
}

/** Playback key: a solution pair moves together. */
export function playbackKey(r: { id: string; pair_id: string }): string {
  return r.pair_id || r.id;
}

/** Every run under this run's playback key (itself, or its whole pair). */
export function runsForKey(ctx: any, r: RunRow): RunRow[] {
  const k = playbackKey(r);
  return [...ctx.db.run.session_id.filter(r.session_id)].filter((x: RunRow) => playbackKey(x) === k);
}

export function deleteRunRows(ctx: any, runId: string): void {
  for (const tbl of RUN_ROW_TABLES) {
    for (const row of [...ctx.db[tbl].run_id.filter(runId)]) ctx.db[tbl].delete(row);
  }
}

/** A run in the session that is being computed or played (rule 5: agents wait for it). */
export function busyRun(ctx: any, sessionId: string): RunRow | undefined {
  return [...ctx.db.run.session_id.filter(sessionId)].find((r: RunRow) => r.status === "requested" || r.status === "running");
}

/** An aggregate-fix round is open: the agents are negotiating or waiting for a human. No run plays meanwhile (rule 5). */
export function roundOpen(s: { round_state: string }): boolean {
  return s.round_state === "running" || s.round_state === "waiting_for_human";
}

/** Why a playback control can't act on a run in this status. */
export function statusRefusal(status: string): string {
  if (status === "requested") return "This run is still being computed.";
  if (status === "done") return "This run has finished. Reset it to play again.";
  if (status === "error") return "This run failed. Reset it to try again.";
  return "";
}

/** Why no run under the key can take a control: the named run's own reason first, then its partner's. */
export function keyRefusal(r: RunRow, runs: RunRow[]): string {
  return statusRefusal(r.status) || runs.map((x) => statusRefusal(x.status)).find(Boolean) || "";
}
