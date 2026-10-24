"use client";

import { useState } from "react";
import type { SessionIndex } from "@/lib/stdb/use-session";
import type { RecommendationRow } from "@/lib/stdb/types";

// The recommendation's one control in the Agent Room (spec 7.4): Review
// recommendation, which reruns the same attack with and without this plan
// (solution_start) so humans can judge it. The rules, numbers and verdicts
// are read on the solution screen; here only the action lives. Agent
// acceptance is never shown as approval (UX rule 8).
export function RecommendationCard({
  rec,
  blocked,
  onShow,
}: {
  rec: RecommendationRow;
  /** Patients affected on the session's baseline run, once that run is done. Kept for callers that pass it. */
  baseline?: number;
  /** Shown in place of the baseline while it isn't final. Kept for callers that pass it. */
  baselineNote?: string;
  index?: SessionIndex;
  /** Why Show the solution would be refused now (solution_start's reasons), or null. */
  blocked: string | null;
  onShow: () => Promise<void>;
}) {
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const show = async () => {
    setError(undefined);
    setBusy(true);
    try {
      await onShow();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        onClick={show}
        disabled={!!blocked || busy}
        title={blocked ?? rec.name}
        className="num inline-flex min-h-[52px] items-center gap-3 rounded-ctl border border-ink bg-ink px-5 text-[15px] font-medium text-bg transition-[filter] duration-fade enabled:hover:brightness-90 disabled:cursor-not-allowed disabled:border-line2 disabled:bg-transparent disabled:text-ink-faint"
      >
        {busy ? "Opening…" : "Review recommendation"}
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
          <path d="M3 8h10M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {(error || blocked) && <p className="num max-w-[360px] text-right text-[11px] leading-snug text-ink-faint">{error ?? blocked}</p>}
    </div>
  );
}
