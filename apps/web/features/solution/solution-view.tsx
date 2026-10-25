"use client";

import { useMemo, useState } from "react";
import { DeviceCard } from "@/components/panel/device-card";
import { HospitalScene } from "@/components/scene/hospital-scene";
import { SceneBoundary } from "@/components/scene/scene-boundary";
import { PatientBadge } from "@/components/shell/badges";
import { Brand } from "@/components/shell/brand";
import { initials, ROLE_LABEL, tickClock } from "@/lib/format";
import { useRoleView } from "@/lib/role-views";
import { pairOf, roundRefusal, SPEEDS, type PlaybackControl } from "@/lib/stdb/run-status";
import { useRunRows, useSessionIndex } from "@/lib/stdb/use-session";
import type { RunRow, SessionSnapshot } from "@/lib/stdb/types";
import type { SessionIndex } from "@/lib/stdb/use-session";
import {
  beforeAfter, pairClock, pairRefusal, pairTarget, planFlows, sceneOf, stripPending, withoutSegmentation,
  type Delta, type Segment,
} from "./pair";
import { Conclusion } from "./conclusion";
import { HoleLines } from "./hole-lines";
import { SegmentBarriers } from "./segment-barriers";
import { functionalSegmentsOf } from "./segments";
import { SegmentHalos } from "./segment-halos";

// The segmentation plan screen (UX.md "Solution view"): the same attack
// replayed on the clinic with the plan in place, drawn exactly as the
// simulation screen draws it (walls, furniture, people, device chips, the
// infection path, a ✕ where the attack met a cut connection), under one
// transport and clock. Under the map, the conclusion: what the agents proposed,
// what was rejected and why, the compromises that came out of it, and how the
// plan held the attack. Both runs are live rows the watcher feeds through the
// engine; nothing here computes spread.

const MIN_SPAN = 16; // 4 simulated hours, until the run settles

