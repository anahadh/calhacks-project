"use client";

import { useState } from "react";

import { tickClock } from "@/lib/format";
import type { SessionIndex } from "@/lib/stdb/use-session";
import type { SessionSnapshot, SimEventRow } from "@/lib/stdb/types";

// The timeline rail: playback controls, the scrubber and the current beat.
// History comes from tick_snapshot rows and markers from sim_event rows.
// Controls are inert until the run reducers exist.
const SPAN_TICKS = 48; // 12 simulated hours
const LABEL_EVERY = 8; // every 2 hours

const DOT: Record<string, string> = {
  patient_zero: "bg-state-infected ring-[3px] ring-state-infected/40",
  device_infected: "bg-state-infected",
  service_down: "bg-ink ring-[3px] ring-ink/25",
  diversion: "bg-state-disrupted",
};

export function Timeline({ session, index }: { session: SessionSnapshot; index: SessionIndex }) {
  const run = session.runs.find((r) => r.id === session.activeRunId) ?? session.runs[0];
  const [err, setErr] = useState<string>();
  const can = session.isPresenter;
  const act = (fn: () => Promise<unknown>) => () => {
    setErr(undefined);
    fn().catch((e: Error) => setErr(e.message));
  };
  const patientZero = index.device.get(run.patientZero)?.name ?? run.patientZero;
  const pct = (tick: number) => `${(tick / SPAN_TICKS) * 100}%`;
  const total = session.hospital.devices.length;

  // The beat is the latest tick with events, shown as one line.
  const lastTick = Math.max(...session.events.filter((e) => e.tick <= run.tick).map((e) => e.tick));
  const beat = session.events.filter((e) => e.tick === lastTick);

  return (
    <section className="rounded-panel border border-line bg-panel px-4 pb-4 pt-3.5">
      <div className="flex flex-wrap items-center gap-3.5">
        <button
          aria-label={run.status === "running" ? "Pause" : "Play"}
          disabled={!can}
          onClick={act(run.status === "running" ? session.actions.pause : session.actions.play)}
          className="disabled:opacity-40 grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line2 bg-panel2 text-ink transition hover:border-accent hover:text-accent"
        >
          {run.status === "running" ? (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
              <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {err && <span role="alert" className="text-[11px] text-state-infected">{err}</span>}
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="font-disp text-[19px] font-semibold tabular-nums">{tickClock(run.tick)}</span>
            <span className="num text-[11px] text-ink-faint">tick {run.tick}</span>
          </div>
          <div className="num text-[10.5px] uppercase tracking-[0.08em] text-ink-muted">
            {run.label} · patient zero {patientZero} · {run.status}
            {!can && session.source === "live" && " · presenter controls playback"}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-1">
          {([0.5, 1, 2, 4] as const).map((s) => (
            <button
              key={s}
              aria-pressed={s === run.speed}
              disabled={!can}
              onClick={act(() => session.actions.setSpeed(s))}
              className={`num rounded-md border px-2 py-1 text-[10.5px] ${
                s === run.speed ? "border-accent bg-accent text-bg" : "border-line2 bg-panel2 text-ink-muted"
              }`}
            >
              {s === 0.5 ? "½" : s}×
            </button>
          ))}
          <label className="num ml-3 inline-flex cursor-pointer select-none items-center gap-2 text-[10.5px] text-ink-muted">
            <span className="relative h-[17px] w-[30px] rounded-full bg-accent-dim">
              <span className="absolute left-[15px] top-[2px] h-[13px] w-[13px] rounded-full bg-accent" />
            </span>
            Following {session.presenterName}
          </label>
        </div>
      </div>

      {/* Track */}
      <div className="relative mt-3.5 h-[42px]">
        {Array.from({ length: SPAN_TICKS / LABEL_EVERY + 1 }, (_, i) => i * LABEL_EVERY).map((t) => (
          <span key={t} className="num absolute top-0 -translate-x-1/2 text-[9.5px] text-ink-faint" style={{ left: pct(t) }}>
            {tickClock(t)}
            <span className="absolute left-1/2 top-[14px] h-[5px] w-px bg-line2" />
          </span>
        ))}

        <EventDots events={session.events} pct={pct} />

        <div className="absolute inset-x-0 top-[33px] flex h-1 overflow-hidden rounded-full bg-line2">
          {session.snapshots.map((s) => (
            <span
              key={s.tick}
              className="block h-full bg-state-infected"
              style={{ width: pct(1), opacity: 0.25 + (s.infectedCount / total) * 3 }}
            />
          ))}
        </div>
        <span
          className="absolute top-[26px] h-[18px] w-[18px] -translate-x-1/2 rounded-full border-[3px] border-accent bg-ink shadow-[0_2px_8px_rgba(0,0,0,.5)]"
          style={{ left: pct(run.tick + 1) }}
          aria-label={`Tick ${run.tick}`}
        />
      </div>

      {/* Current beat */}
      <div className="mt-4 flex min-h-[40px] items-start gap-3">
        <span className="num min-w-[52px] shrink-0 pt-px text-xs font-semibold text-accent">{tickClock(lastTick)}</span>
        <p className="text-[13px] leading-snug text-ink-muted">
          {beat.map((e, i) => (
            <span key={i}>
              {i > 0 && " · "}
              <b className="font-semibold text-ink">{e.text}</b>
            </span>
          ))}
          <span className="mt-1 block text-[11px] text-ink-faint">
            Illustrative simulation. Spread rates are not measured from real incidents.
          </span>
        </p>
      </div>
    </section>
  );
}

function EventDots({ events, pct }: { events: SimEventRow[]; pct: (t: number) => string }) {
  // One dot per tick and kind, so stacked events stay readable.
  const seen = new Set<string>();
  const dots = events.filter((e) => {
    const k = `${e.tick}:${e.kind}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return (
    <>
      {dots.map((e) => (
        <span
          key={`${e.tick}:${e.kind}`}
          title={`${tickClock(e.tick)} · ${e.text}`}
          className={`absolute top-[20px] h-[9px] w-[9px] -translate-x-1/2 rounded-full border-2 border-bg ${DOT[e.kind] ?? "bg-ink-faint"}`}
          style={{ left: pct(e.tick + 0.5) }}
        />
      ))}
    </>
  );
}
