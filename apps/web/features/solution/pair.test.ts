import { describe, expect, it } from "vitest";
import { MOCK_REFUSAL } from "@/features/agents/defend";
import { recRow, runRow, withRun } from "@/features/fixtures";
import type { Hospital, RunView, SessionSnapshot } from "@/lib/stdb/types";
import { beforeAfter, keptWorking, pairClock, pairRefusal, pairTarget, sceneOf, showBlocker, stripPending } from "./pair";

describe("showBlocker", () => {
  const done = runRow({ status: "done", tick: 15, finalTick: 15 });
  const round = { state: "done" as const, round: 2, maxRounds: 4 };
  const ready = withRun(done, { roundState: round, recommendations: [recRow()] });

  it("lets the presenter rerun once the round is done and nothing is playing", () => {
    expect(showBlocker(ready, "s1:2")).toBeNull();
  });
  it("mirrors solution_start's refusals", () => {
    expect(showBlocker({ ...ready, isPresenter: false }, "s1:2")).toBe("Only the presenter can control playback.");
    expect(showBlocker(ready, "s1:9")).toMatch(/does not exist/);
    expect(showBlocker({ ...ready, roundState: { ...round, state: "waiting_for_human" } }, "s1:2")).toMatch(/finish negotiating/);
    const busy = runRow({ id: "pair_1_none", pairId: "pair_1", status: "running" });
    expect(showBlocker({ ...ready, runs: [done, busy] }, "s1:2")).toMatch(/Wait for every run/);
  });
  it("says the mock can't act", () => {
    expect(showBlocker({ ...ready, source: "mock" }, "s1:2")).toBe(MOCK_REFUSAL);
  });
});

const none = (over = {}) => runRow({ id: "pair_1_none", pairId: "pair_1", label: "No segmentation", ...over });
const plan = (over = {}) =>
  runRow({ id: "pair_1_plan", pairId: "pair_1", label: "With plan: Keep scans", recommendationId: "s1:2", ...over });

describe("pairTarget / pairRefusal", () => {
  it("sends play and step to the side still paused once the plan side has finished", () => {
    const sides = [none({ status: "paused", tick: 3, finalTick: 15 }), plan({ status: "done", tick: 2, finalTick: 2 })];
    expect(pairTarget("play", sides)?.id).toBe("pair_1_none");
    expect(pairTarget("step", sides)?.id).toBe("pair_1_none");
    expect(pairRefusal("play", sides)).toBeNull();
    expect(pairRefusal("step", sides)).toBeNull();
  });

  it("sends pause to the side still playing", () => {
    const sides = [none({ status: "running", tick: 3, finalTick: 15 }), plan({ status: "done", tick: 2, finalTick: 2 })];
    expect(pairTarget("pause", sides)?.id).toBe("pair_1_none");
    expect(pairRefusal("pause", sides)).toBeNull();
    expect(pairRefusal("step", sides)).toBe("Pause the run before stepping.");
  });

  it("refuses play once both sides are done, but allows reset", () => {
    const sides = [none({ status: "done" }), plan({ status: "done" })];
    expect(pairRefusal("play", sides)).toBe("This run has finished. Reset it to play again.");
    expect(pairRefusal("reset", sides)).toBeNull();
  });

  it("refuses everything while both are computing, and before the rows arrive", () => {
    const sides = [none(), plan()];
    expect(pairRefusal("play", sides)).toBe("This run is still being computed.");
    expect(pairRefusal("reset", sides)).toBe("This run is still being computed.");
    expect(pairRefusal("play", [undefined, undefined])).toBe("The rerun hasn't started yet.");
  });
});

describe("pairClock", () => {
  it("shows the furthest step out of the longer run", () => {
    const c = pairClock([none({ status: "running", tick: 5, finalTick: 15 }), plan({ status: "done", tick: 2, finalTick: 2 })]);
    expect(c).toEqual({ tick: 5, finalTick: 15, line: "Step 5 of 15" });
  });
  it("says Computing until both rows exist and both have frame 0", () => {
    expect(pairClock([none({ status: "running", tick: 1, finalTick: 15 }), undefined]).line).toBe("Computing the rerun…");
    expect(pairClock([none({ status: "running" }), plan()]).line).toBe("Computing the rerun…");
  });
  it("shows a failed side's detail verbatim", () => {
    const c = pairClock([none({ status: "paused" }), plan({ status: "error", detail: "Engine refused the run (invalid_policy): x" })]);
    expect(c.line).toBe("Engine refused the run (invalid_policy): x");
  });
});

