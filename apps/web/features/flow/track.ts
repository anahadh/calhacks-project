// The timeline rail's layout over one run's rows: one cell per engine step
// (0..final_tick, INTEGRATION.md §9 Q8) and the current beat. Pure, so it is
// tested on its own; components/timeline.tsx renders it.

import type { SimEventRow } from "@/lib/stdb/types";

/** About this many step labels under the track (the last step is always labeled). */
const MAX_LABELS = 8;

export type Track = {
  /** Cells on the track: steps 0..finalTick. */
  cells: number;
  /** Steps that get a label. */
  labels: number[];
  /** Left offset of a step boundary, as a CSS percentage (clamped to the track). */
  pct: (tick: number) => string;
};

export function trackOf(finalTick: number): Track {
  const last = Math.max(0, finalTick);
  const cells = last + 1;
  const every = Math.max(1, Math.ceil(cells / MAX_LABELS));
  const labels: number[] = [];
  for (let t = 0; t <= last; t += every) labels.push(t);
  // Always label the last step: it is the "of M" in "Step N of M".
  if (labels[labels.length - 1] !== last) labels.push(last);
  return { cells, labels, pct: (tick) => `${(Math.min(Math.max(tick, 0), cells) / cells) * 100}%` };
}

/**
 * The beat: the latest step with events, up to `tick`, and those events.
 * Undefined before the first event (no Math.max over nothing).
 */
export function beatOf(events: readonly SimEventRow[], tick: number): { tick: number; events: SimEventRow[] } | undefined {
  let last = -1;
  for (const e of events) if (e.tick <= tick && e.tick > last) last = e.tick;
  if (last < 0) return undefined;
  return { tick: last, events: events.filter((e) => e.tick === last) };
}

/** One marker per step and kind, so stacked events stay readable. */
export function markersOf(events: readonly SimEventRow[]): SimEventRow[] {
  const seen = new Set<string>();
  return events.filter((e) => {
    const k = `${e.tick}:${e.kind}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
