import { describe, expect, it } from "vitest";
import type { Room } from "@/lib/stdb/types";
import { cutGap, doorOf, floorPlan, inwardNormal, nearestWall, walkArea } from "./plan";

const rect = (x: number, y: number, w: number, d: number): Room["polygon"] => [
  [x, y], [x + w, y], [x + w, y + d], [x, y + d],
];
const room = (id: string, polygon: Room["polygon"], type: Room["type"] = "ward"): Room => ({
  id, floorId: "fl_0", name: id, type, zone: "z", polygon,
});

// Two rooms above a corridor (y 10..14) and one below.
const top1 = room("t1", rect(0, 0, 10, 10), "waiting");
const top2 = room("t2", rect(10, 0, 10, 10));
const bottom = room("b", rect(0, 14, 20, 10));

describe("floor plan", () => {
  it("puts each door on the corridor side", () => {
    const plan = floorPlan([top1, top2, bottom]);
    expect(plan.doors.get("t1")?.at).toEqual([5, 10]);
    expect(plan.doors.get("t1")?.inward).toEqual([0, -1]);
    expect(plan.doors.get("b")?.at).toEqual([10, 14]);
    expect(plan.doors.get("b")?.inward).toEqual([0, 1]);
  });

  it("draws a shared wall once and cuts the doorway out", () => {
    const plan = floorPlan([top1, top2, bottom]);
    const shared = plan.walls.filter((w) => w.a[0] === 10 && w.b[0] === 10 && Math.min(w.a[1], w.b[1]) === 0);
    expect(shared).toHaveLength(1);
    // t2's corridor wall (y = 10) is two pieces either side of a 2.4 m door; t1, a waiting area, has a 6 m opening.
    const t2Front = plan.walls.filter((w) => w.a[1] === 10 && w.b[1] === 10 && Math.min(w.a[0], w.b[0]) >= 10);
    expect(t2Front).toHaveLength(2);
    expect(t2Front.map((w) => +Math.abs(w.b[0] - w.a[0]).toFixed(2)).sort()).toEqual([3.8, 3.8]);
    const t1Front = plan.walls.filter((w) => w.a[1] === 10 && w.b[1] === 10 && Math.max(w.a[0], w.b[0]) <= 10);
    expect(t1Front.map((w) => Math.abs(w.b[0] - w.a[0])).sort()).toEqual([2, 2]);
  });

  it("closes the corridor ends in the outer wall and leaves the widest gap as the entrance", () => {
    const plan = floorPlan([top1, top2, bottom]);
    expect(plan.entrance).toBeDefined();
    // Both ends are 4 m; the one by the waiting area (left, x = 0) is the entrance, the right end is a solid wall.
    const right = plan.walls.filter((w) => w.a[0] === 20 && w.b[0] === 20 && Math.min(w.a[1], w.b[1]) === 10);
    expect(right).toHaveLength(1);
    expect(Math.abs(right[0].b[1] - right[0].a[1])).toBeCloseTo(4);
  });

  it("gives waiting areas a wide opening, capped by the wall", () => {
    const w = room("w", rect(0, 0, 6, 10), "waiting");
    expect(doorOf(w, [3, 20]).width).toBeCloseTo(4.4);
  });
});

describe("geometry helpers", () => {
  it("inward normals point into the room for either winding", () => {
    const cw: Room["polygon"] = rect(0, 0, 4, 4);
    const ccw = [...cw].reverse();
    expect(inwardNormal(cw, { a: cw[0], b: cw[1] })).toEqual([0, 1]);
    expect(inwardNormal(ccw, { a: ccw[0], b: ccw[1] })).toEqual([0, -1]);
  });

  it("cuts a gap out of the middle of a wall", () => {
    const pieces = cutGap({ a: [0, 0], b: [10, 0] }, [5, 0], 2);
    expect(pieces).toEqual([{ a: [0, 0], b: [4, 0] }, { a: [6, 0], b: [10, 0] }]);
  });

  it("finds the nearest wall and how far in a device sits", () => {
    const n = nearestWall(top1, [5, 1]);
    expect(n.inward).toEqual([0, 1]);
    expect(n.distance).toBeCloseTo(1);
  });

  it("keeps the walkable area on the door side", () => {
    const door = doorOf(top2, [10, 12]);
    const a = walkArea(top2, door);
    expect(a.maxY).toBeCloseTo(8.8);
    expect(a.minY).toBeCloseTo(8.8 - 7.6 * 0.55);
  });
});
