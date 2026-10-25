"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { Html, Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { centroid, to3, WALL_H } from "@/components/scene/space";
import type { Hospital, Point, Room } from "@/lib/stdb/types";
import type { Segment } from "./pair";

// The plan's segmentation rising out of the floor (HospitalScene's children).
// A segment is the set of machines still joined by file-sharing or remote-desktop
// links after the plan's cuts (pair.ts planSegmentsOf). Each room belongs to the
// segment that owns most of its machines; a segment's barrier is the outer edge
// of its rooms (edges that do not face another room of the same segment), so it
// follows real walls and never covers a room that is not in it. The rooms' floors
// tint in the segment's color and a translucent wall grows up from the ground
// when the plan appears, one segment after another. The segment the infection
// reached, or the hovered one, is drawn stronger with its label. The animation
// only reveals rows (rule 16).

const H = WALL_H + 1.1;
const RISE_MS = 2800;
const STAGGER_MS = 450;
/** How far past an edge a point is tested for a same-segment neighbour (plan meters). */
const PROBE = 0.6;

type Barrier = { key: string; zone: string; floorId: string; level: number; color: string; rooms: Room[]; edges: [Point, Point][]; anchor: Point; order: number };

export function SegmentBarriers({
  hospital,
  segments,
  floorId,
  litZone,
}: {
  hospital: Hospital;
  segments: readonly Segment[];
  floorId?: string;
  litZone: string | null;
}) {
  const barriers = useMemo<Barrier[]>(() => {
    const roomOf = new Map(hospital.devices.map((d) => [d.id, d.roomId]));
    const level = new Map(hospital.floors.map((f) => [f.id, f.level]));
    // A room belongs to the segment with the most of its machines.
    const claim = new Map<string, { zone: string; n: number }>();
    for (const s of segments) {
      const n = new Map<string, number>();
      for (const id of s.deviceIds) {
        const rid = roomOf.get(id);
        if (rid) n.set(rid, (n.get(rid) ?? 0) + 1);
      }
      for (const [rid, count] of n) if ((claim.get(rid)?.n ?? 0) < count) claim.set(rid, { zone: s.zone, n: count });
    }
    const out: Barrier[] = [];
    segments.forEach((s, order) => {
      for (const fid of s.floorIds) {
        const rooms = hospital.rooms.filter((r) => claim.get(r.id)?.zone === s.zone && r.floorId === fid && r.polygon.length >= 3);
        if (!rooms.length) continue;
        const edges: [Point, Point][] = [];
        for (const r of rooms) {
          const poly = r.polygon;
          for (let i = 0; i < poly.length; i++) {
            const a = poly[i];
            const b = poly[(i + 1) % poly.length];
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
        out.push({ key: `${s.zone}:${fid}`, zone: s.zone, floorId: fid, level: level.get(fid) ?? 0, color: s.color, rooms, edges, anchor, order });
      }
    });
    return out;
  }, [hospital, segments]);
  const byZone = new Map(segments.map((s) => [s.zone, s]));

  return (
    <>
      {barriers
        .filter((b) => !floorId || b.floorId === floorId)
        .map((b) => {
          const s = byZone.get(b.zone)!;
          const lit = s.infected > 0 || litZone === b.zone;
          return <Rising key={b.key} b={b} lit={lit} label={lit ? { name: s.name, infected: s.infected, total: s.total } : undefined} />;
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

const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

function Rising({ b, lit, label }: { b: Barrier; lit: boolean; label?: { name: string; infected: number; total: number } }) {
  const group = useRef<THREE.Group>(null);
  const floor = useRef<THREE.MeshBasicMaterial>(null);
  const wall = useRef<THREE.MeshBasicMaterial>(null);
  const start = useRef<number | null>(null);
  const [ox, oy, oz] = to3([0, 0], b.level);

  const shapes = useMemo(
    () =>
      b.rooms.map((r) => {
        const s = new THREE.Shape();
        r.polygon.forEach(([x, y], i) => (i === 0 ? s.moveTo(x, y) : s.lineTo(x, y)));
        s.closePath();
        return s;
      }),
    [b.rooms],
  );
  const wallGeo = useMemo(() => {
    // Plan coordinates, relative to the group (which sits at the floor's origin): plan y is scene z.
    const pos: number[] = [];
    for (const [[ax, az], [bx, bz]] of b.edges) pos.push(ax, 0, az, bx, 0, bz, bx, H, bz, ax, 0, az, bx, H, bz, ax, H, az);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    return g;
  }, [b.edges]);
  const rails = useMemo(() => b.edges.map(([[ax, az], [bx, bz]]) => [[ax, H, az], [bx, H, bz]] as [THREE.Vector3Tuple, THREE.Vector3Tuple]), [b.edges]);

  useFrame(({ clock }) => {
    const now = clock.getElapsedTime() * 1000;
    if (start.current === null) start.current = now + b.order * STAGGER_MS;
    const t = ease((now - start.current) / RISE_MS);
    if (group.current) group.current.scale.y = Math.max(0.001, t);
    if (floor.current) floor.current.opacity = (lit ? 0.26 : 0.13) * t;
    if (wall.current) wall.current.opacity = (lit ? 0.28 : 0.14) * t;
  });

  return (
    <group position={[ox, oy, oz]}>
      {shapes.map((shape, i) => (
        <mesh key={i} position={[0, 0.06, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <shapeGeometry args={[shape]} />
          <meshBasicMaterial ref={i === 0 ? floor : undefined} color={b.color} transparent opacity={lit ? 0.26 : 0.13} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      ))}
      <group ref={group} scale={[1, 0.001, 1]}>
        <mesh geometry={wallGeo}>
          <meshBasicMaterial ref={wall} color={b.color} transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
        {rails.map((pts, i) => (
          <Line key={i} points={pts} color={b.color} lineWidth={lit ? 2.4 : 1.4} transparent opacity={lit ? 1 : 0.75} />
        ))}
      </group>
      {label && (
        <Html position={[b.anchor[0], H + 2.6, b.anchor[1]]} center zIndexRange={[20, 10]} style={{ pointerEvents: "none" }}>
          <div className="num flex items-center gap-2 whitespace-nowrap rounded-ctl border bg-bg/90 px-2.5 py-0.5 text-[11px]" style={{ borderColor: b.color }}>
            <span className="text-ink">{label.name}</span>
            <span className={label.infected > 0 ? "text-state-infected" : "text-ink-faint"}>{label.infected > 0 ? `${label.infected}/${label.total}` : label.total}</span>
          </div>
        </Html>
      )}
    </group>
  );
}
