// A run row's summary columns are copied from the latest frame the watcher
// applied, so part way through a run they are the numbers at that step, not the
// run's result. A number that stands for a whole run (the baseline a plan is
// compared with, either side of the before/after strip) is read only once its
// run is done; until then the UI says where the run is instead. Pure, so it is
// tested on its own.

import { stepOf } from "@/lib/format";
import type { RunRow } from "@/lib/stdb/types";

/** The run once its final frame has landed; undefined while it is computing, playing, paused or failed. */
export function finalOf(run: RunRow | undefined): RunRow | undefined {
  return run?.status === "done" ? run : undefined;
}

/** Why a run's whole-run numbers aren't shown yet ("paused at step 5 of 14"), or null once it is done. */
export function notFinalYet(run: RunRow | undefined): string | null {
  if (!run || run.status === "requested") return "computing…";
  if (run.status === "done") return null;
  if (run.status === "error") return "the run failed";
  const at = stepOf(run.tick, run.finalTick).toLowerCase();
  return run.status === "paused" ? `paused at ${at}` : `playing, ${at}`;
}

/** The caption over a run's live numbers: they are final, or the numbers at the step on screen. */
export function numbersCaption(run: RunRow | undefined): string | undefined {
  if (!run || run.status === "requested" || run.status === "error") return undefined;
  return run.status === "done" ? "Final numbers" : `Numbers at ${stepOf(run.tick, run.finalTick).toLowerCase()}`;
}
