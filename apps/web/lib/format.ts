// One tick is 15 simulated minutes. The clock reads as time since the run
// started, `T+h:mm` (spec 7.3).
export function tickClock(tick: number): string {
  const minutes = tick * 15;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `T+${h}:${String(m).padStart(2, "0")}`;
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