export function SolutionView({ session }: { session: SessionSnapshot }) {
  const { none, plan } = pairOf(session.runs, session.solutionPairId);
  const base = useRunRows(none?.id ?? "");
  const rows = useRunRows(plan?.id ?? "");
  const planRun = rows.run ?? plan;
  const planScene = sceneOf(session, { ...rows, run: planRun });
  const index = useSessionIndex(planScene);
  const roleView = useRoleView(planScene);
  const [hovered, setHovered] = useState<string | null>(null);
  const [listZone, setListZone] = useState<string | null>(null);
  const [floor, setFloor] = useState("all");
  const [err, setErr] = useState<string>();
  const [closing, setClosing] = useState(false);

  const { hospital } = session;
  const rec = session.recommendations.find((r) => r.id === plan?.recommendationId);
  const sides = [none, planRun];
  const clock = pairClock(sides);
  const tick = clock.tick;
  const flows = useMemo(() => planFlows(hospital, planRun), [hospital, planRun]);
  // The plan's segments: machines still joined by lateral links after its cuts, with the run's infected counts.
  // The run row's removed flows arrive with the engine's first frame; until then the recommendation's
  // test run (the same engine, same policy: parity) says what the plan cuts.
  const removedFlows = planRun?.removedFlows.length ? planRun.removedFlows : rec?.verified.removedFlows ?? [];
  // The plan's segments: the functional networks its rules wall off (segments.ts), once a plan exists.
  const segments = useMemo(
    () => (removedFlows.length ? functionalSegmentsOf(hospital, planScene.devices) : []),
    [hospital, planScene.devices, removedFlows.length],
  );
  const segmentOf = useMemo(() => new Map(segments.flatMap((s) => s.deviceIds.map((id) => [id, s.zone] as const))), [segments]);
  // Per segment, the protocols still allowed through its wall (kept connections that cross it), in standard names.
  const allowed = useMemo(() => {
    const NAME: Record<string, string> = { dicom: "DICOM", hl7: "HL7", https: "HTTPS", http: "HTTP", smb: "SMB", rdp: "RDP" };
    const by = new Map<string, Set<string>>();
    for (const f of flows.kept) {
      const a = segmentOf.get(f.from);
      const b = segmentOf.get(f.to);
      if (!a || !b || a === b) continue;
      const name = f.port === 123 ? "NTP" : NAME[f.protocol] ?? f.protocol.toUpperCase();
      for (const z of [a, b]) by.set(z, (by.get(z) ?? new Set()).add(name));
    }
    return new Map([...by].map(([z, set]) => [z, [...set].sort()]));
  }, [flows.kept, segmentOf]);
  const hoveredZone = hovered ? segmentOf.get(hovered) ?? null : null;
  const rowsError = base.error ?? rows.error;
  // The side column: this step's count on both sides, and the final numbers once each side is done.
  const infectedNow = planScene.devices.filter((d) => d.infected).length;
  const ghost = withoutSegmentation(base.run ?? none, base.devices, tick);
  const deltas = beforeAfter(hospital, base.run ?? none, planRun, rec?.rules.length);
  const pending = stripPending(base.run ?? none, planRun);

  const baselineRuns = session.runs.filter((r) => !r.pairId);
  const runNo = baselineRuns.findIndex((r) => r.id === session.activeRunId) + 1;
  const pz = index.device.get(planRun?.patientZero ?? none?.patientZero ?? "")?.name;
  const subtitle = [`Same attack as ${runNo ? `Run ${runNo}` : "the baseline"}`, pz ? `patient zero ${pz}` : ""]
    .filter(Boolean)
    .join(" · ");

  const close = async () => {
    setErr(undefined);
    setClosing(true);
    try {
      await session.actions.closeSolution();
    } catch (e) {
      setErr((e as Error).message);
      setClosing(false);
    }
  };

  const floors = [...hospital.floors].sort((a, b) => b.level - a.level);
  const deviceCount = (fid: string) => hospital.devices.filter((d) => index.room.get(d.roomId)?.floorId === fid).length;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-bg">
        <div className="flex min-h-14 flex-wrap items-center gap-x-4 gap-y-3 px-4 py-2 md:px-6">
          <Brand />
          <span aria-hidden className="h-5 w-px bg-line" />
          <span className="min-w-0 truncate text-[15px] leading-5 text-ink-muted">{hospital.name}</span>
          <div className="ml-auto">
            {session.isPresenter ? (
              <button type="button" onClick={close} disabled={closing} className="btn min-h-9 px-3 text-xs">
                ← Back to the session
              </button>
            ) : (
              <span className="num text-xs text-ink-faint">{session.presenterName} leads this view</span>
            )}
          </div>
        </div>
      </header>

      <main className="flex flex-grow flex-col gap-6 p-4 md:p-6">
        <section aria-label="The plan holding the attack" className="panel flex min-w-0 flex-col overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-line p-4">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="eyebrow">With the plan in place</span>
              <span className="readout text-[19px] leading-6 text-ink">{rec?.name ?? planRun?.label ?? "Computing the plan…"}</span>
              <span className="num text-xs text-ink-muted">{subtitle}</span>
            </div>

            <Transport session={session} sides={sides} tick={tick} statusLine={clock.line.startsWith("Step") ? undefined : clock.line} onError={setErr} />
            {(err || rowsError) && (
              <p role="alert" className="num m-0 text-xs text-ink-muted">{err ?? rowsError}</p>
            )}
            <Scrubber run={planRun} snapshots={rows.snapshots} />
          </div>

          <div className="flex flex-grow flex-col bg-scene-ground">
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 p-4">
              <div className="relative inline-flex">
                <label htmlFor="plan-floor" className="sr-only">Floor</label>
                <select
                  id="plan-floor"
                  value={floor}
                  onChange={(e) => {
                    setFloor(e.target.value);
                    setHovered(null);
                  }}
                  className="num h-11 cursor-pointer appearance-none rounded-ctl border border-line2 bg-panel2 pl-3 pr-9 text-xs text-ink"
                >
                  <option value="all">All floors · {hospital.devices.length} devices</option>
                  {floors.map((f) => (
                    <option key={f.id} value={f.id}>{f.name} · {deviceCount(f.id)} devices</option>
                  ))}
                </select>
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted">
                  <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <Legend />
            </div>

            <div className="grid flex-grow lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="relative min-h-[620px] flex-1">
              {/* Pinned to the box: this panel stands alone in a column, so the canvas's own
                  height:100% has nothing definite to resolve against and would fall to 150px. */}
              <div className="absolute inset-0">
                <SceneBoundary session={planScene}>
                  <HospitalScene
                    session={planScene}
                    index={index}
                    hovered={hovered}
                    onHover={setHovered}
                    floorId={floor === "all" ? undefined : floor}
                    view={roleView}
                  >
                    <SegmentBarriers hospital={hospital} segments={segments} floorId={floor === "all" ? undefined : floor} litZone={hoveredZone ?? listZone} />
                    <HoleLines hospital={hospital} kept={flows.kept} segmentOf={segmentOf} litZone={hoveredZone ?? listZone} floorId={floor === "all" ? undefined : floor} />
                    <SegmentHalos hospital={hospital} segments={segments} devices={rows.devices} floorId={floor === "all" ? undefined : floor} litZone={hoveredZone ?? listZone} />
                  </HospitalScene>
                </SceneBoundary>
              </div>
              {hovered && (
                <div className="pointer-events-none absolute right-4 top-4 z-10">
                  <DeviceCard session={planScene} index={index} deviceId={hovered} view={roleView} />
                </div>
              )}
              <span className="num pointer-events-none absolute bottom-3 left-4 text-[11px] text-ink-faint">
                Drag to turn the building · scroll to zoom · hover a device
              </span>
            </div>

            <aside aria-label="Before and after" className="flex min-w-0 flex-col gap-5 border-t border-line bg-bg p-4 lg:border-l lg:border-t-0">
              <Headline before={ghost} after={infectedNow} total={hospital.devices.length} />
              <Saved deltas={deltas} pending={pending} />
              <Segments segments={segments} hovered={hoveredZone ?? listZone} onHover={setListZone} allowed={allowed} />
            </aside>
            </div>
          </div>
        </section>

        <Conclusion session={session} rec={rec} none={base.run ?? none} plan={planRun} planDevices={rows.devices} segments={segments} />
      </main>

      <footer className="num mt-auto border-t border-line px-4 py-3 text-[11px] text-ink-faint md:px-6">
        Synthetic data · illustrative simulation, not a change to any network · only humans decide what gets deployed.
      </footer>
    </div>
  );
}

