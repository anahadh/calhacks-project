"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { Html, Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { to3, WALL_H } from "@/components/scene/space";
import type { Hospital, Point } from "@/lib/stdb/types";
import { hullOf, type Segment } from "./pair";

// The plan's segmentation rising out of the floor (HospitalScene's children).
// A segment is a functional network (segments.ts): the machines of one kind
// wherever they stand. In each room, the segment's machines get a padded hull
// of their own, so a ward shows a monitoring cluster around its monitors and
// nurse station and a separate clinical cluster around its workstation: the
// segmentation cuts across rooms instead of tracing them. Each cluster's floor
// tints in the segment's color and a translucent wall grows up from the ground
// when the plan appears, one segment after another. The segment the infection
// reached, or the hovered one, is drawn stronger with its label. The animation
// only reveals rows (rule 16).

const H = WALL_H + 1.1;
const RISE_MS = 2800;
const STAGGER_MS = 450;
/** How far a cluster's hull clears its machines (plan meters). */
const PAD = 1.5;

type Barrier = { key: string; zone: string; floorId: string; level: number; color: string; hulls: Point[][]; anchor: Point; order: number };

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
    segments.forEach((s, order) => {
      for (const fid of s.floorIds) {
        // One cluster per room the segment has machines in.
        const byRoom = new Map<string, Point[]>();
        for (const id of s.deviceIds) {
          const d = device.get(id);
          const r = d && room.get(d.roomId);
          if (!d || !r || r.floorId !== fid) continue;
          byRoom.set(r.id, [...(byRoom.get(r.id) ?? []), d.position]);
        }
        const hulls = [...byRoom.values()].map((pts) => hullOf(pts, PAD)).filter((h) => h.length >= 3);
        if (!hulls.length) continue;
        const biggest = [...byRoom.values()].sort((a, b) => b.length - a.length)[0];
        const anchor = biggest.reduce((a, p) => (p[1] < a[1] ? p : a), biggest[0]);
        out.push({ key: `${s.zone}:${fid}`, zone: s.zone, floorId: fid, level: level.get(fid) ?? 0, color: s.color, hulls, anchor, order });
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

  const shapes = useMemo(
    () =>
      b.hulls.map((hull) => {
        const s = new THREE.Shape();
        hull.forEach(([x, y], i) => (i === 0 ? s.moveTo(x, y) : s.lineTo(x, y)));
        s.closePath();
        return s;
      }),
    [b.hulls],
  );
  const wallGeo = useMemo(() => {
    // Plan coordinates, relative to the group (which sits at the floor's origin): plan y is scene z.
    const pos: number[] = [];
    for (const hull of b.hulls) {
      for (let i = 0; i < hull.length; i++) {
        const [ax, az] = hull[i];
        const [bx, bz] = hull[(i + 1) % hull.length];
        pos.push(ax, 0, az, bx, 0, bz, bx, H, bz, ax, 0, az, bx, H, bz, ax, H, az);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    return g;
  }, [b.hulls]);
  const rails = useMemo(() => b.hulls.map((hull) => [...hull, hull[0]].map(([x, y]) => [x, H, y] as THREE.Vector3Tuple)), [b.hulls]);

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
