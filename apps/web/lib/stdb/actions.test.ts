import { beforeEach, describe, expect, it } from "vitest";
import { refusingActions, sessionActions, type SessionReducers } from "./actions";
import { BASE, VIEWER, tables } from "./fixtures/rows";
import { snapshotOf } from "./snapshot";

let calls: [string, unknown][];

// Fake reducers that record each call, as in apps/watcher/test/relay.test.ts.
const reducers = new Proxy({} as SessionReducers, {
  get: (_t, name: string) => async (args: unknown) => {
    calls.push([name, args]);
  },
});

const active = snapshotOf("s1", tables(), VIEWER).activeRun!;

beforeEach(() => {
  calls = [];
});

describe("sessionActions", () => {
  it("starts the attack as a no-policy baseline", async () => {
    await sessionActions(reducers, "s1", undefined, () => "run_new").startRun("ws_img", 2);
    expect(calls).toEqual([["runStart", {
      sessionId: "s1", runId: "run_new", label: "Baseline", patientZero: "ws_img", seed: 1337, speed: 2, policyJson: "",
      pairId: "", autoplay: true,
    }]]);
  });

  it("drives the active run, or the run it is given", async () => {
    const a = sessionActions(reducers, "s1", active);
    await a.play();
    await a.pause("pair_s1_2_1_plan");
    await a.step();
    await a.reset();
    await a.setSpeed(4);
    await a.setSpeed(0.5, "pair_s1_2_1_none");
    expect(calls).toEqual([
      ["runResume", { runId: BASE }], ["runPause", { runId: "pair_s1_2_1_plan" }], ["runStep", { runId: BASE }],
      ["runReset", { runId: BASE }], ["runSetSpeed", { runId: BASE, speed: 4 }],
      ["runSetSpeed", { runId: "pair_s1_2_1_none", speed: 0.5 }],
    ]);
  });

  it("ignores a click event passed where a run id goes", async () => {
    const pause = sessionActions(reducers, "s1", active).pause as (e: unknown) => Promise<void>;
    await pause({ type: "click" });
    expect(calls).toEqual([["runPause", { runId: BASE }]]);
  });

  it("refuses playback before the first attack, without calling a reducer", async () => {
    const a = sessionActions(reducers, "s1", undefined);
    for (const p of [a.play(), a.pause(), a.step(), a.reset(), a.setSpeed(1)]) await expect(p).rejects.toThrow("Start the attack first.");
    expect(calls).toEqual([]);
  });

  it("opens and closes the solution for every tab", async () => {
    const a = sessionActions(reducers, "s1", { ...active, speed: 2 });
    await a.showSolution("s1:2");
    await a.showSolution("s1:2", 0.5);
    await a.closeSolution();
    expect(calls).toEqual([
      ["solutionStart", { sessionId: "s1", recommendationId: "s1:2", speed: 2, patientZero: "" }],
      ["solutionStart", { sessionId: "s1", recommendationId: "s1:2", speed: 0.5, patientZero: "" }],
      ["solutionClose", { sessionId: "s1" }],
    ]);
  });

  it("passes the human controls through", async () => {
    const a = sessionActions(reducers, "s1", active);
    await a.join("Kai", "operations");
    await a.addFocus("srv_file");
    await a.clearFocus("9");
    await a.defend();
    await a.answerQuestion("q2", "yes");
    expect(calls).toEqual([
      ["presenceJoin", { sessionId: "s1", name: "Kai", role: "operations" }],
      ["annotationAdd", { sessionId: "s1", targetId: "srv_file", note: "" }],
      ["annotationClear", { annotationId: 9n }],
      ["defendRequest", { sessionId: "s1" }],
      ["questionAnswer", { sessionId: "s1", questionId: "q2", choice: "yes" }],
    ]);
  });

  it("rethrows a reducer's refusal as-is", async () => {
    const refusing = { defendRequest: async () => { throw new Error("Join the session before creating an aggregate fix."); } };
    await expect(sessionActions(refusing as unknown as SessionReducers, "s1", active).defend()).rejects.toThrow(
      "Join the session before creating an aggregate fix.",
    );
  });

  it("rejects every control while not connected", async () => {
    await expect(sessionActions(undefined, "s1", active).defend()).rejects.toThrow("Not connected to SpacetimeDB.");
  });
});

describe("refusingActions", () => {
  it("refuses every control with the reason", async () => {
    const a = refusingActions("Mock data");
    for (const p of [a.startRun("x"), a.play(), a.defend(), a.showSolution("r"), a.closeSolution()]) {
      await expect(p).rejects.toThrow("Mock data");
    }
  });
});
