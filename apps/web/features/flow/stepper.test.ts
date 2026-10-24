import { describe, expect, it } from "vitest";
import { MOCK_REFUSAL } from "@/features/agents/defend";
import { flow, recRow, runRow, withRun } from "@/features/fixtures";
import { canRepick, defaultPick, pickedOf, stepperOf, type StepperUi } from "./stepper";

const NAMES: Record<string, string> = { mri_2: "MRI 2", ws_img_1: "Imaging WS 1" };
const ui = (over: Partial<StepperUi> = {}): StepperUi => ({
  repick: false, selected: "mri_2", nameOf: (id) => NAMES[id] ?? id, ...over,
});
const kinds = (s: ReturnType<typeof stepperOf>) => s.actions.map((a) => a.kind);

describe("defaultPick / pickedOf", () => {
  it("pre-selects mri_2 only when the engine lists it", () => {
    expect(defaultPick(["ws_img_1", "mri_2"])).toBe("mri_2");
    expect(defaultPick(["ws_img_1"])).toBeUndefined();
    expect(defaultPick([])).toBeUndefined();
  });
  it("keeps the presenter's click only for an entry point", () => {
    expect(pickedOf("ws_img_1", ["ws_img_1", "mri_2"])).toBe("ws_img_1");
    expect(pickedOf("pm_icu_1", ["ws_img_1", "mri_2"])).toBe("mri_2");
    expect(pickedOf(undefined, ["ws_img_1"])).toBeUndefined();
  });
});

describe("stepperOf: 1 run the attack", () => {
  it("before any attack, the presenter picks patient zero and starts it", () => {
    const s = stepperOf(flow(), ui());
    expect(s).toMatchObject({ stage: "pick", step: 1 });
    expect(s.line).toMatch(/Patient zero: MRI 2/);
    expect(s.actions).toEqual([{ kind: "start", label: "Start attack", blocked: null }]);
  });

  it("Start attack waits for a pick", () => {
    const s = stepperOf(flow(), ui({ selected: undefined }));
    expect(s.line).toBe("Click a highlighted device to make it patient zero.");
    expect(s.actions[0].blocked).toBe("Pick patient zero first.");
  });

  it("Start attack waits for the engine's entry points, and shows the watcher's error", () => {
    const s = stepperOf(
      flow({ entryPoints: [], roundState: { state: "idle", round: 0, maxRounds: 4, detail: "Engine unreachable." } }),
      ui({ selected: undefined }),
    );
    expect(s.line).toMatch(/^Waiting for the engine to list the devices.*Engine unreachable\.$/);
    expect(s.actions[0]).toMatchObject({ kind: "start" });
    expect(s.actions[0].blocked).toMatch(/Waiting for the engine/);
  });

  it("a follower sees who is presenting and has no action", () => {
    const s = stepperOf(flow({ isPresenter: false }), ui());
    expect(s.line).toBe("Waiting for Ana to pick patient zero and start the attack.");
    expect(s.actions).toEqual([]);
  });

  it("requested shows Computing", () => {
    const s = stepperOf(withRun(runRow({ status: "requested" })), ui());
    expect(s).toMatchObject({ stage: "spread", step: 1 });
    expect(s.line).toMatch(/^Computing the attack…/);
  });

  it("running shows Step N of M, and no action while agents must stay idle", () => {
    const s = stepperOf(withRun(runRow({ status: "running", tick: 3, finalTick: 15 })), ui());
    expect(s.line).toMatch(/^Step 3 of 15\./);
    expect(s.actions).toEqual([]);
  });

  it("paused offers Create aggregate fix", () => {
    const s = stepperOf(withRun(runRow({ status: "paused", tick: 4, finalTick: 15 })), ui());
    expect(s.line).toMatch(/^Step 4 of 15, paused\./);
    expect(s.actions).toEqual([{ kind: "defend", label: "Create aggregate fix", blocked: null }]);
  });

  it("error shows the engine's detail verbatim and lets the presenter pick again", () => {
    const detail = "Engine refused the run (invalid_app_input): patient zero must be a Windows device";
    const s = stepperOf(withRun(runRow({ status: "error", detail })), ui());
    expect(s.line).toBe(detail);
    expect(kinds(s)).toEqual(["repick"]);
    expect(kinds(stepperOf(withRun(runRow({ status: "error", detail }), { isPresenter: false }), ui()))).toEqual([]);
  });

  it("Pick another device returns to the pick step, with Cancel", () => {
    const s = stepperOf(withRun(runRow({ status: "error", detail: "x" })), ui({ repick: true }));
    expect(s.stage).toBe("pick");
    expect(kinds(s)).toEqual(["start", "cancel_repick"]);
  });
});

