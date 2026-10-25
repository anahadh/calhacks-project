"use client";

import { useMemo, useState } from "react";
import { SPEAKER_COLOR, SPEAKER_LABEL } from "@/features/agents/agents";
import { AgentGlyph } from "@/features/agents/agent-icon";
import { ROLE_LABEL } from "@/lib/format";
import type { AgentId, AgentMessageRow, DeviceStateRow, RecommendationRow, RunRow, SessionSnapshot } from "@/lib/stdb/types";
import { dollars, moneyOf, savedBy, UNIT, type Money, type Saved } from "./estimate";
import type { Segment } from "./pair";

// The conclusion under the split screen, as two cards. First the decision card
// (the plan, two numbers, who signs off, Approve). Once a person approves it
// here, the outcome card: the money, what the plan spared, the segmentation in
// words, and what the agents negotiated over, as one bar per agent. Approval
// here is this browser's step through the demo: it writes nothing (AGENTS.md
// rule 9), and the card says so. Counts are run rows' columns; the rest is the
// round's agent_message rows, reshaped.

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
  const money = rec && saved ? moneyOf(rec.rules.length, segments.length, saved) : undefined;
  const messages = useMemo(
    () => session.messages.filter((m) => (rec ? m.round <= rec.round : true) && m.type !== "chat" && m.type !== "request"),
    [session.messages, rec],
  );
  const name = (id: string) => session.hospital.devices.find((d) => d.id === id)?.name ?? session.hospital.services.find((s) => s.id === id)?.name ?? id;
  const concessions = useMemo(() => concessionsOf(messages, rec?.round ?? 0, name), [messages, rec?.round]); // eslint-disable-line react-hooks/exhaustive-deps
  const infectedSeg = segments.find((s) => s.infected > 0);

  if (!rec) return null;

  const method = <Method rec={rec} messages={messages} segments={segments} name={name} />;

  if (!approved) {
    return (
      <>
        {method}
        <DecisionCard
          rec={rec}
          saved={saved}
          me={session.me}
          onApprove={() => setApproved({ name: session.me?.name ?? session.presenterName ?? "A reviewer", role: session.me?.role ?? "observer" })}
        />
      </>
    );
  }

  const crossing = session.hospital.flows.filter((f) => f.protected && f.active !== false && !(plan?.protectedBroken ?? []).includes(f.id)).length;

  return (
    <section aria-labelledby="outcome" className="panel flex flex-col gap-6 p-5 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="eyebrow">Outcome · {rec.name}</span>
          <h2 id="outcome" className="m-0 mt-1 text-[26px] leading-8 text-ink">
            {infectedSeg ? `The attack stayed inside ${infectedSeg.name}.` : saved ? "The attack went nowhere." : "Waiting for both replays to settle."}
          </h2>
        </div>
        <span className="num inline-flex h-9 items-center gap-2 rounded-ctl border border-line2 px-3 text-[13px] text-ink-muted">
          <span className="h-2 w-2 rounded-full bg-state-healthy" aria-hidden />
          Approved for review by {approved.name} · {ROLE_LABEL[approved.role as keyof typeof ROLE_LABEL] ?? approved.role}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {money && saved && <MoneyCard money={money} saved={saved} />}
        <SegmentationCard segments={segments} cuts={plan?.removedFlows.length ?? 0} crossing={crossing} />
      </div>

      <ConcessionsCard rows={concessions} rounds={rec.round} />

      <p className="num m-0 text-[11px] text-ink-faint">
        Approval here moves the demo forward and writes nothing: no network changes, and only humans decide what gets deployed. Dollar figures are illustrative estimates over the simulation's counts.
      </p>
    </section>
  );
}

