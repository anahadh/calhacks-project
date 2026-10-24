"use client";

// The spread effects inside the 3D scene, each one a row (AGENTS.md rule 16):
// a pulse per successful spread_attempt row, travelling the arc of its flow; a
// fizzle per success:false row, dying halfway at the cut; a ✕ on each cut
// connection (run.removed_flows_json) the infection reached but did not cross;
// and a toast per sim_event row, anchored where it happened. spread-timing.ts
// decides when each one plays; this file only draws.

import { useRef, useState } from "react";
import * as THREE from "three";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { arcPoint, type Vec3 } from "@/components/scene/arcs";
import { C } from "@/lib/colors";
import type { Pulse, Toast } from "./spread-timing";

const INFECTED = new THREE.Color(C.infected);
const CUT = new THREE.Color(C.cut);
/** A fizzle travels for this share of its time, then fades at the halfway point. */
const FIZZLE_TRAVEL = 0.6;

const TOAST_DOT: Record<string, string> = {
  patient_zero: "bg-state-infected",
  device_infected: "bg-state-infected",
  diversion: "bg-state-disrupted",
};

export function SpreadFx({
  pulses,
  toasts,
  stops,
  point,
  anchor,
}: {
  pulses: readonly Pulse[];
  toasts: readonly Toast[];
  /** Cut connections where the infection stopped, by their two ends. */
  stops: readonly { key: string; from: Vec3; to: Vec3 }[];
  point: (deviceId: string) => Vec3 | undefined;
  anchor: (toast: Toast) => Vec3 | undefined;
}) {
  return (
    <>
      {pulses.map((p) => {
        const from = point(p.from);
        const to = point(p.to);
        return from && to ? <PulseDot key={p.key} pulse={p} from={from} to={to} /> : null;
      })}
      {stops.map((s) => (
        <Html key={s.key} position={arcPoint(s.from, s.to, 0.5)} center zIndexRange={[25, 15]} style={{ pointerEvents: "none" }}>
          <span className="font-disp text-[15px] font-bold leading-none text-state-cut" aria-label="The infection stopped here">
            ✕
          </span>
        </Html>
      ))}
      {toasts.map((t) => {
        const at = anchor(t);
        return at ? <ToastAt key={t.key} toast={t} at={at} /> : null;
      })}
    </>
  );
}

/** One spread_attempt row: a dot along the arc, from the infecting device to its target, once. */
function PulseDot({ pulse, from, to }: { pulse: Pulse; from: Vec3; to: Vec3 }) {
  const mesh = useRef<THREE.Mesh>(null);
  const material = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(() => {
    const m = mesh.current;
    const mat = material.current;
    if (!m || !mat) return;
    const k = (performance.now() - pulse.start) / pulse.duration;
    if (k < 0 || k > 1) {
      m.visible = false;
      return;
    }
    m.visible = true;
    if (pulse.success) {
      m.position.set(...arcPoint(from, to, k));
      m.scale.setScalar(1);
      mat.color.copy(INFECTED);
      mat.opacity = 0.95;
      return;
    }
    // A failed attempt is a short pulse that fizzles halfway (UX: the attack spreading).
    const fade = k < FIZZLE_TRAVEL ? 0 : (k - FIZZLE_TRAVEL) / (1 - FIZZLE_TRAVEL);
    m.position.set(...arcPoint(from, to, 0.5 * Math.min(1, k / FIZZLE_TRAVEL)));
    m.scale.setScalar(1 + fade * 0.9);
    mat.color.lerpColors(INFECTED, CUT, fade);
    mat.opacity = 0.95 * (1 - fade);
  });

  return (
    <mesh ref={mesh} visible={false}>
      <sphereGeometry args={[0.32, 14, 14]} />
      <meshBasicMaterial ref={material} color={C.infected} transparent opacity={0.95} depthWrite={false} />
    </mesh>
  );
}

/** One sim_event row as a toast where it happened ("PACS compromised"), readable for over 2 s. */
function ToastAt({ toast, at }: { toast: Toast; at: Vec3 }) {
  // Fixed when the toast mounts, so a re-render never restarts its animation.
  const [delay] = useState(() => Math.round(toast.start - performance.now()));
  return (
    <Html position={at} center zIndexRange={[40, 30]} style={{ pointerEvents: "none" }}>
      <div
        role="status"
        className="fx-toast flex items-center gap-1.5 whitespace-nowrap rounded-md border border-line2 bg-panel/95 px-2 py-0.5 text-[11px] text-ink shadow-overlay"
        style={{ animationDelay: `${delay}ms` }}
      >
        <i className={`h-[7px] w-[7px] shrink-0 rounded-full ${TOAST_DOT[toast.kind] ?? "bg-ink-faint"}`} aria-hidden />
        {toast.text}
      </div>
    </Html>
  );
}
