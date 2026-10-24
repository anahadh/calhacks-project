// Round watcher: wakes the Sign-off Coordinator when a human presses Create
// aggregate fix (a new defend_request_log row). Never on run completion
// (AGENTS.md rule 5). Requests that existed before the watcher started are not
// replayed, so a restart doesn't start old rounds again.

import type { DbConnection } from "../../web/lib/stdb/module_bindings";
import { callCoordinator, type StartRound } from "./coordinator";
import { reportError } from "./stdb";

export function watchRounds(conn: DbConnection, coordinatorUrl: string): void {
  conn.db.defendRequestLog.onInsert(async (_ctx, req) => {
    const body: StartRound = {
      sessionId: req.sessionId, runId: req.runId, patientZero: req.patientZero, seed: req.seed,
      challenges: JSON.parse(req.challengesJson) as string[],
    };
    console.log(`[round] ${req.requesterName} created an aggregate fix for ${req.sessionId} (run ${req.runId})`);
    const ack = await callCoordinator(coordinatorUrl, "/start_round", body);
    if (ack.ok) console.log(`[round] ${req.sessionId}: ${ack.detail ?? "started"}`);
    else await reportError(conn, req.sessionId, `Couldn't start the aggregate fix: ${ack.detail ?? "no detail"}`);
  });
}
