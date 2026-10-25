"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { Html } from "@react-three/drei";
import { C, MOTION } from "@/lib/colors";
import type { Floor, Room } from "@/lib/stdb/types";
import { floorPlan, type Segment } from "./plan";
import { FLOOR_GAP, SLAB_H, SLAB_MARGIN, to3, WALL_H, WALL_T } from "./space";

/**
 * One floor of the clinic as a cutaway model: a ground slab that shows as the
 * corridor between rooms, a floor plate per room, and low walls around every
 * room with a doorway onto the corridor (plan.ts derives all of it from the
 * room polygons). The outer wall is closed across the corridor's ends, with the
 * main entrance left open by the lobby. The floor's name hangs off its left corner.
 */
export function FloorSlab({ floor, rooms = [], subtitle }: { floor: Floor; rooms?: readonly Room[]; subtitle?: string }) {
  const level = floor.level;
  const y = level * FLOOR_GAP;
  const plan = useMemo(() => floorPlan(rooms), [rooms]);
  const b = plan.bounds;
  const w = b.maxX - b.minX + SLAB_MARGIN * 2;
  const d = b.maxY - b.minY + SLAB_MARGIN * 2;
  const [cx, , cz] = to3([(b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2], level);

  // A faint 2 m tile grid on the corridor, drawn once as a texture.
  const grid = useMemo(() => {
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const g = canvas.getContext("2d")!;
    g.fillStyle = C.corridor;
    g.fillRect(0, 0, size, size);
    g.strokeStyle = C.corridorLine;
    g.lineWidth = 2;
    g.strokeRect(1, 1, size - 2, size - 2);
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(w / 2, d / 2);
    t.anisotropy = 4;
    return t;
  }, [w, d]);

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

  const labelAt = to3([b.minX - SLAB_MARGIN, b.maxY + SLAB_MARGIN], level, -0.2);

  return (
    <group>
      {/* the slab: a thin dark side face and the corridor-toned top */}
      <mesh position={[cx, y - SLAB_H / 2, cz]}>
        <boxGeometry args={[w, SLAB_H, d]} />
        <meshLambertMaterial color={C.slabSide} />
      </mesh>
      <mesh position={[cx, y + 0.005, cz]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[w, d]} />
        <meshLambertMaterial map={grid} />
      </mesh>
      <lineLoop geometry={rim} position={[cx, y + 0.02, cz]}>
        <lineBasicMaterial color={C.slabRim} transparent opacity={0.7} />
      </lineLoop>

      {rooms.map((room) => (
        <RoomFloor key={room.id} room={room} level={level} />
      ))}
      {plan.walls.map((s, i) => (
        <Wall key={i} segment={s} level={level} />
      ))}
      {plan.entrance && (
        <mesh
          position={to3(
            [plan.entrance.at[0] - plan.entrance.inward[0] * 1.1, plan.entrance.at[1] - plan.entrance.inward[1] * 1.1],
            level,
            0.012,
          )}
          rotation={[-Math.PI / 2, 0, Math.atan2(plan.entrance.along[0], plan.entrance.along[1])]}
          receiveShadow
        >
          <planeGeometry args={[2.0, plan.entrance.width + 0.6]} />
          <meshLambertMaterial color={C.entranceMat} />
        </mesh>
      )}

      <Html position={labelAt} zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
        <div className="whitespace-nowrap" style={{ transform: "translate(-100%, 0)", paddingRight: 14, textAlign: "right" }}>
          <div className="font-disp text-[12px] font-bold uppercase tracking-[0.08em] text-ink">{floor.name}</div>
          {subtitle && <div className="num text-[10px] text-ink-faint">{subtitle}</div>}
        </div>
      </Html>
    </group>
  );
}

/** A room's floor plate, a shade darker than the corridor, with a skirting line at its walls. */
function RoomFloor({ room, level }: { room: Room; level: number }) {
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
  return (
    <group>
      <mesh position={[ox, oy + 0.015, oz]} rotation={[Math.PI / 2, 0, 0]} receiveShadow>
        <shapeGeometry args={[shape]} />
        <meshLambertMaterial color={C.roomFloor} side={THREE.DoubleSide} />
      </mesh>
      <lineLoop geometry={outline} position={[ox, oy + 0.025, oz]}>
        <lineBasicMaterial color={C.roomFloorEdge} />
      </lineLoop>
    </group>
  );
}

/** One straight piece of wall: a box along the segment with a lighter cap on top. */
function Wall({ segment, level }: { segment: Segment; level: number }) {
  const { a, b } = segment;
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const center = to3([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], level, 0);
  // Plan y is scene z; a rotation about y of -atan2(dz, dx) lays the box's x axis along the segment.
  const angle = -Math.atan2(b[1] - a[1], b[0] - a[0]);
  return (
    <group position={center} rotation={[0, angle, 0]}>
      <mesh position={[0, WALL_H / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[length + WALL_T, WALL_H, WALL_T]} />
        <meshLambertMaterial color={C.wallFace} />
      </mesh>
      <mesh position={[0, WALL_H + 0.02, 0]}>
        <boxGeometry args={[length + WALL_T, 0.04, WALL_T]} />
        <meshBasicMaterial color={C.wallCap} />
      </mesh>
    </group>
  );
}

/**
 * The infection on a room: a warm translucent orange wash over its floor that
 * deepens with the room's infected share (0–1), and nothing while it is clean.
 * The room's walls and furniture are drawn by FloorSlab and Furniture.
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
  if (room.polygon.length < 3 || infectedShare <= 0) return null;
  const tint = 0.1 + infectedShare * (MOTION.roomTintMax + 0.12 - 0.1);
  return (
    <group>
      <mesh position={[ox, oy + 0.03, oz]} rotation={[Math.PI / 2, 0, 0]}>
        <shapeGeometry args={[shape]} />
        <meshBasicMaterial color={C.roomTint} transparent opacity={tint} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* the skirting glows along the walls of a room the attack has reached */}
      <lineLoop geometry={outline} position={[ox, oy + WALL_H + 0.06, oz]}>
        <lineBasicMaterial color={C.infected} transparent opacity={0.35 + infectedShare * 0.45} />
      </lineLoop>
    </group>
  );
}
