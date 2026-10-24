// The solution view's reads over the pair's two run rows: which run each shared
// control acts on, the shared clock, the before/after strip and what keeps
// working. Pure, so it is tested on its own. Every number is a run row's summary
// column, copied (AGENTS.md rule 3): nothing here simulates or recomputes.

import { MOCK_REFUSAL } from "@/features/agents/defend";
import { finalOf, notFinalYet } from "@/features/flow/final";
import { controlRefusal, runProgress, solutionRefusal, type PlaybackControl } from "@/lib/stdb/run-status";
import type { Hospital, RunRow, RunView, ServiceStateRow, SessionSnapshot } from "@/lib/stdb/types";

type ShowInputs = Pick<SessionSnapshot, "source" | "isPresenter" | "activeRun" | "runs" | "roundState" | "recommendations">;

/**
 * Why Show the solution would be refused for this recommendation, or null.
 * Mirrors solution_start: presenter only, the round finished, no session run
 * computing or playing, and a baseline to rerun.
 */
export function showBlocker(s: ShowInputs, recommendationId: string): string | null {
  if (s.source === "mock") return MOCK_REFUSAL;
  return solutionRefusal(s, recommendationId);
}

const NO_ROWS: RunView = {
  devices: [], services: [], patients: [], attempts: [], events: [], snapshots: [], chokePoints: [],
  totals: { patientsAffected: 0, devicesCompromised: 0, servicesDown: 0, delayedProcedures: 0 },
};

/**
 * The session as one scene shows it: the session's hospital and people, with
 * one run's rows in place of the active run's. With no view, the building is
 * clean (no run), as while the presenter picks a new patient zero.
 */
export function sceneOf(s: SessionSnapshot, view: RunView = NO_ROWS): SessionSnapshot {
  return {
    ...s,
    activeRun: view.run,
    activeRunId: view.run?.id ?? "",
    devices: view.devices,
    services: view.services,
    patients: view.patients,
    attempts: view.attempts,
    events: view.events,
    snapshots: view.snapshots,
    chokePoints: view.chokePoints,
    totals: view.totals,
    delayedProcedures: view.totals.delayedProcedures,
  };
}

type Sides = readonly (RunRow | undefined)[];

/**
 * The run one shared control is sent to. The module moves every run under the
 * pair's key, but it checks the status of the run it is given, and the two
 * sides can finish at different steps. So play and step go to a side that is
 * paused, pause to one that is playing, reset to one that is not computing.
 */
export function pairTarget(control: PlaybackControl | "speed", sides: Sides): RunRow | undefined {
  const runs = sides.filter((r): r is RunRow => !!r);
  const first = (status: RunRow["status"]) => runs.find((r) => r.status === status);
  switch (control) {
    case "play":
    case "step":
      return first("paused") ?? first("running") ?? runs[0];
    case "pause":
      return first("running") ?? runs[0];
    case "reset":
      return runs.find((r) => r.status !== "requested") ?? runs[0];
    case "speed":
      return runs[0];
  }
}

/** Why a shared control can't act on the pair now, or null. The same checks as the session's own run. */
export function pairRefusal(control: PlaybackControl, sides: Sides): string | null {
  if (!sides.some(Boolean)) return "The rerun hasn't started yet.";
  return controlRefusal(control, pairTarget(control, sides));
}

/** The shared clock: the furthest step either side has reached, out of the longer run. */
export function pairClock(sides: Sides): { tick: number; finalTick: number; line: string } {
  const runs = sides.filter((r): r is RunRow => !!r);
  const tick = Math.max(0, ...runs.map((r) => r.tick));
  const finalTick = Math.max(0, ...runs.map((r) => r.finalTick));
  if (runs.length < sides.length || runs.some((r) => r.status === "requested")) {
    return { tick, finalTick, line: "Computing the rerun…" };
  }
  const failed = runs.find((r) => r.status === "error");
  if (failed) return { tick, finalTick, line: runProgress(failed) };
  return { tick, finalTick, line: `Step ${tick} of ${finalTick}` };
}

export type Delta = {
  label: string;
  /** No segmentation's final value, or undefined until that run is done. */
  before?: number;
  /** The plan's final value, or undefined until that run is done. */
  after?: number;
  /** The headline (UX rule 1: patients affected leads). */
  lead?: boolean;
};

/**
 * The before/after strip, from the two run rows' summary columns, plus the
 * plan's rule count. A side's numbers fill in only once its run is done: part
 * way through, a run row holds the numbers at that step, and the two sides
 * finish at different steps, so mid-run columns would compare unlike things.
 */
export function beforeAfter(none: RunRow | undefined, plan: RunRow | undefined, rules: number | undefined): Delta[] {
  const b = finalOf(none);
  const a = finalOf(plan);
  return [
    { label: "Patients affected", before: b?.patientsAffected, after: a?.patientsAffected, lead: true },
    { label: "Devices compromised", before: b?.devicesCompromised, after: a?.devicesCompromised },
    { label: "Services down", before: b?.servicesDown, after: a?.servicesDown },
    { label: "Delayed procedures", before: b?.delayedProcedures, after: a?.delayedProcedures },
    { label: "Protected flows broken", before: b?.protectedBroken.length, after: a?.protectedBroken.length },
    { label: "Rules", before: none ? 0 : undefined, after: plan ? rules : undefined },
  ];
}

/** Which side the strip is still waiting for, and where it is ("No segmentation paused at step 5 of 14"), or null. */
export function stripPending(none: RunRow | undefined, plan: RunRow | undefined): string | null {
  const sides: [string, string | null][] = [["No segmentation", notFinalYet(none)], ["With the plan", notFinalYet(plan)]];
  const waiting = sides.filter(([, note]) => note !== null).map(([side, note]) => `${side} ${note}`);
  return waiting.length ? waiting.join(" · ") : null;
}

export type KeptFlow = { purpose: string; flowIds: string[]; broken: string[] };
export type KeptService = { id: string; name: string; down: boolean };

/**
 * "What keeps working" on the plan side: each protected flow, grouped by its
 * purpose, with the ones the plan removed (run.protected_broken_json); and each
 * critical service with its service_state row.
 */
export function keptWorking(
  hospital: Hospital,
  plan: RunRow | undefined,
  services: readonly ServiceStateRow[],
): { flows: KeptFlow[]; services: KeptService[] } {
  const broken = new Set(plan?.protectedBroken ?? []);
  const name = new Map(hospital.devices.map((d) => [d.id, d.name]));
  const flows = new Map<string, KeptFlow>();
  for (const f of hospital.flows) {
    if (!f.protected) continue;
    // A protected flow without a purpose is named by its two ends.
    const purpose = f.purpose ?? `${name.get(f.from) ?? f.from} → ${name.get(f.to) ?? f.to}`;
    const g = flows.get(purpose) ?? { purpose, flowIds: [], broken: [] };
    g.flowIds.push(f.id);
    if (broken.has(f.id)) g.broken.push(f.id);
    flows.set(purpose, g);
  }
  const down = new Map(services.map((s) => [s.serviceId, s.down]));
  return {
    flows: [...flows.values()],
    services: hospital.services.filter((s) => s.critical).map((s) => ({ id: s.id, name: s.name, down: !!down.get(s.id) })),
  };
}
