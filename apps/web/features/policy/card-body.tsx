"use client";

import { useState } from "react";
import { ROLE_LABEL } from "@/lib/format";
import type { SessionIndex } from "@/lib/stdb/use-session";
import type { RecommendationRow } from "@/lib/stdb/types";
import { AgentIcon } from "@/features/agents/agent-icon";
import { SPEAKER_NAME } from "@/features/agents/agents";

// One recommendation card (spec 7.4): rules, the explanation, numbers from
// the engine, each agent's verdict, the roles that must sign off, and Show the
// solution, which reruns the same attack with and without this plan. Agent
// acceptance is shown as the agents' verdict, never as approval (UX rule 8).
export function RecommendationCard({
  rec,
  baseline,
  baselineNote,
  index,
  blocked,
  onShow,
}: {
  rec: RecommendationRow;
  /** Patients affected on the session's baseline run (its run row), once that run is done. */
  baseline?: number;
  /** Shown in place of the baseline while it isn't final ("baseline paused at step 5 of 14"). */
  baselineNote?: string;
  index: SessionIndex;
  /** Why Show the solution would be refused now (solution_start's reasons), or null. */
  blocked: string | null;
  onShow: () => Promise<void>;
}) {
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const broken = rec.verified.protectedBroken.map((id) => {
    const f = index.flow.get(id);
    return f?.purpose ?? id;
  });

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
    <div className="border-b border-line p-3.5 last:border-b-0">
      <div className="flex items-baseline gap-2">
        <b className="font-disp text-[14px]">{rec.name}</b>
        <span className="num ml-auto text-[10px] uppercase tracking-[0.06em] text-ink-faint">round {rec.round}</span>
      </div>

      {broken.length > 0 && (
        <p className="num mt-1.5 rounded border border-line2 bg-panel2 px-2 py-1 text-[10.5px] text-ink">
          ✕ Breaks a protected flow: {broken.join(", ")}
        </p>
      )}

      <ul className="mt-2 space-y-1">
        {rec.rules.map((r, i) => (
          <li key={i} className="rounded border border-line2 bg-panel2 px-2 py-1 text-[11.5px] text-ink-muted">
            {r}
          </li>
        ))}
      </ul>

      <p className="mt-2 text-[12px] leading-snug text-ink-muted">
        {rec.explanation}
        {rec.source === "template" && <span className="num ml-1 text-[10px] text-ink-faint">(template text)</span>}
      </p>

      <div className="num mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-muted">
        <span>
          Patients affected{" "}
          {baseline !== undefined && (
            <>
              <s className="text-ink-faint">{baseline}</s> →{" "}
            </>
          )}
          <b className="font-disp text-[15px] font-light text-ink">{rec.verified.patientsAffected}</b>
          {baseline === undefined && baselineNote && <span className="ml-1 text-ink-faint">({baselineNote})</span>}
        </span>
        <span>Devices compromised {rec.verified.devicesCompromised}</span>
        <span>Connections cut {rec.verified.removedFlows.length}</span>
        {rec.fixture && <span className="text-ink-faint">fixture results, not the engine</span>}
      </div>

      <ul className="mt-2 space-y-1">
        {rec.verdicts.map((v) => (
          <li key={v.agent} className="flex items-start gap-2 text-[11px] text-ink-muted">
            <AgentIcon who={v.agent} size={16} />
            <span>
              <span className="num text-ink">{v.decision === "accept" ? "● accepts" : "✕ rejects"}</span> · {SPEAKER_NAME[v.agent]}: {v.reason}
            </span>
          </li>
        ))}
      </ul>

      <div className="num mt-2 text-[10.5px] text-ink-faint">
        Sign-off needed from {rec.requiredRoles.map((r) => ROLE_LABEL[r]).join(", ")} · {rec.status === "ready" ? "Ready" : "not reviewed"}
      </div>

      <button
        onClick={show}
        disabled={!!blocked || busy}
        title={blocked ?? undefined}
        className="num mt-3 w-full rounded-[7px] border border-accent px-3 py-2.5 text-[11.5px] font-semibold text-accent transition hover:bg-accent/10 disabled:cursor-not-allowed disabled:border-line2 disabled:text-ink-faint disabled:hover:bg-transparent"
      >
        Show the solution →
      </button>
      {(error || blocked) && <p className="num mt-1.5 text-[10.5px] leading-snug text-ink-faint">{error ?? blocked}</p>}
    </div>
  );
}