function Transport({
  session,
  sides,
  tick,
  statusLine,
  onError,
}: {
  session: SessionSnapshot;
  sides: readonly (RunRow | undefined)[];
  tick: number;
  /** "Computing the rerun…" or a failed side's detail, under the clock. */
  statusLine?: string;
  onError: (message?: string) => void;
}) {
  const can = session.isPresenter;
  const lock = can ? null : `Only ${session.presenterName} controls playback.`;
  const why = (c: PlaybackControl) => lock ?? roundRefusal(c, session.roundState) ?? pairRefusal(c, sides);
  const send = (c: PlaybackControl) => () => {
    const run = pairTarget(c, sides);
    if (!run) return;
    onError(undefined);
    session.actions[c](run.id).catch((e: Error) => onError(e.message));
  };
  const playing = pairTarget("pause", sides)?.status === "running";
  const toggle: PlaybackControl = playing ? "pause" : "play";
  const speedRun = pairTarget("speed", sides);
  const setSpeed = (s: (typeof SPEEDS)[number]) => () => {
    if (!speedRun) return;
    onError(undefined);
    session.actions.setSpeed(s, speedRun.id).catch((e: Error) => onError(e.message));
  };

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
      <div className="flex gap-2">
        <button type="button" className="ctl w-11" aria-label="Back to the start" title={why("reset") ?? "Back to the start"} disabled={!!why("reset")} onClick={send("reset")}>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
            <path d="M4 3v10M13 3.5 6.5 8l6.5 4.5z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          </svg>
        </button>
        <button type="button" className="ctl ctl-on w-11" aria-label={playing ? "Pause" : "Play"} title={why(toggle) ?? undefined} disabled={!!why(toggle)} onClick={send(toggle)}>
          {playing ? (
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
              <path d="M4.5 3h2.5v10H4.5zM9 3h2.5v10H9z" fill="currentColor" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
              <path d="M5 3v10l8-5z" fill="currentColor" />
            </svg>
          )}
        </button>
        <button type="button" className="ctl w-11" aria-label="Forward 15 minutes" title={why("step") ?? "Forward 15 minutes"} disabled={!!why("step")} onClick={send("step")}>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
            <path d="M12 3v10M3 3.5 9.5 8 3 12.5z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div className="flex flex-col">
        <span className="readout text-readout-m" aria-live="off">{tickClock(tick)}</span>
        {statusLine && <span className="num text-[11px] text-ink-faint">{statusLine}</span>}
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-x-5 gap-y-3">
        <div role="group" aria-label="Simulation speed" className="flex gap-0.5 rounded-ctl border border-line2 p-[3px]">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={s === speedRun?.speed}
              disabled={!can || !speedRun}
              title={lock ?? undefined}
              onClick={setSpeed(s)}
              className={`num h-9 min-w-[44px] rounded-[1px] px-2.5 text-xs disabled:cursor-not-allowed ${
                s === speedRun?.speed ? "bg-select font-medium text-select-on" : "text-ink-muted enabled:hover:text-ink"
              }`}
            >
              {s}×
            </button>
          ))}
        </div>
        <span aria-hidden className="hidden h-7 w-px bg-line sm:block" />
        <Presence session={session} />
      </div>
    </div>
  );
}

