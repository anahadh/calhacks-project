"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AgentId } from "@/lib/stdb/types";
import type { ReactNode } from "react";
import { AgentGlyph } from "./agent-icon";
import { SPEAKER_COLOR, SPEAKER_LABEL } from "./agents";
import { DemoScene } from "./demo-scene";
import { demoScript, eventsFromRows, reopenedFromRows, type DemoEvent, type Verb } from "./demo-script";
import type { Names } from "./negotiation";
import { RevealClock } from "./reveal";
import { createdMs, elapsedLabel, entryOf } from "./transcript";
import type { AgentMessageRow, RoundState } from "@/lib/stdb/types";

// The scripted negotiation, top and center: a web of the four agents around the
// Coordinator, a particle travelling along the edge each message takes and the
// sender pulsing, and in sync below, a feed of one short contribution per agent.
// Labeled "Scripted demo": it is a script (demo-script.ts), not agent rows.

const STEP_MS = 2400;

type Who = AgentId | "humans";
const NODE: Record<Who, { x: number; y: number; r: number }> = {
  coordinator: { x: 320, y: 150, r: 40 },
  flow: { x: 320, y: 36, r: 32 },
  inventory: { x: 110, y: 200, r: 32 },
  clinical_workflow: { x: 530, y: 200, r: 32 },
  humans: { x: 320, y: 270, r: 26 },
};

const VERB: Record<Verb, { label: string; color: string; glyph: string }> = {
  opens: { label: "opens the round", color: "#A1A8AE", glyph: "▷" },
  proposes: { label: "suggests a plan", color: "#4DB0FF", glyph: "◆" },
  revises: { label: "improves the plan", color: "#4DB0FF", glyph: "↻" },
  declines: { label: "says no", color: "#FF5C5C", glyph: "✕" },
  approves: { label: "approves", color: "#3DD68C", glyph: "●" },
  asks: { label: "asks a human", color: "#F2C14E", glyph: "?" },
  recommends: { label: "sends for sign-off", color: "#3DD68C", glyph: "■" },
};

export function DemoRoom({ onClose, options, status }: { onClose?: () => void; options?: ReactNode; status?: string }) {
  const [script, setScript] = useState<DemoEvent[]>(() => demoScript());
  const [shown, setShown] = useState(0);
  const [playing, setPlaying] = useState(true);
  useEffect(() => {
    if (!playing || shown >= script.length) return;
    const id = window.setTimeout(() => setShown((n) => n + 1), shown === 0 ? 600 : STEP_MS);
    return () => window.clearTimeout(id);
  }, [playing, shown, script.length]);
  const done = shown >= script.length;
  return (
    <NegotiationRoom
      events={script.slice(0, shown)}
      done={done}
      subtitle={`Round ${script[Math.max(0, shown - 1)]?.round ?? 1} of 3 · ${done ? "agreed" : "negotiating"}`}
      badge="Scripted demo"
      controls={
        <>
          {!done && <button type="button" onClick={() => setPlaying((p) => !p)} className="ctl h-9 px-3 text-[13px]">{playing ? "Pause" : "Play"}</button>}
          {!done && <button type="button" onClick={() => setShown(script.length)} className="ctl h-9 px-3 text-[13px]">Skip to result</button>}
          {done && <button type="button" onClick={() => { setScript(demoScript()); setShown(0); setPlaying(true); }} className="ctl h-9 px-3 text-[13px]">Replay</button>}
        </>
      }
      onClose={onClose}
      options={options}
      status={status}
    />
  );
}

/**
 * The same room on the live round: the session's agent_message rows, revealed one every
 * few seconds so each can be read (UX rule 5), with the real recommendation at the end.
 */
