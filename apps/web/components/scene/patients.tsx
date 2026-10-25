"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { C, MOTION } from "@/lib/colors";
import type { PatientStateValue, Room } from "@/lib/stdb/types";
import type { Door } from "./plan";
import { walkArea } from "./plan";
import { to3 } from "./space";

export const MAX_FIGURES = 12;

const STATE_COLOR: Record<PatientStateValue, string> = {
  ok: C.personOk,
  delayed: C.personDelayed,
  disrupted: C.personDisrupted,
  diverted: C.personDisrupted,
};

/** Walking speed in meters per second, by state: fine people stroll, delayed ones drag, disrupted ones stop. */
const SPEED: Record<PatientStateValue, number> = { ok: 0.75, delayed: 0.35, disrupted: 0, diverted: 0 };

/** A small deterministic PRNG, so both laptops see the same people in the same places. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);

type Walker = {
  x: number;
  z: number;
  tx: number;
  tz: number;
  /** Waypoints still to visit after the current target (a trip out to the corridor and back). */
  queue: [number, number][];
  wait: number;
  phase: number;
  pace: number;
};

/**
 * A patient group as small figures walking about the free part of their room
 * (counts only, never people: one figure per patient, capped at MAX_FIGURES; the
 * room chip carries the +N). Now and then one steps out through the doorway into
 * the corridor and back. The group's patient_state row sets their color and
 * pace: green and strolling while care is normal, amber and slow when delayed,
 * red and standing still when disrupted or diverted.
 */
export function PatientFigures({
  room,
  door,
  level,
  count,
  state,
}: {
  room: Room;
  door: Door;
  level: number;
  count: number;
  state: PatientStateValue;
}) {
  const n = Math.min(Math.max(0, count), MAX_FIGURES);
  const area = useMemo(() => walkArea(room, door), [room, door]);
  const rand = useMemo(() => mulberry32(hash(room.id)), [room.id]);

  const walkers = useMemo<Walker[]>(() => {
    const out: Walker[] = [];
    for (let i = 0; i < n; i++) {
      const x = area.minX + rand() * (area.maxX - area.minX);
      const z = area.minY + rand() * (area.maxY - area.minY);
      out.push({ x, z, tx: x, tz: z, queue: [], wait: rand() * 2, phase: rand() * Math.PI * 2, pace: 0.85 + rand() * 0.3 });
    }
    return out;
    // rand is seeded by room id; the figures are laid out once per room.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, area]);

  const refs = useRef<(THREE.Group | null)[]>([]);
  // One material for the whole group, so everyone changes color together; lerped toward the state color each frame.
  const material = useMemo(() => new THREE.MeshLambertMaterial({ color: STATE_COLOR[state] }), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => material.dispose(), [material]);
  const target = useMemo(() => new THREE.Color(STATE_COLOR[state]), [state]);
  const speed = SPEED[state];

  // A spot in the corridor just outside the door, and the doorway itself.
  const trip = (r: () => number): [number, number][] => {
    const [dx, dy] = door.inward;
    const [ax, ay] = door.along;
    const side = (r() - 0.5) * 6;
    const doorway: [number, number] = [door.at[0] + dx * 0.9, door.at[1] + dy * 0.9];
    const outside: [number, number] = [door.at[0] - dx * 2.2 + ax * side, door.at[1] - dy * 2.2 + ay * side];
    return [doorway, outside, doorway];
  };

  useFrame((_, dt) => {
    const step = Math.min(dt, 0.1);
    material.color.lerp(target, Math.min(1, (step * 1000) / MOTION.flash));
    walkers.forEach((w, i) => {
      const g = refs.current[i];
      if (!g) return;
      if (speed > 0) {
        if (w.wait > 0) w.wait -= step;
        else {
          const dx = w.tx - w.x;
          const dz = w.tz - w.z;
          const dist = Math.hypot(dx, dz);
          const move = speed * w.pace * step;
          if (dist <= move) {
            w.x = w.tx;
            w.z = w.tz;
            const next = w.queue.shift();
            if (next) {
              [w.tx, w.tz] = next;
            } else {
              w.wait = 0.6 + rand() * 2.4;
              if (rand() < 0.18) {
                const [first, ...rest] = trip(rand);
                [w.tx, w.tz] = first;
                w.queue = rest;
              } else {
                w.tx = area.minX + rand() * (area.maxX - area.minX);
                w.tz = area.minY + rand() * (area.maxY - area.minY);
              }
            }
          } else {
            w.x += (dx / dist) * move;
            w.z += (dz / dist) * move;
            g.rotation.y = Math.atan2(dx, dz);
          }
        }
      }
      const walking = speed > 0 && w.wait <= 0;
      w.phase += step * (walking ? 9 : 1.5);
      const [sx, sy, sz] = to3([w.x, w.z], level, 0);
      g.position.set(sx, sy + (walking ? Math.abs(Math.sin(w.phase)) * 0.035 : 0), sz);
    });
  });

  if (!n) return null;
  return (
    <group>
      {walkers.map((w, i) => (
        <group key={i} ref={(el) => { refs.current[i] = el; }} position={to3([w.x, w.z], level, 0)}>
          <Figure material={material} />
        </group>
      ))}
    </group>
  );
}

/** A small figure: a rounded body and a head, about a meter tall. */
function Figure({ material }: { material: THREE.Material }) {
  return (
    <group>
      <mesh position={[0, 0.42, 0]} material={material} castShadow>
        <capsuleGeometry args={[0.17, 0.42, 4, 10]} />
      </mesh>
      <mesh position={[0, 0.93, 0]} material={material} castShadow>
        <sphereGeometry args={[0.15, 12, 10]} />
      </mesh>
    </group>
  );
}
