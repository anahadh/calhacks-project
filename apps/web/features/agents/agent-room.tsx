"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SessionIndex } from "@/lib/stdb/use-session";
import type { AgentMessageRow, SessionSnapshot, Speaker } from "@/lib/stdb/types";
import { RecommendationCard } from "@/features/policy/card-body";
import { showBlocker } from "@/features/solution/pair";
import { AgentGlyph } from "./agent-icon";
import { SPEAKER_COLOR, SPEAKER_LABEL } from "./agents";
import { DefendButton } from "./defend-button";
import { RevealClock } from "./reveal";
import { createdMs, elapsedLabel, entryOf, statusLine, type TimedMessage } from "./transcript";

/**
 * The Agent Room: a modal over the simulation. Left, the five parties as a
 * node graph with the line of whoever is talking lit; right, the transcript,
 * one entry per agent_message row, revealed at a readable pace; below, the
 * state of the round and Review recommendation. Renders agent_message,
 * agent_status, session.round_state and recommendation rows only.
 */
export function AgentRoom({ session, index, onClose }: { session: SessionSnapshot; index: SessionIndex; onClose?: () => void }) {
  const { messages, roundState, recommendations } = session;
  const shown = useRevealed(messages);
  const newest = shown[shown.length - 1];
  const speaking = new Set<Speaker>(session.agentStatus.filter((s) => s.status === "speaking" || s.status === "thinking").map((s) => s.agent));
  if (newest) speaking.add(newest.from);
  const rec = recommendations[0];

  // Without an onClose, fall back to the session view's own "1" shortcut (switches to Simulation).
  const close = () => (onClose ? onClose() : window.dispatchEvent(new KeyboardEvent("keydown", { key: "1", bubbles: true })));
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (onClose) onClose();
      else window.dispatchEvent(new KeyboardEvent("keydown", { key: "1", bubbles: true }));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-bg/80 p-4 backdrop-blur-[2px] md:p-8" role="dialog" aria-modal="true" aria-labelledby="agent-room-title">
      <div className="flex h-full w-full max-w-[1760px] flex-col rounded-panel border border-line bg-panel shadow-overlay">
        <header className="relative flex min-h-[96px] items-center justify-center border-b border-line px-6">
          <h1 id="agent-room-title" className="text-[30px] font-normal tracking-[-0.01em] text-ink">
            Creating a segmentation plan
          </h1>
          <button
            type="button"
            onClick={close}
            aria-label="Close the Agent Room"
            className="ctl absolute right-6 top-1/2 h-14 min-w-[56px] -translate-y-1/2 text-ink"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
              <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="grid min-h-0 flex-1 lg:grid-cols-2">
          <section aria-label="Who is talking" className="relative min-h-[320px] border-b border-line lg:border-b-0 lg:border-r">
            <Graph newest={newest} speaking={speaking} />
          </section>

          <section aria-label="Transcript" className="flex min-h-0 flex-col p-6">
            <div className="flex min-h-[44px] flex-wrap items-center gap-5">
              <span className="eyebrow">Now talking</span>
              {newest ? (
                <span className="inline-flex h-11 items-center gap-3 rounded-ctl border border-line2 bg-panel2 px-4 text-[17px]">
                  <Party who={newest.from} />
                  <svg width="22" height="12" viewBox="0 0 22 12" aria-hidden className="text-ink-faint">
                    <path d="M1 6h19M15 1l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {newest.to === "all" ? <span className="text-ink-muted">everyone</span> : <Party who={newest.to} />}
                </span>
              ) : (
                <span className="num text-[13px] text-ink-faint">No one yet</span>
              )}
            </div>
            <Transcript messages={shown} index={index} />
          </section>
        </div>

        <footer className="flex min-h-[88px] flex-wrap items-center justify-between gap-4 border-t border-line px-6 py-4">
          <p role="status" className="m-0 text-[17px] text-ink-muted">
            {statusLine(roundState, recommendations, messages.length > 0)}
            {messages.some((m) => m.fixture) && <span className="num ml-3 text-[11px] text-ink-faint">Test numbers come from fixture files, not hippo-sim.</span>}
          </p>
          {rec ? (
            <RecommendationCard rec={rec} index={index} blocked={showBlocker(session, rec.id)} onShow={() => session.actions.showSolution(rec.id)} />
          ) : roundState.state === "idle" && !messages.length ? (
            <div className="w-[280px]">
              <DefendButton session={session} />
            </div>
          ) : null}
        </footer>
      </div>
    </div>
  );
}

