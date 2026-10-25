"use client";

import { useMemo, useState } from "react";

import { initials, ROLE_LABEL, runStatusLabel, tickClock } from "@/lib/format";
import { ROLE_SHORT } from "@/lib/role-views";
import type { SessionIndex } from "@/lib/stdb/use-session";
import type { SessionSnapshot } from "@/lib/stdb/types";

// The top of the simulation panel: the runs strip, the transport row (with
// presence), and the track for the selected run. History comes from
// tick_snapshot rows; nothing here computes the simulation.
const SPEEDS = [0.5, 1, 2, 4] as const;
const MIN_SPAN = 16; // 4 simulated hours, until the run settles

export function Timeline({
  session,
  index,
  onNewRun,
}: {
  session: SessionSnapshot;
  index: SessionIndex;
  /** + New run: the view clears the hospital so a device can be clicked as the next patient zero. */
  onNewRun?: () => void;
}) {
  const run = session.runs.find((r) => r.id === session.activeRunId) ?? session.runs[0];
  const [err, setErr] = useState<string>();
  const runTick = run?.tick ?? 0;
  const settled = run?.status === "done";
  const span = settled ? Math.max(runTick, 1) : Math.max(runTick + 4, MIN_SPAN);
  const heat = useMemo(() => {
    const byTick = new Map(session.snapshots.map((s) => [s.tick, s.infectedCount]));
    const peak = Math.max(1, ...session.snapshots.map((s) => s.infectedCount));
    // Segment t covers the tick that ends at t + 1, so the played part ends under the marker.
    return Array.from({ length: span }, (_, t) => {
      const c = byTick.get(t + 1) ?? byTick.get(t) ?? 0;
      return t < runTick
        ? `rgba(255,106,46,${(0.3 + 0.7 * (c / peak)).toFixed(2)})`
        : "rgba(125,133,139,0.1)";
    });
  }, [session.snapshots, span, runTick]);

  // Before any attack there is no run; show just the runs strip (with + New run).
  if (!run) {
    return (
      <div className="flex flex-col gap-4 border-b border-line p-5">
        <RunsStrip session={session} index={index} onNewRun={onNewRun} />
      </div>
    );
  }
  const can = session.isPresenter;
  const act = (fn: () => Promise<unknown>) => () => {
    setErr(undefined);
    fn().catch((e: Error) => setErr(e.message));
  };

  const pct = (tick: number) => `${(Math.min(tick, span) / span) * 100}%`;

  const playing = run.status === "running";
  const lock = !can ? `Only ${session.presenterName} controls playback.` : undefined;

  return (
    <div className="flex flex-col gap-4 border-b border-line p-5">
      <RunsStrip session={session} index={index} onNewRun={onNewRun} />

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="flex gap-2.5">
          <button
            type="button"
            className="ctl ctl-lg"
            aria-label="Back to the start"
            title={lock ?? "Back to the start"}
            disabled={!can || !session.activeRunId}
            onClick={act(session.actions.reset)}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
              <path d="M3 3v10M13 3.5 7 8l6 4.5zM8.5 3.5 2.5 8l6 4.5z" fill="currentColor" />
            </svg>
          </button>
          <button
            type="button"
            className="ctl ctl-lg ctl-on"
            aria-label={playing ? "Pause" : "Play"}
            title={lock}
            disabled={!can || settled}
            onClick={act(playing ? session.actions.pause : session.actions.play)}
          >
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
          <button
            type="button"
            className="ctl ctl-lg"
            aria-label="Forward 15 minutes"
            title={lock ?? "Forward 15 minutes"}
            disabled={!can || playing || settled || !session.activeRunId}
            onClick={act(session.actions.step)}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
              <path d="M13 3v10M3 3.5 9 8l-6 4.5zM7.5 3.5 13.5 8l-6 4.5z" fill="currentColor" />
            </svg>
          </button>
        </div>

        <span className="readout text-[36px] leading-none tracking-[-0.02em]" aria-live="off">
          {tickClock(run.tick)}
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-x-6 gap-y-3">
          <div role="group" aria-label="Simulation speed" className="flex gap-0.5 rounded-ctl border border-line2 p-[3px]">
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={s === run.speed}
                disabled={!can}
                title={lock}
                onClick={act(() => session.actions.setSpeed(s))}
                className={`num h-11 min-w-[56px] rounded-[1px] px-3 text-[13px] disabled:cursor-not-allowed ${
                  s === run.speed ? "bg-select font-medium text-select-on" : "text-ink-muted enabled:hover:text-ink"
                }`}
              >
                {s}×
              </button>
            ))}
          </div>
          <Presence session={session} />
        </div>
      </div>
      {err && <p role="alert" className="num m-0 text-xs text-ink-muted">{err}</p>}

      {/* The track: a marker over the current tick, the end dot where the run settles, the heat strip under it. */}
      <div className="flex flex-col gap-2 pt-1">
        <div className="relative mx-[7px]" role="img" aria-label={`${tickClock(run.tick)} of ${settled ? tickClock(span) : "a run still going"}`}>
          <div className="relative h-5">
            <svg
              width="12"
              height="8"
              viewBox="0 0 12 8"
              aria-hidden
              className="absolute top-1 -translate-x-1/2 transition-[left] duration-fade ease-travel"
              style={{ left: pct(run.tick) }}
            >
              <path d="M0 0h12L6 8z" fill="#4DB0FF" />
            </svg>
          </div>
          <div className="relative h-4">
            <span className="absolute inset-x-0 top-[7px] h-px bg-line2" />
            <span className="absolute left-0 top-[7px] h-px bg-ink-faint" style={{ width: pct(run.tick) }} />
            <span
              className={`absolute right-0 top-0 h-[15px] w-[15px] translate-x-1/2 rounded-full border-2 ${
                settled ? "border-ink bg-bg shadow-[inset_0_0_0_3px_#0D0F10,inset_0_0_0_8px_#E9ECEE]" : "border-line2 bg-bg"
              }`}
            />
          </div>
        </div>
        <div aria-hidden className="flex h-2 gap-[3px] px-[7px]">
          {heat.map((bg, t) => (
            <span key={t} className="flex-[1_1_0]" style={{ background: bg }} />
          ))}
        </div>
        <div className="num flex justify-between px-[7px] text-[13px] leading-4 text-ink-faint">
          <span>T+0:00</span>
          <span>{tickClock(Math.round(span / 2))}</span>
          <span>{settled ? `Settles ${tickClock(span)}` : playing ? "Spreading" : tickClock(span)}</span>
        </div>
      </div>
    </div>
  );
}

