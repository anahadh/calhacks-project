// Round watcher: wakes the Sign-off Coordinator when a human presses Create
// aggregate fix (a new defend_request_log row). Never on run completion
// (AGENTS.md rule 5). Requests that existed before the watcher started are not
// replayed, so a restart doesn't start old rounds again.

import { z } from "zod";
import type { DbConnection } from "../../web/lib/stdb/module_bindings";
import { cachedRoundProblem, replayCachedRound, type CachedRound } from "./cached";
import { callCoordinator, type StartRound } from "./coordinator";
import { reportError } from "./stdb";

const Challenges = z.array(z.string().min(1));

export function watchRounds(conn: DbConnection, coordinatorUrl: string, cached?: CachedRound): void {
  console.log(`[round] watching defend_request_log inserts${cached ? ` (CACHED_ROUND: replaying the cached round at ${cached.speed}x)` : ""}`);
  conn.db.defendRequestLog.onInsert(async (_ctx, req) => {
    console.log(`[round] defend_request_log insert: id=${req.id} session=${req.sessionId} run=${req.runId} pz=${req.patientZero}`);
    const challenges = Challenges.safeParse(safeJson(req.challengesJson));
    if (!challenges.success) {
      await reportError(conn, req.sessionId, "Couldn't start the aggregate fix: the request's challenges are not a JSON list of ids.");
      return;
    }
    const body: StartRound = {
      sessionId: req.sessionId, runId: req.runId, patientZero: req.patientZero, seed: req.seed, challenges: challenges.data,
    };
    console.log(`[round] ${req.requesterName} created an aggregate fix for ${req.sessionId} (run ${req.runId})`);
    if (cached) {
      // Rule 14's exception: the recorded real round, labeled "Cached run" on every message.
      const problem = cachedRoundProblem();
      if (problem) return reportError(conn, req.sessionId, `Couldn't replay the cached round: ${problem}`);
      try {
        await replayCachedRound(req.sessionId, cached.speed);
        console.log(`[round] ${req.sessionId}: cached round replayed`);
      } catch (e) {
        await reportError(conn, req.sessionId, `Couldn't replay the cached round: ${(e as Error).message}`);
      }
      return;
    }
    const ack = await callCoordinator(coordinatorUrl, "/start_round", body);
    if (ack.ok) console.log(`[round] ${req.sessionId}: ${ack.detail ?? "started"}`);
    else await reportError(conn, req.sessionId, `Couldn't start the aggregate fix: ${ack.detail ?? "no detail"}`);
  });
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
