"use client";

import { useMemo } from "react";
import { QuadraticBezierLine } from "@react-three/drei";
import { C } from "@/lib/colors";

export type Vec3 = [number, number, number];

export type Arc = {
  key: string;
  from: Vec3;
  to: Vec3;
  kind: "infection" | "flow" | "protected" | "kept" | "cut";
};

/** The control point of an arc between two devices: it rises with distance, so long links clear the walls. */
export function arcMid([ax, ay, az]: Vec3, [bx, by, bz]: Vec3): Vec3 {
  const dist = Math.hypot(bx - ax, by - ay, bz - az);
  return [(ax + bx) / 2, Math.max(ay, by) + 1.2 + dist * 0.1, (az + bz) / 2];
}

/** A point along the arc, t in 0..1 (the quadratic Bézier the line draws). */
export function arcPoint(a: Vec3, b: Vec3, t: number, mid: Vec3 = arcMid(a, b)): Vec3 {
  const u = 1 - t;
  return [0, 1, 2].map((i) => u * u * a[i] + 2 * u * t * mid[i] + t * t * b[i]) as Vec3;
}

const STYLE: Record<Arc["kind"], { color: string; width: number; opacity: number; dashed?: boolean }> = {
  infection: { color: C.infected, width: 1.6, opacity: 0.85 },
  flow: { color: C.healthy, width: 1, opacity: 0.6 },
  protected: { color: C.healthy, width: 1, opacity: 0.6 },
  // The plan's kept protected connections: thin blue lines (UX: solution view).
  kept: { color: C.healthy, width: 0.8, opacity: 0.45 },
  // A connection the plan removed: dashed gray (UX rule 3: cut connections are dashed).
  cut: { color: C.cut, width: 1.3, opacity: 0.9, dashed: true },
};

// Network arcs float above the building. The infection path is drawn by
// default; a hovered device adds its own flows, and a plan adds its cuts.
export function NetworkArc({ arc }: { arc: Arc }) {
  const s = STYLE[arc.kind];
  // drei rebuilds the line geometry whenever these arrays change identity, so
  // keep them for as long as the two positions stay the same.
  const at = `${arc.from.join()}|${arc.to.join()}`;
  const ends = useMemo(() => ({ start: arc.from, end: arc.to, mid: arcMid(arc.from, arc.to) }), [at]);
  const dash = s.dashed ? { dashed: true, dashSize: 0.5, gapSize: 0.35 } : {};
  return <QuadraticBezierLine {...ends} color={s.color} lineWidth={s.width} transparent opacity={s.opacity} {...dash} />;
}
