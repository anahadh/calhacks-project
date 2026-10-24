// Run status helpers over subscribed rows. Each refusal mirrors one the module
// makes (spacetime/src, INTEGRATION.md 5b), with the same text, so a control
// can be disabled with its reason before anyone presses it. The reducer stays
// the authority: when it refuses, the UI shows the reducer's message.
// Status reads only, no simulation.

import { stepOf } from "../format";
import type { RunRow, RunStatus, SessionSnapshot, Speed } from "./types";

export const RUN_STATUSES: readonly RunStatus[] = ["requested", "running", "paused", "done", "error"];
export const SPEEDS: readonly Speed[] = [0.5, 1, 2, 4];

/** A status column as the UI types it. The module writes only the five; anything else reads as an error. */
export function runStatusOf(status: string): RunStatus {
  return RUN_STATUSES.find((s) => s === status) ?? "error";
}

export function speedOf(speed: number): Speed {
  return SPEEDS.find((s) => s === speed) ?? 1;
}

/** Being computed or playing. While any session run is busy, agents stay quiet and no solution starts (rule 5). */
export function isBusy(run: Pick<RunRow, "status">): boolean {
  return run.status === "requested" || run.status === "running";
}

export function busyRunOf(runs: readonly RunRow[]): RunRow | undefined {
  return runs.find(isBusy);
}

/** One line for where a run is: "Computing…", "Step 3 of 15", or the engine's refusal verbatim. */
export function runProgress(run: RunRow): string {
  if (run.status === "requested") return "Computing…";
  if (run.status === "error") return run.detail || "The run failed.";
  return stepOf(run.tick, run.finalTick);
}

/** The module's statusRefusal: why play, step or reset can't act on a run in this status. */
function statusRefusal(status: RunStatus): string | null {
  if (status === "requested") return "This run is still being computed.";
  if (status === "done") return "This run has finished. Reset it to play again.";
  if (status === "error") return "This run failed. Reset it to try again.";
  return null;
}

export type PlaybackControl = "play" | "pause" | "step" | "reset";

/**
 * Why a presenter's playback control can't act on this run right now, or null.
 * play, step and reset mirror the refusals of run_resume, run_step and run_reset.
 * The rest are moves the module would accept and ignore: pause on a run that
 * isn't playing, play on one that is, and a second step before the watcher has
 * applied the first (the module merges them into one step).
 */
export function controlRefusal(control: PlaybackControl, run: RunRow | undefined): string | null {
  if (!run) return "Start the attack first.";
  switch (control) {
    case "play":
      return run.status === "running" ? "The run is already playing." : statusRefusal(run.status);
    case "pause":
      return run.status === "running" ? null : "The run is not playing.";
    case "step":
      if (run.status === "running") return "Pause the run before stepping.";
      if (run.stepPending) return "The last step is still being applied.";
      return statusRefusal(run.status);
    case "reset":
      return run.status === "requested" ? statusRefusal(run.status) : null;
  }
}

type DefendInputs = Pick<SessionSnapshot, "me" | "activeRun" | "runs" | "roundState">;

/** Why Create aggregate fix would be refused, or null. Mirrors defend_request, in its order (rule 5). */
export function defendRefusal(s: DefendInputs): string | null {
  if (!s.me) return "Join the session before creating an aggregate fix.";
  const run = s.activeRun;
  if (!run) return "Run the attack first. The agents work from a baseline run.";
  if (run.status === "requested") return "The attack is still being computed. Wait for it before creating an aggregate fix.";
  if (run.status === "error") {
    return "The attack run failed, so there is no baseline for the agents. Reset it or start a new attack.";
  }
  if (run.status === "running") return "Wait for the run to finish, or pause it, before creating an aggregate fix.";
  if (busyRunOf(s.runs)) return "Wait for every run in this session to finish, or pause it, before creating an aggregate fix.";
  const { state } = s.roundState;
  if (state === "running" || state === "waiting_for_human") return "An aggregate fix is already being negotiated for this session.";
  return null;
}

type SolutionInputs = Pick<SessionSnapshot, "isPresenter" | "activeRun" | "runs" | "roundState" | "recommendations">;

/** Why Show the solution would be refused for this recommendation, or null. Mirrors solution_start. */
export function solutionRefusal(s: SolutionInputs, recommendationId: string): string | null {
  if (!s.isPresenter) return "Only the presenter can control playback.";
  if (!s.recommendations.some((r) => r.id === recommendationId)) {
    return `Recommendation "${recommendationId}" does not exist in this session.`;
  }
  const { state } = s.roundState;
  if (state === "running" || state === "waiting_for_human") return "Wait for the agents to finish negotiating before showing a solution.";
  if (busyRunOf(s.runs)) return "Wait for every run in this session to finish, or pause it, before showing a solution.";
  if (!s.activeRun) return "Run the attack first. The solution reruns the baseline's attack.";
  return null;
}

/**
 * Where the session is in the demo flow (INTEGRATION.md 5e), read from rows:
 * pick patient zero → spread → create aggregate fix → agents negotiating →
 * pick a solution → the solution rerun.
 */
export type FlowStage = "pick" | "spread" | "defend" | "negotiating" | "pick_solution" | "solution";

type StageInputs = Pick<SessionSnapshot, "activeRun" | "roundState" | "recommendations" | "solutionPairId">;

export function flowStage(s: StageInputs): FlowStage {
  if (s.solutionPairId) return "solution";
  const { state } = s.roundState;
  if (state === "running" || state === "waiting_for_human") return "negotiating";
  if (!s.activeRun) return "pick";
  if (s.activeRun.status !== "done") return "spread";
  if (state === "done" && s.recommendations.length) return "pick_solution";
  return "defend";
}

/**
 * The two sides of a solution pair, told apart by recommendationId ("" on the
 * no-segmentation side), never by label. Either is undefined until its row arrives.
 */
export function pairOf(runs: readonly RunRow[], pairId: string): { none?: RunRow; plan?: RunRow } {
  if (!pairId) return {};
  const pair = runs.filter((r) => r.pairId === pairId);
  return { none: pair.find((r) => !r.recommendationId), plan: pair.find((r) => !!r.recommendationId) };
}
