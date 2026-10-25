"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { SessionIndex } from "@/lib/stdb/use-session";
import type { AgentMessageRow, AgentStatusRow, RecommendationRow, RoundState, SessionSnapshot, Speaker } from "@/lib/stdb/types";
import { RecommendationCard } from "@/features/policy/card-body";
import { showBlocker } from "@/features/solution/pair";
import { AgentGlyph } from "./agent-icon";
import { SPEAKER_COLOR, SPEAKER_LABEL } from "./agents";
import { DefendButton } from "./defend-button";
import { coordinatorStamp, lanesOf, needsLabel, negotiationOf, REVIEWERS, type ConstraintChip, type Lane, type Names, type PlanColumn, type Stamp } from "./negotiation";
import { RevealClock } from "./reveal";
import { createdMs, elapsedLabel, entryOf, statusLine, type TimedMessage } from "./transcript";


/**
 * The Agent Room for a session: a modal over the simulation, with the
 * recommendation (or Create segmentation plan) in its footer. Renders
 * agent_message, agent_status, session.round_state and recommendation rows only.
 */
export function AgentRoom({ session, index, onClose }: { session: SessionSnapshot; index: SessionIndex; onClose?: () => void }) {
  const { messages, roundState, recommendations } = session;
  const newest = recommendations.filter((r) => r.round === recommendations[0]?.round);
  const close = () => (onClose ? onClose() : window.dispatchEvent(new KeyboardEvent("keydown", { key: "1", bubbles: true })));
  return (
    <AgentRoomFrame
      variant="modal"
      title="Creating a segmentation plan"
      messages={messages}
      agentStatus={session.agentStatus}
      roundState={roundState}
      status={statusLine(roundState, recommendations, messages.length > 0)}
      names={index}
      onClose={close}
      options={
        newest.length ? (
          <OptionCards
            recs={newest}
            review={(rec) => (
              <RecommendationCard rec={rec} index={index} blocked={showBlocker(session, rec.id)} onShow={() => session.actions.showSolution(rec.id)} />
            )}
          />
        ) : undefined
      }
      footer={
        roundState.state === "idle" && !messages.length ? (
          <div className="w-[280px]">
            <DefendButton session={session} />
          </div>
        ) : null
      }
    />
  );
}

/**
 * The room itself, for a session (the modal above) or for a round started from
 * ASI:One chat (app/room). Left: who is talking, as a graph with a particle per
 * message, and the constraints the rejections added. Right: the negotiation as a
 * table (one column per plan, one row per reviewing agent), or the transcript.
 */
