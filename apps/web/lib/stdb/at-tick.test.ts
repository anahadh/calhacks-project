import { describe, expect, it } from "vitest";
import { atTick } from "./at-tick";
import { mockSession } from "./mock-session";
import type { SessionSnapshot } from "./types";

const RUN = { ...mockSession.activeRun!, id: "r1", tick: 6 };
const S: SessionSnapshot = {
  ...mockSession,
  activeRunId: "r1",
  activeRun: RUN,
  runs: [RUN],
  devices: [
    { deviceId: "a", infected: true, infectedAtTick: 0 },
    { deviceId: "b", infected: true, infectedAtTick: 4, infectedBy: "a" },
    { deviceId: "c", infected: false },
  ],
  services: [
    { serviceId: "pacs", down: true, downSinceTick: 5 },
    { serviceId: "ehr", down: false },
  ],
  patients: [{ groupId: "g1", state: "delayed" }],
  attempts: [
    { tick: 1, from: "a", to: "b", flowId: "f1", success: false },
    { tick: 4, from: "a", to: "b", flowId: "f1", success: true },
  ],
  events: [
    { tick: 0, kind: "patient_zero", targetId: "a", text: "A — patient zero" },
    { tick: 4, kind: "device_infected", targetId: "b", text: "B compromised" },
  ],
  snapshots: [0, 1, 2, 3, 4, 5, 6].map((tick) => ({ tick, infectedCount: tick < 4 ? 1 : 2 })),
};

describe("atTick", () => {
  it("cuts every row back to the step this tab is looking at", () => {
    const v = atTick(S, 3);
    expect(v.activeRun?.tick).toBe(3);
    expect(v.runs[0].tick).toBe(3);
    expect(v.devices.filter((d) => d.infected).map((d) => d.deviceId)).toEqual(["a"]);
    expect(v.services.every((x) => !x.down)).toBe(true);
    expect(v.attempts.map((a) => a.tick)).toEqual([1]);
    expect(v.events.map((e) => e.kind)).toEqual(["patient_zero"]);
    expect(v.snapshots.at(-1)?.tick).toBe(3);
  });

  it("keeps a row from the step it happened on", () => {
    const v = atTick(S, 5);
    expect(v.devices.find((d) => d.deviceId === "b")).toEqual({ deviceId: "b", infected: true, infectedAtTick: 4, infectedBy: "a" });
    expect(v.services.find((x) => x.serviceId === "pacs")?.down).toBe(true);
  });

  it("shows no patient states in the past: their rows carry no step", () => {
    expect(atTick(S, 5).patients).toEqual([]);
  });

  it("is the live session at or past the run's step, and never touches the input", () => {
    expect(atTick(S, 6)).toBe(S);
    expect(atTick(S, 9)).toBe(S);
    atTick(S, 2);
    expect(S.devices.filter((d) => d.infected)).toHaveLength(2);
  });
});
