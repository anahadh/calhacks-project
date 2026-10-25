import type { SessionSnapshot } from "./types";

/**
 * The active run as it stood at an earlier step, for this tab's own scrubbing. Filtering only:
 * every row already says when it happened (infected_at_tick, down_since_tick, a tick column), so
 * the rows this tab has are cut back to that step. Nothing is computed and nothing is written, so
 * other people's view is untouched. Patient rows carry no step, so a past view has none rather
 * than guessing (rule 3).
 */
export function atTick(s: SessionSnapshot, tick: number): SessionSnapshot {
  const run = s.activeRun;
  if (!run || tick >= run.tick) return s;
  const past = { ...run, tick };
  return {
    ...s,
    activeRun: past,
    runs: s.runs.map((r) => (r.id === run.id ? past : r)),
    devices: s.devices.map((d) => (d.infected && (d.infectedAtTick ?? 0) <= tick ? d : { deviceId: d.deviceId, infected: false })),
    services: s.services.map((x) => (x.down && (x.downSinceTick ?? 0) <= tick ? x : { serviceId: x.serviceId, down: false })),
    patients: [],
    attempts: s.attempts.filter((a) => a.tick <= tick),
    events: s.events.filter((e) => e.tick <= tick),
    snapshots: s.snapshots.filter((x) => x.tick <= tick),
  };
}
