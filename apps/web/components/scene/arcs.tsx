"use client";

import { Html, QuadraticBezierLine } from "@react-three/drei";
import { C } from "@/lib/colors";

export type Arc = {
  key: string;
  from: [number, number, number];
  to: [number, number, number];
  /** infection: the spread path (every role). flow / protected: network flows. dependency: device → service. */
  kind: "infection" | "flow" | "protected" | "dependency";
  /** From the role view: faint arcs recede, strong ones stand out. */
  emphasis?: "normal" | "strong" | "faint";
  /** Shown at the arc's peak, e.g. "SMB 445" or "Scans to radiologists (DICOM)". */
  label?: string;
};

const WIDTH = { faint: 0.8, normal: 1, strong: 1.6 } as const;
const OPACITY = { faint: 0.12, normal: 0.5, strong: 0.85 } as const;

// Network arcs float above the building. The infection path is always drawn;
// which other connections show depends on the role view.
export function NetworkArc({ arc }: { arc: Arc }) {
  const [ax, ay, az] = arc.from;
  const [bx, by, bz] = arc.to;
  const dist = Math.hypot(bx - ax, by - ay, bz - az);
  const mid: [number, number, number] = [(ax + bx) / 2, Math.max(ay, by) + 1.2 + dist * 0.1, (az + bz) / 2];
  const infection = arc.kind === "infection";
  const emphasis = arc.emphasis ?? "normal";
  const color = infection ? C.infected : arc.kind === "dependency" ? C.ok : C.healthy;
  return (
    <>
      <QuadraticBezierLine
        start={arc.from}
        end={arc.to}
        mid={mid}
        color={color}
        lineWidth={infection ? 1.6 : WIDTH[emphasis]}
        transparent
        opacity={infection ? 0.85 : OPACITY[emphasis]}
      />
      {arc.label && (
        // The curve's peak is halfway between the control point and the chord.
        <Html position={[mid[0], (mid[1] + (ay + by) / 2) / 2 + 0.3, mid[2]]} center zIndexRange={[25, 15]} style={{ pointerEvents: "none" }}>
          <span className="num whitespace-nowrap rounded-[3px] border border-line2 bg-panel/95 px-1.5 py-px text-[10px] text-ink">{arc.label}</span>
        </Html>
      )}
    </>
  );
}

/** Where a service's dependency lines meet, labeled with its name (Hospital Management's lens). */
export function ServiceAnchor({ position, name, down }: { position: [number, number, number]; name: string; down: boolean }) {
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