/** The plan run's track: the scrubber, a heat strip from its tick_snapshot rows, and the time labels. */
function Scrubber({ run, snapshots }: { run?: RunRow; snapshots: SessionSnapshot["snapshots"] }) {
  const runTick = run?.tick ?? 0;
  const settled = run?.status === "done";
  const playing = run?.status === "running";
  const span = settled ? Math.max(runTick, 1) : Math.max(runTick + 4, MIN_SPAN);
  const heat = useMemo(() => {
    const byTick = new Map(snapshots.map((s) => [s.tick, s.infectedCount]));
    const peak = Math.max(1, ...snapshots.map((s) => s.infectedCount));
    // Segment t covers the tick that ends at t + 1, so the played part ends under the thumb.
    return Array.from({ length: span }, (_, t) => {
      const c = byTick.get(t + 1) ?? byTick.get(t) ?? 0;
      return t < runTick ? `rgba(255,106,46,${(0.12 + 0.75 * (c / peak)).toFixed(2)})` : "rgba(125,133,139,0.08)";
    });
  }, [snapshots, span, runTick]);
  const pct = (tick: number) => `${(Math.min(tick, span) / span) * 100}%`;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative mx-[7px]">
        <div className="relative h-7" role="img" aria-label={`${tickClock(runTick)} of ${settled ? tickClock(span) : "a run still going"}`}>
          <span className="absolute inset-x-0 top-[13px] h-0.5 bg-line2" />
          <span className="absolute left-0 top-[13px] h-0.5 bg-ink" style={{ width: pct(runTick) }} />
          <span
            className="absolute top-[7px] h-3.5 w-3.5 -translate-x-1/2 rounded-full border-[3px] border-bg bg-ink shadow-[0_0_0_1px_#E9ECEE] transition-[left] duration-fade ease-travel"
            style={{ left: pct(runTick) }}
          />
        </div>
      </div>
      <div aria-hidden className="flex h-1.5 gap-0.5 px-[7px]">
        {heat.map((bg, t) => (
          <span key={t} className="flex-[1_1_0]" style={{ background: bg }} />
        ))}
      </div>
      <div className="num flex justify-between px-[7px] text-[11px] leading-[14px] text-ink-faint">
        <span>T+0:00</span>
        <span>{tickClock(Math.round(span / 2))}</span>
        <span>{settled ? `Settles ${tickClock(span)}` : playing ? "Spreading" : tickClock(span)}</span>
      </div>
    </div>
  );
}

