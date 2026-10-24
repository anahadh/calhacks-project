// Recommendations (F2). The Coordinator publishes one per finished round; the
// watcher upserts it here. `status` starts as draft and is changed only by
// review_submit (AGENTS.md rule 9): an update never touches it.

import { t } from "spacetimedb/server";

import spacetimedb, { fail, getSession, requireServer } from "./schema";

type Published = {
  policy: { name: string };
  testResult: unknown;
  verdicts: unknown[];
  explanation: string;
  explanationSource?: string | null;
  requiredRoles: string[];
};

/** `recommendation_json` is agents/protocol.py's Recommendation, as JSON. */
export const recommendation_upsert = spacetimedb.reducer(
  { session_id: t.string(), round: t.u32(), recommendation_json: t.string(), fixture: t.bool() },
  (ctx, { session_id, round, recommendation_json, fixture }) => {
    requireServer(ctx);
    getSession(ctx, session_id);
    let rec: Published;
    try {
      rec = JSON.parse(recommendation_json) as Published;
    } catch {
      fail("The recommendation is not valid JSON.");
    }
    if (!rec?.policy?.name || !Array.isArray(rec.verdicts) || !Array.isArray(rec.requiredRoles) || !rec.requiredRoles.length) {
      fail("A recommendation needs a policy, verdicts and required roles.");
    }
    const id = `${session_id}:${round}`;
    const old = ctx.db.recommendation.id.find(id);
    const row = {
      id, session_id, round, name: rec.policy.name, policy_json: JSON.stringify(rec.policy),
      explanation: rec.explanation ?? "", explanation_source: rec.explanationSource ?? "",
      verified_json: JSON.stringify(rec.testResult), verdicts_json: JSON.stringify(rec.verdicts),
      required_roles_json: JSON.stringify(rec.requiredRoles), fixture,
      status: old ? old.status : "draft", updated_at: ctx.timestamp,
    };
    if (old) ctx.db.recommendation.id.update(row);
    else ctx.db.recommendation.insert(row);
  },
);
