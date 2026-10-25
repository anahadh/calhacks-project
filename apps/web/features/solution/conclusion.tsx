"use client";

import { useMemo, useState } from "react";
import { SPEAKER_COLOR, SPEAKER_LABEL } from "@/features/agents/agents";
import { AgentGlyph } from "@/features/agents/agent-icon";
import { lanesOf } from "@/features/agents/negotiation";
import { ROLE_LABEL } from "@/lib/format";
import type { DeviceStateRow, RecommendationRow, RunRow, SessionSnapshot } from "@/lib/stdb/types";
import { diagramOf, dollars, moneyOf, savedBy, UNIT, type Diagram, type Money, type Saved } from "./estimate";
import type { Segment } from "./pair";

// The conclusion under the split screen, as cards: first the decision card
// (the plan, its numbers, who signs off, and Approve); once a person approves
// it here, the outcome card: what the plan saved, the money estimate, the
// segmentation as a diagram, and the four agents' part in it. Approval here is
// this browser's step through the demo: it writes nothing (AGENTS.md rule 9),
// and the card says so. Every count is a run row's column or a hospital row.

export function Conclusion({
  session,
  rec,
  none,
  plan,
  planDevices,
  segments,
}: {
  session: SessionSnapshot;
  rec?: RecommendationRow;
  none?: RunRow;
  plan?: RunRow;
  planDevices: readonly DeviceStateRow[];
  segments: readonly Segment[];
}) {
  const [approved, setApproved] = useState<{ name: string; role: string } | null>(null);
  const saved = savedBy(session.hospital, none, plan);
  const diagram = useMemo(() => diagramOf(session.hospital, planDevices, plan?.removedFlows ?? []), [session.hospital, planDevices, plan?.removedFlows]);
  const money = rec && saved ? moneyOf(rec.rules.length, segments.length, saved) : undefined;
  const roundMessages = useMemo(
    () => session.messages.filter((m) => (rec ? m.round <= rec.round : true) && m.type !== "chat"),
    [session.messages, rec],
  );
  const lanes = useMemo(() => lanesOf(roundMessages, [], { state: "done", round: rec?.round ?? 0 }), [roundMessages, rec?.round]);

  if (!rec) return null;

  if (!approved) {
    return (
      <DecisionCard
        rec={rec}
        saved={saved}
        me={session.me}
        onApprove={() => setApproved({ name: session.me?.name ?? session.presenterName ?? "A reviewer", role: session.me?.role ?? "observer" })}
      />
    );
  }

  return (
    <section aria-labelledby="outcome" className="panel flex flex-col gap-6 p-5 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="eyebrow">Outcome · {rec.name}</span>
          <h2 id="outcome" className="m-0 mt-1 text-[26px] leading-8 text-ink">
            {saved ? `${saved.before.devices} → ${saved.after.devices} machines compromised` : "Waiting for both replays to settle"}
          </h2>
        </div>
        <span className="num inline-flex h-9 items-center gap-2 rounded-ctl border border-line2 px-3 text-[13px] text-ink-muted">
          <span className="h-2 w-2 rounded-full bg-state-healthy" aria-hidden />
          Approved for review by {approved.name} · {ROLE_LABEL[approved.role as keyof typeof ROLE_LABEL] ?? approved.role}
        </span>
      </div>

      {saved && <SavedTiles saved={saved} />}

      <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <SegmentDiagram diagram={diagram} rules={rec.rules} />
        <div className="flex flex-col gap-6">
          {money && <MoneyCard money={money} />}
          <AgentsStrip lanes={lanes} rec={rec} />
        </div>
      </div>

      <p className="num m-0 text-[11px] text-ink-faint">
        Approval here moves the demo forward and writes nothing: no network changes, and only humans decide what gets deployed. Dollar figures are illustrative estimates over the simulation's counts.
      </p>
    </section>
  );
}

