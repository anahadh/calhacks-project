import { describe, expect, it } from "vitest";
import { MOCK_REFUSAL } from "@/features/agents/defend";
import { recRow, runRow, withRun } from "@/features/fixtures";
import type { Hospital, RunView, SessionSnapshot } from "@/lib/stdb/types";
import {
  beforeAfter, hullOf, keptWorking, pairClock, pairRefusal, pairTarget, planFlows, sceneOf, segmentsOf, showBlocker,
  stripPending, withoutSegmentation,
} from "./pair";

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

const flows55 = {
  flows: [
    { id: "fl_1", from: "a", to: "b", protocol: "hl7" as const, port: 2575, protected: true, purpose: "Lab results to charts" },
    ...Array.from({ length: 54 }, (_, i) => ({ id: `fl_${i + 2}`, from: "a", to: "b", protocol: "smb" as const, port: 445, protected: false })),
  ],
};

describe("beforeAfter", () => {
  it("copies the two run rows' summary columns into the saved grid, with the plan's cuts and rules", () => {
    const d = beforeAfter(
      flows55,
      none({ status: "done", devicesCompromised: 16, servicesDown: 7 }),
      plan({ status: "done", devicesCompromised: 2, servicesDown: 2, protectedBroken: ["fl_1"], removedFlows: Array.from({ length: 38 }, (_, i) => `fl_${i + 1}`) }),
      4,
    );
    expect(d.map((x) => [x.label, x.before, x.after, x.note])).toEqual([
      ["Devices infected", 16, 2, undefined],
      ["Services offline", 7, 2, undefined],
      ["Protected flows cut", 0, 1, "Lab results to charts"],
      ["Connections", 55, 17, "4 allow rules"],
    ]);
  });
  it("leaves a side blank until its row arrives", () => {
    const d = beforeAfter(flows55, undefined, plan({ status: "done", devicesCompromised: 4 }), 1);
    expect(d[0]).toMatchObject({ before: undefined, after: 4 });
    expect(d[3]).toMatchObject({ before: undefined, after: 55, note: "1 allow rule" });
  });

  it("leaves a side blank until its run is done, so mid-run columns never read as the result", () => {
    // No segmentation part way through, the plan already finished.
    const playing = none({ status: "running", tick: 5, finalTick: 14, devicesCompromised: 6 });
    const finished = plan({ status: "done", tick: 1, finalTick: 1, devicesCompromised: 1, servicesDown: 1 });
    const d = beforeAfter(flows55, playing, finished, 2);
    expect(d.map((x) => [x.label, x.before, x.after])).toEqual([
      ["Devices infected", undefined, 1],
      ["Services offline", undefined, 1],
      ["Protected flows cut", undefined, 0],
      ["Connections", 55, 55],
    ]);
    expect(beforeAfter(flows55, none({ status: "paused", tick: 5, finalTick: 14 }), plan({ status: "paused" }), 2)[0]).toMatchObject({
      before: undefined,
      after: undefined,
    });
  });
});

describe("withoutSegmentation", () => {
  it("counts the baseline's device rows infected by the plan's step when they are subscribed", () => {
    const rows = [
      { deviceId: "a", infected: true, infectedAtTick: 0 },
      { deviceId: "b", infected: true, infectedAtTick: 3 },
      { deviceId: "c", infected: true, infectedAtTick: 9 },
      { deviceId: "d", infected: false },
    ];
    expect(withoutSegmentation(none({ status: "done", devicesCompromised: 3 }), rows, 5)).toBe(2);
    expect(withoutSegmentation(none({ status: "done", devicesCompromised: 3 }), rows, 9)).toBe(3);
  });
  it("falls back to the baseline run's summary column without rows, and to nothing before the row", () => {
    expect(withoutSegmentation(none({ status: "done", devicesCompromised: 16 }), [], 2)).toBe(16);
    expect(withoutSegmentation(none(), [], 2)).toBeUndefined();
    expect(withoutSegmentation(undefined, [], 2)).toBeUndefined();
  });
});

