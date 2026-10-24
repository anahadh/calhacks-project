// Agent rounds (F1): the "Create aggregate fix" request, and the rows the
// watcher's relay mirrors from the uAgents (AGENTS.md rules 5, 10, 11).
// Reducers make no network calls: the round watcher sees defend_request_log rows
// and wakes the Coordinator itself.

import { t } from "spacetimedb/server";

import { AGENT_NAMES, AGENT_STATUSES, MESSAGE_TYPES, PAYLOAD_MAX, ROUND_STATES, SPEAKERS, TEXT_SOURCES } from "./constants";
import spacetimedb, { fail, getSession, requireServer } from "./schema";

function oneOf<T extends string>(value: string, allowed: readonly T[], what: string): T {
  if (!(allowed as readonly string[]).includes(value)) fail(`${what} must be one of: ${allowed.join(", ")}.`);
  return value as T;
}

/**
 * Create aggregate fix. Any joined human may ask, once the baseline run has
 * finished or been paused: agents never talk during a running visible run
 * (rule 5). The watcher reads the run's seed and patient zero from this row.
 */
export const defend_request = spacetimedb.reducer({ session_id: t.string() }, (ctx, { session_id }) => {
  const s = getSession(ctx, session_id);
  const p = ctx.db.presence.identity.find(ctx.sender);
  if (!p || p.session_id !== session_id) fail("Join the session before creating an aggregate fix.");
  const r = s.active_run_id ? ctx.db.run.id.find(s.active_run_id) : undefined;
  if (!r) fail("Run the attack first. The agents work from a baseline run.");
  if (r.status === "running") fail("Wait for the run to finish, or pause it, before creating an aggregate fix.");
  if (s.round_state === "running" || s.round_state === "waiting_for_human") {
    fail("An aggregate fix is already being negotiated for this session.");
  }
  ctx.db.defend_request_log.insert({
    id: 0n, session_id, run_id: r.id, patient_zero: r.patient_zero, seed: r.seed, challenges_json: "[]",
    requested_by: ctx.sender, requester_name: p.name, created_at: ctx.timestamp,
  });
});

/** One relayed uAgent message, sent or received. seq is assigned here, per session. */
export const agent_message_add = spacetimedb.reducer(
  {
    session_id: t.string(), round: t.u32(), from_agent: t.string(), to_agent: t.string(), type: t.string(),
    payload_json: t.string(), reason: t.string(), reason_source: t.string(), direction: t.string(), fixture: t.bool(),
  },
  (ctx, a) => {
    requireServer(ctx);
    if (!a.session_id) fail("session_id is required.");
    oneOf(a.from_agent, SPEAKERS, "from");
    oneOf(a.to_agent, SPEAKERS, "to");
    oneOf(a.type, MESSAGE_TYPES, "type");
    oneOf(a.reason_source, TEXT_SOURCES, "reason_source");
    oneOf(a.direction, ["sent", "received"] as const, "direction");
    if (a.payload_json.length > PAYLOAD_MAX) fail("The payload is too large.");
    try {
      JSON.parse(a.payload_json);
    } catch {
      fail("The payload is not valid JSON.");
    }
    let seq = 0;
    for (const m of ctx.db.agent_message.session_id.filter(a.session_id)) if (m.seq > seq) seq = m.seq;
    ctx.db.agent_message.insert({ id: 0n, ...a, seq: seq + 1, created_at: ctx.timestamp });
  },
);

export const agent_status_set = spacetimedb.reducer(
  { session_id: t.string(), agent: t.string(), status: t.string() },
  (ctx, { session_id, agent, status }) => {
    requireServer(ctx);
    oneOf(agent, AGENT_NAMES, "agent");
    oneOf(status, AGENT_STATUSES, "status");
    const row = { id: `${session_id}:${agent}`, session_id, agent, status, updated_at: ctx.timestamp };
    if (ctx.db.agent_status.id.find(row.id)) ctx.db.agent_status.id.update(row);
    else ctx.db.agent_status.insert(row);
  },
);

/** The Coordinator's RoundState, or the watcher's error in `detail` (rule 14: show it). */
export const round_state_set = spacetimedb.reducer(
  { session_id: t.string(), round: t.u32(), state: t.string(), detail: t.string() },
  (ctx, { session_id, round, state, detail }) => {
    requireServer(ctx);
    oneOf(state, ROUND_STATES, "state");
    const s = getSession(ctx, session_id);
    ctx.db.session.id.update({ ...s, round_state: state, round, round_detail: detail.slice(0, 500) });
  },
);
