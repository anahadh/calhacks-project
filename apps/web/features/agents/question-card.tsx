"use client";

import { useState } from "react";
import { ROLE_LABEL } from "@/lib/format";
import type { SessionIndex } from "@/lib/stdb/use-session";
import type { QuestionRow, SessionSnapshot } from "@/lib/stdb/types";
import { AgentIcon } from "./agent-icon";
import { SPEAKER_NAME } from "./agents";

// A question an agent asked humans (spec 7.4). Shown as a banner on every
// screen until it is answered. Only the allowed roles see the choices; the
// question_answer reducer checks the role again.
export function QuestionBanner({ session, index }: { session: SessionSnapshot; index: SessionIndex }) {
  const open = session.questions.filter((q) => !q.answer);
  if (!open.length) return null;
  return (
    <div className="space-y-2">
      {open.map((q) => (
        <QuestionCard key={q.questionId} q={q} session={session} index={index} />
      ))}
    </div>
  );
}

export function QuestionCard({ q, session, index }: { q: QuestionRow; session: SessionSnapshot; index: SessionIndex }) {
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const device = index.device.get(q.targetId);
  const canAnswer = !!session.me && (q.allowedRoles as string[]).includes(session.me.role);
  const who = q.allowedRoles.map((r) => ROLE_LABEL[r]).join(" or ");

  const answer = async (choice: string) => {
    setError(undefined);
    setBusy(true);
    try {
      await session.actions.answerQuestion(q.questionId, choice);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div role="alert" className="panel flex flex-wrap items-center gap-3 px-3.5 py-3">
      <AgentIcon who={q.agent} size={24} />
      <div className="min-w-0 flex-[1_1_320px]">
        <div className="num text-[9.5px] uppercase tracking-[0.08em] text-ink-faint">
          ? Question · {SPEAKER_NAME[q.agent]} · round {q.round} · about {device?.name ?? q.targetId}
          {q.source === "template" && " · template text"}
        </div>
        <p className="mt-0.5 font-disp text-[14px] text-ink">{q.text}</p>
        {error && <p className="num mt-1 text-[10.5px] text-ink-muted">{error}</p>}
      </div>
      {canAnswer ? (
        <div className="flex flex-wrap gap-1.5">
          {q.choices.map((c) => (
            <button
              key={c}
              disabled={busy}
              onClick={() => answer(c)}
              className="num rounded-[7px] border border-line2 px-3 py-1.5 text-[11.5px] text-ink transition hover:border-accent disabled:opacity-50"
            >
              {c}
            </button>
          ))}
        </div>
      ) : (
        <span className="num text-[10.5px] text-ink-faint">Waiting for {who} to answer</span>
      )}
    </div>
  );
}
