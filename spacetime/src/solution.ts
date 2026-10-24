// The solution view (F4). "Show the solution" reruns the attack as one lockstep
// pair: no segmentation on one side, the recommendation's plan on the other.
// The run watcher computes both through the engine and feeds their frames in
// one call, so both sides advance together. Every tab follows
// session.solution_pair_id into the view.
//
// Not a deployment (rule 9): nothing here writes recommendation.status. The
// session's baseline (active_run_id) stays put, so the Agent Room keeps reading it.
// Every export here must be a reducer (index.ts re-exports this file).

import { t } from "spacetimedb/server";

import { SPEEDS } from "./constants";
import spacetimedb, { BEFORE_FRAME_0, busyRun, fail, getSession, readRun, requirePresenter } from "./schema";

/** A fresh pair id per press, so a reopened solution never reuses a stale plan. */
function newPairId(ctx: any, sessionId: string, recommendationId: string): string {
  const base = `pair_${recommendationId.replace(/[^A-Za-z0-9_-]/g, "_")}`;
  const used = new Set([...ctx.db.run.session_id.filter(sessionId)].map((r: { pair_id: string }) => r.pair_id));
  let n = 1;
  while (used.has(`${base}_${n}`)) n++;
  return `${base}_${n}`;
}

export const solution_start = spacetimedb.reducer(
  { session_id: t.string(), recommendation_id: t.string(), speed: t.f64() },
  (ctx, { session_id, recommendation_id, speed }) => {
    requirePresenter(ctx, session_id);
    const s = getSession(ctx, session_id);
    if (!(SPEEDS as readonly number[]).includes(speed)) fail("Speed must be 0.5, 1, 2 or 4.");
    const rec = ctx.db.recommendation.id.find(recommendation_id);
    if (!rec || rec.session_id !== session_id) fail(`Recommendation "${recommendation_id}" does not exist in this session.`);
    if (s.round_state === "running" || s.round_state === "waiting_for_human") {
      fail("Wait for the agents to finish negotiating before showing a solution.");
    }
    if (busyRun(ctx, session_id)) fail("Wait for every run in this session to finish, or pause it, before showing a solution.");
    if (!s.active_run_id) fail("Run the attack first. The solution reruns the baseline's attack.");
    const base = readRun(ctx, s.active_run_id);

    const pair_id = newPairId(ctx, session_id, rec.id);
    const common = {
      ...BEFORE_FRAME_0, session_id, pair_id, seed: base.seed, patient_zero: base.patient_zero, speed,
      autoplay: true, challenges_json: base.challenges_json, started_at: ctx.timestamp,
    };
    for (const id of [`${pair_id}_none`, `${pair_id}_plan`]) {
      if (ctx.db.run.id.find(id)) fail(`Run "${id}" already exists.`);
    }
    ctx.db.run.insert({ ...common, id: `${pair_id}_none`, label: "No segmentation", policy_json: "", recommendation_id: "" });
    ctx.db.run.insert({
      ...common, id: `${pair_id}_plan`, label: `With plan: ${rec.name}`, policy_json: rec.policy_json, recommendation_id: rec.id,
    });
    ctx.db.session.id.update({ ...s, solution_pair_id: pair_id });
  },
);

/** Back to the session: every tab leaves the solution view. The pair's runs stay. */
export const solution_close = spacetimedb.reducer({ session_id: t.string() }, (ctx, { session_id }) => {
  requirePresenter(ctx, session_id);
  const s = getSession(ctx, session_id);
  ctx.db.session.id.update({ ...s, solution_pair_id: "" });
});
