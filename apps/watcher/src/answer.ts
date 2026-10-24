// Answer watcher: when a human answers a question (question_answer), sends the
// Answer to the Sign-off Coordinator, which resumes the round.

import type { DbConnection } from "../../web/lib/stdb/module_bindings";
import { callCoordinator, type Resume } from "./coordinator";
import { reportError } from "./stdb";

export function watchAnswers(conn: DbConnection, coordinatorUrl: string): void {
  conn.db.question.onUpdate(async (_ctx, before, q) => {
    if (before.answered || !q.answered) return;
    const body: Resume = {
      sessionId: q.sessionId, questionId: q.questionId, choice: q.answerChoice, author: q.answerAuthor, role: q.answerRole,
    };
    console.log(`[answer] ${q.answerAuthor} (${q.answerRole}) answered ${q.questionId}: ${q.answerChoice}`);
    const ack = await callCoordinator(coordinatorUrl, "/resume", body);
    if (!ack.ok) await reportError(conn, q.sessionId, `Couldn't resume the round with that answer: ${ack.detail ?? "no detail"}`);
  });
}
