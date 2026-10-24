import { describe, expect, it } from "vitest";
import { stepLabel, stepOf } from "../format";
import { BASE, NONE, PAIR, PLAN, VIEWER, tables } from "./fixtures/rows";
import {
  busyRunOf, controlRefusal, defendRefusal, flowStage, isBusy, pairOf, runProgress, solutionRefusal,
} from "./run-status";
import { snapshotOf } from "./snapshot";
import type { RoundState, RunRow } from "./types";

const base = snapshotOf("s1", tables(), VIEWER);
const runOf = (id: string) => base.runs.find((r) => r.id === id)!;
const at = (over: Partial<RunRow>): RunRow => ({ ...runOf(BASE), ...over });
const round = (state: RoundState["state"]): RoundState => ({ state, round: 2, maxRounds: 4 });

describe("step labels", () => {
  it("counts steps, not clock time", () => {
    expect(stepLabel(3)).toBe("Step 3");
    expect(stepOf(3, 15)).toBe("Step 3 of 15");
  });

  it("says where a run is, or why it failed, verbatim", () => {
    expect(runProgress(at({ status: "requested", tick: 0, finalTick: 0 }))).toBe("Computing…");
    expect(runProgress(at({ status: "running", tick: 1, finalTick: 2 }))).toBe("Step 1 of 2");
    expect(runProgress(at({ status: "done" }))).toBe("Step 2 of 2");
    const detail = "Engine refused the run (invalid_app_input): patient zero 'mri_1' is not a Windows device";
    expect(runProgress(at({ status: "error", detail }))).toBe(detail);
    expect(runProgress(at({ status: "error", detail: "" }))).toBe("The run failed.");
  });
});

describe("busy runs", () => {
  it("treats requested and running as busy", () => {
    expect(["requested", "running", "paused", "done", "error"].map((status) => isBusy({ status } as RunRow))).toEqual([
      true, true, false, false, false,
    ]);
    expect(busyRunOf(base.runs)?.id).toBe(NONE);
    expect(busyRunOf([runOf(BASE)])).toBeUndefined();
  });
});

describe("controlRefusal", () => {
  it("mirrors run_resume, run_step and run_reset", () => {
    expect(controlRefusal("play", undefined)).toBe("Start the attack first.");
    expect(controlRefusal("play", at({ status: "paused" }))).toBeNull();
    expect(controlRefusal("play", at({ status: "requested" }))).toBe("This run is still being computed.");
    expect(controlRefusal("play", at({ status: "done" }))).toBe("This run has finished. Reset it to play again.");
    expect(controlRefusal("play", at({ status: "error" }))).toBe("This run failed. Reset it to try again.");
    expect(controlRefusal("step", at({ status: "running" }))).toBe("Pause the run before stepping.");
    expect(controlRefusal("step", at({ status: "paused" }))).toBeNull();
    expect(controlRefusal("reset", at({ status: "requested" }))).toBe("This run is still being computed.");
    for (const status of ["running", "paused", "done", "error"] as const) expect(controlRefusal("reset", at({ status }))).toBeNull();
  });

  it("blocks moves the module would ignore", () => {
    expect(controlRefusal("play", at({ status: "running" }))).toBe("The run is already playing.");
    expect(controlRefusal("pause", at({ status: "paused" }))).toBe("The run is not playing.");
    expect(controlRefusal("pause", at({ status: "running" }))).toBeNull();
    expect(controlRefusal("step", at({ status: "paused", stepPending: true }))).toBe("The last step is still being applied.");
  });
});

describe("defendRefusal", () => {
  const ok = { ...base, runs: [runOf(BASE)], roundState: round("done") };

  it("mirrors defend_request, in its order", () => {
    expect(defendRefusal(ok)).toBeNull();
    expect(defendRefusal({ ...ok, me: undefined })).toBe("Join the session before creating an aggregate fix.");
    expect(defendRefusal({ ...ok, activeRun: undefined, runs: [] })).toBe("Run the attack first. The agents work from a baseline run.");
    const as = (status: RunRow["status"]) => {
      const r = at({ status });
      return defendRefusal({ ...ok, activeRun: r, runs: [r] });
    };
    expect(as("requested")).toBe("The attack is still being computed. Wait for it before creating an aggregate fix.");
    expect(as("error")).toBe("The attack run failed, so there is no baseline for the agents. Reset it or start a new attack.");
    expect(as("running")).toBe("Wait for the run to finish, or pause it, before creating an aggregate fix.");
    expect(as("paused")).toBeNull();
    expect(defendRefusal({ ...ok, roundState: round("waiting_for_human") })).toBe("An aggregate fix is already being negotiated for this session.");
  });

  it("waits for a solution pair that is still playing (rule 5)", () => {
    expect(defendRefusal({ ...base, roundState: round("done") })).toBe(
      "Wait for every run in this session to finish, or pause it, before creating an aggregate fix.",
    );
  });
});

describe("solutionRefusal", () => {
  const presenter = { ...base, isPresenter: true, runs: [runOf(BASE)], roundState: round("done") };

  it("mirrors solution_start", () => {
    expect(solutionRefusal(presenter, "s1:2")).toBeNull();
    expect(solutionRefusal({ ...presenter, isPresenter: false }, "s1:2")).toBe("Only the presenter can control playback.");
    expect(solutionRefusal(presenter, "s1:9")).toBe('Recommendation "s1:9" does not exist in this session.');
    expect(solutionRefusal({ ...presenter, roundState: round("running") }, "s1:2")).toBe(
      "Wait for the agents to finish negotiating before showing a solution.",
    );
    expect(solutionRefusal({ ...presenter, runs: base.runs }, "s1:2")).toBe(
      "Wait for every run in this session to finish, or pause it, before showing a solution.",
    );
    expect(solutionRefusal({ ...presenter, activeRun: undefined }, "s1:2")).toBe(
      "Run the attack first. The solution reruns the baseline's attack.",
    );
  });
});

describe("flowStage", () => {
  const none = { activeRun: undefined, roundState: round("idle"), recommendations: [], solutionPairId: "" };

  it("walks the demo flow from rows alone", () => {
    expect(flowStage(none)).toBe("pick");
    for (const status of ["requested", "running", "paused", "error"] as const) {
      expect(flowStage({ ...none, activeRun: at({ status }) })).toBe("spread");
    }
    expect(flowStage({ ...none, activeRun: at({ status: "done" }) })).toBe("defend");
    expect(flowStage({ ...none, activeRun: at({ status: "done" }), roundState: round("running") })).toBe("negotiating");
    expect(flowStage({ ...none, activeRun: at({ status: "done" }), roundState: round("waiting_for_human") })).toBe("negotiating");
    expect(flowStage({ ...none, activeRun: at({ status: "done" }), roundState: round("done") })).toBe("defend");
    expect(flowStage({ ...base, roundState: round("done"), solutionPairId: "" })).toBe("pick_solution");
    expect(flowStage(base)).toBe("solution");
  });
});

describe("pairOf", () => {
  it("tells the sides apart by recommendationId, not label", () => {
    const relabeled = base.runs.map((r) => ({ ...r, label: "x" }));
    expect(pairOf(relabeled, PAIR)).toMatchObject({ none: { id: NONE }, plan: { id: PLAN } });
    expect(pairOf(base.runs, "")).toEqual({});
    expect(pairOf(base.runs, "pair_missing")).toEqual({ none: undefined, plan: undefined });
  });
});