function DecisionCard({ rec, saved, me, onApprove }: { rec: RecommendationRow; saved?: Saved; me?: SessionSnapshot["me"]; onApprove: () => void }) {
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

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-panel border border-line bg-line">
        <Tile label="Machines compromised" value={rec.verified.devicesCompromised} note={saved ? `${saved.before.devices} without the plan` : "vs the run on the left"} />
        <Tile label="Patients affected" value={rec.verified.patientsAffected} note={saved ? `${saved.before.patients} without the plan` : "vs the run on the left"} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="num text-[12px] text-ink-faint">Must sign off:</span>
          {rec.requiredRoles.map((r) => (
            <Badge key={r} tone="warn">{ROLE_LABEL[r]}</Badge>
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

/**
 * How the agents got here, as a numbered method with the round's own numbers: the objective,
 * the deterministic optimizer, the test from every start (the proof chart), what each reviewer
 * checked and what each rejection changed, and the result the two replays verify. Every line
 * is read from the recommendation row and the round's agent_message rows.
 */
function Method({ rec, messages, segments, name }: { rec: RecommendationRow; messages: readonly AgentMessageRow[]; segments: readonly Segment[]; name: (id: string) => string }) {
  const proposals = messages.filter((m) => m.from === "flow" && (m.type === "proposal" || m.type === "revision"));
  const rejections = messages.filter((m) => m.type === "reject" && m.constraint);
  const few = (ids: string[], n = 3) => (ids.length <= n ? ids.map(name).join(", ") : `${ids.slice(0, n).map(name).join(", ")} +${ids.length - n}`);
  const what = (m: AgentMessageRow) => {
    const c = m.constraint!;
    if (c.kind === "keep_flow") return `reopen ${few(c.targetIds)}`;
    if (c.kind === "keep_service") return `keep ${few(c.targetIds)} running`;
    if (c.kind === "confirm_device") return `wait for a person to name ${few(c.targetIds)}`;
    return "fold the rules to fit the switches";
  };
  const steps: { title: string; body: React.ReactNode }[] = [
    {
      title: "The objective",
      body: (
        <>Cut the fewest file-sharing and remote-desktop links between the {segments.length || 5} functional networks so that an attack from <em>any</em> workstation stays inside its own network. Clinical traffic (DICOM, HL7, HTTPS, NTP) is never the target of a cut.</>
      ),
    },
    {
      title: "The method is deterministic",
      body: (
        <>The Flow Agent's optimizer is greedy and has no randomness: while some start can still reach outside its network, it cuts the wall link that lowers total reach the most. Every candidate is then run through the same simulation engine as the two replays above, which has no random numbers and no clock, so the same hospital and the same plan always give the same result.</>
      ),
    },
    {
      title: "Tested from every possible start, not only this one",
      body: rec.evidence && rec.evidence.length > 0 ? <Proof evidence={rec.evidence} /> : <span className="text-ink-faint">This plan's per-start results were not published with it.</span>,
    },
    {
      title: `Reviewed in ${rec.round} ${rec.round === 1 ? "round" : "rounds"}`,
      body: (
        <>
          Flow proposed {proposals.length} {proposals.length === 1 ? "version" : "versions"}. The reviewers decide in code: Clinical rejects any plan that breaks a protected clinical link or keeps a critical service down; Inventory rejects any plan that touches a machine nobody can name or needs more rules than the switches carry. The language model only words the reasons.
          {rejections.length > 0 && (
            <ol className="m-0 mt-2 flex list-none flex-col gap-1 p-0">
              {rejections.map((m) => (
                <li key={`${m.round}:${m.seq}`} className="num text-[12px] text-ink-muted">
                  <span className="text-ink-faint">Round {m.round} · </span>
                  <span style={{ color: SPEAKER_COLOR[m.from] }}>{SPEAKER_LABEL[m.from].replace(" Agent", "")}</span>
                  <span className="text-ink-faint"> made Flow </span>
                  {what(m)}
                </li>
              ))}
            </ol>
          )}
        </>
      ),
    },
    {
      title: "The result, verified on screen",
      body: (
        <>“{rec.name}”: {rec.rules.length} allow rules, {rec.verified.removedFlows.length} links cut, {rec.verified.protectedBroken.length} protected clinical links broken. The two replays above are this plan and no plan, run through the same engine on the same attack; their numbers are the plan's numbers.</>
      ),
    },
  ];
  return (
    <section aria-labelledby="method" className="panel flex flex-col gap-4 p-5 md:p-6">
      <div>
        <span className="eyebrow">How the agents got here</span>
        <h2 id="method" className="m-0 mt-1 text-[22px] leading-7 text-ink">Chosen by an optimizer, checked by the engine, argued by the reviewers</h2>
      </div>
      <ol className="m-0 flex list-none flex-col gap-4 p-0">
        {steps.map((st, i) => (
          <li key={st.title} className="grid grid-cols-[28px_minmax(0,1fr)] gap-x-3">
            <span className="num grid h-7 w-7 place-items-center rounded-full border border-line2 text-[12px] text-ink-muted">{i + 1}</span>
            <div className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[15px] font-medium text-ink">{st.title}</span>
              <div className="text-[14px] leading-6 text-ink-muted">{st.body}</div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * The proof: the plan was tested by the engine from every place an attack could start,
 * not only the one on screen. One row per start: machines infected without the plan (grey)
 * and with it (blue). Sorted by what the attack would have reached.
 */
function Proof({ evidence }: { evidence: NonNullable<RecommendationRow["evidence"]> }) {
  const rows = [...evidence].sort((a, b) => b.baseline - a.baseline || a.name.localeCompare(b.name));
  const max = Math.max(1, ...rows.map((r) => r.baseline));
  const avg = (k: "baseline" | "plan") => rows.reduce((a, r) => a + r[k], 0) / rows.length;
  const held = rows.filter((r) => r.plan <= Math.max(3, Math.floor(r.baseline / 4))).length;
  return (
    <section aria-labelledby="proof" className="flex flex-col gap-3 rounded-panel border border-line bg-panel2 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="proof" className="eyebrow m-0">Tested from every possible start · {rows.length}</h3>
        <span className="num text-[12px] text-ink-muted">
          average <span className="text-ink-faint line-through">{avg("baseline").toFixed(1)}</span> → <span className="text-ink">{avg("plan").toFixed(1)}</span> machines · holds {held} of {rows.length}
        </span>
      </div>
      <ul className="m-0 grid list-none gap-x-6 gap-y-1.5 p-0 sm:grid-cols-2" role="list">
        {rows.map((r) => (
          <li key={r.start} className="grid grid-cols-[108px_minmax(0,1fr)_44px] items-center gap-2" title={`${r.name}: ${r.baseline} machines without the plan, ${r.plan} with it`}>
            <span className="num truncate text-[11px] text-ink-muted">{r.name}</span>
            <span className="relative block h-3">
              <span className="absolute inset-y-0 left-0 rounded-[1px] bg-line2" style={{ width: `${(r.baseline / max) * 100}%` }} />
              <span className="absolute inset-y-[3px] left-0 rounded-[1px] bg-state-healthy" style={{ width: `${(r.plan / max) * 100}%` }} />
            </span>
            <span className="num text-right text-[11px] tabular-nums"><span className="text-ink-faint">{r.baseline}</span><span className="text-ink-faint"> → </span><span className="text-ink">{r.plan}</span></span>
          </li>
        ))}
      </ul>
      <span className="num text-[11px] text-ink-faint">Grey: machines the attack reaches with no plan. Blue: with this plan. Same engine as the two replays above.</span>
    </section>
  );
}

/** The money, and in the same card the two things it buys: machines and patients kept out of it. */
function MoneyCard({ money, saved }: { money: Money; saved: Saved }) {
  const max = Math.max(money.implement, money.avoided, 1);
  const ratio = money.implement ? money.avoided / money.implement : 0;
  return (
    <section aria-labelledby="money" className="flex flex-col gap-4 rounded-panel border border-line bg-panel2 p-4">
      <div className="flex items-baseline justify-between">
        <h3 id="money" className="eyebrow m-0">The money · this attack</h3>
        {ratio >= 1 && <span className="num text-[12px] text-ink-muted">pays back {ratio.toFixed(1)}× in one incident</span>}
      </div>
      <Bar label="To put the plan in place" value={money.implement} max={max} color="#A1A8AE" />
      <Bar label="Avoided in this attack" value={money.avoided} max={max} color="#4DB0FF" />
      <p className="m-0 text-[15px] leading-6 text-ink">
        <span className="readout text-readout-m">{saved.machines}</span> machines and <span className="readout text-readout-m">{saved.patients}</span> patients kept out of it.
      </p>
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

/** The segmentation in words: the segments as halo chips, and what crosses between them. */
function SegmentationCard({ segments, cuts, crossing }: { segments: readonly Segment[]; cuts: number; crossing: number }) {
  return (
    <section aria-labelledby="segmentation" className="flex flex-col gap-3 rounded-panel border border-line bg-panel2 p-4">
      <h3 id="segmentation" className="eyebrow m-0">The segmentation</h3>
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
        {segments.map((s) => (
          <li key={s.zone} className="num inline-flex h-8 items-center gap-2 rounded-ctl border border-line2 px-2.5 text-[12px] text-ink">
            <span aria-hidden className="h-3.5 w-3.5 rounded-full border-2" style={{ borderColor: s.color, background: s.infected > 0 ? "#FF6A2E44" : "transparent" }} />
            {s.name}
            <span className={s.infected > 0 ? "text-state-infected" : "text-ink-faint"}>{s.infected > 0 ? `${s.infected}/${s.total}` : s.total}</span>
          </li>
        ))}
      </ul>
      <p className="m-0 text-[14px] leading-6 text-ink-muted">
        {segments.length} segments, each a group of machines that can still reach each other. File sharing and remote desktop no longer cross between them
        ({cuts} links cut); scans, vitals and charts still do ({crossing} protected clinical connections kept). An attack fills its own segment and stops at the edge.
      </p>
    </section>
  );
}

// --- What the agents negotiated over: one bar per agent, from the round's rows ---

type ConcessionRow = {
  agent: AgentId;
  /** What the agent held out for, in words. */
  what: string;
  /** How much it got: targets kept, questions answered, links given back, rounds run. */
  value: number;
  unit: string;
};

/**
 * Clinical Workflow: the connections and services its rejections made the plan keep.
 * Inventory: the devices it would not touch until a human named them. Flow: the
 * links it gave back to care after rejections (the same targets, from its side).
 * Coordinator: the rounds it ran. Nothing is inferred beyond reading the rows.
 */
export function concessionsOf(messages: readonly AgentMessageRow[], rounds: number, name: (id: string) => string): ConcessionRow[] {
  const by = (agent: AgentId) => messages.filter((m) => m.from === agent);
  const targets = (agent: AgentId, kinds: string[]) =>
    [...new Set(by(agent).filter((m) => m.type === "reject" && m.constraint && kinds.includes(m.constraint.kind)).flatMap((m) => m.constraint!.targetIds))];
  const clinical = targets("clinical_workflow", ["keep_flow", "keep_service"]);
  const inventory = [...new Set([...targets("inventory", ["confirm_device"]), ...by("inventory").filter((m) => m.type === "question").map((m) => m.reason)])];
  const questions = by("inventory").filter((m) => m.type === "question").length;
  const gaveBack = [...new Set([...clinical, ...targets("inventory", ["keep_flow", "keep_service"])])];
  const revisions = by("flow").filter((m) => m.type === "revision").length;
  const few = (ids: string[], n = 2) => (ids.length <= n ? ids.map(name).join(", ") : `${ids.slice(0, n).map(name).join(", ")} +${ids.length - n}`);
  return [
    {
      agent: "clinical_workflow",
      what: clinical.length ? `insisted the plan keep ${few(clinical)}` : "accepted the first plan as it was",
      value: clinical.length,
      unit: clinical.length === 1 ? "connection kept" : "connections kept",
    },
    {
      agent: "inventory",
      what: questions ? `stopped to ask a person about ${few(targets("inventory", ["confirm_device"]))}` : "could name every device the plan touches",
      value: inventory.length,
      unit: inventory.length === 1 ? "device confirmed" : "devices confirmed",
    },
    {
      agent: "flow",
      what: gaveBack.length ? `gave ${gaveBack.length} ${gaveBack.length === 1 ? "link" : "links"} back to care and redrew the plan ${revisions}×` : "kept its first plan",
      value: gaveBack.length,
      unit: gaveBack.length === 1 ? "link given back" : "links given back",
    },
    {
      agent: "coordinator",
      what: `ran ${rounds} ${rounds === 1 ? "round" : "rounds"} and routed every plan to both reviewers`,
      value: rounds,
      unit: rounds === 1 ? "round" : "rounds",
    },
  ];
}

function ConcessionsCard({ rows, rounds }: { rows: ConcessionRow[]; rounds: number }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <section aria-labelledby="negotiated" className="flex flex-col gap-3 rounded-panel border border-line bg-panel2 p-4">
      <div className="flex items-baseline justify-between">
        <h3 id="negotiated" className="eyebrow m-0">What they negotiated over</h3>
        <span className="num text-[12px] text-ink-faint">{rounds} {rounds === 1 ? "round" : "rounds"}</span>
      </div>
      <ul className="m-0 flex list-none flex-col gap-3 p-0" role="list">
        {rows.map((r) => (
          <li key={r.agent} className="grid grid-cols-[150px_minmax(0,1fr)] items-center gap-x-4 gap-y-1 sm:grid-cols-[170px_minmax(0,1fr)_minmax(0,1.6fr)]">
            <span className="inline-flex items-center gap-2 text-[13px]" style={{ color: SPEAKER_COLOR[r.agent] }}>
              <AgentGlyph who={r.agent} size={14} />
              {SPEAKER_LABEL[r.agent].replace(" Agent", "")}
            </span>
            <div className="flex items-center gap-3" title={`${r.value} ${r.unit}`}>
              <div className="h-3 flex-grow overflow-hidden rounded-[2px] bg-line2">
                <span className="block h-full rounded-[2px] transition-[width] duration-fade ease-breath" style={{ width: `${(r.value / max) * 100}%`, background: SPEAKER_COLOR[r.agent] }} />
              </div>
              <span className="num w-[132px] shrink-0 text-[12px] text-ink">
                {r.value} {r.unit}
              </span>
            </div>
            <p className="col-span-2 m-0 text-[13px] leading-5 text-ink-muted sm:col-span-1">{r.what}</p>
          </li>
        ))}
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
      <div className="readout mt-1 text-readout-l text-ink">{value}</div>
      {note && <div className="num mt-1 text-[12px] text-ink-muted">{note}</div>}
    </div>
  );
}
