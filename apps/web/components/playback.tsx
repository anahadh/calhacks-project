"use client";

import { SPEEDS, type PlaybackControl } from "@/lib/stdb/run-status";
import type { RunRow, SessionActions, Speed } from "@/lib/stdb/types";

// Play/pause, step, reset and speed for one run, or for a solution pair (any
// run of a pair moves the whole pair). Each button calls one reducer; only the
// presenter's buttons are live, and a follower can never move playback.

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
    <div className="flex items-center gap-1.5">
      <RoundButton label={playing ? "Pause" : "Play"} blocked={why(toggle)} onClick={send(toggle)} large>
        {playing ? <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" /> : <path d="M8 5v14l11-7z" />}
      </RoundButton>
      <RoundButton label="Step" blocked={why("step")} onClick={send("step")}>
        <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
      </RoundButton>
      <RoundButton label="Reset" blocked={why("reset")} onClick={send("reset")}>
        <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
      </RoundButton>
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
    <div className="flex items-center gap-1" role="group" aria-label="Speed">
      {SPEEDS.map((s) => (
        <button
          key={s}
          aria-pressed={s === target?.speed}
          disabled={!isPresenter || !target}
          title={isPresenter ? undefined : PRESENTER_ONLY}
          onClick={set(s)}
          className={`num rounded-md border px-2 py-1 text-[10.5px] disabled:cursor-not-allowed ${
            s === target?.speed ? "border-accent bg-accent text-bg" : "border-line2 bg-panel2 text-ink-muted"
          } ${!target ? "opacity-40" : isPresenter ? "" : "opacity-60"}`}
        >
          {s === 0.5 ? "½" : s}×
        </button>
      ))}
    </div>
  );
}

function RoundButton({
  label,
  blocked,
  onClick,
  large,
  children,
}: {
  label: string;
  blocked: string | null;
  onClick: () => void;
  large?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-label={label}
      title={blocked ?? label}
      disabled={!!blocked}
      onClick={onClick}
      className={`grid shrink-0 place-items-center rounded-full border border-line2 bg-panel2 text-ink transition hover:border-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-line2 ${
        large ? "h-10 w-10" : "h-8 w-8"
      }`}
    >
      <svg viewBox="0 0 24 24" className={large ? "h-4 w-4" : "h-3.5 w-3.5"} fill="currentColor" aria-hidden>
        {children}
      </svg>
    </button>
  );
}