export function LiveNegotiationRoom({ messages, roundState, names, onClose, options, status }: {
  messages: readonly AgentMessageRow[];
  roundState: RoundState;
  names: Names;
  onClose?: () => void;
  options?: ReactNode;
  status?: string;
}) {
  const clock = useRef(new RevealClock());
  const [now, setNow] = useState(() => Date.now());
  const seqs = messages.map((m) => m.seq).join(",");
  useEffect(() => {
    const t = Date.now();
    clock.current.observe(messages.map((m) => m.seq), t);
    setNow(t);
  }, [seqs]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const next = clock.current.nextAt(now);
    if (next === undefined) return;
    const id = window.setTimeout(() => setNow(Date.now()), Math.max(0, next - now));
    return () => window.clearTimeout(id);
  }, [now, seqs]);
  const shownRows = useMemo(() => messages.filter((m) => clock.current.shown(m.seq, now)), [messages, now]);
  const events = useMemo(() => eventsFromRows(shownRows, names), [shownRows, names]);
  const reopened = useMemo(() => reopenedFromRows(shownRows), [shownRows]);
  const revealing = shownRows.length < messages.length;
  const done = !revealing && roundState.state === "done";
  const round = events[events.length - 1]?.round ?? roundState.round ?? 1;
  const skip = () => { const t = Date.now(); clock.current.flush(t); setNow(t); };
  return (
    <NegotiationRoom
      events={events}
      done={done}
      reopened={reopened}
      subtitle={`Round ${Math.max(1, round)} of ${roundState.maxRounds} · ${done ? (roundState.detail?.startsWith("No agreement") ? "no agreement" : "agreed") : roundState.state === "waiting_for_human" && !revealing ? "waiting for a human" : roundState.state === "idle" && !messages.length ? "idle" : "negotiating"}`}
      badge={roundState.detail?.startsWith("Cached run") ? "Cached run" : undefined}
      controls={revealing ? <button type="button" onClick={skip} className="ctl h-9 px-3 text-[13px]">Skip to result</button> : null}
      onClose={onClose}
      options={options}
      status={status}
      chat={{ rows: shownRows, names }}
    />
  );
}

function NegotiationRoom({ events, done, reopened, subtitle, badge, controls, onClose, options, status, chat }: {
  events: DemoEvent[];
  done: boolean;
  reopened?: string[];
  /** Live only: the real rows behind the cards, for the Full chat tab. */
  chat?: { rows: readonly AgentMessageRow[]; names: Names };
  subtitle: string;
  badge?: string;
  controls?: ReactNode;
  onClose?: () => void;
  options?: ReactNode;
  status?: string;
}) {
  const feed = useRef<HTMLOListElement>(null);
  useEffect(() => {
    feed.current?.scrollTo({ top: feed.current.scrollHeight, behavior: "smooth" });
  }, [events.length]);
  const newest = events[events.length - 1];
  const plans = useMemo(() => events.filter((e) => e.plan).map((e) => e.plan!), [events]);
  const [tab, setTab] = useState<"cards" | "chat">("cards");

  return (
    <div className="flex h-full w-full flex-col rounded-panel border border-line bg-panel shadow-overlay">
      <header className="flex min-h-[72px] flex-wrap items-center justify-between gap-4 border-b border-line px-6 py-3">
        <div>
          <h1 className="m-0 text-[24px] font-normal tracking-[-0.01em] text-ink">Agents negotiating the plan</h1>
          <div className="num mt-0.5 text-[12px] text-ink-faint">{subtitle}</div>
        </div>
        <div className="flex items-center gap-2">
          {badge && (
            <span className="num inline-flex h-9 items-center rounded-ctl border border-state-delayed/60 px-3 text-[13px] text-state-delayed">{badge}</span>
          )}
          {controls}
          {onClose && (
            <button type="button" onClick={onClose} aria-label="Close" className="ctl h-9 min-w-[40px] text-ink">✕</button>
          )}
        </div>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className="grid min-h-0 grid-rows-[300px_minmax(0,1fr)] border-b border-line lg:border-b-0 lg:border-r">
          <section aria-label="Who is talking" className="relative border-b border-line">
            <Web newest={newest} />
          </section>
          <section aria-label="Contributions" className="flex min-h-0 flex-col">
            {chat && (
              <div role="tablist" aria-label="View" className="flex gap-1 px-5 pt-3">
                <button type="button" role="tab" aria-selected={tab === "cards"} onClick={() => setTab("cards")} className={`h-9 rounded-ctl px-3 text-[14px] ${tab === "cards" ? "bg-select-wash text-ink" : "text-ink-muted hover:text-ink"}`}>
                  Contributions
                </button>
                <button type="button" role="tab" aria-selected={tab === "chat"} onClick={() => setTab("chat")} className={`h-9 rounded-ctl px-3 text-[14px] ${tab === "chat" ? "bg-select-wash text-ink" : "text-ink-muted hover:text-ink"}`}>
                  Full chat <span className="num text-ink-faint">{chat.rows.length}</span>
                </button>
              </div>
            )}
            {chat && tab === "chat" ? (
              <TerminalLog rows={chat.rows} names={chat.names} />
            ) : (
              <ol ref={feed} className="scroll-quiet m-0 flex min-h-0 flex-1 list-none flex-col gap-2 overflow-y-auto p-5">
                {events.map((e, i) => (
                  <Bubble key={e.seq} e={e} fresh={i === events.length - 1} />
                ))}
                {!events.length && <li className="num text-[13px] text-ink-faint">{status ?? "Waiting for the Coordinator to open the round…"}</li>}
              </ol>
            )}
          </section>
        </div>
        <section aria-label="The plan on the hospital" className="relative min-h-[420px]">
          <DemoScene plan={plans.length} infected={plans[plans.length - 1]?.devices ?? 9} reopened={reopened} />
          {plans.length > 0 && <PlanTrail plans={plans} />}
        </section>
      </div>
      {done && (
        <footer className="border-t border-line px-6 py-4">
          {options ?? <p role="status" className="num m-0 text-[14px] text-ink-muted">{status ?? "The agents are finalizing the plan…"}</p>}
        </footer>
      )}
    </div>
  );
}

