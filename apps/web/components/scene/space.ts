import type { Point, Room } from "@/lib/stdb/types";

// Floor plan meters → scene units. Floors stack along y with a gap wide enough
// that, from the default camera, the ground floor is not hidden by the one above.
export const FLOOR_GAP = 10;
const OFFSET_X = -20;
const OFFSET_Z = -12;

export function to3([x, y]: Point, level: number, lift = 0): [number, number, number] {
  return [x + OFFSET_X, level * FLOOR_GAP + lift, y + OFFSET_Z];
}

export function centroid(polygon: Point[]): Point {
  const n = polygon.length;
  return [polygon.reduce((a, p) => a + p[0], 0) / n, polygon.reduce((a, p) => a + p[1], 0) / n];
}

export function bounds(polygon: Point[]) {
  const xs = polygon.map((p) => p[0]);
  const ys = polygon.map((p) => p[1]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

export function levelOf(room: Room, floorLevel: Map<string, number>) {
  return floorLevel.get(room.floorId) ?? 0;
}