const AVATAR_FILL = ["#4A5258", "#3E4448", "#2F3438"];

/** Who is here: three avatars, then +N. The presenter wears the ink ring. */
function Presence({ session }: { session: SessionSnapshot }) {
  const people = session.presence;
  const shown = people.slice(0, 3);
  const extra = people.length - shown.length;
  return (
    <div role="group" aria-label={`${people.length} ${people.length === 1 ? "person" : "people"} in this session`} className="flex items-center pl-0.5">
      {shown.map((p, i) => {
        const presenting = p.name === session.presenterName;
        return (
          <span
            key={`${p.name}-${i}`}
            title={`${p.name} · ${ROLE_LABEL[p.role]}${presenting ? " · presenting" : ""}`}
            className="num relative inline-flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-medium text-ink"
            style={{
              marginLeft: i ? -8 : 0,
              background: AVATAR_FILL[i],
              boxShadow: presenting ? "0 0 0 2px #0D0F10, 0 0 0 3.5px #E9ECEE" : "0 0 0 2px #0D0F10",
            }}
          >
            {initials(p.name)}
          </span>
        );
      })}
      {extra > 0 && (
        <span title={`${extra} more`} className="num relative -ml-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-panel2 text-[11px] font-medium text-ink shadow-[0_0_0_2px_#0D0F10]">
          +{extra}
        </span>
      )}
    </div>
  );
}


/** This step, live on both sides: how many devices the attack has reached without the plan and with it. */
function Headline({ before, after, total }: { before?: number; after: number; total: number }) {
  const blocked = before === undefined ? undefined : Math.max(0, before - after);
  const pct = (n: number) => (total ? Math.min(100, (n / total) * 100) : 0);
  return (
    <section aria-label="Devices infected at this step" className="flex flex-col gap-3">
      <span className="eyebrow">Devices infected · at this step</span>
      <div className="flex items-baseline gap-3 tabular-nums">
        <span className="readout text-readout-l text-state-infected line-through decoration-2 opacity-70">{before ?? "—"}</span>
        <span className="num text-sm text-ink-faint">→</span>
        <span className="readout text-readout-l text-state-healthy">{after}</span>
        <span className="num ml-auto text-xs text-ink-muted">{blocked === undefined ? "" : `${blocked} blocked`}</span>
      </div>
      <div className="flex flex-col gap-1">
        <div role="progressbar" aria-label="Without segmentation" aria-valuemin={0} aria-valuemax={total} aria-valuenow={before ?? 0} className="h-2 overflow-hidden rounded-[1px] bg-panel2">
          <span className="block h-full bg-state-infected transition-[width] duration-fade ease-breath" style={{ width: `${pct(before ?? 0)}%` }} />
        </div>
        <div role="progressbar" aria-label="With the plan" aria-valuemin={0} aria-valuemax={total} aria-valuenow={after} className="h-2 overflow-hidden rounded-[1px] bg-panel2">
          <span className="block h-full bg-state-healthy transition-[width] duration-fade ease-breath" style={{ width: `${pct(after)}%` }} />
        </div>
      </div>
      <span className="num text-xs text-ink-muted">
        {before === undefined ? "The no-segmentation rerun is still computing" : "Struck through: the same attack without segmentation"}
      </span>
    </section>
  );
}