describe("beforeAfter", () => {
  it("copies the two run rows' summary columns, patients first", () => {
    const d = beforeAfter(
      none({ status: "done", patientsAffected: 212, devicesCompromised: 14, servicesDown: 7, delayedProcedures: 52 }),
      plan({ status: "done", patientsAffected: 9, devicesCompromised: 1, servicesDown: 1, delayedProcedures: 0, protectedBroken: ["fl_1"] }),
      3,
    );
    expect(d[0]).toEqual({ label: "Patients affected", before: 212, after: 9, lead: true });
    expect(d.map((x) => [x.label, x.before, x.after])).toEqual([
      ["Patients affected", 212, 9],
      ["Devices compromised", 14, 1],
      ["Services down", 7, 1],
      ["Delayed procedures", 52, 0],
      ["Protected flows broken", 0, 1],
      ["Rules", 0, 3],
    ]);
  });
  it("leaves a side blank until its row arrives", () => {
    const d = beforeAfter(undefined, plan({ status: "done", patientsAffected: 4 }), 2);
    expect(d[0]).toMatchObject({ before: undefined, after: 4 });
  });

  it("leaves a side blank until its run is done, so mid-run columns never read as the result", () => {
    // No segmentation part way through (patients 0 until its final step), the plan already finished.
    const playing = none({ status: "running", tick: 5, finalTick: 14, patientsAffected: 0, devicesCompromised: 6 });
    const finished = plan({ status: "done", tick: 1, finalTick: 1, patientsAffected: 26, devicesCompromised: 1, servicesDown: 1, delayedProcedures: 26 });
    const d = beforeAfter(playing, finished, 2);
    expect(d.map((x) => [x.label, x.before, x.after])).toEqual([
      ["Patients affected", undefined, 26],
      ["Devices compromised", undefined, 1],
      ["Services down", undefined, 1],
      ["Delayed procedures", undefined, 26],
      ["Protected flows broken", undefined, 0],
      ["Rules", 0, 2],
    ]);
    expect(beforeAfter(none({ status: "paused", tick: 5, finalTick: 14 }), plan({ status: "paused" }), 2)[0]).toMatchObject({
      before: undefined,
      after: undefined,
    });
  });
});

describe("stripPending", () => {
  it("names the side still playing and where it is, until both are done", () => {
    expect(stripPending(none({ status: "running", tick: 5, finalTick: 14 }), plan({ status: "done", tick: 1, finalTick: 1 }))).toBe(
      "No segmentation playing, step 5 of 14",
    );
    expect(stripPending(none({ status: "paused", tick: 5, finalTick: 14 }), plan())).toBe(
      "No segmentation paused at step 5 of 14 · With the plan computing…",
    );
    expect(stripPending(none({ status: "done" }), plan({ status: "done" }))).toBeNull();
  });
});

describe("keptWorking", () => {
  const hospital = {
    id: "h", name: "H", floors: [], rooms: [], devices: [], patients: [],
    flows: [
      { id: "fl_1", from: "a", to: "p", protocol: "dicom", port: 104, protected: true, purpose: "Scans to radiologists" },
      { id: "fl_2", from: "b", to: "p", protocol: "dicom", port: 104, protected: true, purpose: "Scans to radiologists" },
      { id: "fl_3", from: "c", to: "e", protocol: "hl7", port: 2575, protected: true, purpose: "Vitals to charts" },
      { id: "fl_4", from: "c", to: "f", protocol: "smb", port: 445, protected: false },
    ],
    services: [
      { id: "svc_a", name: "Imaging", dependsOnDevices: ["a"], consequence: "", critical: true },
      { id: "svc_b", name: "Files", dependsOnDevices: ["f"], consequence: "" },
    ],
  } satisfies Hospital;

  it("groups protected flows by purpose and names the ones the plan broke", () => {
    const k = keptWorking(hospital, plan({ protectedBroken: ["fl_2"] }), [{ serviceId: "svc_a", down: true }]);
    expect(k.flows).toEqual([
      { purpose: "Scans to radiologists", flowIds: ["fl_1", "fl_2"], broken: ["fl_2"] },
      { purpose: "Vitals to charts", flowIds: ["fl_3"], broken: [] },
    ]);
    expect(k.services).toEqual([{ id: "svc_a", name: "Imaging", down: true }]);
  });

  it("names a protected flow without a purpose by its two devices", () => {
    const h = {
      ...hospital,
      devices: [
        { id: "a", roomId: "r", type: "mri", name: "MRI 1", os: "", vulnerable: false, criticality: "high", vlan: 1, position: [0, 0] },
        { id: "p", roomId: "r", type: "server_rack", name: "PACS", os: "", vulnerable: false, criticality: "high", vlan: 1, position: [1, 0] },
      ],
      flows: [{ id: "fl_9", from: "a", to: "p", protocol: "dicom", port: 104, protected: true }],
    } satisfies Hospital;
    expect(keptWorking(h, undefined, []).flows).toEqual([{ purpose: "MRI 1 → PACS", flowIds: ["fl_9"], broken: [] }]);
  });
});

describe("sceneOf", () => {
  const session = {
    activeRunId: "run_a", activeRun: runRow(), devices: [{ deviceId: "x", infected: true }], services: [], patients: [],
    attempts: [], events: [], snapshots: [], chokePoints: [], delayedProcedures: 5,
    totals: { patientsAffected: 9, devicesCompromised: 1, servicesDown: 0, delayedProcedures: 5 },
  } as unknown as SessionSnapshot;

  it("swaps in one run's rows and totals", () => {
    const view: RunView = {
      run: plan({ status: "running" }), devices: [], services: [{ serviceId: "s", down: true }], patients: [], attempts: [],
      events: [], snapshots: [], chokePoints: [], totals: { patientsAffected: 1, devicesCompromised: 2, servicesDown: 1, delayedProcedures: 0 },
    };
    const s = sceneOf(session, view);
    expect(s.activeRunId).toBe("pair_1_plan");
    expect(s.services).toEqual([{ serviceId: "s", down: true }]);
    expect(s.totals.devicesCompromised).toBe(2);
    expect(s.delayedProcedures).toBe(0);
  });

  it("with no view, shows the clean building", () => {
    const s = sceneOf(session);
    expect(s.activeRun).toBeUndefined();
    expect(s.activeRunId).toBe("");
    expect(s.devices).toEqual([]);
    expect(s.totals.patientsAffected).toBe(0);
  });
});