export function AgentRoomFrame(props: {
  variant: "modal" | "page";
  title: string;
  subtitle?: ReactNode;
  messages: readonly AgentMessageRow[];
  agentStatus: readonly AgentStatusRow[];
  roundState: RoundState;
  status: string;
  names: Names;
  footer?: ReactNode;
  /** The recommendations humans choose between, shown across the room once published. */
  options?: ReactNode;
  onClose?: () => void;
}) {
  const { variant, messages, roundState, names, onClose } = props;
  const { shown, skip } = useRevealed(messages);
  const newest = shown[shown.length - 1];
  // The rows may already say "done" while this tab is still revealing the thread one message at a
  // time (UX rule 5). Until the last row is on screen, the room reads as still negotiating: no
  // recommendation, no "done" chip, and the round chip follows the newest revealed message.
  const revealing = shown.length < messages.length;
  const liveRound: RoundState = revealing
    ? { ...roundState, state: "running", round: Math.max(roundState.round, newest?.round ?? 1), detail: undefined }
    : roundState;
  const status = revealing ? "Agents are negotiating…" : props.status;
  // A replayed recording (rule 14's one exception) says so on every message and in the round detail.
  const cached = !!roundState.detail?.startsWith("Cached run") || messages.some((m) => m.reason?.startsWith("Cached run · "));
  const speaking = new Set<Speaker>(props.agentStatus.filter((s) => s.status === "speaking" || s.status === "thinking").map((s) => s.agent));
  if (newest) speaking.add(newest.from);
  const thinking = new Set(props.agentStatus.filter((s) => s.status === "thinking").map((s) => s.agent));
  const { plans, constraints } = useMemo(() => negotiationOf(shown, names), [shown, names]);
  const lanes = useMemo(() => lanesOf(shown, props.agentStatus, liveRound), [shown, props.agentStatus, liveRound]);
  // Which plan each published recommendation is: option number by (round, plan name).
  const options = new Map(shown.filter((m) => m.type === "recommendation").map((m) => [`${m.round}:${m.name}`, m.option ?? 1]));
  const optionOf = (p: PlanColumn) => options.get(`${p.round}:${p.name}`);
  const viaAsi1 = messages.some((m) => m.type === "chat");
  const [tab, setTab] = useState<"table" | "transcript">("table");

  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const panel = (
    <div className={`flex w-full flex-col rounded-panel border border-line bg-panel ${variant === "modal" ? "h-full max-w-[1760px] shadow-overlay" : "min-h-[calc(100vh-32px)]"}`}>
      <header className="relative flex min-h-[88px] flex-wrap items-center justify-between gap-4 border-b border-line px-6 py-4">
        <div className="min-w-0">
          <h1 id="agent-room-title" className="m-0 text-[28px] font-normal tracking-[-0.01em] text-ink">
            {props.title}
          </h1>
          {props.subtitle && <div className="num mt-1 text-[13px] text-ink-faint">{props.subtitle}</div>}
        </div>
        <div className="flex items-center gap-3">
          {revealing && (
            <button type="button" onClick={skip} className="num inline-flex h-9 items-center gap-2 rounded-ctl border border-line2 px-3 text-[13px] text-ink-muted hover:text-ink" title="Show every message that has already arrived">
              Skip to result
              <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden><path d="M3 3.5 9 8l-6 4.5zM11 3h2v10h-2z" fill="currentColor" /></svg>
            </button>
          )}
          <RoundChip round={liveRound} />
          {cached && (
            <span className="num inline-flex h-9 items-center rounded-ctl border border-state-delayed/60 px-3 text-[13px] text-state-delayed" title="A real round recorded earlier, replayed through the relay">
              Cached run
            </span>
          )}
          {onClose && (
            <button type="button" onClick={onClose} aria-label="Close the Agent Room" className="ctl h-12 min-w-[48px] text-ink">
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
                <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(340px,5fr)_minmax(0,8fr)]">
        <section aria-label="Who is talking" className="flex min-h-0 flex-col border-b border-line lg:border-b-0 lg:border-r">
          <div className="relative h-[300px] shrink-0 lg:h-[46%]">
            <Graph newest={newest} speaking={speaking} asi1={viaAsi1} />
          </div>
          <div className="flex min-h-[44px] flex-wrap items-center gap-3 border-t border-line px-5 py-3">
            <span className="eyebrow">Latest</span>
            {newest ? (
              <div className="flex min-w-0 flex-col gap-1">
                <span className="text-[15px] leading-6 text-ink">
                  <span style={{ color: SPEAKER_COLOR[newest.from] }}>{SPEAKER_LABEL[newest.from]}</span> {saidOf(newest, names)}
                </span>
                {newest.reason && newest.type !== "request" && (
                  <span className="line-clamp-2 text-[14px] leading-5 text-ink-muted">“{newest.reason}”</span>
                )}
              </div>
            ) : (
              <span className="num text-[13px] text-ink-faint">No one yet</span>
            )}
          </div>
          <ConstraintRail constraints={constraints} />
        </section>

        <section aria-label="Negotiation" className="flex min-h-0 flex-col p-5">
          <LanesStrip lanes={lanes} />
          <div role="tablist" aria-label="View" className="mt-4 flex gap-1">
            <Tab on={tab === "table"} onClick={() => setTab("table")}>Negotiation</Tab>
            <Tab on={tab === "transcript"} onClick={() => setTab("transcript")}>
              Transcript <span className="num text-ink-faint">{shown.length}</span>
            </Tab>
          </div>
          {tab === "table" ? (
            <NegotiationTable plans={plans} messages={shown} optionOf={optionOf} thinking={thinking} newestSeq={newest?.seq} running={liveRound.state === "running"} />
          ) : (
            <Transcript messages={shown} names={names} />
          )}
        </section>
      </div>

      {props.options && !revealing && <div className="border-t border-line px-6 py-4">{props.options}</div>}

      <footer className="flex min-h-[80px] flex-wrap items-center justify-between gap-4 border-t border-line px-6 py-4">
        <p role="status" className="m-0 text-[16px] text-ink-muted">
          {status}
          {messages.some((m) => m.fixture) && <span className="num ml-3 text-[11px] text-ink-faint">Test numbers come from fixture files, not hippo-sim.</span>}
        </p>
        {props.footer}
      </footer>
    </div>
  );

  if (variant === "page") return panel;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-bg/80 p-4 backdrop-blur-[2px] md:p-8" role="dialog" aria-modal="true" aria-labelledby="agent-room-title">
      {panel}
    </div>
  );
}