function DecisionCard({ rec, saved, me, onApprove }: { rec: RecommendationRow; saved?: Saved; me?: SessionSnapshot["me"]; onApprove: () => void }) {
  const roles = rec.requiredRoles.map((r) => ROLE_LABEL[r]);
  const mine = me && rec.requiredRoles.includes(me.role as (typeof rec.requiredRoles)[number]);
  return (
    <section aria-labelledby="decision" className="panel flex flex-col gap-5 p-5 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="eyebrow">Decision · option {rec.option}</span>
          <h2 id="decision" className="m-0 mt-1 text-[26px] leading-8 text-ink">{rec.name}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {rec.verdicts.map((v) => (
            <Badge key={v.agent} tone={v.decision === "accept" ? "ok" : "warn"}>
              {v.decision === "accept" ? "●" : "✕"} {SPEAKER_LABEL[v.agent].replace(" Agent", "")}
            </Badge>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-panel border border-line bg-line md:grid-cols-4">
        <Tile label="Machines compromised" value={rec.verified.devicesCompromised} note={saved ? `${saved.before.devices} without the plan` : undefined} />
        <Tile label="Patients affected" value={rec.verified.patientsAffected} note={saved ? `${saved.before.patients} without the plan` : undefined} />
        <Tile label="Connections cut" value={rec.verified.removedFlows.length} note={`${rec.rules.length} allow ${rec.rules.length === 1 ? "rule" : "rules"}`} />
        <Tile label="Protected flows cut" value={rec.verified.protectedBroken.length} note={rec.verified.protectedBroken.length ? undefined : "care keeps flowing"} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="num text-[12px] text-ink-faint">Must sign off:</span>
          {roles.map((r) => (
            <Badge key={r} tone="warn">{r}</Badge>
          ))}
        </div>
        <button
          type="button"
          onClick={onApprove}
          className="num inline-flex min-h-[52px] items-center gap-3 rounded-ctl bg-state-healthy px-6 text-[15px] font-medium text-bg transition-[filter] duration-fade hover:brightness-110"
        >
          {mine ? `Approve as ${ROLE_LABEL[me!.role as keyof typeof ROLE_LABEL]}` : "Approve this plan"}
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
            <path d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </section>
  );
}

function SavedTiles({ saved }: { saved: Saved }) {
  const tiles = [
    { label: "Machines kept clean", value: saved.machines, of: saved.before.devices, bar: "bg-state-healthy" },
    { label: "Patients kept on normal care", value: saved.patients, of: saved.before.patients, bar: "bg-state-ok" },
    { label: "Services kept running", value: saved.services, of: saved.before.services, bar: "bg-ink-muted" },
    { label: "Protected flows intact", value: saved.flowsIntact, of: saved.flowsTotal, bar: "bg-state-zone" },
  ];
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-panel border border-line bg-line md:grid-cols-4">
      {tiles.map((t) => (
        <div key={t.label} className="min-w-0 bg-panel px-4 py-3">
          <div className="eyebrow !tracking-[0.1em]">{t.label}</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="readout text-readout-l text-ink">{t.value}</span>
            <small className="num text-[13px] text-ink-muted">/ {t.of}</small>
          </div>
          <div className="mt-2 h-[3px] overflow-hidden rounded-sm bg-line2">
            <i className={`block h-full rounded-sm ${t.bar}`} style={{ width: `${t.of ? Math.min(100, (t.value / t.of) * 100) : 0}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function MoneyCard({ money }: { money: Money }) {
  const max = Math.max(money.implement, money.avoided, 1);
  const ratio = money.implement ? money.avoided / money.implement : 0;
  return (
    <section aria-labelledby="money" className="flex flex-col gap-3 rounded-panel border border-line bg-panel2 p-4">
      <div className="flex items-baseline justify-between">
        <h3 id="money" className="eyebrow m-0">Estimated cost · this attack</h3>
        {ratio >= 1 && <span className="num text-[12px] text-ink-muted">pays back {ratio.toFixed(1)}× in one incident</span>}
      </div>
      <Bar label="To put the plan in place" value={money.implement} max={max} color="#A1A8AE" />
      <Bar label="Avoided in this attack" value={money.avoided} max={max} color="#4DB0FF" />
      <details className="num text-[12px] text-ink-faint">
        <summary className="cursor-pointer">How this is estimated</summary>
        <ul className="m-0 mt-2 flex list-none flex-col gap-1 p-0">
          {money.lines.map((l) => (
            <li key={`${l.side}:${l.label}`} className="flex justify-between gap-3">
              <span>{l.count} {l.label} × {dollars(l.unit)}</span>
              <span className="tabular-nums text-ink-muted">{dollars(l.total)}</span>
            </li>
          ))}
        </ul>
        <p className="m-0 mt-2">Unit costs are stated assumptions (e.g. {dollars(UNIT.device)} per machine rebuilt), not measurements. Counts are the two replays' final numbers.</p>
      </details>
    </section>
  );
}

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between">
        <span className="num text-[12px] text-ink-muted">{label}</span>
        <span className="readout text-readout-m text-ink">{dollars(value)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-[1px] bg-line2">
        <span className="block h-full transition-[width] duration-fade ease-breath" style={{ width: `${(value / max) * 100}%`, background: color }} />
      </div>
    </div>
  );
}

/** The segmentation as a ring of zones: solid lines are connections the plan keeps, dashed red ones it cut. */
function SegmentDiagram({ diagram, rules }: { diagram: Diagram; rules: string[] }) {
  const pos = new Map(diagram.nodes.map((n) => [n.zone, n]));
  const cuts = diagram.edges.reduce((a, e) => a + e.cut, 0);
  const kept = diagram.edges.reduce((a, e) => a + e.kept, 0);
  return (
    <section aria-labelledby="diagram" className="flex flex-col gap-3 rounded-panel border border-line bg-panel2 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="diagram" className="eyebrow m-0">The segmentation · {diagram.nodes.length} segments</h3>
        <span className="num text-[12px] text-ink-muted">{kept} connections kept between segments · {cuts} cut</span>
      </div>
      <svg viewBox={`0 0 ${diagram.width} ${diagram.height}`} className="h-auto w-full" role="img" aria-label="Segments and the connections between them">
        {diagram.edges.map((e) => {
          const a = pos.get(e.from)!;
          const b = pos.get(e.to)!;
          const mx = (a.x + b.x) / 2;
          const my = (a.y + b.y) / 2;
          return (
            <g key={`${e.from}|${e.to}`}>
              {e.kept > 0 && <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={e.protectedKept ? "#4DB0FF" : "#7D858B"} strokeWidth={Math.min(1 + e.kept, 5)} opacity={0.9} />}
              {e.cut > 0 && e.kept === 0 && <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#FF6A2E" strokeWidth={1.4} strokeDasharray="5 5" opacity={0.8} />}
              {e.cut > 0 && (
                <g transform={`translate(${mx} ${my})`}>
                  <circle r={10} fill="#131618" stroke="#FF6A2E" strokeWidth={1.2} />
                  <text textAnchor="middle" dominantBaseline="central" className="fill-[#FF6A2E] font-mono text-[11px]">{e.cut}✕</text>
                </g>
              )}
            </g>
          );
        })}
        {diagram.nodes.map((n) => (
          <g key={n.zone} transform={`translate(${n.x} ${n.y})`}>
            <circle r={30} fill="#131618" stroke={n.color} strokeWidth={n.infected ? 2.5 : 1.5} />
            <circle r={30} fill={n.color} opacity={n.infected ? 0.22 : 0.1} />
            <text textAnchor="middle" dominantBaseline="central" y={-4} className="fill-[#E9ECEE] font-mono text-[13px]">
              {n.infected ? `${n.infected}/${n.devices}` : n.devices}
            </text>
            <text textAnchor="middle" dominantBaseline="central" y={11} className="fill-[#7D858B] font-mono text-[9px]">
              {n.infected ? "infected" : "devices"}
            </text>
            <text textAnchor="middle" y={48} className="font-mono text-[11px]" style={{ fill: n.color }}>
              {n.name.toUpperCase()}
            </text>
          </g>
        ))}
      </svg>
      <ul className="num m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-[11px] text-ink-muted">
        <li><span className="mr-1.5 inline-block h-0.5 w-5 bg-state-healthy align-middle" />protected connection kept</li>
        <li><span className="mr-1.5 inline-block h-0.5 w-5 bg-ink-faint align-middle" />connection kept</li>
        <li><span className="mr-1.5 inline-block h-0.5 w-5 border-t border-dashed border-state-infected align-middle" />cut by the plan</li>
      </ul>
      <div className="flex flex-wrap gap-1.5">
        {rules.slice(0, 6).map((r, i) => (
          <Badge key={i} tone="info">{r}</Badge>
        ))}
        {rules.length > 6 && <Badge tone="info">+{rules.length - 6} more rules</Badge>}
      </div>
    </section>
  );
}

/** The four agents' part in this plan: their verdicts on it, and their tallies for the round. */
function AgentsStrip({ lanes, rec }: { lanes: ReturnType<typeof lanesOf>; rec: RecommendationRow }) {
  const verdict = new Map(rec.verdicts.map((v) => [v.agent, v.decision]));
  return (
    <section aria-labelledby="agents" className="flex flex-col gap-2 rounded-panel border border-line bg-panel2 p-4">
      <h3 id="agents" className="eyebrow m-0">The four agents</h3>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {lanes.map((l) => {
          const v = verdict.get(l.agent);
          return (
            <li key={l.agent} className="flex flex-wrap items-center gap-2">
              <span className="inline-flex w-[150px] items-center gap-2 text-[13px]" style={{ color: SPEAKER_COLOR[l.agent] }}>
                <AgentGlyph who={l.agent} size={14} />
                {SPEAKER_LABEL[l.agent].replace(" Agent", "")}
              </span>
              {l.agent === "flow" && <Badge tone="info">◆ proposed</Badge>}
              {l.agent === "coordinator" && <Badge tone="info">■ published option {rec.option}</Badge>}
              {v && <Badge tone={v === "accept" ? "ok" : "warn"}>{v === "accept" ? "● accepted" : "✕ rejected"}</Badge>}
              {l.badges.filter((b) => !/accepted|rejected/.test(b.label)).map((b) => (
                <Badge key={b.label} tone={b.tone}>{b.label}</Badge>
              ))}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const TONE = {
  info: "border-line2 text-ink-muted",
  ok: "border-[#3DD68C66] text-[#3DD68C] bg-[#3DD68C14]",
  warn: "border-[#FF5C5C66] text-[#FF5C5C] bg-[#FF5C5C14]",
} as const;

export function Badge({ tone, children }: { tone: keyof typeof TONE; children: React.ReactNode }) {
  return <span className={`num inline-flex h-7 items-center rounded-ctl border px-2 text-[12px] ${TONE[tone]}`}>{children}</span>;
}

function Tile({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div className="min-w-0 bg-panel px-4 py-3">
      <div className="eyebrow !tracking-[0.1em]">{label}</div>
      <div className="readout mt-1 text-readout-m text-ink">{value}</div>
      {note && <div className="num mt-1 text-[12px] text-ink-muted">{note}</div>}
    </div>
  );
}

