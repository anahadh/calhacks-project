"use client";

import { useMemo, useState } from "react";
import { SystemsDown } from "@/components/panel/spread";
import { SceneBoundary } from "@/components/scene/scene-boundary";
import { Brand } from "@/components/shell/brand";
import { initials, ROLE_LABEL, tickClock } from "@/lib/format";
import { pairOf, roundRefusal, SPEEDS, type PlaybackControl } from "@/lib/stdb/run-status";
import { useRunRows, useSessionIndex } from "@/lib/stdb/use-session";
import type { RunRow, SessionSnapshot } from "@/lib/stdb/types";
import {
  beforeAfter, pairClock, pairRefusal, pairTarget, planFlows, sceneOf, segmentsOf, stripPending, withoutSegmentation,
  type Delta, type Segment,
} from "./pair";
import { PlanScene } from "./plan-scene";

// The segmentation plan screen (UX.md "Solution view", the design's screen 4):
// the plan's rerun of the same attack, on one scene, with what the baseline
// rerun ("no segmentation") did drawn against it as numbers. Both are live
// runs the watcher feeds through the engine, moved as one pair; every tab
// opens this view while session.solution_pair_id is set. The scene and the
// side column read the plan run's rows; the baseline's row gives the
// "without segmentation" numbers. Nothing here computes spread.

const MIN_SPAN = 16; // 4 simulated hours, until the run settles

export function SolutionView({ session }: { session: SessionSnapshot }) {
  const { none, plan } = pairOf(session.runs, session.solutionPairId);
  const base = useRunRows(none?.id ?? "");
  const rows = useRunRows(plan?.id ?? "");
  const planRun = rows.run ?? plan;
  const planScene = sceneOf(session, { ...rows, run: planRun });
  const index = useSessionIndex(planScene);
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);
  const [floor, setFloor] = useState("all");
  const [err, setErr] = useState<string>();
  const [closing, setClosing] = useState(false);

  const { hospital } = session;
  const rec = session.recommendations.find((r) => r.id === plan?.recommendationId);
  const sides = [none, planRun];
  const clock = pairClock(sides);
  const tick = planRun?.tick ?? clock.tick;
  const segments = useMemo(() => segmentsOf(hospital, rows.devices), [hospital, rows.devices]);
  const flows = useMemo(() => planFlows(hospital, planRun), [hospital, planRun]);
  const deltas = beforeAfter(hospital, none, planRun, rec?.rules.length);
  const pending = stripPending(none, planRun);
  const ghost = withoutSegmentation(base.run ?? none, base.devices, tick);
  // A pair run's subscription failing is shown as written (rule 14), never as an empty scene.
  const rowsError = base.error ?? rows.error;
  const notes = [...new Set([...(none?.assumptions ?? []), ...(planRun?.assumptions ?? [])])];

  const baselineRuns = session.runs.filter((r) => !r.pairId);
  const runNo = baselineRuns.findIndex((r) => r.id === session.activeRunId) + 1;
  const pz = index.device.get(planRun?.patientZero ?? none?.patientZero ?? "")?.name;
  const subtitle = [`Same attack and seed as ${runNo ? `Run ${runNo}` : "the baseline"}`, pz ? `patient zero ${pz}` : ""]
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

      <main className="flex flex-grow flex-wrap items-stretch gap-6 p-4 md:p-6">
        <section aria-label="Segmentation plan" className="panel flex min-w-0 flex-[999_1_760px] flex-col overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-line p-4">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="eyebrow">Segmentation plan</span>
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
                  onChange={(e) => setFloor(e.target.value)}
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

            <div className="relative min-h-[620px] flex-1">
              <SceneBoundary session={planScene}>
                <PlanScene
                  hospital={hospital}
                  devices={rows.devices}
                  segments={segments}
                  kept={flows.kept}
                  cut={flows.cut}
                  patientZero={planRun?.patientZero}
                  hoveredZone={hoveredZone}
                  onHoverZone={setHoveredZone}
                  floorId={floor === "all" ? undefined : floor}
                />
              </SceneBoundary>
              <span className="num pointer-events-none absolute bottom-3 left-4 text-[11px] text-ink-faint">
                Drag to rotate · scroll to zoom · hover a device
              </span>
            </div>
          </div>
        </section>

        <aside aria-label="What segmentation saved" className="flex min-w-0 flex-[1_1_380px] flex-col gap-5">
          <Infected total={hospital.devices.length} infected={rows.totals.devicesCompromised} ghost={ghost} />
          <Saved deltas={deltas} pending={pending} />
          <Segments segments={segments} hovered={hoveredZone} onHover={setHoveredZone} />
          <SystemsDown session={planScene} index={index} />
          <p className="num m-0 text-[11px] leading-relaxed text-ink-faint">
            Illustrative simulation. Spread rates are not measured from real incidents. This rerun is a simulation, not a
            change to any network: only humans decide what gets deployed.
          </p>
          {notes.length > 0 && (
            <details className="num text-[11px] text-ink-faint">
              <summary className="cursor-pointer">What the engine assumed ({notes.length})</summary>
              <ul className="mt-1 list-disc pl-5">{notes.map((n, i) => (<li key={i}>{n}</li>))}</ul>
            </details>
          )}
        </aside>
      </main>

      <footer className="num mt-auto border-t border-line px-4 py-3 text-[11px] text-ink-faint md:px-6">
        Synthetic data · illustrative simulation · humans approve every plan.
      </footer>
    </div>
  );
}

/**
 * The transport row, as on the simulation screen: back to start, play/pause,
 * forward 15 minutes, the clock, speed and presence. Each control is sent to
 * the side of the pair it can act on (pairTarget); the module moves both.
 */
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