function RoundChip({ round }: { round: RoundState }) {
  const label =
    round.state === "idle" && !round.round
      ? "Idle"
      : `Round ${Math.max(round.round, 1)} of ${round.maxRounds} · ${round.state === "waiting_for_human" ? "waiting for a human" : round.state}`;
  return (
    <span className="num inline-flex h-9 items-center gap-2 rounded-ctl border border-line2 px-3 text-[13px] text-ink-muted">
      {round.state === "running" && <span className="h-2 w-2 animate-pulse rounded-full bg-[#3DD68C]" aria-hidden />}
      {label}
    </span>
  );
}

function Tab({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={on}
      onClick={onClick}
      className={`h-10 rounded-ctl px-4 text-[15px] ${on ? "bg-select-wash text-ink" : "text-ink-muted hover:text-ink"}`}
    >
      {children}
    </button>
  );
}

/**
 * Paces the thread: rows already there when this tab opened show at once, later
 * rows one every REVEAL_MS in seq order (UX rule 5). Returns the rows on screen,
 * each with the moment this tab showed it as a fallback clock.
 */
function useRevealed(messages: readonly AgentMessageRow[]): { shown: (TimedMessage & { revealedAt?: number })[]; skip: () => void } {
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

  const shown = useMemo(
    () =>
      messages
        .filter((m) => clock.current.shown(m.seq, now))
        .map((m) => {
          const at = clock.current.shownAt(m.seq);
          return { ...m, revealedAt: at !== undefined && Number.isFinite(at) ? at : undefined };
        }),
    [messages, now],
  );
  // Skip to result: show everything that has already arrived (the reader asked to skip ahead).
  const skip = () => {
    const t = Date.now();
    clock.current.flush(t);
    setNow(t);
  };
  return { shown, skip };
}

// --- The node graph. Positions are fixed; only the rows decide what lights up. ---

const NODE: Record<Speaker, { x: number; y: number; r: number }> = {
  flow: { x: 320, y: 64, r: 36 },
  inventory: { x: 96, y: 170, r: 36 },
  clinical_workflow: { x: 544, y: 170, r: 36 },
  coordinator: { x: 320, y: 270, r: 42 },
  humans: { x: 544, y: 336, r: 32 },
  asi1: { x: 96, y: 336, r: 32 },
};
const SPOKES: Speaker[] = ["flow", "inventory", "clinical_workflow", "humans", "asi1"];

