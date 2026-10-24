// An engine tick is one step of the attack, not a clock time (INTEGRATION.md §9 Q8).

/** "Step 3", for a tick shown on its own (an event, an infection, a service going down). */
export function stepLabel(tick: number): string {
  return `Step ${tick}`;
}

/** "Step 3 of 15": where a run is, against the last step the engine computed. */
export function stepOf(tick: number, finalTick: number): string {
  return `Step ${tick} of ${finalTick}`;
}

/** @deprecated Use stepLabel or stepOf. There is no clock any more; this alias only keeps old call sites compiling. */
export const tickClock = stepLabel;

export const ROLE_LABEL = {
  security: "Security",
  clinical_engineering: "Clinical engineering",
  operations: "Operations",
  observer: "Observer",
} as const;
