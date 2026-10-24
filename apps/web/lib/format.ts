// An engine tick is one step of the attack, not a clock time (INTEGRATION.md §9 Q8).
/** "Step 3", for a tick shown on its own. */
export function stepLabel(tick: number): string {
  return `Step ${tick}`;
}
/** "Step 3 of 15": where a run is, against the last step the engine computed. */
export function stepOf(tick: number, finalTick: number): string {
  return `Step ${tick} of ${finalTick}`;
}

// One tick is 15 simulated minutes. The clock reads as time since the run
// started, `T+h:mm` (spec 7.3).
export function tickClock(tick: number): string {
  const minutes = tick * 15;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `T+${h}:${String(m).padStart(2, "0")}`;
}

/** The run tab's second line: "settles T+4:30" once done, else where the run is. */
export function runStatusLabel(r: { status: string; tick: number }): string {
  if (r.status === "done") return `settles ${tickClock(r.tick)}`;
  if (r.status === "running") return `running · ${tickClock(r.tick)}`;
  if (r.status === "requested") return "computing…";
  if (r.status === "error") return "failed";
  return `paused · ${tickClock(r.tick)}`;
}

export const ROLE_LABEL = {
  security: "Security",
  clinical_engineering: "Clinical engineering",
  operations: "Operations",
  observer: "Observer",
} as const;

/** Two-letter initials for a presence avatar ("Maya R." → "MR"). */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[1][0]).toUpperCase();
}
