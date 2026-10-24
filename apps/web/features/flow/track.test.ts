import { describe, expect, it } from "vitest";
import type { SimEventRow } from "@/lib/stdb/types";
import { beatOf, markersOf, trackOf } from "./track";

const ev = (tick: number, kind: string, targetId = "x"): SimEventRow => ({ tick, kind, targetId, text: `${targetId} ${kind}` });

describe("trackOf", () => {
  it("spans the run's final step, not a fixed clock", () => {
    const t = trackOf(15);
    expect(t.cells).toBe(16);
    expect(t.pct(0)).toBe("0%");
    expect(t.pct(16)).toBe("100%");
    expect(t.pct(8)).toBe("50%");
  });
  it("labels about eight steps, always including the last", () => {
    expect(trackOf(15).labels).toEqual([0, 2, 4, 6, 8, 10, 12, 14, 15]);
    expect(trackOf(14).labels).toEqual([0, 2, 4, 6, 8, 10, 12, 14]);
    expect(trackOf(4).labels).toEqual([0, 1, 2, 3, 4]);
    expect(trackOf(20).labels).toEqual([0, 3, 6, 9, 12, 15, 18, 20]);
  });
  it("is one cell before frame 0 lands, and clamps", () => {
    const t = trackOf(0);
    expect(t.cells).toBe(1);
    expect(t.labels).toEqual([0]);
    expect(t.pct(-3)).toBe("0%");
    expect(t.pct(9)).toBe("100%");
  });
});

describe("beatOf", () => {
  it("is undefined before any event (the old -Infinity beat)", () => {
    expect(beatOf([], 3)).toBeUndefined();
    expect(beatOf([ev(5, "service_down")], 3)).toBeUndefined();
  });
  it("is the latest step with events up to now", () => {
    const events = [ev(0, "patient_zero"), ev(2, "device_infected", "a"), ev(2, "device_infected", "b"), ev(6, "service_down")];
    expect(beatOf(events, 4)).toEqual({ tick: 2, events: [events[1], events[2]] });
    expect(beatOf(events, 6)?.tick).toBe(6);
  });
});

describe("markersOf", () => {
  it("keeps one marker per step and kind", () => {
    const events = [ev(2, "device_infected", "a"), ev(2, "device_infected", "b"), ev(2, "service_down"), ev(3, "device_infected")];
    expect(markersOf(events).map((e) => `${e.tick}:${e.kind}`)).toEqual(["2:device_infected", "2:service_down", "3:device_infected"]);
  });
});