/** The final numbers, each from the two run rows, the old one struck through ("16 → 2"). */
function Saved({ deltas, pending }: { deltas: Delta[]; pending: string | null }) {
  return (
    <section aria-labelledby="saved" className="flex flex-col gap-3">
      <h2 id="saved" className="eyebrow m-0">Before → after · when both settle</h2>
      {pending && <p role="status" className="num m-0 text-[11px] text-ink-faint">Final numbers fill in as each side finishes · {pending}</p>}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-panel border border-line bg-line">
        {deltas.map((d) => (
          <div key={d.label} className="flex min-w-0 flex-col gap-1.5 bg-panel px-3.5 py-3">
            <span className="eyebrow !tracking-[0.1em]">{d.label}</span>
            <div className="flex items-baseline gap-2 tabular-nums">
              <span className="num text-xs text-ink-faint line-through">{d.before ?? "—"}</span>
              <span className="num text-xs text-ink-faint">→</span>
              <span className="readout text-readout-m">{d.after ?? "—"}</span>
            </div>
            {d.note && <span className="num text-xs text-ink-muted">{d.note}</span>}
          </div>
        ))}
      </div>
    </section>
  );
}

/** The plan's segments: swatch, name, floors, and how many of its devices this run shows infected. Hover one to light its fence. */
function Segments({ segments, hovered, onHover, allowed }: { segments: Segment[]; hovered: string | null; onHover: (zone: string | null) => void; allowed: Map<string, string[]> }) {
  return (
    <section aria-labelledby="segments" className="flex flex-col gap-3">
      <h2 id="segments" className="eyebrow m-0">Segments the plan makes · {segments.length} · the barriers</h2>
      <ul className="m-0 flex list-none flex-col overflow-hidden rounded-panel border border-line p-0" onMouseLeave={() => onHover(null)}>
        {segments.map((s) => {
          const lit = s.infected > 0 || hovered === s.zone;
          const through = allowed.get(s.zone) ?? [];
          return (
            <li
              key={s.zone}
              onMouseEnter={() => onHover(s.zone)}
              title={through.length ? `Allowed through the wall: ${through.join(", ")}` : "Nothing crosses this wall"}
              className={`num flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-3 py-2.5 text-xs last:border-b-0 ${lit ? "bg-select-wash" : ""}`}
            >
              <span
                aria-hidden
                className="h-3.5 w-3.5 shrink-0 rounded-full border-2"
                style={{ borderColor: s.color, background: s.infected > 0 ? "#FF6A2E44" : "transparent" }}
              />
              <span className="min-w-0 flex-auto truncate text-ink">{s.name}</span>
              <span className="text-ink-muted">{s.floors}</span>
              <span className={`w-10 text-right tabular-nums ${s.infected > 0 ? "text-state-infected" : "text-ink"}`}>
                {s.infected > 0 ? `${s.infected}/${s.total}` : s.total}
              </span>
              {hovered === s.zone && (
                <span className="basis-full pl-6 text-[11px] text-ink-muted">
                  {through.length ? `Allowed through: ${through.join(" · ")}` : "Nothing crosses this wall"}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Legend() {
  return (
    <ul className="num m-0 flex list-none flex-wrap gap-x-5 gap-y-2 p-0 text-xs leading-4 text-ink-muted">
      <li className="inline-flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-state-healthy" />
        Healthy
      </li>
      <li className="inline-flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-state-zero shadow-[0_0_0_2px_#111315,0_0_0_3px_#E9ECEE]" />
        Patient zero
      </li>
      <li className="inline-flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-state-infected" />
        Infected
      </li>
      <li className="inline-flex items-center gap-2">
        <svg width="22" height="8" viewBox="0 0 22 8" aria-hidden>
          <path d="M1 7Q11 -1 19 5" fill="none" stroke="#FF6A2E" strokeWidth="1.5" />
          <path d="M21 6.5 17 6.8 18.6 3.3z" fill="#FF6A2E" />
        </svg>
        Infection path
      </li>
      <li className="inline-flex items-center gap-2">
        <span aria-hidden className="h-3.5 w-3.5 rounded-full border-2" style={{ borderColor: "#B08CFF" }} />
        Barrier: a functional segment (its machines still reach each other)
      </li>
      <li className="inline-flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ background: "#6FCF97" }} />
        Patients
      </li>
      <li className="inline-flex items-center gap-2">
        <PatientBadge state="delayed" /> Delayed
      </li>
      <li className="inline-flex items-center gap-2">
        <PatientBadge state="disrupted" /> Disrupted
      </li>
    </ul>
  );
}
