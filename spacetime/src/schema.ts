// Every table of the Hippocra.tech module, plus helpers shared by the reducer
// files. Reducers live in index.ts (base) and in one file per feature
// (agents.ts, question.ts, recommendation.ts), all re-exported from index.ts.
//
// All data is synthetic. Patient groups are counts.

import { schema, table, t, SenderError } from "spacetimedb/server";
import type { Identity } from "spacetimedb";
// Resolved lazily by the schema, after every module has loaded.
import { run_tick } from "./index";

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
  },
);

const run = table(
  { name: "run", public: true },
  {
    id: t.string().primaryKey(),
    session_id: t.string().index("btree"),
    pair_id: t.string(), // "" unless part of a solution-view pair
    label: t.string(),
    seed: t.u32(),
    patient_zero: t.string(),
    policy_json: t.string(), // "" = no segmentation
    tick: t.u32(),
    status: t.string(), // running | paused | done
    speed: t.f64(),
    patients_affected: t.u32(),
    devices_compromised: t.u32(),
    services_down: t.u32(),
    delayed_procedures: t.u32(),
    choke_points_json: t.string(),
    protected_broken_json: t.string(),
    started_at: t.timestamp(),
  },
);

/** The engine's full state per run. Private: clients read the public rows. */
const run_state = table(
  { name: "run_state" },
  { run_id: t.string().primaryKey(), state_json: t.string() },
);

/** One row per ticking run or pair. Deleting it pauses the run. */
export const tick_timer = table(
  { name: "tick_timer", scheduled: (): any => run_tick },
  {
    scheduled_id: t.u64().primaryKey().autoInc(),
    scheduled_at: t.scheduleAt(),
    key: t.string(), // run id, or pair id for lockstep runs
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

/** Focus annotations (spec 7.8). Context for the agents, never an order. */
const annotation = table(
  { name: "annotation", public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    session_id: t.string().index("btree"),
    run_id: t.string(),
    kind: t.string(), // focus
    target_id: t.string(), // device id
    note: t.string(),
    author: t.identity(),
    author_name: t.string(),
    role: t.string(),
    active: t.bool(),
    created_at: t.timestamp(),
    cleared_by: t.string(), // "" while active
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
    challenges_json: t.string(), // ChallengeId[]; "[]" until challenge_add exists
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
    fixture: t.bool(), // numbers came from fixture files, not hippo-sim
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
    verified_json: t.string(), // the RunResult from hippo-sim
    verdicts_json: t.string(),
    required_roles_json: t.string(),
    fixture: t.bool(),
    status: t.string(), // draft | ready
    updated_at: t.timestamp(),
  },
);

const spacetimedb = schema({
  config, session, run, run_state, tick_timer, device_state, service_state,
  patient_state, spread_attempt, sim_event, tick_snapshot, presence, annotation,
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
