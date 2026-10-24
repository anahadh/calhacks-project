"use client";

import { SPEEDS, type PlaybackControl } from "@/lib/stdb/run-status";
import type { RunRow, SessionActions, Speed } from "@/lib/stdb/types";

// Play/pause, step, reset and speed for one run, or for a solution pair (any
// run of a pair moves the whole pair). Each button calls one reducer; only the
// presenter's buttons are live, and a follower can never move playback.
// Styled like the timeline's transport row: square controls, a segmented speed.

/** The run each control is sent to: the session's run, or a side of the pair (features/solution/pair.ts). */
export type PlaybackTargets = Record<PlaybackControl | "speed", RunRow | undefined>;

const PRESENTER_ONLY = "Only the presenter can control playback.";

export function PlaybackButtons({
  targets,
  refusal,
  actions,
  isPresenter,
  onError,
}: {
  targets: PlaybackTargets;
  /** Why a control can't act now (run-status.ts controlRefusal), or null. */
  refusal: (control: PlaybackControl) => string | null;
  actions: SessionActions;
  isPresenter: boolean;
  onError: (message?: string) => void;
}) {
  const playing = targets.pause?.status === "running";
  const send = (control: PlaybackControl) => () => {
    const run = targets[control];
    if (!run) return;
    onError(undefined);
    actions[control](run.id).catch((e: Error) => onError(e.message));
  };
  const why = (control: PlaybackControl) => (isPresenter ? refusal(control) : PRESENTER_ONLY);

  const toggle: PlaybackControl = playing ? "pause" : "play";
  return (
    <div className="flex items-center gap-2">
      <SquareButton label="Reset" blocked={why("reset")} onClick={send("reset")}>
        <path d="M3 3v10M13 3.5 7 8l6 4.5zM8.5 3.5 2.5 8l6 4.5z" fill="currentColor" />
      </SquareButton>
      <SquareButton label={playing ? "Pause" : "Play"} blocked={why(toggle)} onClick={send(toggle)} on>
        {playing ? <path d="M4.5 3h2.5v10H4.5zM9 3h2.5v10H9z" fill="currentColor" /> : <path d="M5 3v10l8-5z" fill="currentColor" />}
      </SquareButton>
      <SquareButton label="Step" blocked={why("step")} onClick={send("step")}>
        <path d="M13 3v10M3 3.5 9 8l-6 4.5zM7.5 3.5 13.5 8l-6 4.5z" fill="currentColor" />
      </SquareButton>
    </div>
  );
}

export function SpeedButtons({
  target,
  actions,
  isPresenter,
  onError,
}: {
  target: RunRow | undefined;
  actions: SessionActions;
  isPresenter: boolean;
  onError: (message?: string) => void;
}) {
  const set = (s: Speed) => () => {
    if (!target) return;
    onError(undefined);
    actions.setSpeed(s, target.id).catch((e: Error) => onError(e.message));
  };
  return (
    <div className={`flex gap-0.5 rounded-ctl border border-line2 p-[3px] ${target ? "" : "opacity-disabled"}`} role="group" aria-label="Speed">
      {SPEEDS.map((s) => (
        <button
          key={s}
          type="button"
          aria-pressed={s === target?.speed}
          disabled={!isPresenter || !target}
          title={isPresenter ? undefined : PRESENTER_ONLY}
          onClick={set(s)}
          className={`num h-9 min-w-[48px] rounded-[1px] px-2.5 text-xs disabled:cursor-not-allowed ${
            s === target?.speed ? "bg-select font-medium text-select-on" : "text-ink-muted enabled:hover:text-ink"
          }`}
        >
          {s}×
        </button>
      ))}
    </div>
  );
}

function SquareButton({
  label,
  blocked,
  onClick,
  on,
  children,
}: {
  label: string;
  blocked: string | null;
  onClick: () => void;
  /** The light-filled control (play). */
  on?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={blocked ?? label}
      disabled={!!blocked}
      onClick={onClick}
      className={`ctl ${on ? "ctl-on" : ""}`}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
        {children}
      </svg>
    </button>
  );
}
