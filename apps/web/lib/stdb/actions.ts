// The session's controls: each one calls one reducer and nothing else. The
// watcher reacts to the rows those reducers write (AGENTS.md rules 4, 5, 9).
// A reducer's refusal (e.g. "Only the presenter can control playback.") is
// rethrown as-is for the UI to show.

import type { DbConnection } from "./module_bindings";
import type { RunRow, SessionActions, Speed } from "./types";

export type SessionReducers = Pick<
  DbConnection["reducers"],
  | "runStart" | "runResume" | "runPause" | "runStep" | "runReset" | "runSetSpeed" | "presenceJoin" | "annotationAdd"
  | "annotationClear" | "defendRequest" | "questionAnswer" | "solutionStart" | "solutionClose"
>;

/** Accepted and ignored: the engine has no RNG. Kept for the run_start contract. */
const SEED = 1337;

const newRunId = () => `run_${Date.now().toString(36)}`;

/**
 * Controls for one session. Playback acts on `runId` when it is a non-empty
 * string (any run of a pair moves the whole pair), else on the active run.
 * Without reducers (not connected yet), every control rejects.
 */
export function sessionActions(
  reducers: SessionReducers | undefined,
  sessionId: string,
  activeRun: RunRow | undefined,
  runIdFor: () => string = newRunId,
): SessionActions {
  const need = (): SessionReducers => {
    if (!reducers) throw new Error("Not connected to SpacetimeDB.");
    return reducers;
  };
  // A control handed straight to onClick gets an event, not a run id.
  const target = (runId?: unknown): string => {
    const id = typeof runId === "string" && runId ? runId : activeRun?.id;
    if (!id) throw new Error("Start the attack first.");
    return id;
  };

  return {
    startRun: async (patientZero, speed = 1) => {
      await need().runStart({
        sessionId, runId: runIdFor(), label: "Baseline", patientZero, seed: SEED, speed, policyJson: "", pairId: "",
        autoplay: true,
      });
    },
    play: async (runId) => need().runResume({ runId: target(runId) }),
    pause: async (runId) => need().runPause({ runId: target(runId) }),
    step: async (runId) => need().runStep({ runId: target(runId) }),
    reset: async (runId) => need().runReset({ runId: target(runId) }),
    setSpeed: async (speed, runId) => need().runSetSpeed({ runId: target(runId), speed }),
    join: async (name, role) => need().presenceJoin({ sessionId, name, role }),
    addFocus: async (deviceId, note = "") => need().annotationAdd({ sessionId, targetId: deviceId, note }),
    clearFocus: async (id) => need().annotationClear({ annotationId: BigInt(id) }),
    defend: async () => need().defendRequest({ sessionId }),
    answerQuestion: async (questionId, choice) => need().questionAnswer({ sessionId, questionId, choice }),
    showSolution: async (recommendationId, speed?: Speed, patientZero = "") =>
      need().solutionStart({ sessionId, recommendationId, speed: speed ?? activeRun?.speed ?? 1, patientZero }),
    closeSolution: async () => need().solutionClose({ sessionId }),
  };
}

/** Controls that always refuse with `reason`: for the explicit mock and the not-connected view. */
export function refusingActions(reason: string): SessionActions {
  const no = async () => {
    throw new Error(reason);
  };
  return {
    startRun: no, play: no, pause: no, step: no, reset: no, setSpeed: no, join: no, addFocus: no, clearFocus: no,
    defend: no, answerQuestion: no, showSolution: no, closeSolution: no,
  };
}
