"use client";

import { C } from "@/lib/colors";
import type { PatientStateValue, Room } from "@/lib/stdb/types";
import { bounds, to3 } from "./space";

export const MAX_FIGURES = 12;

const STATE_COLOR: Record<PatientStateValue, string> = {
  ok: C.ok,
  delayed: C.delayed,
  disrupted: C.disrupted,
  diverted: C.disrupted,
};

// A row of simple figures along the room's front wall, capped at 12.
// The state badge and the +N overflow are on the room chip.
export function PatientFigures({
  room,
  level,
  count,
  state,
}: {
  room: Room;
  level: number;
  count: number;
  state: PatientStateValue;
}) {
  const b = bounds(room.polygon);
  const n = Math.min(count, MAX_FIGURES);
  const span = b.maxX - b.minX - 2;
  const step = Math.min(0.9, span / Math.max(n, 1));
  const startX = b.minX + 1;
  const y = b.maxY - 0.8;

  return (
    <group>
      {Array.from({ length: n }, (_, i) => (
        <mesh key={i} position={to3([startX + i * step, y], level, 0.45)}>
          <capsuleGeometry args={[0.16, 0.5, 4, 8]} />
          <meshStandardMaterial color={STATE_COLOR[state]} roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}
