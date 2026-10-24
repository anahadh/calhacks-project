import { describe, expect, it } from "vitest";
import type { DeviceStateRow, ServiceStateRow, SimEventRow, SpreadAttemptRow } from "@/lib/stdb/types";
import { schedule, SpreadTracker, stepMsOf, stoppedAt, TICK_MS, TOAST_MS, type SpreadRows } from "./spread-timing";

// Hand-written rows for one small run (synthetic ids). Nothing here is engine output.
const dev = (deviceId: string, infected: boolean): DeviceStateRow => ({ deviceId, infected });
const svc = (serviceId: string, down: boolean): ServiceStateRow => ({ serviceId, down });
const hit = (tick: number, from: string, to: string, flowId: string, success = true): SpreadAttemptRow => ({
  tick, from, to, flowId, success,
});
const ev = (tick: number, kind: string, targetId: string, text = `${targetId} ${kind}`): SimEventRow => ({
  tick, kind, targetId, text,
});

const frame0: SpreadRows = {
  runId: "run_a", tick: 0, speed: 1,
  devices: [dev("ws_a", true), dev("srv_b", false), dev("ws_c", false)],
  services: [svc("svc_b", false)],
  attempts: [],
  events: [ev(0, "patient_zero", "ws_a")],
};
const frame1: SpreadRows = {
  ...frame0, tick: 1,
  devices: [dev("ws_a", true), dev("srv_b", true), dev("ws_c", false)],
  attempts: [hit(1, "ws_a", "srv_b", "fl_1")],
  events: [...frame0.events, ev(1, "device_infected", "srv_b")],
};
const frame2: SpreadRows = {
  ...frame1, tick: 2,
  devices: [dev("ws_a", true), dev("srv_b", true), dev("ws_c", true)],
  services: [svc("svc_b", true)],
  attempts: [...frame1.attempts, hit(2, "srv_b", "ws_c", "fl_2")],
  events: [...frame1.events, ev(2, "device_infected", "ws_c"), ev(2, "service_down", "svc_b")],
};
const requested: SpreadRows = { ...frame0, devices: [], services: [], attempts: [], events: [] };

describe("schedule", () => {
  it("plays only the given step's attempts, over most of one step", () => {
    const p = schedule([hit(1, "a", "b", "fl_1"), hit(2, "b", "c", "fl_2")], 2, 100, 1000);
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ from: "b", to: "c", flowId: "fl_2", success: true, start: 100 });
    expect(p[0].duration).toBeCloseTo(900);
  });

  it("chains hops: a hop leaving where an earlier hop arrived waits for it", () => {
    const p = schedule([hit(3, "a", "b", "fl_1"), hit(3, "b", "c", "fl_2"), hit(3, "a", "d", "fl_3")], 3, 0, 1000);
    expect(p.map((x) => x.start)).toEqual([0, 450, 0]);
    expect(p.every((x) => x.duration === 450)).toBe(true);
  });

  it("never chains from a fizzle, which arrives nowhere", () => {
    const p = schedule([hit(1, "a", "b", "fl_1", false), hit(1, "b", "c", "fl_2")], 1, 0, 1000);
    expect(p.map((x) => x.start)).toEqual([0, 0]);
  });

  it("gives every row of a step its own key", () => {
    const p = schedule([hit(1, "a", "b", "fl_1"), hit(1, "a", "b", "fl_1")], 1, 0, 1000);
    expect(new Set(p.map((x) => x.key)).size).toBe(2);
  });
});

describe("stepMsOf", () => {
  it("is TICK_MS over the run's speed", () => {
    expect(stepMsOf(1)).toBe(TICK_MS);
    expect(stepMsOf(4)).toBe(TICK_MS / 4);
    expect(stepMsOf(0)).toBe(TICK_MS);
  });
});