function Graph({ newest, speaking, asi1 }: { newest: AgentMessageRow | undefined; speaking: Set<Speaker>; asi1: boolean }) {
  const from = newest?.from;
  const bubble = newest ? VERB[newest.type] : undefined;
  return (
    <svg viewBox="0 0 640 400" className="absolute inset-0 h-full w-full" role="img" aria-label="The orchestrator and the agents it calls">
      {SPOKES.map((s) => (
        <Edge key={s} a="coordinator" b={s} lit={false} color={SPEAKER_COLOR.coordinator} faint={s === "asi1" && !asi1} />
      ))}
      {(Object.keys(NODE) as Speaker[]).map((who) => (
        <Node key={who} who={who} glow={speaking.has(who)} dim={who === "asi1" && !asi1} />
      ))}
      {/* What the newest message is, said by its sender: a bubble beside the node, restarted by the row's seq. */}
      {newest && from && bubble && (
        <g key={newest.seq} transform={`translate(${NODE[from].x + (NODE[from].x > 320 ? -NODE[from].r - 8 : NODE[from].r + 8)} ${NODE[from].y - NODE[from].r - 6})`}>
          <g className="fx-pop">
          <rect x={NODE[from].x > 320 ? -(bubble.length * 7.2 + 18) : 0} y={-11} width={bubble.length * 7.2 + 18} height={22} rx={4} fill="#0D0F10" stroke={SPEAKER_COLOR[from]} strokeWidth={1} />
          <text x={NODE[from].x > 320 ? -(bubble.length * 7.2 + 18) / 2 : (bubble.length * 7.2 + 18) / 2} y={4} textAnchor="middle" className="font-mono text-[12px]" style={{ fill: SPEAKER_COLOR[from] }}>
            {bubble}
          </text>
          </g>
        </g>
      )}
      <text x={NODE.coordinator.x} y={NODE.coordinator.y + NODE.coordinator.r + 20} textAnchor="middle" className="fill-[#A1A8AE] font-mono text-[12px]">
        ORCHESTRATOR
      </text>
      <text x={NODE.asi1.x} y={NODE.asi1.y + NODE.asi1.r + 18} textAnchor="middle" className="fill-[#7D858B] font-mono text-[12px]">
        ASI:ONE
      </text>
      <text x={NODE.humans.x} y={NODE.humans.y + NODE.humans.r + 18} textAnchor="middle" className="fill-[#7D858B] font-mono text-[12px]">
        HUMANS
      </text>
    </svg>
  );
}

/** The verb on the bubble beside the sender's node. */
const VERB: Record<AgentMessageRow["type"], string> = {
  request: "opens the round",
  proposal: "proposes",
  revision: "revises",
  accept: "accepts",
  reject: "rejects",
  question: "asks a human",
  answer: "answers",
  recommendation: "recommends",
  chat: "chats",
};

/**
 * What a message did, in a sentence after the sender's name: "proposed “Strict” · 26 links cut",
 * "rejected it · needs: keep ER vitals, ICU vitals", "accepted it". From the row only.
 */
function saidOf(m: AgentMessageRow, names: Names): string {
  const device = (id: string) => names.device.get(id)?.name ?? id;
  const tested = m.tested ? ` · ${m.tested.devicesCompromised ?? "?"} ${m.tested.devicesCompromised === 1 ? "machine" : "machines"} compromised in the test` : "";
  switch (m.type) {
    case "request":
      return m.round > 1 ? `opened round ${m.round} and asked Flow to revise` : "opened the round and asked Flow for a plan";
    case "proposal":
      return m.from === "coordinator"
        ? `sent the plan to ${SPEAKER_LABEL[m.to].replace(" Agent", "")} to review`
        : `proposed ${m.name ? `“${m.name}”` : "a plan"}${m.rules?.length ? ` · ${m.rules.length} rules` : ""}${tested}`;
    case "revision":
      return m.from === "coordinator"
        ? `sent the revised plan to ${SPEAKER_LABEL[m.to].replace(" Agent", "")}`
        : `revised the plan${m.diff?.length ? ` · ${m.diff.length} changes` : ""}${tested}`;
    case "accept":
      return "accepted it";
    case "reject":
      return `rejected it${m.constraint ? ` · needs: ${needsLabel(m.constraint, names).toLowerCase()}` : ""}`;
    case "question":
      return `stopped to ask a person${m.constraint?.targetIds.length ? ` about ${m.constraint.targetIds.map(device).join(", ")}` : ""}`;
    case "answer":
      return `answered: ${m.reason}`;
    case "recommendation":
      return `recommended ${m.name ? `“${m.name}”` : "the plan"} to the humans${m.option && m.option > 1 ? ` as option ${m.option}` : ""}`;
    case "chat":
      return m.from === "asi1" ? "asked on ASI:One" : "replied on ASI:One";
  }
}

function Edge({ a, b, lit, color, faint }: { a: Speaker; b: Speaker; lit: boolean; color: string; faint?: boolean }) {
  const p = NODE[a];
  const q = NODE[b];
  return (
    <line
      x1={p.x}
      y1={p.y}
      x2={q.x}
      y2={q.y}
      stroke={lit ? color : "#3E4448"}
      strokeWidth={lit ? 1.6 : 1}
      strokeDasharray={lit ? "5 5" : faint ? "2 6" : undefined}
      opacity={faint ? 0.5 : 1}
      style={lit ? { animation: "agent-room-dash 600ms linear infinite" } : undefined}
    />
  );
}