function Web({ newest }: { newest?: DemoEvent }) {
  const from = newest?.agent;
  const to = newest?.to;
  const color = from ? SPEAKER_COLOR[from] : SPEAKER_COLOR.coordinator;
  const verb = newest ? VERB[newest.verb] : undefined;
  return (
    <svg viewBox="0 0 640 300" className="absolute inset-0 h-full w-full" role="img" aria-label="The agents around the Coordinator">
      <style>{`@keyframes demo-dash { to { stroke-dashoffset: -16; } } @keyframes demo-pulse { 0%,100% { r: 44 } 50% { r: 52 } }`}</style>
      {(["flow", "inventory", "clinical_workflow", "humans"] as Who[]).map((w) => {
        const lit = !!newest && ((from === "coordinator" && to === w) || (from === w && to === "coordinator"));
        const a = NODE.coordinator;
        const b = NODE[w];
        return (
          <line key={w} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={lit ? color : "#3E4448"} strokeWidth={lit ? 2 : 1} strokeDasharray={lit ? "6 6" : undefined} style={lit ? { animation: "demo-dash 500ms linear infinite" } : undefined} />
        );
      })}
      {newest && from && to && (
        <circle key={newest.seq} r={6} fill={color}>
          <animateMotion dur="0.9s" fill="freeze" path={`M${NODE[from].x},${NODE[from].y} L${NODE[to].x},${NODE[to].y}`} />
          <animate attributeName="opacity" values="1;1;0" keyTimes="0;0.85;1" dur="0.9s" fill="freeze" />
        </circle>
      )}
      {(Object.keys(NODE) as Who[]).map((w) => {
        const { x, y, r } = NODE[w];
        const c = w === "humans" ? "#E9ECEE" : SPEAKER_COLOR[w];
        const active = from === w;
        return (
          <g key={w}>
            {active && <circle cx={x} cy={y} r={r + 10} fill={c} opacity={0.16} style={{ animation: "demo-pulse 1.2s ease-in-out infinite" }} />}
            <circle cx={x} cy={y} r={r} fill="#131618" stroke={c} strokeWidth={active ? 2.5 : 1.5} />
            <circle cx={x} cy={y} r={r} fill={c} opacity={0.1} />
            {w !== "humans" && (
              <g transform={`translate(${x - 12} ${y - 12})`} style={{ color: c }}>
                <AgentGlyph who={w} size={24} strokeWidth={1.3} />
              </g>
            )}
            {w === "humans" && <text x={x} y={y + 4} textAnchor="middle" className="fill-[#E9ECEE] font-mono text-[11px]">YOU</text>}
            <text x={x} y={y + r + 16} textAnchor="middle" className="font-mono text-[11px]" style={{ fill: active ? c : "#7D858B" }}>
              {w === "humans" ? "HUMANS" : SPEAKER_LABEL[w].replace(" Agent", "").toUpperCase()}
            </text>
            {active && verb && (
              <g transform={`translate(${x > 320 ? x - r - 10 - (verb.label.length * 7.4 + 22) : x + r + 10} ${y - 10})`}>
                <g className="fx-pop">
                  <rect x={0} y={0} width={verb.label.length * 7.4 + 22} height={20} rx={4} fill="#0D0F10" stroke={verb.color} />
                  <text x={11 + (verb.label.length * 7.4) / 2} y={14} textAnchor="middle" className="font-mono text-[11px]" style={{ fill: verb.color }}>
                    {verb.glyph} {verb.label}
                  </text>
                </g>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** The plans so far, top right: each one's machines and patients, falling. */
function PlanTrail({ plans }: { plans: NonNullable<DemoEvent["plan"]>[] }) {
  return (
    <ol className="absolute right-4 top-4 m-0 flex list-none flex-col gap-1.5 p-0">
      {plans.map((p, i) => {
        const prev = plans[i - 1];
        return (
          <li key={i} className="fx-pop num flex items-center gap-3 rounded-ctl border border-line2 bg-bg/90 px-3 py-1.5 text-[12px]">
            <span className="text-ink-faint">Plan {i + 1}</span>
            <span className="text-ink">{p.name}</span>
            <Num label="machines" value={p.devices} prev={prev?.devices} />
            <Num label="patients" value={p.patients} prev={prev?.patients} />
          </li>
        );
      })}
    </ol>
  );
}

function Num({ label, value, prev }: { label: string; value: number; prev?: number }) {
  const better = prev !== undefined && value < prev;
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className={`readout text-[18px] leading-none ${better ? "text-state-healthy" : "text-ink"}`}>{value}</span>
      <span className="text-ink-faint">{label}</span>
      {better && <span className="text-state-healthy">↓{prev - value}</span>}
    </span>
  );
}

function Bubble({ e, fresh }: { e: DemoEvent; fresh: boolean }) {
  const v = VERB[e.verb];
  const c = SPEAKER_COLOR[e.agent];
  return (
    <li className={`grid grid-cols-[32px_minmax(0,1fr)] items-start gap-3 rounded-panel border px-4 py-3 ${fresh ? "fx-pop border-line2 bg-select-wash" : "border-line"}`}>
      <span className="grid h-8 w-8 place-items-center rounded-full border" style={{ borderColor: c, color: c }}>
        <AgentGlyph who={e.agent} size={16} />
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[14px] font-medium" style={{ color: c }}>{SPEAKER_LABEL[e.agent]}</span>
          <span className="num inline-flex h-6 items-center gap-1 rounded-ctl border px-2 text-[11px]" style={{ borderColor: `${v.color}66`, color: v.color, background: `${v.color}14` }}>
            <span aria-hidden>{v.glyph}</span>
            {v.label}
          </span>
          <span className="num text-[11px] text-ink-faint">round {e.round}</span>
        </div>
        <p className="m-0 mt-1 text-[15px] leading-6 text-ink">{e.line}</p>
        {e.plan && (
          <div className="num mt-2 flex flex-wrap gap-1.5 text-[11px]">
            <Chip tone="info">{e.plan.name}</Chip>
            <Chip tone="ok">{e.plan.devices} machines compromised</Chip>
            <Chip tone="ok">{e.plan.patients} patients affected</Chip>
            {e.plan.cuts !== undefined && <Chip tone="info">{e.plan.cuts} links cut</Chip>}
            <Chip tone="info">{e.plan.rules} rules</Chip>
          </div>
        )}
        {e.needs && (
          <div className="num mt-2 text-[12px] text-ink-muted">
            What it takes to get a yes: <span className="text-ink">{e.needs}</span>
          </div>
        )}
      </div>
    </li>
  );
}

/** The full chat as a terminal: every row, full text, mono and phosphor on black. */
function TerminalLog({ rows, names }: { rows: readonly AgentMessageRow[]; names: Names }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight });
  }, [rows.length]);
  const times = rows.map((m) => createdMs(m));
  const start = Math.min(...times.filter((t): t is number => t !== undefined), Infinity);
  return (
    <div ref={box} className="scroll-quiet mx-5 mb-5 mt-3 min-h-0 flex-1 overflow-y-auto rounded-panel border border-[#1F3A2A] bg-[#060907] p-4 font-mono text-[12.5px] leading-[1.55] text-[#9FE6B0]">
      <div className="text-[#4C8A5C]">hippocratech@agents:~$ tail -f agent_message.log</div>
      {rows.map((m) => {
        const e = entryOf(m, names);
        const t = times[rows.indexOf(m)];
        return (
          <div key={m.seq} className="mt-2 whitespace-pre-wrap break-words">
            <span className="text-[#4C8A5C]">[{elapsedLabel(t === undefined || start === Infinity ? undefined : t - start)}]</span>{" "}
            <span className="text-[#E6F5EA]">#{m.seq}</span>{" "}
            <span style={{ color: SPEAKER_COLOR[m.from] }}>{m.from}</span>
            <span className="text-[#4C8A5C]"> → </span>
            <span style={{ color: SPEAKER_COLOR[m.to] }}>{m.to}</span>{" "}
            <span className="text-[#E6F5EA]">{m.type}</span>
            {" · "}
            {e.subject}
            {e.detail && <div className="pl-6 text-[#6FB07F]">{e.detail}</div>}
            {e.quote && <div className="pl-6 text-[#D7F3DF]">“{e.quote}”{e.asi1 ? "  [asi1]" : e.template ? "  [template]" : "  [claude]"}</div>}
          </div>
        );
      })}
      <div className="mt-2 text-[#4C8A5C]">
        <span className="animate-pulse">▌</span>
      </div>
    </div>
  );
}

const TONE = { info: "border-line2 text-ink-muted", ok: "border-[#3DD68C66] bg-[#3DD68C14] text-[#3DD68C]" } as const;
function Chip({ tone, children }: { tone: keyof typeof TONE; children: React.ReactNode }) {
  return <span className={`inline-flex h-6 items-center rounded-ctl border px-2 ${TONE[tone]}`}>{children}</span>;
}