describe("stoppedAt", () => {
  const flow = new Map([
    ["fl_1", { from: "a", to: "b" }],
    ["fl_2", { from: "c", to: "d" }],
    ["fl_3", { from: "e", to: "f" }],
  ]);
  it("marks removed flows with exactly one infected end", () => {
    const state = new Map([["a", { infected: true }], ["c", { infected: true }], ["d", { infected: true }]]);
    expect([...stoppedAt(["fl_1", "fl_2", "fl_3", "fl_missing"], flow, state)]).toEqual(["fl_1"]);
  });
  it("marks nothing without a plan", () => {
    expect(stoppedAt([], flow, new Map([["a", { infected: true }]])).size).toBe(0);
  });
});

describe("SpreadTracker", () => {
  it("plays a run watched from frame 0: the patient zero flash and toast at once", () => {
    const t = new SpreadTracker();
    t.observe(requested, 0);
    const s = t.observe(frame0, 1000);
    expect(s.flashAt.get("ws_a")).toBe(1000);
    expect(s.toasts.map((x) => x.kind)).toEqual(["patient_zero"]);
    expect(s.pulses).toEqual([]);
  });

  it("flashes a device when the pulse that infected it arrives, and toasts it then", () => {
    const t = new SpreadTracker();
    t.observe(frame0, 1000);
    const s = t.observe(frame1, 2000);
    expect(s.pulses).toHaveLength(1);
    expect(s.pulses[0].start).toBe(2000);
    expect(s.flashAt.get("srv_b")).toBe(2000 + s.pulses[0].duration);
    expect(s.toasts.find((x) => x.targetId === "srv_b")?.start).toBe(2000 + s.pulses[0].duration);
  });

  it("pops a service when it goes down on a step this tab saw, and gives it no toast", () => {
    const t = new SpreadTracker();
    t.observe(frame0, 0);
    t.observe(frame1, 1000);
    const s = t.observe(frame2, 2000);
    expect(s.downAt.get("svc_b")).toBe(2000);
    expect(s.toasts.some((x) => x.kind === "service_down")).toBe(false);
  });

  it("plays nothing for a run first seen part way through, until its next step", () => {
    const t = new SpreadTracker();
    const late = t.observe(frame1, 5000);
    expect(late.pulses).toEqual([]);
    expect(late.flashAt.size).toBe(0);
    expect(late.toasts).toEqual([]);
    const next = t.observe(frame2, 6000);
    expect(next.pulses.map((p) => p.to)).toEqual(["ws_c"]);
    expect([...next.flashAt.keys()]).toEqual(["ws_c"]);
    expect(next.toasts.map((x) => x.targetId)).toEqual(["ws_c"]);
  });

  it("is idempotent: observing the same rows again changes nothing", () => {
    const t = new SpreadTracker();
    t.observe(frame0, 0);
    const a = t.observe(frame1, 1000);
    const flash = a.flashAt.get("srv_b");
    const b = t.observe(frame1, 1010);
    expect(b.pulses.map((p) => p.start)).toEqual([1000]);
    expect(b.flashAt.get("srv_b")).toBe(flash);
    expect(b.toasts).toHaveLength(2);
  });

  it("replays from frame 0 after a reset clears the rows", () => {
    const t = new SpreadTracker();
    t.observe(frame0, 0);
    t.observe(frame1, 1000);
    t.observe(requested, 2000);
    const again = t.observe(frame0, 3000);
    expect(again.flashAt.get("ws_a")).toBe(3000);
    expect(again.flashAt.has("srv_b")).toBe(false);
  });

  it("starts over for a different run", () => {
    const t = new SpreadTracker();
    t.observe(frame0, 0);
    const other = t.observe({ ...frame1, runId: "run_b" }, 1000);
    expect(other.pulses).toEqual([]);
    expect(other.flashAt.size).toBe(0);
  });

  it("drops toasts once they have been on screen for TOAST_MS", () => {
    const t = new SpreadTracker();
    t.observe(frame0, 0);
    expect(t.observe(frame0, TOAST_MS - 1).toasts).toHaveLength(1);
    expect(t.observe(frame0, TOAST_MS + 1).toasts).toHaveLength(0);
  });
});