function Node({ who, glow, dim }: { who: Speaker; glow: boolean; dim?: boolean }) {
  const { x, y, r } = NODE[who];
  const color = SPEAKER_COLOR[who];
  const ring = who === "humans" ? "#7D858B" : color;
  const size = who === "coordinator" ? 26 : 22;
  return (
    <g opacity={dim ? 0.4 : 1}>
      {glow && <circle cx={x} cy={y} r={r + 12} fill={ring} opacity={0.14} />}
      <circle cx={x} cy={y} r={r} fill="#131618" stroke={ring} strokeWidth={1.5} />
      <circle cx={x} cy={y} r={r} fill={ring} opacity={0.1} />
      <g transform={`translate(${x - size / 2} ${y - size / 2})`} style={{ color: who === "humans" ? "#E9ECEE" : color }}>
        <AgentGlyph who={who} size={size} strokeWidth={1.3} />
      </g>
      <title>{SPEAKER_LABEL[who]}</title>
    </g>
  );
}

// --- The four agents, as lanes: a live badge and what each has done, counted from the rows. ---

const CHIP = {
  info: "border-line2 text-ink-muted",
  ok: "border-[#3DD68C66] bg-[#3DD68C14] text-[#3DD68C]",
  warn: "border-[#FF5C5C66] bg-[#FF5C5C14] text-[#FF5C5C]",
} as const;

function Chip({ tone, title, children }: { tone: keyof typeof CHIP; title?: string; children: ReactNode }) {
  return <span title={title} className={`num inline-flex h-6 max-w-full items-center truncate rounded-ctl border px-1.5 text-[11px] ${CHIP[tone]}`}>{children}</span>;
}