/**
 * Paces the thread: rows already there when this tab opened show at once, later
 * rows one every REVEAL_MS in seq order (UX rule 5). Returns the rows on screen,
 * each with the moment this tab showed it as a fallback clock.
 */
function useRevealed(messages: readonly AgentMessageRow[]): (TimedMessage & { revealedAt?: number })[] {
  const clock = useRef(new RevealClock());
  const [now, setNow] = useState(() => Date.now());
  const seqs = messages.map((m) => m.seq).join(",");

  useEffect(() => {
    const t = Date.now();
    clock.current.observe(messages.map((m) => m.seq), t);
    setNow(t);
  }, [seqs]); // keyed on the seq list, so a re-rendered but unchanged thread observes nothing new

  useEffect(() => {
    const next = clock.current.nextAt(now);
    if (next === undefined) return;
    const id = window.setTimeout(() => setNow(Date.now()), Math.max(0, next - now));
    return () => window.clearTimeout(id);
  }, [now, seqs]);

  return useMemo(
    () =>
      messages
        .filter((m) => clock.current.shown(m.seq, now))
        .map((m) => {
          const at = clock.current.shownAt(m.seq);
          return { ...m, revealedAt: at !== undefined && Number.isFinite(at) ? at : undefined };
        }),
    [messages, now],
  );
}

function Party({ who }: { who: Speaker }) {
  return (
    <span className="inline-flex items-center gap-2" style={{ color: SPEAKER_COLOR[who] }}>
      <AgentGlyph who={who} size={16} />
      {SPEAKER_LABEL[who]}
    </span>
  );
}

// --- The node graph. Positions are fixed; only the rows decide what lights up. ---

const NODE: Record<Speaker, { x: number; y: number; r: number }> = {
  flow: { x: 320, y: 70, r: 38 },
  inventory: { x: 90, y: 185, r: 38 },
  clinical_workflow: { x: 550, y: 185, r: 38 },
  coordinator: { x: 320, y: 300, r: 44 },
  humans: { x: 550, y: 322, r: 38 },
};
const SPOKES: Speaker[] = ["flow", "inventory", "clinical_workflow", "humans"];

function Graph({ newest, speaking }: { newest: AgentMessageRow | undefined; speaking: Set<Speaker> }) {
  const from = newest?.from;
  const to = newest?.to;
  const lit = (a: Speaker, b: Speaker) =>
    !!newest && ((from === a && (to === b || to === "all")) || (from === b && (to === a || to === "all")));
  const litColor = from ? SPEAKER_COLOR[from] : SPEAKER_COLOR.coordinator;
  // A message between two spokes (no coordinator end) gets its own lit line, since the row says so.
  const extra = newest && from !== "coordinator" && to !== "coordinator" && to !== "all" ? [from!, to as Speaker] : undefined;

  return (
    <svg viewBox="0 0 640 400" className="absolute inset-0 h-full w-full" role="img" aria-label="Agents and humans around the Sign-off Coordinator">
      <style>{`@keyframes agent-room-dash { to { stroke-dashoffset: -16; } }`}</style>
      {SPOKES.map((s) => (
        <Edge key={s} a="coordinator" b={s} lit={lit("coordinator", s)} color={litColor} />
      ))}
      {extra && <Edge a={extra[0]} b={extra[1]} lit color={litColor} />}
      {(Object.keys(NODE) as Speaker[]).map((who) => (
        <Node key={who} who={who} glow={speaking.has(who)} />
      ))}
    </svg>
  );
}

