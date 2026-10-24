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

/**
 * A patient group as a quiet row of small dots along the room's front edge,
 * capped at 12 (counts only, never people). Near-invisible while the group is
 * fine, so the floor stays uncluttered; they take the state color when the
 * group is delayed or disrupted. The badge and the +N overflow are on the room chip.
 */
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
  const n = Math.min(Math.max(0, count), MAX_FIGURES);
  if (!n) return null;
  const span = Math.max(0, b.maxX - b.minX - 2);
  const step = Math.min(0.7, span / Math.max(n, 1));
  const startX = b.minX + 1;
  const y = b.maxY - 0.7;
  const ok = state === "ok";

  return (
    <group>
      {Array.from({ length: n }, (_, i) => (
        <mesh key={i} position={to3([startX + i * step, y], level, 0.06)} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[ok ? 0.11 : 0.15, 12]} />
          <meshBasicMaterial color={STATE_COLOR[state]} transparent opacity={ok ? 0.28 : 0.95} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}
