"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { Html, Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { to3, WALL_H } from "@/components/scene/space";
import type { Hospital, Point } from "@/lib/stdb/types";
import { hullOf, type Segment } from "./pair";

// The plan's segmentation rising out of the floor (HospitalScene's children):
// around each segment's machines a padded polygon, its floor tinted in the
// segment's color, and a translucent wall that grows up from the ground when
// the plan appears, one segment after another. The segment the infection
// reached, or the hovered one, is drawn stronger with its label. Segments come
// from pair.ts planSegmentsOf (the hospital file and the run's removed flows);
// the animation only reveals them (rule 16).

const H = WALL_H + 1.1;
const RISE_MS = 2800;
const STAGGER_MS = 450;
const PAD = 1.8;

type Barrier = { key: string; zone: string; floorId: string; level: number; color: string; hull: Point[]; anchor: Point; order: number };

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
    const device = new Map(hospital.devices.map((d) => [d.id, d]));
    const room = new Map(hospital.rooms.map((r) => [r.id, r]));
    const level = new Map(hospital.floors.map((f) => [f.id, f.level]));
    const out: Barrier[] = [];
    segments.forEach((s, i) => {
      for (const fid of s.floorIds) {
        const pts = s.deviceIds
          .map((id) => device.get(id))
          .filter((d): d is NonNullable<typeof d> => !!d && room.get(d.roomId)?.floorId === fid)
          .map((d) => d.position);
        if (!pts.length) continue;
        const hull = hullOf(pts, PAD);
        const anchor = hull.reduce((a, p) => (p[1] < a[1] ? p : a), hull[0]);
        out.push({ key: `${s.zone}:${fid}`, zone: s.zone, floorId: fid, level: level.get(fid) ?? 0, color: s.color, hull, anchor, order: i });
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

const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

function Rising({ b, lit, label }: { b: Barrier; lit: boolean; label?: { name: string; infected: number; total: number } }) {
  const group = useRef<THREE.Group>(null);
  const floor = useRef<THREE.MeshBasicMaterial>(null);
  const wall = useRef<THREE.MeshBasicMaterial>(null);
  const start = useRef<number | null>(null);
  const [ox, oy, oz] = to3([0, 0], b.level);

  const shape = useMemo(() => {
    const s = new THREE.Shape();
    b.hull.forEach(([x, y], i) => (i === 0 ? s.moveTo(x, y) : s.lineTo(x, y)));
    s.closePath();
    return s;
  }, [b.hull]);
  const wallGeo = useMemo(() => {
    const pos: number[] = [];
    // Plan coordinates, relative to the group (which sits at the floor's origin): plan y is scene z.
    for (let i = 0; i < b.hull.length; i++) {
      const [ax, az] = b.hull[i];
      const [bx, bz] = b.hull[(i + 1) % b.hull.length];
      pos.push(ax, 0, az, bx, 0, bz, bx, H, bz, ax, 0, az, bx, H, bz, ax, H, az);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    return g;
  }, [b.hull]);
  const rail = useMemo(() => [...b.hull, b.hull[0]].map(([x, y]) => [x, H, y] as THREE.Vector3Tuple), [b.hull]);

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
      <mesh position={[0, 0.06, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <shapeGeometry args={[shape]} />
        <meshBasicMaterial ref={floor} color={b.color} transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <group ref={group} scale={[1, 0.001, 1]}>
        <mesh geometry={wallGeo}>
          <meshBasicMaterial ref={wall} color={b.color} transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
        <Line points={rail} color={b.color} lineWidth={lit ? 2.4 : 1.4} transparent opacity={lit ? 1 : 0.75} />
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
