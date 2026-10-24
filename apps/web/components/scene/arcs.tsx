"use client";

import { QuadraticBezierLine } from "@react-three/drei";
import { C } from "@/lib/colors";

export type Arc = {
  key: string;
  from: [number, number, number];
  to: [number, number, number];
  kind: "infection" | "flow" | "protected";
};

// Network arcs float above the building. Only the infection path is drawn by
// default; a hovered device adds its own flows.
export function NetworkArc({ arc }: { arc: Arc }) {
  const [ax, ay, az] = arc.from;
  const [bx, by, bz] = arc.to;
  const dist = Math.hypot(bx - ax, by - ay, bz - az);
  const mid: [number, number, number] = [(ax + bx) / 2, Math.max(ay, by) + 1.5 + dist * 0.18, (az + bz) / 2];
  const color = arc.kind === "infection" ? C.infected : C.healthy;
  return (
    <QuadraticBezierLine
      start={arc.from}
      end={arc.to}
      mid={mid}
      color={color}
      lineWidth={arc.kind === "infection" ? 1.6 : 1}
      transparent
      opacity={arc.kind === "infection" ? 0.85 : 0.6}
    />
  );
}
