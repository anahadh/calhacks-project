"use client";

import { useEffect, useRef, useState } from "react";
import { ROLE_LABEL } from "@/lib/format";
import type { SessionIndex } from "@/lib/stdb/use-session";
import type { AgentMessageRow, AgentStatusRow, SessionSnapshot } from "@/lib/stdb/types";
import { finalOf, notFinalYet } from "@/features/flow/final";
import { RecommendationCard } from "@/features/policy/card-body";
import { showBlocker } from "@/features/solution/pair";
import { AgentIcon } from "./agent-icon";
import { AGENTS, MESSAGE_SHAPE, SPEAKER_NAME } from "./agents";
import { DefendButton } from "./defend-button";
import { RevealClock } from "./reveal";

// The Agents tab: who the agents are, what they are saying, and what comes
// out of the round. Renders agent_message, agent_status, question and
// recommendation rows only.
export function AgentRoom({ session, index }: { session: SessionSnapshot; index: SessionIndex }) {
  return (
    <div className="grid items-start gap-3.5 lg:grid-cols-[280px_minmax(0,1.3fr)_minmax(0,1fr)]">
      <AgentList session={session} />
      <Negotiation session={session} index={index} />
      <Recommendations session={session} index={index} />
    </div>
  );
}

const STATUS: Record<AgentStatusRow["status"], { label: string; cls: string }> = {
  idle: { label: "Idle", cls: "bg-line text-ink-faint" },
  thinking: { label: "Thinking", cls: "bg-accent/15 text-accent" },
  speaking: { label: "Speaking", cls: "bg-accent/15 text-accent" },
  waiting: { label: "Waiting", cls: "bg-ink/10 text-ink-muted" },
};

