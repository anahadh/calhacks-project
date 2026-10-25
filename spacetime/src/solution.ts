// The solution view (F4). "Show the solution" reruns the attack as one lockstep
// pair: no segmentation on one side, the recommendation's plan on the other.
// The run watcher computes both through the engine and feeds their frames in
// one call, so both sides advance together. Every tab follows
// session.solution_pair_id into the view.
//
// Not a deployment (rule 9): nothing here writes recommendation.status. The
// session's baseline (active_run_id) stays put, so the Agent Room keeps reading it.
// The pair reruns the attack on screen only when it is the attack the plan was
// tested on, so the plan side's numbers can equal recommendation.verified_json.
// Every export here must be a reducer (index.ts re-exports this file).

import { t } from "spacetimedb/server";
import type { Timestamp } from "spacetimedb";

import { SPEEDS } from "./constants";
import spacetimedb, { BEFORE_FRAME_0, busyRun, fail, getSession, readRun, requirePresenter, roundOpen } from "./schema";

type DefendRow = { id: bigint; patient_zero: string; challenges_json: string; created_at: Timestamp };

/**
 * The Create aggregate fix request a plan answers: the newest one in the
 * session at or before the plan's last write. Round numbers restart at 1 on
 * every request, so recommendation.round can't name it.
 */
function requestBehind(ctx: any, sessionId: string, updatedAt: Timestamp): DefendRow | undefined {
  let best: DefendRow | undefined;
  for (const d of ctx.db.defend_request_log.session_id.filter(sessionId) as Iterable<DefendRow>) {
    if (d.created_at.microsSinceUnixEpoch > updatedAt.microsSinceUnixEpoch) continue;
    if (!best || d.id > best.id) best = d;
  }
  return best;
}

/** A fresh pair id per press, so a reopened solution never reuses a stale plan. */
function newPairId(ctx: any, sessionId: string, recommendationId: string): string {
  const base = `pair_${recommendationId.replace(/[^A-Za-z0-9_-]/g, "_")}`;
  const used = new Set([...ctx.db.run.session_id.filter(sessionId)].map((r: { pair_id: string }) => r.pair_id));
  let n = 1;
  while (used.has(`${base}_${n}`)) n++;
  return `${base}_${n}`;
}

export const solution_start = spacetimedb.reducer(
  { session_id: t.string(), recommendation_id: t.string(), speed: t.f64(), patient_zero: t.string() },
  (ctx, { session_id, recommendation_id, speed, patient_zero }) => {
    requirePresenter(ctx, session_id);
    const s = getSession(ctx, session_id);
    if (!(SPEEDS as readonly number[]).includes(speed)) fail("Speed must be 0.5, 1, 2 or 4.");
    const rec = ctx.db.recommendation.id.find(recommendation_id);
    if (!rec || rec.session_id !== session_id) fail(`Recommendation "${recommendation_id}" does not exist in this session.`);
    if (roundOpen(s)) fail("Wait for the agents to finish negotiating before showing a solution.");
    if (busyRun(ctx, session_id)) fail("Wait for every run in this session to finish, or pause it, before showing a solution.");
    if (!s.active_run_id) fail("Run the attack first. The solution reruns the baseline's attack.");
    const base = readRun(ctx, s.active_run_id);
    if (base.status === "error") fail("The attack run failed, so there is no attack to rerun. Reset it or start a new attack.");
    const tested = requestBehind(ctx, session_id, rec.updated_at);
    if (!tested) fail("This plan has no aggregate fix request in this session, so there is no attack to rerun.");
    // Plans are designed for every entry point, so any attack on screen can be rerun against one:
    // the presenter can start a new attack anywhere and test the same plan. Challenges must match.
    if (tested.challenges_json !== base.challenges_json) {
      fail("This plan was tested with different challenges than the attack on screen. Create an aggregate fix for this one.");
    }

    // "" reruns the attack on screen; a device id reruns both sides from there (the plan holds for any entry point).
    let start = base.patient_zero;
    if (patient_zero) {
      const entryPoints = JSON.parse(s.entry_points_json) as string[];
      if (entryPoints.length && !entryPoints.includes(patient_zero)) fail(`"${patient_zero}" is not an entry point the engine accepts.`);
      start = patient_zero;
    }
    const pair_id = newPairId(ctx, session_id, rec.id);
    const common = {
      ...BEFORE_FRAME_0, session_id, pair_id, seed: base.seed, patient_zero: start, speed,
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
