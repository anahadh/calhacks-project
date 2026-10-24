// One tick is 15 simulated minutes.
export function tickClock(tick: number): string {
  const minutes = tick * 15;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export const ROLE_LABEL = {
  security: "Security",
  clinical_engineering: "Clinical engineering",
  operations: "Operations",
  observer: "Observer",
} as const;