function AgentList({ session }: { session: SessionSnapshot }) {
  const status = new Map(session.agentStatus.map((s) => [s.agent, s.status]));
  const { roundState } = session;

  return (
    <div className="panel">
      <div className="panel-h">
        <h2>uAgents</h2>
        <span className="num ml-auto rounded-full bg-panel2 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
          Round {roundState.round} of {roundState.maxRounds}
        </span>
      </div>
      <ul className="px-3.5">
        {AGENTS.map((a) => {
          const st = STATUS[status.get(a.id) ?? "idle"];
          return (
            <li key={a.id} className="flex items-start gap-2.5 border-b border-line py-2.5 last:border-b-0">
              <AgentIcon who={a.id} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-disp text-[12.5px] font-semibold">{a.name}</span>
                  <span className={`num ml-auto rounded-full px-1.5 py-px text-[9.5px] uppercase tracking-[0.06em] ${st.cls}`}>
                    {st.label}
                    {status.get(a.id) === "thinking" && <Dots />}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] leading-snug text-ink-muted">{a.objective}</p>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="border-t border-line px-3.5 py-3">
        <div className="eyebrow">Humans in the session</div>
        <ul className="mt-2 space-y-1.5">
          {session.presence.map((p, i) => (
            <li key={`${p.name}:${i}`} className="flex items-center gap-2 text-[12px]">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-panel2 font-disp text-[10px] font-bold text-ink-muted">
                {p.name[0]}
              </span>
              <span>{p.name}</span>
              <span className="num ml-auto text-[10px] text-ink-faint">{ROLE_LABEL[p.role]}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3">
          <DefendButton session={session} />
        </div>
      </div>
    </div>
  );
}

/**
 * The messages this tab shows now, paced no faster than one per 1.2 s (UX rule 5,
 * reveal.ts), how many are still to come, and a way to show them all at once.
 */
function useRevealed(all: readonly AgentMessageRow[]) {
  const clock = useRef<RevealClock>();
  if (!clock.current) clock.current = new RevealClock();
  const [, redraw] = useState(0);
  const c = clock.current;
  const now = performance.now();
  c.observe(all.map((m) => m.seq), now);
  const next = c.nextAt(now);
  useEffect(() => {
    if (next === undefined) return;
    const id = setTimeout(() => redraw((n) => n + 1), Math.max(0, next - performance.now()) + 16);
    return () => clearTimeout(id);
  }, [next]);
  return {
    messages: all.filter((m) => c.shown(m.seq, now)),
    waiting: c.waiting(now),
    showAll: () => {
      c.flush(performance.now());
      redraw((n) => n + 1);
    },
  };
}

function Negotiation({ session, index }: { session: SessionSnapshot; index: SessionIndex }) {
  const { roundState } = session;
  // Only what has been revealed counts below, so no number runs ahead of the thread.
  const { messages, waiting, showAll } = useRevealed(session.messages);
  const thinking = session.agentStatus.find((s) => s.status === "thinking");
  const rounds = [...new Set(messages.map((m) => m.round))];
  const lastTest = [...messages].reverse().find((m) => m.tested)?.tested;
  const constraints = messages.filter((m) => m.constraint).length;
  // The baseline run's own column (the run row), never summed in the browser,
  // and only once the run is done: a paused baseline's column is its current step's.
  const baseline = finalOf(session.activeRun)?.patientsAffected;

  return (
    <div className="panel">
      <div className="panel-h">
        <h2>Negotiation</h2>
        <span className="eyebrow ml-auto !tracking-[0.12em]">
          {roundState.state === "running" ? "In progress" : roundState.state.replaceAll("_", " ")}
        </span>
      </div>
      {roundState.detail && (
        <p role="status" className="num border-b border-line px-3.5 py-2 text-[10.5px] leading-snug text-ink-muted">
          {roundState.detail}
        </p>
      )}
      {messages.some((m) => m.fixture) && (
        <p className="num border-b border-line px-3.5 py-1.5 text-[10px] text-ink-faint">
          Test numbers in this round come from fixture files, not the engine.
        </p>
      )}

      <div className="scroll-quiet max-h-[520px] overflow-y-auto px-3.5 py-2">
        {!session.messages.length && (
          <p className="num py-6 text-center text-[11px] text-ink-faint">
            No agent messages yet. Agents stay idle while the attack runs; press Create aggregate fix when it has finished or is paused.
          </p>
        )}
        {rounds.map((r) => (
          <div key={r}>
            <div className="num pb-1 pt-3 text-[9.5px] uppercase tracking-[0.08em] text-accent">Round {r}</div>
            {messages
              .filter((m) => m.round === r)
              .map((m) => (
                <Message key={m.seq} m={m} index={index} />
              ))}
          </div>
        ))}
        {waiting > 0 && (
          <div className="num flex items-center gap-2 py-2.5 text-[10.5px] text-ink-faint">
            <span>
              {waiting} more message{waiting === 1 ? "" : "s"} coming, one at a time
            </span>
            <button onClick={showAll} className="ml-auto rounded border border-line2 px-2 py-0.5 text-ink-muted transition hover:border-accent hover:text-ink">
              Show all now
            </button>
          </div>
        )}
        {thinking && (
          <div className="num flex items-center gap-2 py-3 text-[10.5px] text-ink-faint">
            <AgentIcon who={thinking.agent} size={20} />
            {SPEAKER_NAME[thinking.agent]} is thinking
            <Dots />
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-px border-t border-line bg-line">
        <PlanCell label="Patients affected">
          {lastTest ? (
            <>
              {lastTest.patientsAffected}{" "}
              <small className="text-[11px] font-medium text-ink-faint">
                {baseline !== undefined ? `was ${baseline}` : `baseline ${notFinalYet(session.activeRun)}`}
              </small>
            </>
          ) : (
            "—"
          )}
        </PlanCell>
        <PlanCell label="Constraints added">{constraints}</PlanCell>
        <PlanCell label="Round">
          {roundState.round} <small className="text-[11px] font-medium text-ink-faint">of {roundState.maxRounds}</small>
        </PlanCell>
      </div>
    </div>
  );
}

function Message({ m, index }: { m: AgentMessageRow; index: SessionIndex }) {
  const shape = MESSAGE_SHAPE[m.type];
  const name = (id: string) => index.device.get(id)?.name ?? id;

  return (
    <div className="grid grid-cols-[22px_1fr] gap-2 border-b border-line/50 py-2 last:border-b-0">
      <AgentIcon who={m.from} size={20} />
      <div className="min-w-0">
        <div className="num text-[9.5px] uppercase tracking-[0.06em] text-ink-faint">
          <span className="text-ink">{shape.glyph}</span> {shape.label} · {SPEAKER_NAME[m.from]} → {SPEAKER_NAME[m.to]}
        </div>
        <p className="mt-0.5 text-[12.5px] leading-snug text-ink-muted">
          {m.reason}
          {m.source === "template" && <span className="num ml-1 text-[10px] text-ink-faint">(template text)</span>}
        </p>

        {m.constraint && (
          <span className="num mt-1.5 inline-block rounded border border-line2 bg-panel2 px-1.5 py-0.5 text-[10px] text-ink">
            {m.constraint.kind} · {m.constraint.targetIds.map(name).join(" → ")}
          </span>
        )}
        {m.rules && (
          <ul className="mt-1.5 space-y-1">
            {m.rules.map((r, i) => (
              <li key={i} className="rounded border border-line2 bg-panel2 px-2 py-1 text-[11.5px] text-ink-muted">
                {r}
              </li>
            ))}
          </ul>
        )}
        {m.diff && (
          <pre className="num mt-1.5 whitespace-pre-wrap rounded border border-line2 bg-bg px-2 py-1 text-[10.5px] text-ink">
            {m.diff.join("\n")}
          </pre>
        )}
        {m.tested && (
          <span className="num mt-1.5 inline-block rounded bg-panel2 px-1.5 py-0.5 text-[10px] text-ink-muted">
            ✓ tested · {m.tested.patientsAffected} patients affected
          </span>
        )}
      </div>
    </div>
  );
}

function PlanCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-panel px-3 py-2.5">
      <div className="eyebrow !text-[9.5px] !tracking-[0.1em]">{label}</div>
      <div className="mt-0.5 font-disp text-lg font-semibold tabular-nums">{children}</div>
    </div>
  );
}

function Recommendations({ session, index }: { session: SessionSnapshot; index: SessionIndex }) {
  const recs = session.recommendations.slice(0, 3);
  // Compared with the baseline's result only once the baseline has finished playing.
  const baseline = finalOf(session.activeRun)?.patientsAffected;
  const baselineNote = baseline === undefined ? `baseline ${notFinalYet(session.activeRun)}` : undefined;
  return (
    <div className="panel">
      <div className="panel-h">
        <h2>Recommendations</h2>
        <span className="num ml-auto rounded-full bg-panel2 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
          Humans approve
        </span>
      </div>
      {recs.map((rec) => (
        <RecommendationCard
          key={rec.id}
          rec={rec}
          baseline={baseline}
          baselineNote={baselineNote}
          index={index}
          blocked={showBlocker(session, rec.id)}
          onShow={() => session.actions.showSolution(rec.id)}
        />
      ))}
      {!recs.length && (
        <p className="num p-3.5 text-[11.5px] leading-relaxed text-ink-faint">
          {session.roundState.state === "done"
            ? "No recommendation came out of this round."
            : "Up to three recommendations appear here when a round ends, each with its rules, tested numbers, every agent's verdict, the roles that must sign off, and Show the solution."}
        </p>
      )}
    </div>
  );
}

// Driven by an agent_status row of "thinking".
function Dots() {
  return (
    <span className="ml-1 inline-flex gap-0.5 align-middle" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span key={i} className="h-1 w-1 animate-pulse rounded-full bg-current" style={{ animationDelay: `${i * 200}ms` }} />
      ))}
    </span>
  );
}
