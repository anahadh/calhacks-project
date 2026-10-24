import type { Point, Room } from "@/lib/stdb/types";

// Floor plan meters → scene units. Floors stack along y with a gap wide enough
// that, from the isometric camera, the ground floor is not hidden by the one above.
export const FLOOR_GAP = 15;
const OFFSET_X = -20;
const OFFSET_Z = -12;

/** How far the slab extends past the outermost room wall. */
export const SLAB_MARGIN = 1.6;
/** The slab's thickness. */
export const SLAB_H = 0.5;

export function to3([x, y]: Point, level: number, lift = 0): [number, number, number] {
  return [x + OFFSET_X, level * FLOOR_GAP + lift, y + OFFSET_Z];
}

export function centroid(polygon: Point[]): Point {
  const n = polygon.length;
  if (!n) return [0, 0];
  return [polygon.reduce((a, p) => a + p[0], 0) / n, polygon.reduce((a, p) => a + p[1], 0) / n];
}

export function bounds(polygon: Point[]) {
  if (!polygon.length) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  const xs = polygon.map((p) => p[0]);
  const ys = polygon.map((p) => p[1]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

/** The plan-space extent of a set of rooms (one floor, or the whole building). Empty → the demo footprint. */
export function roomsBounds(rooms: readonly Room[]) {
  if (!rooms.length) return { minX: 0, maxX: 40, minY: 0, maxY: 24 };
  const all = rooms.flatMap((r) => r.polygon);
  return bounds(all);
}

export function levelOf(room: Room, floorLevel: Map<string, number>) {
  return floorLevel.get(room.floorId) ?? 0;
}
