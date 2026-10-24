"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { C, MOTION } from "@/lib/colors";
import type { Device, DeviceStateRow, DeviceType } from "@/lib/stdb/types";
import { to3 } from "./space";

// Box sizes so key equipment reads at a glance. Detailed models are F4.
const SIZE: Partial<Record<DeviceType, [number, number, number]>> = {
  mri: [2.2, 1.6, 1.8],
  ct: [1.8, 1.4, 1.6],
  server_rack: [0.9, 2.2, 0.9],
  nurse_station: [1.6, 0.9, 0.8],
  anesthesia_machine: [0.8, 1.3, 0.7],
  pharmacy_cabinet: [1.2, 1.6, 0.6],
  lab_analyzer: [1.1, 1, 0.8],
};
const DEFAULT_SIZE: [number, number, number] = [0.55, 0.55, 0.55];

const WHITE = new THREE.Color("#ffffff");
const HEALTHY = new THREE.Color(C.healthy);
const INFECTED = new THREE.Color(C.infected);
const DIM = new THREE.Color(C.muted);
/** Monochrome ink selection (UX rule 2): selection never reads as a state. */
const SELECT = "#E9ECEE";

/** Patient-zero picking (step 1). Devices the engine can't start from are dimmed and can't be clicked. */
export type DevicePick = { eligible: boolean; selected: boolean; onPick?: () => void };

export function DeviceBox({
  device,
  level,
  state,
  hovered,
  onHover,
  flashAt,
  pick,
}: {
  device: Device;
  level: number;
  state?: DeviceStateRow;
  hovered: boolean;
  onHover: (id: string | null) => void;
  /** When the pulse that infected it arrives (spread-timing.ts). Until then it stays healthy, then flashes white to orange. */
  flashAt?: number;
  pick?: DevicePick;
}) {
  const [w, h, d] = SIZE[device.type] ?? DEFAULT_SIZE;
  const infected = !!state?.infected;
  const dimmed = !!pick && !pick.eligible;
  const clickable = !!pick?.eligible && !!pick.onPick;
  const material = useRef<THREE.MeshStandardMaterial>(null);
  const outline = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(w + 0.2, h + 0.2, d + 0.2)), [w, h, d]);

  // Color follows the device_state row; only its timing is eased: a flash on
  // arrival, then a slow 60 bpm pulse while infected (UX: the attack spreading).
  useFrame(() => {
    const m = material.current;
    if (!m) return;
    const now = performance.now();
    let glow: number;
    if (dimmed) {
      m.color.copy(DIM);
      glow = 0.02;
    } else if (!infected || (flashAt !== undefined && now < flashAt)) {
      m.color.copy(HEALTHY);
      glow = pick?.selected ? 0.9 : pick ? 0.3 : 0.1;
    } else if (flashAt !== undefined && now < flashAt + MOTION.flash) {
      const k = (now - flashAt) / MOTION.flash;
      m.color.lerpColors(WHITE, INFECTED, k);
      glow = 1 - 0.5 * k;
    } else {
      m.color.copy(INFECTED);
      glow = 0.45 + 0.15 * Math.sin((now / MOTION.heartbeat) * 2 * Math.PI);
    }
    m.emissive.copy(m.color);
    m.emissiveIntensity = hovered && !dimmed ? Math.max(glow, 0.9) : glow;
  });

  return (
    <group position={to3(device.position, level, h / 2)}>
      <mesh
        castShadow
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover(device.id);
          document.body.style.cursor = dimmed ? "not-allowed" : "pointer";
        }}
        onPointerOut={() => {
          onHover(null);
          document.body.style.cursor = "";
        }}
        onClick={(e) => {
          if (!clickable) return;
          e.stopPropagation();
          pick?.onPick?.();
        }}
      >
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial ref={material} color={C.healthy} emissive={C.healthy} emissiveIntensity={0.1} roughness={0.5} />
      </mesh>

      {pick?.selected && (
        <>
          <lineSegments geometry={outline}>
            <lineBasicMaterial color={SELECT} />
          </lineSegments>
          <Html position={[0, h / 2 + 0.9, 0]} center zIndexRange={[30, 20]} style={{ pointerEvents: "none" }}>
            <span className="num whitespace-nowrap rounded-ctl bg-select px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-select-on">
              Patient zero · {device.name}
            </span>
          </Html>
        </>
      )}
    </group>
  );
}