describe("stepperOf: 2 create aggregate fix", () => {
  const done = runRow({ status: "done", tick: 15, finalTick: 15, devicesCompromised: 14, patientsAffected: 212 });

  it("a finished run asks for Create aggregate fix, quoting the run row's totals", () => {
    const s = stepperOf(withRun(done), ui());
    expect(s).toMatchObject({ stage: "defend", step: 2 });
    expect(s.line).toMatch(/reached 14 devices and affected 212 patients/);
    expect(kinds(s)).toEqual(["defend", "repick"]);
    expect(s.actions[0].blocked).toBeNull();
  });

  it("Create aggregate fix carries the reducer's refusal (busy solution pair)", () => {
    const busy = runRow({ id: "pair_1_none", pairId: "pair_1", status: "requested" });
    const s = stepperOf(withRun(done, { runs: [done, busy] }), ui());
    expect(s.actions[0].blocked).toMatch(/Wait for every run in this session/);
  });

  it("in the mock every action says it is mock data", () => {
    const s = stepperOf(withRun(done, { source: "mock" }), ui());
    expect(s.actions.every((a) => a.blocked === MOCK_REFUSAL)).toBe(true);
  });

  it("negotiating points at the Agents tab", () => {
    const s = stepperOf(withRun(done, { roundState: { state: "running", round: 1, maxRounds: 4 } }), ui());
    expect(s).toMatchObject({ stage: "negotiating", step: 2 });
    expect(kinds(s)).toEqual(["agents"]);
    const q = stepperOf(withRun(done, { roundState: { state: "waiting_for_human", round: 1, maxRounds: 4 } }), ui());
    expect(q.line).toMatch(/waiting for a human/);
  });

  it("a round that ended with no recommendation offers another", () => {
    const s = stepperOf(withRun(done, { roundState: { state: "done", round: 4, maxRounds: 4 } }), ui());
    expect(s.stage).toBe("defend");
    expect(s.line).toMatch(/^No recommendation came out/);
    expect(kinds(s)).toEqual(["defend"]);
  });
});

describe("stepperOf: 3 show the solution", () => {
  const done = runRow({ status: "done", tick: 15, finalTick: 15 });
  const round = { state: "done" as const, round: 2, maxRounds: 4 };

  it("recommendations lead to Show the solution, on the Agents tab", () => {
    const s = stepperOf(withRun(done, { roundState: round, recommendations: [recRow()] }), ui());
    expect(s).toMatchObject({ stage: "pick_solution", step: 3 });
    expect(s.line).toMatch(/recommend 1 plan\. Press Show the solution/);
    expect(kinds(s)).toEqual(["agents"]);
  });

  it("an open solution pair is the last step, and repick is off", () => {
    const s = stepperOf(withRun(done, { roundState: round, recommendations: [recRow()], solutionPairId: "pair_1" }), ui({ repick: true }));
    expect(s).toMatchObject({ stage: "solution", step: 3 });
  });

  it("never calls agent output approved, ready or safe to deploy", () => {
    const s = stepperOf(withRun(done, { roundState: round, recommendations: [recRow(), recRow({ id: "s1:3" })] }), ui());
    expect(s.line).not.toMatch(/approved|ready|safe to deploy/i);
  });
});

describe("canRepick", () => {
  it("only the presenter, only after a failure or a finished run with no round yet", () => {
    const done = runRow({ status: "done" });
    expect(canRepick(withRun(done))).toBe(true);
    expect(canRepick(withRun(done, { roundState: { state: "done", round: 1, maxRounds: 4 } }))).toBe(false);
    expect(canRepick(withRun(done, { isPresenter: false }))).toBe(false);
    expect(canRepick(withRun(runRow({ status: "running" })))).toBe(false);
    expect(canRepick(withRun(runRow({ status: "error" })))).toBe(true);
    expect(canRepick(flow())).toBe(false);
  });
});
