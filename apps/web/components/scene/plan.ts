// Floor-plan geometry derived from the hospital file, so the scene can draw a
// real clinic (walls with doorways onto the corridor, furniture facing the right
// way, people walking in the free part of each room) from nothing but room
// polygons and device positions. Pure functions over plan coordinates (meters,
// x right, y down the plan); no three.js, so this is tested on its own.

import type { Point, Room } from "@/lib/stdb/types";
import { bounds, roomsBounds } from "./space";

/** One straight piece of wall between two plan points. */
export type Segment = { a: Point; b: Point };

/** A doorway in a room's wall: its centre, the unit normal pointing into the room, and the wall's unit direction. */
export type Door = { at: Point; inward: Point; along: Point; width: number };

/** Doorway widths (meters): a normal door, and the open front of a waiting area. */
export const DOOR_W = 2.4;
export const OPENING_W = 6;
/** The building's main entrance: the widest unclosed gap in the outer wall. */
export const ENTRANCE_W = 3.6;

const EPS = 1e-6;

/** The polygon's edges in order. */
export function edges(polygon: Point[]): Segment[] {
  return polygon.map((p, i) => ({ a: p, b: polygon[(i + 1) % polygon.length] }));
}

function centroidOf(polygon: Point[]): Point {
  const n = polygon.length || 1;
  return [polygon.reduce((a, p) => a + p[0], 0) / n, polygon.reduce((a, p) => a + p[1], 0) / n];
}
function mid(s: Segment): Point {
  return [(s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2];
}
function len(s: Segment) {
  return Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]);
}
function unit(s: Segment): Point {
  const l = len(s) || 1;
  return [(s.b[0] - s.a[0]) / l, (s.b[1] - s.a[1]) / l];
}
/** Signed area: positive when the polygon winds clockwise in plan coordinates (y down). */
function signedArea(polygon: Point[]) {
  let a = 0;
  for (const { a: p, b: q } of edges(polygon)) a += p[0] * q[1] - q[0] * p[1];
  return a / 2;
}
/** The unit normal of an edge that points into the polygon. */
export function inwardNormal(polygon: Point[], e: Segment): Point {
  const [ux, uy] = unit(e);
  // With y down the plan, a clockwise polygon has its inside to the right of each edge.
  const n: Point = signedArea(polygon) > 0 ? [-uy, ux] : [uy, -ux];
  return [n[0] || 0, n[1] || 0];
}

/**
 * Where a room opens onto the corridor: the edge whose midpoint is nearest the
 * middle of the floor, which on a double-loaded corridor plan is the corridor
 * side. Waiting areas get a wide opening instead of a door.
 */
export function doorOf(room: Room, floorCenter: Point): Door {
  let best = edges(room.polygon)[0];
  let bestD = Infinity;
  for (const e of edges(room.polygon)) {
    const m = mid(e);
    const d = Math.hypot(m[0] - floorCenter[0], m[1] - floorCenter[1]);
    if (d < bestD - EPS) {
      bestD = d;
      best = e;
    }
  }
  const width = Math.min(room.type === "waiting" ? OPENING_W : DOOR_W, Math.max(1.2, len(best) - 1.6));
  return { at: mid(best), inward: inwardNormal(room.polygon, best), along: unit(best), width };
}

/** Cut a gap of `width` centred at `at` out of a segment that passes through it. */
export function cutGap(s: Segment, at: Point, width: number): Segment[] {
  const u = unit(s);
  const l = len(s);
  const t = (at[0] - s.a[0]) * u[0] + (at[1] - s.a[1]) * u[1];
  const t0 = Math.max(0, t - width / 2);
  const t1 = Math.min(l, t + width / 2);
  if (t1 <= t0) return [s];
  const p = (k: number): Point => [s.a[0] + u[0] * k, s.a[1] + u[1] * k];
  const out: Segment[] = [];
  if (t0 > EPS) out.push({ a: s.a, b: p(t0) });
  if (l - t1 > EPS) out.push({ a: p(t1), b: s.b });
  return out;
}

const key = (s: Segment) => {
  const r = (v: number) => Math.round(v * 100) / 100;
  const p = `${r(s.a[0])},${r(s.a[1])}`;
  const q = `${r(s.b[0])},${r(s.b[1])}`;
  return p < q ? `${p}|${q}` : `${q}|${p}`;
};

export type FloorPlan = {
  /** Every wall piece to draw, each shared wall once. */
  walls: Segment[];
  doors: Map<string, Door>;
  /** The main entrance in the outer wall, if the rooms leave one open. */
  entrance?: Door;
  bounds: ReturnType<typeof roomsBounds>;
  center: Point;
};

/**
 * The walls of one floor: each room's edges with its doorway cut out, shared
 * walls drawn once, plus the outer wall closed across any gap the rooms leave
 * (the ends of a corridor). The widest such gap is the main entrance and stays
 * open to ENTRANCE_W.
 */
