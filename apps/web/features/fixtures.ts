// Hand-written rows in the UI's shapes (lib/stdb/types.ts), for the feature
// tests. They follow the run contract (INTEGRATION.md 5b) but are not engine
// output, and they import nothing from another piece. All data is synthetic.

import type { RecommendationRow, RunRow, SessionSnapshot } from "@/lib/stdb/types";

export function runRow(over: Partial<RunRow> = {}): RunRow {
  return {
    id: "run_a", label: "Baseline", patientZero: "mri_2", seed: 1337, tick: 0, status: "requested", speed: 1,
    pairId: "", policyJson: "", finalTick: 0, detail: "", stepPending: false, removedFlows: [], protectedBroken: [],
    assumptions: [], recommendationId: "", patientsAffected: 0, devicesCompromised: 0, servicesDown: 0,
    delayedProcedures: 0, ...over,
  };
}

export function recRow(over: Partial<RecommendationRow> = {}): RecommendationRow {
  return {
    id: "s1:2", round: 2, name: "Keep scans flowing", rules: ["Scanners may send images to PACS."], explanation: "",
    verified: { patientsAffected: 0, devicesCompromised: 1, protectedBroken: [], removedFlows: ["fl_8"] },
    verdicts: [], requiredRoles: ["security"], status: "draft", fixture: false, ...over,
  };
}

/** The session fields the stepper, defend and solution helpers read. */
export type FlowInputs = Pick<
  SessionSnapshot,
  | "source" | "me" | "isPresenter" | "presenterName" | "activeRun" | "runs" | "roundState" | "recommendations"
  | "solutionPairId" | "entryPoints"
>;

/** A live session the presenter has joined, before any attack. */
export function flow(over: Partial<FlowInputs> = {}): FlowInputs {
  return {
    source: "live", me: { name: "Ana", role: "security", following: true }, isPresenter: true, presenterName: "Ana",
    activeRun: undefined, runs: [], roundState: { state: "idle", round: 0, maxRounds: 4 }, recommendations: [],
    solutionPairId: "", entryPoints: ["ws_img_1", "mri_2"], ...over,
  };
}

/** `flow` with `run` as the active run (and the only session run). */
export function withRun(run: RunRow, over: Partial<FlowInputs> = {}): FlowInputs {
  return flow({ activeRun: run, runs: [run], ...over });
}
