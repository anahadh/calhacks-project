"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { Html, Line } from "@react-three/drei";
import { to3, WALL_H } from "@/components/scene/space";
import { centroid } from "@/components/scene/space";
import type { Hospital, Point, Room } from "@/lib/stdb/types";
import type { Segment } from "./pair";

// The plan's segmentation drawn over the simulation scene (HospitalScene's
// children), room by room: every room's floor is tinted in its segment's color,
// and a translucent fence stands on each room edge that does not face another
// room of the same segment. So two Imaging rooms side by side read as one
// fenced area, and the fence is exactly where the plan's walls are. A segment
// the infection reached, or whose device is hovered or whose row in the side
// column is hovered, is drawn stronger with its label. Everything comes from the
// hospital file and the run's rows (rule 16).

const FENCE_H = WALL_H + 0.9;
/** How far past the edge a point is tested for a same-segment neighbour (plan meters). */
const PROBE = 0.6;

export function SegmentOutlines({
  hospital,
  segments,
  floorId,
  litZone,
}: {
  hospital: Hospital;
  segments: readonly Segment[];
  /** Show one floor only; all floors when unset. */
  floorId?: string;
  /** The zone to draw stronger (a hovered device's, or a hovered row's). */
  litZone: string | null;
}) {
  const fences = useMemo(() => {
    const level = new Map(hospital.floors.map((f) => [f.id, f.level]));
    const color = new Map(segments.map((s) => [s.zone, s.color]));
    const out: { key: string; zone: string; level: number; floorId: string; color: string; rooms: Room[]; edges: [Point, Point][]; anchor: Point }[] = [];
    for (const s of segments) {
      for (const fid of s.floorIds) {
        const rooms = hospital.rooms.filter((r) => r.zone === s.zone && r.floorId === fid && r.polygon.length >= 3);
        if (!rooms.length) continue;
        const edges: [Point, Point][] = [];
        for (const r of rooms) {
          const poly = r.polygon;
          for (let i = 0; i < poly.length; i++) {
            const a = poly[i];
            const b = poly[(i + 1) % poly.length];
            // Probe both sides of the edge: a same-segment room on either side makes it an inner wall.
            const mx = (a[0] + b[0]) / 2;
            const my = (a[1] + b[1]) / 2;
            const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
            const nx = (-(b[1] - a[1]) / len) * PROBE;
            const ny = ((b[0] - a[0]) / len) * PROBE;
            const inner = rooms.some((o) => o !== r && (inside([mx + nx, my + ny], o.polygon) || inside([mx - nx, my - ny], o.polygon)));
            if (!inner) edges.push([a, b]);
          }
        }
        const tops = rooms.map((r) => centroid(r.polygon));
        const anchor = tops.reduce((a, p) => (p[1] < a[1] ? p : a), tops[0]);
        out.push({ key: `${s.zone}:${fid}`, zone: s.zone, level: level.get(fid) ?? 0, floorId: fid, color: color.get(s.zone) ?? s.color, rooms, edges, anchor });
      }
    }
    return out;
  }, [hospital, segments]);

  const byZone = new Map(segments.map((s) => [s.zone, s]));
  return (
    <>
      {fences
        .filter((f) => !floorId || f.floorId === floorId)
        .map((f) => {
          const s = byZone.get(f.zone)!;
          const lit = s.infected > 0 || litZone === f.zone;
          return (
            <Fence
              key={f.key}
              rooms={f.rooms}
              edges={f.edges}
              level={f.level}
              color={f.color}
              lit={lit}
              label={lit ? { name: s.name, infected: s.infected, total: s.total, at: f.anchor } : undefined}
            />
          );
        })}
    </>
  );
}

/** Ray-casting point in polygon, in plan meters. */
function inside([x, y]: Point, poly: Point[]): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/** One segment on one floor: tinted room floors, a translucent fence on its outer edges, a bright rail on top. */
function Fence({
  rooms,
  edges,
  level,
  color,
  lit,
  label,
}: {
  rooms: Room[];
  edges: [Point, Point][];
  level: number;
  color: string;
  lit: boolean;
  label?: { name: string; infected: number; total: number; at: Point };
}) {
  const floors = useMemo(
    () =>
      rooms.map((r) => {
        const s = new THREE.Shape();
        r.polygon.forEach(([x, y], i) => (i === 0 ? s.moveTo(x, y) : s.lineTo(x, y)));
        s.closePath();
        return s;
      }),
    [rooms],
  );
  const wall = useMemo(() => {
    const pos: number[] = [];
    for (const [a, b] of edges) {
      const [ax, ay, az] = to3(a, level, 0.02);
      const [bx, by, bz] = to3(b, level, 0.02);
      const top = FENCE_H;
      // two triangles per edge
      pos.push(ax, ay, az, bx, by, bz, bx, by + top, bz, ax, ay, az, bx, by + top, bz, ax, ay + top, az);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    return g;
  }, [edges, level]);
  const rails = useMemo(() => edges.map(([a, b]) => [to3(a, level, FENCE_H), to3(b, level, FENCE_H)] as [THREE.Vector3Tuple, THREE.Vector3Tuple]), [edges, level]);
  const [ox, oy, oz] = to3([0, 0], level);
  return (
    <group>
      {floors.map((shape, i) => (
        <mesh key={i} position={[ox, oy + 0.05, oz]} rotation={[Math.PI / 2, 0, 0]}>
          <shapeGeometry args={[shape]} />
          <meshBasicMaterial color={color} transparent opacity={lit ? 0.22 : 0.11} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      ))}
      <mesh geometry={wall}>
        <meshBasicMaterial color={color} transparent opacity={lit ? 0.3 : 0.14} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {rails.map((pts, i) => (
        <Line key={i} points={pts} color={color} lineWidth={lit ? 2.4 : 1.5} transparent opacity={lit ? 1 : 0.7} />
      ))}
      {label && (
        <Html position={to3(label.at, level, FENCE_H + 2.8)} center zIndexRange={[20, 10]} style={{ pointerEvents: "none" }}>
          <div
            className="num flex items-center gap-2 whitespace-nowrap rounded-ctl border bg-bg/90 px-2.5 py-0.5 text-[11px]"
            style={{ borderColor: color }}
          >
            <span className="text-ink">{label.name}</span>
            <span className={label.infected > 0 ? "text-state-infected" : "text-ink-faint"}>
              {label.infected > 0 ? `${label.infected}/${label.total}` : label.total}
            </span>
          </div>
        </Html>
      )}
    </group>
  );
}