describe("planFlows", () => {
  it("splits the hospital's flows by the plan's removed_flows, skipping inactive ones", () => {
    const hospital = {
      flows: [
        { id: "fl_1", from: "a", to: "b", protocol: "smb" as const, port: 445, protected: false },
        { id: "fl_2", from: "a", to: "c", protocol: "smb" as const, port: 445, protected: false },
        { id: "fl_3", from: "a", to: "d", protocol: "smb" as const, port: 445, protected: false, active: false },
      ],
    };
    const { kept, cut } = planFlows(hospital, plan({ removedFlows: ["fl_2"] }));
    expect(kept.map((f) => f.id)).toEqual(["fl_1"]);
    expect(cut.map((f) => f.id)).toEqual(["fl_2"]);
    expect(planFlows(hospital, undefined).kept.map((f) => f.id)).toEqual(["fl_1", "fl_2"]);
  });
});

describe("segmentsOf", () => {
  const dev = (id: string, roomId: string) => ({
    id, roomId, type: "workstation" as const, name: id, os: "", vulnerable: false, criticality: "low" as const, vlan: 1, position: [0, 0] as [number, number],
  });
  const hospital: Hospital = {
    id: "h", name: "H", flows: [], services: [], patients: [],
    floors: [{ id: "fl_0", name: "Ground", level: 0 }, { id: "fl_1", name: "Level 1", level: 1 }],
    rooms: [
      { id: "r_img", floorId: "fl_0", name: "Imaging", type: "imaging", zone: "imaging", polygon: [] },
      { id: "r_read", floorId: "fl_1", name: "Reading", type: "imaging", zone: "imaging", polygon: [] },
      { id: "r_srv", floorId: "fl_1", name: "Server room", type: "server", zone: "it_core", polygon: [] },
      { id: "r_x", floorId: "fl_0", name: "Annex", type: "other", zone: "research_wing", polygon: [] },
    ],
    devices: [dev("mri_1", "r_img"), dev("mri_2", "r_img"), dev("ws_rad", "r_read"), dev("pacs", "r_srv"), dev("x1", "r_x")],
  };

  it("groups devices by room zone, with floors spanned and the run's infected count, in the design's order", () => {
    const s = segmentsOf(hospital, [{ deviceId: "mri_2", infected: true }, { deviceId: "pacs", infected: false }]);
    expect(s.map((x) => [x.name, x.floors, x.infected, x.total])).toEqual([
      ["Imaging", "Both floors", 1, 3],
      ["IT core", "Level 1", 0, 1],
      ["Research wing", "Ground", 0, 1],
    ]);
    expect(s[0].deviceIds).toEqual(["mri_1", "mri_2", "ws_rad"]);
    expect(s[0].floorIds).toEqual(["fl_0", "fl_1"]);
    expect(s[0].color).toBe("#B08CFF");
  });
});

describe("hullOf", () => {
  it("wraps three or more points in their convex hull, pushed out by the padding", () => {
    const h = hullOf([[0, 0], [4, 0], [4, 4], [0, 4], [2, 2]], 0);
    expect(h).toHaveLength(4);
    expect(h).toEqual(expect.arrayContaining([[0, 0], [4, 0], [4, 4], [0, 4]]));
    const padded = hullOf([[0, 0], [4, 0], [4, 4], [0, 4]], 1);
    expect(padded.every(([x, y]) => x < 0 || x > 4) && padded.every(([x, y]) => y < 0 || y > 4)).toBe(true);
  });
  it("boxes one or two points, and gives nothing for none", () => {
    expect(hullOf([[2, 3]], 1)).toEqual([[1, 2], [3, 2], [3, 4], [1, 4]]);
    expect(hullOf([[0, 0], [2, 0]], 1)).toEqual([[-1, -1], [3, -1], [3, 1], [-1, 1]]);
    expect(hullOf([])).toEqual([]);
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