export function floorPlan(rooms: readonly Room[]): FloorPlan {
  const b = roomsBounds(rooms);
  const center: Point = [(b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2];
  const doors = new Map<string, Door>();
  const seen = new Map<string, Segment>();
  for (const room of rooms) {
    if (room.polygon.length < 3) continue;
    const door = doorOf(room, center);
    doors.set(room.id, door);
    for (const e of edges(room.polygon)) {
      const pieces = mid(e)[0] === door.at[0] && mid(e)[1] === door.at[1] ? cutGap(e, door.at, door.width) : [e];
      for (const p of pieces) seen.set(key(p), p);
    }
  }
  const walls = [...seen.values()];

  // Close the outer wall where no room edge runs along the boundary.
  const outer: { s: Segment; inward: Point }[] = [
    { s: { a: [b.minX, b.minY], b: [b.maxX, b.minY] }, inward: [0, 1] },
    { s: { a: [b.maxX, b.minY], b: [b.maxX, b.maxY] }, inward: [-1, 0] },
    { s: { a: [b.minX, b.maxY], b: [b.maxX, b.maxY] }, inward: [0, -1] },
    { s: { a: [b.minX, b.minY], b: [b.minX, b.maxY] }, inward: [1, 0] },
  ];
  const gaps: { s: Segment; inward: Point }[] = [];
  for (const o of outer) {
    const horizontal = o.s.a[1] === o.s.b[1];
    const fixed = horizontal ? o.s.a[1] : o.s.a[0];
    const lo = horizontal ? o.s.a[0] : o.s.a[1];
    const hi = horizontal ? o.s.b[0] : o.s.b[1];
    // Spans of this boundary covered by some room edge.
    const covered: [number, number][] = [];
    for (const room of rooms) {
      for (const e of edges(room.polygon)) {
        const onLine = horizontal
          ? Math.abs(e.a[1] - fixed) < EPS && Math.abs(e.b[1] - fixed) < EPS
          : Math.abs(e.a[0] - fixed) < EPS && Math.abs(e.b[0] - fixed) < EPS;
        if (!onLine) continue;
        const i = horizontal ? 0 : 1;
        covered.push([Math.min(e.a[i], e.b[i]), Math.max(e.a[i], e.b[i])]);
      }
    }
    covered.sort((x, y) => x[0] - y[0]);
    let cursor = lo;
    const open: [number, number][] = [];
    for (const [c0, c1] of covered) {
      if (c0 > cursor + EPS) open.push([cursor, c0]);
      cursor = Math.max(cursor, c1);
    }
    if (hi > cursor + EPS) open.push([cursor, hi]);
    for (const [g0, g1] of open) {
      const s: Segment = horizontal ? { a: [g0, fixed], b: [g1, fixed] } : { a: [fixed, g0], b: [fixed, g1] };
      gaps.push({ s, inward: o.inward });
    }
  }
  let entrance: Door | undefined;
  if (gaps.length) {
    // The entrance: the widest gap; between equals, the one nearest a waiting area (the lobby).
    const lobbies = rooms.filter((r) => r.type === "waiting").map((r) => centroidOf(r.polygon));
    const toLobby = (s: Segment) => {
      const m = mid(s);
      return lobbies.length ? Math.min(...lobbies.map((c) => Math.hypot(m[0] - c[0], m[1] - c[1]))) : 0;
    };
    const widest = gaps.reduce((x, y) =>
      len(y.s) > len(x.s) + EPS || (Math.abs(len(y.s) - len(x.s)) <= EPS && toLobby(y.s) < toLobby(x.s)) ? y : x,
    );
    const width = Math.min(ENTRANCE_W, Math.max(1.2, len(widest.s) - 0.8));
    entrance = { at: mid(widest.s), inward: widest.inward, along: unit(widest.s), width };
    for (const g of gaps) {
      const pieces = g === widest ? cutGap(g.s, entrance.at, width) : [g.s];
      for (const p of pieces) walls.push(p);
    }
  }
  return { walls, doors, entrance, bounds: b, center };
}

/** The room edge nearest a point, with the unit normal into the room and the distance to it. */
export function nearestWall(room: Room, p: Point): { inward: Point; along: Point; distance: number } {
  let best = { inward: [0, 1] as Point, along: [1, 0] as Point, distance: Infinity };
  for (const e of edges(room.polygon)) {
    const u = unit(e);
    const l = len(e);
    const t = Math.max(0, Math.min(l, (p[0] - e.a[0]) * u[0] + (p[1] - e.a[1]) * u[1]));
    const q: Point = [e.a[0] + u[0] * t, e.a[1] + u[1] * t];
    const d = Math.hypot(p[0] - q[0], p[1] - q[1]);
    if (d < best.distance) best = { inward: inwardNormal(room.polygon, e), along: u, distance: d };
  }
  return best;
}

/**
 * Where people can walk in a room: the room inset from its walls, keeping the
 * half nearest the door (equipment and beds line the far walls). A rectangle in
 * plan coordinates; rooms are drawn from their bounding box here.
 */
export function walkArea(room: Room, door: Door, inset = 1.2): { minX: number; maxX: number; minY: number; maxY: number } {
  const b = bounds(room.polygon);
  const a = { minX: b.minX + inset, maxX: b.maxX - inset, minY: b.minY + inset, maxY: b.maxY - inset };
  const keep = 0.55;
  if (door.inward[1] > 0.5) a.maxY = a.minY + (a.maxY - a.minY) * keep; // door on the top edge
  else if (door.inward[1] < -0.5) a.minY = a.maxY - (a.maxY - a.minY) * keep; // bottom edge
  else if (door.inward[0] > 0.5) a.maxX = a.minX + (a.maxX - a.minX) * keep; // left edge
  else if (door.inward[0] < -0.5) a.minX = a.maxX - (a.maxX - a.minX) * keep; // right edge
  return a;
}
