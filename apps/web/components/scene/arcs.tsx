"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { Html, Line, QuadraticBezierLine } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type { Line2, LineMaterial } from "three-stdlib";
import { C } from "@/lib/colors";

export type Vec3 = [number, number, number];

export type Arc = {
  key: string;
  from: Vec3;
  to: Vec3;
  /** dependency: a device to a service that relies on it (Hospital Management's lens). */
  kind: "infection" | "flow" | "protected" | "kept" | "cut" | "dependency";
  /**
   * For an infection path: performance.now() when this tab saw the target's
   * device_state row turn infected (spread-timing.ts). The arc draws itself in
   * from that moment. Unset for rows that were already there: drawn in full.
   */
  since?: number;
  /** From the role view, or the infection path's age: faint arcs recede, strong ones stand out. */
  emphasis?: "normal" | "strong" | "faint";
  /** Shown at the arc's peak, e.g. "SMB 445" or "Scans to radiologists (DICOM)". */
  label?: string;
};

/** The control point of an arc between two devices: it rises with distance, so the paths sweep high over the slab (the design). */
export function arcMid([ax, ay, az]: Vec3, [bx, by, bz]: Vec3): Vec3 {
  const dist = Math.hypot(bx - ax, by - ay, bz - az);
  return [(ax + bx) / 2, Math.max(ay, by) + 2.4 + dist * 0.32, (az + bz) / 2];
}

/** A point along the arc, t in 0..1 (the quadratic Bézier the line draws). */
export function arcPoint(a: Vec3, b: Vec3, t: number, mid: Vec3 = arcMid(a, b)): Vec3 {
  const u = 1 - t;
  return [0, 1, 2].map((i) => u * u * a[i] + 2 * u * t * mid[i] + t * t * b[i]) as Vec3;
}

const STYLE: Record<Exclude<Arc["kind"], "infection">, { color: string; width: number; opacity: number; dashed?: boolean }> = {
  flow: { color: C.healthy, width: 1, opacity: 0.6 },
  protected: { color: C.healthy, width: 1, opacity: 0.6 },
  // The plan's kept protected connections: thin blue lines (UX: solution view).
  kept: { color: C.healthy, width: 0.8, opacity: 0.45 },
  // A connection the plan removed: dashed gray (UX rule 3: cut connections are dashed).
  cut: { color: C.cut, width: 1.3, opacity: 0.9, dashed: true },
  dependency: { color: C.ok, width: 1, opacity: 0.6 },
};

/** How a role view's emphasis scales a plain arc. */
const EMPHASIS = { faint: { width: 0.8, opacity: 0.25 }, normal: { width: 1, opacity: 1 }, strong: { width: 1.5, opacity: 1.4 } } as const;

/** Time an infection path takes to draw itself in, from the infecting device to the target. */
export const ARC_DRAW_MS = 550;

// Network arcs float above the building. The infection path is drawn by
// default; a hovered device adds its own flows, and a plan adds its cuts.
export function NetworkArc({ arc }: { arc: Arc }) {
  if (arc.kind === "infection") return <InfectionArc arc={arc} />;
  const s = STYLE[arc.kind];
  const e = EMPHASIS[arc.emphasis ?? "normal"];
  return (
    <>
      <PlainArc arc={arc} {...s} width={s.width * e.width} opacity={Math.min(1, s.opacity * e.opacity)} />
      {arc.label && <ArcLabel arc={arc} text={arc.label} />}
    </>
  );
}

/** A label at the arc's peak (the Bézier's midpoint). */
function ArcLabel({ arc, text }: { arc: Arc; text: string }) {
  return (
    <Html position={arcPoint(arc.from, arc.to, 0.5)} center zIndexRange={[25, 15]} style={{ pointerEvents: "none" }}>
      <span className="num whitespace-nowrap rounded-[3px] border border-line2 bg-panel/95 px-1.5 py-px text-[10px] text-ink">{text}</span>
    </Html>
  );
}

