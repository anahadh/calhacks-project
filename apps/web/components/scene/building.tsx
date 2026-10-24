"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { Html } from "@react-three/drei";
import { C } from "@/lib/colors";
import type { Floor, Room } from "@/lib/stdb/types";
import { FLOOR_GAP, to3 } from "./space";

const WALL_H = 0.9;
const WALL_T = 0.08;

export function FloorSlab({ floor }: { floor: Floor }) {
  const y = floor.level * FLOOR_GAP;
  return (
    <group>
      <mesh position={[0, y - 0.2, 0]} receiveShadow>
        <boxGeometry args={[41, 0.4, 25]} />
        <meshStandardMaterial color={C.slab} roughness={0.95} />
      </mesh>
      <Html position={[-20, y + 0.1, 13.2]} center={false} zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
        <div className="whitespace-nowrap text-[11px] font-medium uppercase tracking-wider text-ink-faint">
          {floor.name}
        </div>
      </Html>
    </group>
  );
}

// Floor tint deepens with the room's infected share (0–1).
export function RoomShell({ room, level, infectedShare }: { room: Room; level: number; infectedShare: number }) {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    room.polygon.forEach(([x, y], i) => (i === 0 ? s.moveTo(x, y) : s.lineTo(x, y)));
    s.closePath();
    return s;
  }, [room.polygon]);

  const walls = useMemo(
    () =>
      room.polygon.map((a, i) => {
        const b = room.polygon[(i + 1) % room.polygon.length];
        const [ax, , az] = to3(a, level);
        const [bx, , bz] = to3(b, level);
        const len = Math.hypot(bx - ax, bz - az);
        return {
          key: i,
          position: [(ax + bx) / 2, level * FLOOR_GAP + WALL_H / 2, (az + bz) / 2] as [number, number, number],
          rotationY: -Math.atan2(bz - az, bx - ax),
          len,
        };
      }),
    [room.polygon, level],
  );

  const [ox, , oz] = to3([0, 0], level);

  return (
    <group>
      {/* Shape is drawn in the x/y plane, then laid flat onto x/z. */}
      <mesh position={[ox, level * FLOOR_GAP + 0.01, oz]} rotation={[Math.PI / 2, 0, 0]}>
        <shapeGeometry args={[shape]} />
        <meshBasicMaterial
          color={infectedShare > 0 ? C.infected : C.slab}
          transparent
          opacity={infectedShare > 0 ? 0.04 + infectedShare * 0.32 : 0}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {walls.map((w) => (
        <mesh key={w.key} position={w.position} rotation={[0, w.rotationY, 0]}>
          <boxGeometry args={[w.len, WALL_H, WALL_T]} />
          <meshStandardMaterial color={C.wall} transparent opacity={0.55} />
        </mesh>
      ))}
    </group>
  );
}