/** One tab per baseline run, then + New run. The selected tab is the run on screen. */
function RunsStrip({
  session,
  index,
  onNewRun,
}: {
  session: SessionSnapshot;
  index: SessionIndex;
  onNewRun?: () => void;
}) {
  const runs = session.runs.filter((r) => r.id && !r.pairId);
  return (
    <div role="group" aria-label="Runs in this session" className="flex flex-wrap items-center gap-2.5 border-b border-line pb-4">
      <span className="eyebrow mr-2">Runs</span>
      {runs.length === 0 && <span className="text-[13px] text-ink-muted">No runs yet. Start one from a patient zero.</span>}
      {runs.map((r, i) => {
        const on = r.id === session.activeRunId;
        return (
          <button
            key={r.id}
            type="button"
            aria-pressed={on}
            disabled={!on}
            title={on ? undefined : "Switching the run on screen comes with several-runs support."}
            className={`tab ${on ? "tab-on" : "disabled:cursor-not-allowed"}`}
          >
            <span className="font-medium">
              Run {i + 1} · {index.device.get(r.patientZero)?.name ?? r.patientZero}
            </span>
            <span className={`text-[13px] leading-4 ${on ? "text-[#4A5258]" : "text-ink-muted"}`}>{runStatusLabel(r)}</span>
          </button>
        );
      })}
      <NewRun session={session} onNewRun={onNewRun} />
    </div>
  );
}

/**
 * + New run: clears the hospital on screen so the presenter clicks the next
 * patient zero straight on the building. No picker here; the scene is the picker.
 */
function NewRun({ session, onNewRun }: { session: SessionSnapshot; onNewRun?: () => void }) {
  const blocker =
    session.source !== "live" ? "Connect to SpacetimeDB to start a run."
    : !session.me ? "Join the session to start a run."
    : !session.isPresenter ? `Only ${session.presenterName} starts runs.`
    : null;

  return (
    <button
      type="button"
      disabled={!!blocker || !onNewRun}
      title={blocker ?? "Click a device on the building to start the next attack"}
      onClick={onNewRun}
      className="num flex min-h-[60px] items-center gap-2.5 rounded-ctl border border-dashed border-line2 px-4 text-[14px] text-ink enabled:hover:border-ink-faint disabled:cursor-not-allowed disabled:opacity-disabled"
    >
      <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
        <path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
      New run
    </button>
  );
}

const AVATAR_FILL = ["#4A5258", "#3E4448", "#2F3438"];

/** Who is here: three avatars, then +N. The presenter wears the ink ring. */
function Presence({ session }: { session: SessionSnapshot }) {
  const people = session.presence;
  const shown = people.slice(0, 3);
  const extra = people.length - shown.length;
  return (
    <div role="group" aria-label={`${people.length} ${people.length === 1 ? "person" : "people"} in this session`} className="flex items-center rounded-full border border-line2 p-1">
      {shown.map((p, i) => {
        const presenting = p.name === session.presenterName;
        return (
          <span
            key={`${p.name}-${i}`}
            title={`${p.name} · ${ROLE_LABEL[p.role]}${presenting ? " · presenting" : ""}`}
            className="num relative inline-flex h-9 w-9 items-center justify-center rounded-full text-[12px] font-medium text-ink"
            style={{
              marginLeft: i ? -8 : 0,
              background: AVATAR_FILL[i],
              boxShadow: presenting ? "0 0 0 2px #0D0F10, 0 0 0 3.5px #E9ECEE" : "0 0 0 2px #0D0F10",
            }}
          >
            {initials(p.name)}
            <span
              aria-hidden
              className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-[3px] border border-line2 bg-panel px-0.5 text-[7.5px] uppercase leading-[10px] tracking-[0.04em] text-ink-muted"
            >
              {ROLE_SHORT[p.role]}
            </span>
          </span>
        );
      })}
      {extra > 0 && (
        <span
          title={`${extra} more`}
          className="num relative -ml-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-panel2 text-[12px] font-medium text-ink shadow-[0_0_0_2px_#0D0F10]"
        >
          +{extra}
        </span>
      )}
    </div>
  );
}