function LanesStrip({ lanes }: { lanes: Lane[] }) {
  return (
    <ul aria-label="The four agents" className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2 xl:grid-cols-4">
      {lanes.map((l) => {
        const live = l.status === "thinking" || l.status === "speaking";
        return (
          <li key={l.agent} className={`flex min-w-0 flex-col gap-2 rounded-panel border px-3 py-2.5 ${live ? "border-line2 bg-select-wash" : "border-line"}`}>
            <span className="inline-flex items-center gap-2 text-[13px]" style={{ color: SPEAKER_COLOR[l.agent] }}>
              <AgentGlyph who={l.agent} size={14} />
              <span className="truncate">{SPEAKER_LABEL[l.agent].replace(" Agent", "")}</span>
              {live && <span className="ml-auto h-2 w-2 animate-pulse rounded-full" style={{ background: SPEAKER_COLOR[l.agent] }} aria-hidden />}
            </span>
            <div className="flex flex-wrap gap-1">
              {l.badges.length ? l.badges.map((b) => <Chip key={b.label} tone={b.tone}>{b.label}</Chip>) : <Chip tone="info">idle</Chip>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// --- The negotiation table: one column per plan, one row per reviewing agent, and the Coordinator's row. ---

const STAMP = {
  accept: { glyph: "●", label: "Accepts", color: "#3DD68C" },
  reject: { glyph: "✕", label: "Rejects", color: "#FF5C5C" },
  question: { glyph: "?", label: "Asked a human", color: "#F2C14E" },
} as const;

function NegotiationTable(props: { plans: PlanColumn[]; messages: readonly AgentMessageRow[]; optionOf: (p: PlanColumn) => number | undefined; thinking: Set<string>; newestSeq?: number; running: boolean }) {
  const { plans, optionOf, newestSeq } = props;
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Braces: Chrome's scrollIntoView now returns a Promise, which React would call as a cleanup.
    end.current?.scrollIntoView({ behavior: "smooth", inline: "end", block: "nearest" });
  }, [plans.length]);

  if (!plans.length) {
    return (
      <div className="mt-4 grid flex-1 place-items-center rounded-panel border border-dashed border-line2 p-8 text-center">
        <p className="m-0 max-w-[420px] text-[15px] text-ink-faint">
          {props.running ? "The Flow Agent is drafting the first plan…" : "No plan yet. Each plan the Flow Agent proposes becomes a column here, and each agent's verdict a stamp."}
        </p>
      </div>
    );
  }

  const cols = `180px repeat(${plans.length}, minmax(240px, 340px))`;
  const last = plans[plans.length - 1];
  return (
    <div className="scroll-quiet mt-4 min-h-0 flex-1 overflow-auto rounded-panel border border-line bg-bg">
      <div className="grid min-w-max" style={{ gridTemplateColumns: cols }}>
        <RowLabel who="flow" label="Plan" />
        {plans.map((p) => (
          <div key={`h${colKey(p)}`} className={`border-b border-l border-line px-4 py-3 ${optionOf(p) ? "bg-select-wash" : ""}`}>
            <div className="num flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-ink-faint">
              Round {p.round} · {p.kind}
              {optionOf(p) && <span className="rounded-ctl border border-ink px-1.5 py-px text-ink">■ Option {optionOf(p)}</span>}
            </div>
            <div className="mt-1 text-[16px] leading-6 text-ink">{p.name}</div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              <Chip tone="info">{p.size}</Chip>
              {p.lines.slice(0, 2).map((l, i) => (
                <Chip key={i} tone="info" title={l}>{l.length > 34 ? `${l.slice(0, 32)}…` : l}</Chip>
              ))}
              {p.lines.length > 2 && <Chip tone="info" title={p.lines.slice(2).join("\n")}>+{p.lines.length - 2}</Chip>}
            </div>
          </div>
        ))}

        <RowLabel who="flow" label="Tested in the simulator" />
        {plans.map((p) => (
          <div key={`t${colKey(p)}`} className={`border-b border-l border-line px-4 py-3 ${optionOf(p) ? "bg-select-wash" : ""}`}>
            {p.patientsAffected === undefined ? (
              <span className="num text-[13px] text-ink-faint">No test result</span>
            ) : (
              <>
                <div className="text-readout-m text-ink">{p.patientsAffected}</div>
                <div className="num text-[12px] text-ink-muted">
                  {p.patientsAffected === 1 ? "patient" : "patients"} affected
                  {p.devicesCompromised !== undefined ? ` · ${p.devicesCompromised} ${p.devicesCompromised === 1 ? "device" : "devices"} compromised` : ""}
                </div>
              </>
            )}
          </div>
        ))}

        {REVIEWERS.map((agent) => (
          <ReviewerRow key={agent} agent={agent} plans={plans} optionOf={optionOf} newestSeq={newestSeq}
            pending={props.running} thinking={props.thinking.has(agent)} lastRound={last.round} />
        ))}

        <RowLabel who="coordinator" label="Coordinator" />
        {plans.map((p) => {
          const c = coordinatorStamp(props.messages, p);
          return (
            <div key={`c${colKey(p)}`} className={`flex flex-wrap content-start gap-1 border-b border-l border-line px-4 py-3 ${optionOf(p) ? "bg-select-wash" : ""}`}>
              {c.routed > 0 && <Chip tone="info">→ routed to {c.routed} {c.routed === 1 ? "reviewer" : "reviewers"}</Chip>}
              {c.option !== undefined && <Chip tone="ok">■ published as option {c.option}</Chip>}
              {c.routed === 0 && c.option === undefined && <span className="num text-[13px] text-ink-faint">—</span>}
            </div>
          );
        })}
      </div>
      <div ref={end} />
    </div>
  );
}

const colKey = (p: PlanColumn) => `${p.round}:${p.policyId ?? p.kind}`;

function RowLabel({ who, label }: { who: Speaker; label: string }) {
  return (
    <div className="sticky left-0 z-10 flex items-center gap-2 border-b border-line bg-bg px-4 py-3 text-[14px]" style={{ color: SPEAKER_COLOR[who] }}>
      <AgentGlyph who={who} size={15} />
      <span>{label}</span>
    </div>
  );
}

function ReviewerRow(props: { agent: "inventory" | "clinical_workflow"; plans: PlanColumn[]; optionOf: (p: PlanColumn) => number | undefined; newestSeq?: number; pending: boolean; thinking: boolean; lastRound: number }) {
  const { agent, plans } = props;
  return (
    <>
      <RowLabel who={agent} label={SPEAKER_LABEL[agent].replace(" Agent", "")} />
      {plans.map((p) => {
        const s = p.verdicts[agent];
        return (
          <div key={`${agent}${colKey(p)}`} className={`border-b border-l border-line px-4 py-3 ${props.optionOf(p) ? "bg-select-wash" : ""}`}>
            {s ? (
              <StampCell stamp={s} fresh={s.seq === props.newestSeq} />
            ) : p.round === props.lastRound && props.pending ? (
              <span className="num text-[13px] text-ink-faint">{props.thinking ? "reviewing…" : "waiting for its turn"}</span>
            ) : (
              <span className="num text-[13px] text-ink-faint">—</span>
            )}
          </div>
        );
      })}
    </>
  );
}

function StampCell({ stamp, fresh }: { stamp: Stamp; fresh: boolean }) {
  const look = STAMP[stamp.decision];
  return (
    <div className={fresh ? "fx-pop" : undefined} title={stamp.reason}>
      <span className="inline-flex h-8 items-center gap-2 rounded-ctl border px-2.5 text-[14px]" style={{ borderColor: `${look.color}66`, color: look.color, background: `${look.color}14` }}>
        <span aria-hidden>{look.glyph}</span>
        {look.label}
      </span>
      {stamp.needs && <div className="num mt-2 line-clamp-2 text-[12px] leading-5 text-ink" title={stamp.needs}>Needs: {stamp.needs}</div>}
    </div>
  );
}

// --- The constraints the rejections added, and when a later plan met them. ---

function ConstraintRail({ constraints }: { constraints: ConstraintChip[] }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col border-t border-line px-5 py-4">
      <span className="eyebrow">Constraints learned</span>
      {!constraints.length ? (
        <p className="num m-0 mt-3 text-[13px] text-ink-faint">None yet. Each rejection adds what the next plan must respect.</p>
      ) : (
        <ol className="scroll-quiet m-0 mt-3 flex list-none flex-col gap-2 overflow-y-auto p-0">
          {constraints.map((c) => (
            <li key={c.seq} className="fx-pop rounded-ctl border border-line2 bg-panel2 px-3 py-2">
              <div className="flex items-center justify-between gap-2 text-[12px]">
                <span style={{ color: SPEAKER_COLOR[c.agent] }}>
                  {SPEAKER_LABEL[c.agent]} · round {c.round}
                </span>
                {c.metIn !== undefined ? (
                  <span className="num text-[#3DD68C]">✓ met in round {c.metIn}</span>
                ) : (
                  <span className="num text-ink-faint">open</span>
                )}
              </div>
              <div className={`mt-1 text-[14px] leading-5 ${c.metIn !== undefined ? "text-ink-muted" : "text-ink"}`}>{c.label}</div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// --- The transcript: one entry per row, newest marked, scrolled to the newest. ---

function Transcript({ messages, names }: { messages: readonly (TimedMessage & { revealedAt?: number })[]; names: Names }) {
  const list = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const el = list.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  // The round clock starts at the first message's created_at, or when this tab first showed one.
  const times = messages.map((m) => createdMs(m) ?? m.revealedAt);
  const start = Math.min(...times.filter((t): t is number => t !== undefined), Infinity);

  return (
    <ol ref={list} className="scroll-quiet mt-4 min-h-0 flex-1 list-none overflow-y-auto rounded-panel border border-line bg-bg p-0">
      {!messages.length && (
        <li className="num px-5 py-8 text-[13px] text-ink-faint">No messages yet. The orchestrator opens the round after Create segmentation plan, or a request on ASI:One.</li>
      )}
      {messages.map((m, i) => {
        const e = entryOf(m, names);
        const t = times[i];
        const last = i === messages.length - 1;
        return (
          <li
            key={m.seq}
            className={`grid grid-cols-[80px_minmax(0,1fr)] gap-x-3 border-l-[3px] px-4 py-3 ${last ? "border-l-[#3DD68C] bg-select-wash" : "border-l-transparent"}`}
          >
            <span className="num pt-px text-[14px] text-ink-faint">{elapsedLabel(t === undefined || start === Infinity ? undefined : t - start)}</span>
            <div className="min-w-0">
              <div className="num text-[14px] leading-6">
                <span style={{ color: SPEAKER_COLOR[m.from] }}>{SPEAKER_LABEL[m.from]}</span>
                <span className="text-ink-faint"> → </span>
                <span style={{ color: SPEAKER_COLOR[m.to] }}>{SPEAKER_LABEL[m.to]}</span>
              </div>
              <div className="num text-[14px] leading-6 text-ink">{e.subject}</div>
              {e.detail && <div className="num text-[14px] leading-6 text-ink-muted">{e.detail}</div>}
              {e.quote && (
                <p className="m-0 whitespace-pre-line text-[16px] leading-7 text-ink">
                  “{e.quote}”
                  {e.template && <span className="num ml-2 text-[11px] text-ink-faint">template text</span>}
                  {e.asi1 && <span className="num ml-2 text-[11px] text-ink-faint">via ASI:One</span>}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// --- The options humans choose between: the negotiated plan and the alternatives both reviewers accepted. ---

const ROLE: Record<string, string> = { security: "Security", clinical_engineering: "Clinical engineering", operations: "Operations" };
/** "Also holds 12 of 17 other attack starts…" from the plan's rationale, as the card's headline difference. */
const coverage = (rationale?: string) =>
  rationale?.match(/Average over \d+ attack starts: [^)]*\)\./)?.[0] ?? rationale?.match(/Also holds \d+ of \d+ other attack starts[^.]*\./)?.[0];
const count = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function OptionCards({ recs, review }: { recs: readonly RecommendationRow[]; review?: (rec: RecommendationRow) => ReactNode }) {
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="eyebrow">{recs.length > 1 ? `${recs.length} options · humans choose one` : "Recommendation · for human review"}</span>
        <span className="num text-[12px] text-ink-faint">Both reviewing agents accepted each option. Agent agreement is not approval.</span>
      </div>
      <ol className="m-0 mt-3 grid list-none gap-3 p-0" style={{ gridTemplateColumns: `repeat(${recs.length}, minmax(0, 1fr))` }}>
        {recs.map((r) => (
          <li key={r.id} className="flex flex-col rounded-panel border border-line2 bg-panel2 p-4">
            <div className="num text-[11px] uppercase tracking-[0.14em] text-ink-faint">
              Option {r.option}
              {r.option === 1 ? " · negotiated" : " · alternative"}
            </div>
            <div className="mt-1 text-[17px] leading-6 text-ink">{r.name}</div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-readout-m text-ink">{r.verified.patientsAffected}</span>
              <span className="num text-[12px] text-ink-muted">{r.verified.patientsAffected === 1 ? "patient" : "patients"} affected</span>
            </div>
            <div className="num text-[12px] text-ink-muted">
              {count(r.verified.devicesCompromised, "device")} compromised · {count(r.verified.removedFlows.length, "connection")} cut ·{" "}
              {count(r.verified.protectedBroken.length, "protected flow")} broken
            </div>
            {coverage(r.rationale) && (
              <div className="num mt-2 rounded-ctl border border-line2 px-2 py-1 text-[12px] text-ink">{coverage(r.rationale)}</div>
            )}
            {r.tradeoff && <p className="m-0 mt-2 text-[13px] leading-5 text-ink-muted"><span className="text-ink-faint">Cost: </span>{r.tradeoff}</p>}
            {r.explanation && <p className="m-0 mt-2 line-clamp-2 text-[13px] leading-5 text-ink-faint" title={r.explanation}>{r.explanation}</p>}
            <div className="num mt-2 text-[12px] text-ink-faint">
              {r.verdicts.map((v) => `${v.decision === "accept" ? "●" : "✕"} ${SPEAKER_LABEL[v.agent].replace(" Agent", "")}`).join("  ")}
            </div>
            <div className="num mt-1 text-[12px] text-ink-faint">{r.requiredRoles.map((x) => ROLE[x] ?? x).join(", ")} must sign off</div>
            {review && <div className="mt-auto pt-3">{review(r)}</div>}
          </li>
        ))}
      </ol>
    </div>
  );
}
