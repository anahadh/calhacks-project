"use client";

import { useMemo, useState } from "react";

import { initials, ROLE_LABEL, tickClock } from "@/lib/format";
import type { SessionIndex } from "@/lib/stdb/use-session";
import type { RunRow, SessionSnapshot } from "@/lib/stdb/types";

// The top of the simulation panel: the runs strip, the transport row (with
// presence), and the track for the selected run. History comes from
// tick_snapshot rows; nothing here computes the simulation.
const SPEEDS = [0.5, 1, 2, 4] as const;
const MIN_SPAN = 16; // 4 simulated hours, until the run settles

export function Timeline({ session, index }: { session: SessionSnapshot; index: SessionIndex }) {
  const run = session.runs.find((r) => r.id === session.activeRunId) ?? session.runs[0];
  const [err, setErr] = useState<string>();
  const can = session.isPresenter;
  const act = (fn: () => Promise<unknown>) => () => {
    setErr(undefined);
    fn().catch((e: Error) => setErr(e.message));
  };

  const settled = run.status === "done";
  const span = settled ? Math.max(run.tick, 1) : Math.max(run.tick + 4, MIN_SPAN);
  const pct = (tick: number) => `${(Math.min(tick, span) / span) * 100}%`;
  const heat = useMemo(() => {
    const byTick = new Map(session.snapshots.map((s) => [s.tick, s.infectedCount]));
    const peak = Math.max(1, ...session.snapshots.map((s) => s.infectedCount));
    // Segment t covers the tick that ends at t + 1, so the played part ends under the thumb.
    return Array.from({ length: span }, (_, t) => {
      const c = byTick.get(t + 1) ?? byTick.get(t) ?? 0;
      return t < run.tick
        ? `rgba(255,106,46,${(0.12 + 0.75 * (c / peak)).toFixed(2)})`
        : "rgba(125,133,139,0.08)";
    });
  }, [session.snapshots, span, run.tick]);

  const playing = run.status === "running";
  const lock = !can ? `Only ${session.presenterName} controls playback.` : undefined;

  return (
    <div className="flex flex-col gap-3 border-b border-line p-4">
      <RunsStrip session={session} index={index} />

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="flex gap-2">
          <button
            type="button"
            className="ctl w-11"
            aria-label="Back to the start"
            title={lock ?? "Back to the start"}
            disabled={!can || !session.activeRunId}
            onClick={act(session.actions.reset)}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
              <path d="M4 3v10M13 3.5 6.5 8l6.5 4.5z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            className="ctl ctl-on w-11"
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
            className="ctl w-11"
            aria-label="Forward 15 minutes"
            title={lock ?? "Forward 15 minutes"}
            disabled={!can || playing || settled || !session.activeRunId}
            onClick={act(session.actions.step)}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
              <path d="M12 3v10M3 3.5 9.5 8 3 12.5z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <span className="readout text-readout-m" aria-live="off">
          {tickClock(run.tick)}
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-x-5 gap-y-3">
          <div role="group" aria-label="Simulation speed" className="flex gap-0.5 rounded-ctl border border-line2 p-[3px]">
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={s === run.speed}
                disabled={!can}
                title={lock}
                onClick={act(() => session.actions.setSpeed(s))}
                className={`num h-9 min-w-[44px] rounded-[1px] px-2.5 text-xs disabled:cursor-not-allowed ${
                  s === run.speed ? "bg-select font-medium text-select-on" : "text-ink-muted enabled:hover:text-ink"
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
      {err && <p role="alert" className="num m-0 text-xs text-ink-muted">{err}</p>}

      <div className="flex flex-col gap-1.5">
        <div className="relative mx-[7px]">
          <div className="h-3.5" />
          {/* Progress: the track, its played part, and the thumb at the current tick. */}
          <div className="relative h-7" role="img" aria-label={`${tickClock(run.tick)} of ${settled ? tickClock(span) : "a run still going"}`}>
            <span className="absolute inset-x-0 top-[13px] h-0.5 bg-line2" />
            <span className="absolute left-0 top-[13px] h-0.5 bg-ink" style={{ width: pct(run.tick) }} />
            <span
              className="absolute top-[7px] h-3.5 w-3.5 -translate-x-1/2 rounded-full border-[3px] border-bg bg-ink shadow-[0_0_0_1px_#E9ECEE] transition-[left] duration-fade ease-travel"
              style={{ left: pct(run.tick) }}
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
    </div>
  );
}

/** One tab per baseline run, then + New run. The selected tab is the run on screen. */
function RunsStrip({ session, index }: { session: SessionSnapshot; index: SessionIndex }) {
  const runs = session.runs.filter((r) => r.id);
  return (
    <div role="group" aria-label="Runs in this session" className="flex flex-wrap items-center gap-2 border-b border-line pb-3">
      <span className="eyebrow mr-1">Runs</span>
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
            className={`num flex min-h-[52px] flex-col items-start gap-0.5 rounded-ctl border px-3 py-2 text-left text-xs ${
              on ? "border-select bg-select text-select-on" : "border-line2 text-ink disabled:cursor-not-allowed"
            }`}
          >
            <span className="font-medium">
              Run {i + 1} · {index.device.get(r.patientZero)?.name ?? r.patientZero}
            </span>
            <span className={`text-[11px] ${on ? "text-[#4A5258]" : "text-ink-muted"}`}>{runStatus(r)}</span>
          </button>
        );
      })}
      <NewRun session={session} />
    </div>
  );
}

function runStatus(r: RunRow) {
  if (r.status === "done") return `Settles ${tickClock(r.tick)}`;
  if (r.status === "running") return `Running · ${tickClock(r.tick)}`;
  return `Paused · ${tickClock(r.tick)}`;
}

/** + New run: pick a patient zero and start. Anyone in the session can. */
function NewRun({ session }: { session: SessionSnapshot }) {
  const [open, setOpen] = useState(false);
  const [pz, setPz] = useState("");
  const [err, setErr] = useState<string>();
  const [busy, setBusy] = useState(false);
  const { hospital } = session;
  const blocker =
    session.source !== "live" ? "Connect to SpacetimeDB to start a run."
    : !session.me ? "Join the session to start a run."
    : null;

  const start = async () => {
    if (!pz) return;
    setBusy(true);
    setErr(undefined);
    try {
      await session.actions.startRun(pz);
      setOpen(false);
      setPz("");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={open}
        disabled={!!blocker}
        title={blocker ?? undefined}
        onClick={() => setOpen(!open)}
        className="num flex min-h-[52px] items-center gap-2 rounded-ctl border border-dashed border-line2 px-3 text-xs text-ink enabled:hover:border-ink-faint disabled:cursor-not-allowed disabled:opacity-disabled"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
          <path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        New run
      </button>
      {open && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            start();
          }}
          className="absolute left-0 top-[60px] z-30 flex w-[300px] flex-col gap-2 rounded-panel border border-line2 bg-panel2 p-3 shadow-overlay"
        >
          <label htmlFor="new-run-pz" className="num text-xs text-ink-muted">Patient zero</label>
          <select
            id="new-run-pz"
            autoFocus
            value={pz}
            onChange={(e) => setPz(e.target.value)}
            className="num h-11 rounded-ctl border border-line2 bg-panel px-3 text-xs text-ink"
          >
            <option value="" disabled>Pick the first infected device</option>
            {hospital.rooms.map((room) => (
              <optgroup key={room.id} label={room.name}>
                {hospital.devices
                  .filter((d) => d.roomId === room.id)
                  .map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
              </optgroup>
            ))}
          </select>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="num min-h-9 px-2 text-xs text-ink-muted hover:text-ink">
              Cancel
            </button>
            <button disabled={!pz || busy} className="btn btn-primary min-h-9 px-3 text-xs">
              {busy ? "Starting…" : "Start run"}
            </button>
          </div>
          {err && <p role="alert" className="num m-0 text-[11px] text-ink-muted">{err}</p>}
        </form>
      )}
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
        <span
          title={`${extra} more`}
          className="num relative -ml-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-panel2 text-[11px] font-medium text-ink shadow-[0_0_0_2px_#0D0F10]"
        >
          +{extra}
        </span>
      )}
    </div>
  );
}
