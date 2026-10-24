"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { Html } from "@react-three/drei";
import { C, MOTION } from "@/lib/colors";
import type { Floor, Room } from "@/lib/stdb/types";
import { FLOOR_GAP, roomsBounds, SLAB_H, SLAB_MARGIN, to3 } from "./space";

/**
 * One floating floor slab (the design: a dark isometric slab with a thin light
 * rim), sized to the rooms on it. The floor label sits at the slab's left edge:
 * its name in caps and the room list in small mono.
 */
export function FloorSlab({ floor, subtitle, rooms = [] }: { floor: Floor; subtitle: string; rooms?: readonly Room[] }) {
  const y = floor.level * FLOOR_GAP;
  const b = roomsBounds(rooms);
  const w = b.maxX - b.minX + SLAB_MARGIN * 2;
  const d = b.maxY - b.minY + SLAB_MARGIN * 2;
  const [cx, , cz] = to3([(b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2], floor.level);

  const rim = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const hx = w / 2;
    const hz = d / 2;
    g.setFromPoints([
      new THREE.Vector3(-hx, 0, -hz),
      new THREE.Vector3(hx, 0, -hz),
      new THREE.Vector3(hx, 0, hz),
      new THREE.Vector3(-hx, 0, hz),
    ]);
    return g;
  }, [w, d]);

  // The label hangs off the slab's left corner, as in the design.
  const labelAt = to3([b.minX - SLAB_MARGIN, b.maxY + SLAB_MARGIN], floor.level, -0.2);

  return (
    <group>
      {/* the slab: a flat dark top and a thin, slightly lighter side face */}
      <mesh position={[cx, y - SLAB_H / 2, cz]}>
        <boxGeometry args={[w, SLAB_H, d]} />
        <meshBasicMaterial color={C.slabSide} />
      </mesh>
      <mesh position={[cx, y + 0.005, cz]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w, d]} />
        <meshBasicMaterial color={C.slabTop} />
      </mesh>
      {/* thin light outline around the top */}
      <lineLoop geometry={rim} position={[cx, y + 0.02, cz]}>
        <lineBasicMaterial color={C.slabRim} transparent opacity={0.9} />
      </lineLoop>
      {/* and a fainter one along the bottom edge, so the slab reads as a solid */}
      <lineLoop geometry={rim} position={[cx, y - SLAB_H, cz]}>
        <lineBasicMaterial color={C.slabRim} transparent opacity={0.35} />
      </lineLoop>

      <Html position={labelAt} zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
        <div className="whitespace-nowrap" style={{ transform: "translate(-100%, 0)", paddingRight: 14, textAlign: "right" }}>
          <div className="font-disp text-[12px] font-bold uppercase tracking-[0.08em] text-ink">{floor.name}</div>
          <div className="num text-[10px] text-ink-faint">{subtitle}</div>
        </div>
      </Html>
    </group>
  );
}

/**
 * A room on the slab: its outline, and a warm translucent orange tint that
 * deepens with the room's infected share (0–1). Rooms are flat; the design
 * draws no walls.
 */
export function RoomShell({ room, level, infectedShare }: { room: Room; level: number; infectedShare: number }) {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    room.polygon.forEach(([x, y], i) => (i === 0 ? s.moveTo(x, y) : s.lineTo(x, y)));
    s.closePath();
    return s;
  }, [room.polygon]);

  const outline = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setFromPoints(room.polygon.map(([x, y]) => new THREE.Vector3(x, 0, y)));
    return g;
  }, [room.polygon]);

  const [ox, oy, oz] = to3([0, 0], level);
  if (room.polygon.length < 3) return null;

  const tint = infectedShare > 0 ? 0.08 + infectedShare * (MOTION.roomTintMax + 0.1 - 0.08) : 0;

  return (
    <group>
      {/* Shape is drawn in the x/y plane, then laid flat onto x/z. */}
      <mesh position={[ox, oy + 0.03, oz]} rotation={[Math.PI / 2, 0, 0]} visible={tint > 0}>
        <shapeGeometry args={[shape]} />
        <meshBasicMaterial color={C.roomTint} transparent opacity={tint} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <lineLoop geometry={outline} position={[ox, oy + 0.04, oz]}>
        <lineBasicMaterial color={infectedShare > 0 ? C.infected : C.roomLine} transparent opacity={infectedShare > 0 ? 0.45 : 0.9} />
      </lineLoop>
    </group>
  );
}