/** Where a service's dependency lines meet, labeled with its name (Hospital Management's lens). */
export function ServiceAnchor({ position, name, down }: { position: Vec3; name: string; down: boolean }) {
  return (
    <Html position={position} center zIndexRange={[24, 14]} style={{ pointerEvents: "none" }}>
      <span className="num inline-flex items-center gap-1 whitespace-nowrap rounded-[3px] border border-line2 bg-panel/95 px-1.5 py-px text-[10px] text-ink">
        <span aria-hidden>{down ? "✕" : "◇"}</span>
        {name}
        {down && <span className="text-ink-muted">· offline</span>}
      </span>
    </Html>
  );
}

function PlainArc({ arc, color, width, opacity, dashed }: { arc: Arc; color: string; width: number; opacity: number; dashed?: boolean }) {
  // drei rebuilds the line geometry whenever these arrays change identity, so
  // keep them for as long as the two positions stay the same.
  const at = `${arc.from.join()}|${arc.to.join()}`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ends = useMemo(() => ({ start: arc.from, end: arc.to, mid: arcMid(arc.from, arc.to) }), [at]);
  const dash = dashed ? { dashed: true, dashSize: 0.5, gapSize: 0.35 } : {};
  return <QuadraticBezierLine {...ends} color={color} lineWidth={width} transparent opacity={opacity} {...dash} />;
}

/** Points along the curve. More segments make the draw-in smoother. */
const SEGMENTS = 48;
/** Dots per second flowing along the path, in scene units. */
const FLOW_SPEED = 2.2;
const DOT = 0.16;
const GAP = 0.34;
const UP = new THREE.Vector3(0, 1, 0);

/**
 * One infection path (the design's hero): a dotted orange curve from the
 * infecting device to the one it infected, with a small arrowhead at the
 * target. The dots flow along the path, and a path whose row this tab just saw
 * land draws itself in over ARC_DRAW_MS. Both read only `arc`, which comes
 * from device_state.infected_by (AGENTS.md rule 16).
 */
function InfectionArc({ arc }: { arc: Arc }) {
  const at = `${arc.from.join()}|${arc.to.join()}`;
  const geom = useMemo(() => {
    const mid = arcMid(arc.from, arc.to);
    const points = Array.from({ length: SEGMENTS + 1 }, (_, i) => arcPoint(arc.from, arc.to, i / SEGMENTS, mid));
    // The arrowhead sits a touch short of the target, so it points at the chip rather than hiding under it.
    const tipT = 0.975;
    const tip = new THREE.Vector3(...arcPoint(arc.from, arc.to, tipT, mid));
    const before = new THREE.Vector3(...arcPoint(arc.from, arc.to, tipT - 0.04, mid));
    const dir = tip.clone().sub(before);
    const quat = new THREE.Quaternion();
    if (dir.lengthSq() > 1e-9) quat.setFromUnitVectors(UP, dir.normalize());
    return { points, tip, quat };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at]);

  const line = useRef<Line2>(null);
  const head = useRef<THREE.Mesh>(null);
  // An older hop: a faint trail, so the spread happening now stands out.
  const faint = arc.emphasis === "faint";

  useFrame((_, dt) => {
    const l = line.current;
    if (!l) return;
    const mat = l.material as LineMaterial;
    // Dots travel from the infecting device toward its target.
    mat.dashOffset -= Math.min(dt, 0.1) * FLOW_SPEED;
    // Draw-in: only the first k segments are drawn until the path has landed.
    const k = arc.since === undefined ? 1 : Math.min(1, Math.max(0, (performance.now() - arc.since) / ARC_DRAW_MS));
    const geo = l.geometry as THREE.InstancedBufferGeometry;
    const n = Math.round(k * SEGMENTS);
    if (geo.instanceCount !== n) geo.instanceCount = n;
    if (head.current) head.current.visible = k >= 1;
  });

  return (
    <group>
      <Line
        ref={line}
        points={geom.points}
        color={C.infected}
        lineWidth={faint ? 1 : 1.8}
        dashed
        dashSize={DOT}
        gapSize={GAP}
        transparent
        opacity={faint ? 0.3 : 0.95}
        depthWrite={false}
      />
      <mesh ref={head} position={geom.tip} quaternion={geom.quat} visible={arc.since === undefined}>
        <coneGeometry args={[0.22, 0.62, 10]} />
        <meshBasicMaterial color={C.infected} transparent opacity={faint ? 0.3 : 0.95} depthWrite={false} />
      </mesh>
    </group>
  );
}