function Legend() {
  return (
    <ul className="num m-0 flex list-none flex-wrap gap-x-5 gap-y-2 p-0 text-xs leading-4 text-ink-muted">
      <li className="inline-flex items-center gap-2">
        <span className="h-2.5 w-4 rounded-full border-[1.5px] border-state-zone" />
        Infected segment
      </li>
      <li className="inline-flex items-center gap-2">
        <span className="h-px w-5 bg-state-healthy" />
        Kept clinical flow
      </li>
      <li className="inline-flex items-center gap-2">
        <span className="inline-flex items-center gap-1">
          <span className="h-px w-5 border-t border-dashed border-state-cut" />
          <span className="text-[10px] text-state-cut">×</span>
        </span>
        Cut clinical flow
      </li>
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
          <path d="M1 7Q11 -1 19 5" fill="none" stroke="#FF6A2E" strokeWidth="1.5" strokeDasharray="2 2" />
          <path d="M21 6.5 17 6.8 18.6 3.3z" fill="#FF6A2E" />
        </svg>
        Infection path
      </li>
    </ul>
  );
}

/**
 * Devices infected under the plan, with the baseline's count by the same step
 * hatched past it, and the difference as infections blocked. `infected` is the
 * plan run row's column; `ghost` is withoutSegmentation().
 */
function Infected({ total, infected, ghost }: { total: number; infected: number; ghost?: number }) {
  const share = total ? Math.round((infected / total) * 100) : 0;
  const pct = (n: number) => (total ? Math.min(100, (n / total) * 100) : 0);
  const blocked = ghost === undefined ? undefined : Math.max(0, ghost - infected);
  return (
    <div className="panel flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-3">
        <span className="eyebrow">Devices infected</span>
        <div className="flex items-baseline gap-2 tabular-nums">
          <span className="readout text-readout-l">{infected}</span>
          <span className="readout text-readout-m text-ink-muted">/ {total}</span>
          <span className="num ml-auto text-xs text-ink-muted">{share}%</span>
        </div>
        <div role="progressbar" aria-label="Devices infected" aria-valuemin={0} aria-valuemax={total} aria-valuenow={infected} className="relative h-2.5 overflow-hidden rounded-[1px] bg-panel2">
          {ghost !== undefined && ghost > infected && (
            <span
              aria-hidden
              className="absolute inset-y-0 transition-[width,left] duration-fade ease-breath"
              style={{
                left: `${pct(infected)}%`,
                width: `${pct(ghost) - pct(infected)}%`,
                background: "repeating-linear-gradient(135deg, rgba(255,106,46,0.6) 0 2px, transparent 2px 5px)",
              }}
            />
          )}
          <span className="absolute inset-y-0 left-0 bg-state-infected transition-[width] duration-fade ease-breath" style={{ width: `${pct(infected)}%` }} />
        </div>
        <span className="num text-xs text-ink-muted">
          {ghost === undefined ? "Hatched: the no-segmentation rerun is still computing" : `Hatched: ${ghost} infected by now without segmentation`}
        </span>
      </div>
      <div className="flex items-center gap-3 border-t border-line pt-3">
        <span className="eyebrow flex-auto">Infections blocked</span>
        <span className="readout text-readout-m">{blocked ?? "—"}</span>
      </div>
    </div>
  );
}

/** The 2×2 grid: each number from the two run rows, the old one struck through ("16 → 2"). */
function Saved({ deltas, pending }: { deltas: Delta[]; pending: string | null }) {
  return (
    <section aria-labelledby="saved" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <h2 id="saved" className="eyebrow m-0">What segmentation saved</h2>
        <span className="eyebrow">· versus no segmentation</span>
      </div>
      {pending && (
        <p role="status" className="num m-0 text-[11px] text-ink-faint">Final numbers fill in as each side finishes · {pending}</p>
      )}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-panel border border-line bg-line">
        {deltas.map((d) => (
          <div key={d.label} className="flex min-w-0 flex-col gap-2 bg-panel px-4 py-3">
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

/** The hospital's segments: swatch, name, floors, and how many of its devices the plan run shows infected. */
function Segments({ segments, hovered, onHover }: { segments: Segment[]; hovered: string | null; onHover: (zone: string | null) => void }) {
  return (
    <section aria-labelledby="segments" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <h2 id="segments" className="eyebrow m-0">Segments · {segments.length}</h2>
        <p className="num m-0 text-xs leading-5 text-ink-muted">Shown on the hospital when infected. Hover a segment or a device to see any other.</p>
      </div>
      <ul className="m-0 flex list-none flex-col overflow-hidden rounded-panel border border-line p-0" onMouseLeave={() => onHover(null)}>
        {segments.map((s) => {
          const lit = s.infected > 0 || hovered === s.zone;
          return (
            <li
              key={s.zone}
              onMouseEnter={() => onHover(s.zone)}
              className={`num flex items-center gap-3 border-b border-line px-3 py-2.5 text-xs last:border-b-0 ${lit ? "bg-select-wash" : ""}`}
            >
              <span
                aria-hidden
                className="h-3 w-3 shrink-0 rounded-[2px] border-[1.5px]"
                style={{ borderColor: s.color, background: s.infected > 0 ? `${s.color}33` : "transparent" }}
              />
              <span className="min-w-0 flex-auto truncate text-ink">{s.name}</span>
              <span className="text-ink-muted">{s.floors}</span>
              <span className={`w-10 text-right tabular-nums ${s.infected > 0 ? "text-state-infected" : "text-ink"}`}>
                {s.infected > 0 ? `${s.infected}/${s.total}` : s.total}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