function Edge({ a, b, lit, color }: { a: Speaker; b: Speaker; lit: boolean; color: string }) {
  const p = NODE[a];
  const q = NODE[b];
  return (
    <line
      x1={p.x}
      y1={p.y}
      x2={q.x}
      y2={q.y}
      stroke={lit ? color : "#3E4448"}
      strokeWidth={lit ? 1.5 : 1}
      strokeDasharray={lit ? "5 5" : undefined}
      style={lit ? { animation: "agent-room-dash 600ms linear infinite" } : undefined}
    />
  );
}

function Node({ who, glow }: { who: Speaker; glow: boolean }) {
  const { x, y, r } = NODE[who];
  const color = SPEAKER_COLOR[who];
  const ring = who === "humans" ? "#7D858B" : color;
  const size = who === "coordinator" ? 26 : 22;
  return (
    <g>
      {glow && <circle cx={x} cy={y} r={r + 12} fill={ring} opacity={0.12} />}
      <circle cx={x} cy={y} r={r} fill="#131618" stroke={ring} strokeWidth={1.5} />
      <circle cx={x} cy={y} r={r} fill={ring} opacity={0.1} />
      <g transform={`translate(${x - size / 2} ${y - size / 2})`} style={{ color: who === "humans" ? "#E9ECEE" : color }}>
        <AgentGlyph who={who} size={size} strokeWidth={1.3} />
      </g>
      <title>{SPEAKER_LABEL[who]}</title>
    </g>
  );
}

// --- The transcript: one entry per row, newest marked, scrolled to the newest. ---

function Transcript({ messages, index }: { messages: readonly (TimedMessage & { revealedAt?: number })[]; index: SessionIndex }) {
  const list = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const el = list.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  // The round clock starts at the first message's created_at, or when this tab first showed one.
  const times = messages.map((m) => createdMs(m) ?? m.revealedAt);
  const start = Math.min(...times.filter((t): t is number => t !== undefined), Infinity);

  return (
    <ol ref={list} className="scroll-quiet mt-5 min-h-0 flex-1 list-none overflow-y-auto rounded-panel border border-line bg-bg p-0">
      {!messages.length && (
        <li className="num px-5 py-8 text-[13px] text-ink-faint">No messages yet. The Sign-off Coordinator opens the round after Create segmentation plan.</li>
      )}
      {messages.map((m, i) => {
        const e = entryOf(m, index);
        const t = times[i];
        const last = i === messages.length - 1;
        return (
          <li
            key={m.seq}
            className={`grid grid-cols-[88px_minmax(0,1fr)] gap-x-3 border-l-[3px] px-4 py-3 ${last ? "border-l-[#3DD68C] bg-select-wash" : "border-l-transparent"}`}
          >
            <span className="num pt-px text-[15px] text-ink-faint">{elapsedLabel(t === undefined || start === Infinity ? undefined : t - start)}</span>
            <div className="min-w-0">
              <div className="num text-[15px] leading-7">
                <span style={{ color: SPEAKER_COLOR[m.from] }}>{SPEAKER_LABEL[m.from]}</span>
                <span className="text-ink-faint"> → </span>
                <span style={{ color: SPEAKER_COLOR[m.to] }}>{SPEAKER_LABEL[m.to]}</span>
              </div>
              <div className="num text-[15px] leading-7 text-ink">{e.subject}</div>
              {e.detail && <div className="num text-[15px] leading-7 text-ink-muted">{e.detail}</div>}
              {e.quote && (
                <p className="m-0 text-[17px] leading-7 text-ink">
                  “{e.quote}”
                  {e.template && <span className="num ml-2 text-[11px] text-ink-faint">template text</span>}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
