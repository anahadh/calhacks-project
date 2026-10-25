// Answer watcher: when a human answers a question (question_answer), sends the
// Answer to the Sign-off Coordinator, which resumes the round.

import type { DbConnection } from "../../web/lib/stdb/module_bindings";
import { callCoordinator, type Resume } from "./coordinator";
import { reportError } from "./stdb";

export function watchAnswers(conn: DbConnection, coordinatorUrl: string, cached = false): void {
  conn.db.question.onUpdate(async (_ctx, before, q) => {
    if (before.answered || !q.answered) return;
    // A cached round has no Coordinator to resume: its recorded answer, if any, is replayed in order.
    if (cached) return console.log(`[answer] ${q.questionId} answered during a cached round; nothing to resume`);
    const body: Resume = {
      sessionId: q.sessionId, questionId: q.questionId, choice: q.answerChoice, author: q.answerAuthor, role: q.answerRole,
    };
    console.log(`[answer] ${q.answerAuthor} (${q.answerRole}) answered ${q.questionId}: ${q.answerChoice}`);
    const ack = await callCoordinator(coordinatorUrl, "/resume", body);
    if (!ack.ok) await reportError(conn, q.sessionId, `Couldn't resume the round with that answer: ${ack.detail ?? "no detail"}`);
  });
}
