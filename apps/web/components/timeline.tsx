"use client";

import { useState } from "react";

import { PlaybackButtons, SpeedButtons } from "@/components/playback";
import { beatOf, markersOf, trackOf } from "@/features/flow/track";
import { stepLabel, stepOf } from "@/lib/format";
import { controlRefusal } from "@/lib/stdb/run-status";
import type { SessionIndex } from "@/lib/stdb/use-session";
import type { RunRow, SessionSnapshot, SimEventRow } from "@/lib/stdb/types";

// The timeline rail for the session's run: playback (presenter only), the step
// clock, a track with event markers (sim_event) and an infected-count heat strip
// (tick_snapshot), and the current beat. An engine tick is one step (§9 Q8).

const DOT: Record<string, string> = {
  patient_zero: "bg-state-infected ring-[3px] ring-state-infected/40",
  device_infected: "bg-state-infected",
  service_down: "bg-ink ring-[3px] ring-ink/25",
  diversion: "bg-state-disrupted",
};

const STATUS_WORD: Record<RunRow["status"], string> = {
  requested: "computing",
  running: "playing",
  paused: "paused",
  done: "finished",
  error: "failed",
};

/** The big clock: where the run is, in steps. */
function clockOf(run: RunRow | undefined): string {
  if (!run) return "No attack yet";
  if (run.status === "requested") return "Computing…";
  if (run.status === "error") return "Run failed";
  return stepOf(run.tick, run.finalTick);
}

export function Timeline({ session, index }: { session: SessionSnapshot; index: SessionIndex }) {
  const run = session.activeRun;
  const [err, setErr] = useState<string>();
  // Frame 0 sets final_tick; before it (or after a failure) there is no track to draw.
  const framed = !!run && run.status !== "requested" && run.status !== "error";
  const track = trackOf(framed ? run.finalTick : 0);
  const beat = run && framed ? beatOf(session.events, run.tick) : undefined;
  const total = session.hospital.devices.length || 1;
  const patientZero = run ? index.device.get(run.patientZero)?.name ?? run.patientZero : "";
  const targets = { play: run, pause: run, step: run, reset: run, speed: run };

  return (
    <section className="rounded-panel border border-line bg-panel px-4 pb-4 pt-3.5">
      <div className="flex flex-wrap items-center gap-3.5">
        <PlaybackButtons
          targets={targets}
          refusal={(c) => controlRefusal(c, run)}
          actions={session.actions}
          isPresenter={session.isPresenter}
          onError={setErr}
        />

        <div className="min-w-0">
          <span className="font-disp text-[19px] font-semibold tabular-nums">{clockOf(run)}</span>
          <div className="num text-[10.5px] uppercase tracking-[0.08em] text-ink-muted">
            {run ? `${run.label} · patient zero ${patientZero} · ${STATUS_WORD[run.status]}` : "Pick patient zero to start"}
          </div>
        </div>
        {err && (
          <span role="alert" className="num text-[11px] text-ink-muted">
            {err}
          </span>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-3">
          <SpeedButtons target={run} actions={session.actions} isPresenter={session.isPresenter} onError={setErr} />
          <span className="num text-[10.5px] text-ink-faint">
            {session.isPresenter ? "You control playback" : `${session.presenterName} controls playback`}
          </span>
        </div>
      </div>

      {/* Track */}
      <div className="relative mt-3.5 h-[42px]">
        {framed &&
          track.labels.map((t) => (
            <span
              key={t}
              className="num absolute top-0 -translate-x-1/2 text-[9.5px] text-ink-faint"
              style={{ left: track.pct(t + 0.5) }}
            >
              {t === 0 ? stepLabel(0) : t}
              <span className="absolute left-1/2 top-[14px] h-[5px] w-px bg-line2" />
            </span>
          ))}

        {framed && <EventDots events={markersOf(session.events)} pct={(t) => track.pct(t + 0.5)} />}

        <div className="absolute inset-x-0 top-[33px] flex h-1 overflow-hidden rounded-full bg-line2">
          {framed &&
            session.snapshots.map((s) => (
              <span
                key={s.tick}
                className="block h-full bg-state-infected"
                style={{ width: track.pct(1), opacity: Math.min(1, 0.25 + (s.infectedCount / total) * 3) }}
              />
            ))}
        </div>
        {run && framed && (
          <span
            className="absolute top-[26px] h-[18px] w-[18px] -translate-x-1/2 rounded-full border-[3px] border-accent bg-ink shadow-[0_2px_8px_rgba(0,0,0,.5)]"
            style={{ left: track.pct(run.tick + 1) }}
            aria-label={stepOf(run.tick, run.finalTick)}
          />
        )}
      </div>

      {/* Current beat */}
      <div className="mt-4 flex min-h-[40px] items-start gap-3">
        <span className="num min-w-[52px] shrink-0 pt-px text-xs font-semibold text-accent">
          {beat ? stepLabel(beat.tick) : ""}
        </span>
        <div className="min-w-0 text-[13px] leading-snug text-ink-muted">
          {run?.status === "error" ? (
            <p role="alert" className="text-ink">
              {run.detail || "The run failed."}
            </p>
          ) : run?.status === "requested" ? (
            <p>The engine is computing the attack. The first step plays when it lands.</p>
          ) : (
            beat && (
              <p>
                {beat.events.map((e, i) => (
                  <span key={i}>
                    {i > 0 && " · "}
                    <b className="font-semibold text-ink">{e.text}</b>
                  </span>
                ))}
              </p>
            )
          )}
          <span className="mt-1 block text-[11px] text-ink-faint">
            Illustrative simulation. Spread rates are not measured from real incidents.
          </span>
          {run && run.assumptions.length > 0 && <Assumptions notes={run.assumptions} />}
        </div>
      </div>
    </section>
  );
}

/** The engine's [S] notes on what it assumed: one click away, never hidden. */
export function Assumptions({ notes }: { notes: string[] }) {
  return (
    <details className="mt-1.5 text-[11px] text-ink-faint">
      <summary className="num cursor-pointer select-none hover:text-ink-muted">
        What the engine assumed ({notes.length})
      </summary>
      <ul className="mt-1 space-y-0.5 pl-3">
        {notes.map((n, i) => (
          <li key={i} className="list-disc">
            {n}
          </li>
        ))}
      </ul>
    </details>
  );
}

function EventDots({ events, pct }: { events: SimEventRow[]; pct: (t: number) => string }) {
  return (
    <>
      {events.map((e) => (
        <span
          key={`${e.tick}:${e.kind}`}
          title={`${stepLabel(e.tick)} · ${e.text}`}
          className={`absolute top-[20px] h-[9px] w-[9px] -translate-x-1/2 rounded-full border-2 border-bg ${DOT[e.kind] ?? "bg-ink-faint"}`}
          style={{ left: pct(e.tick) }}
        />
      ))}
    </>
  );
}
