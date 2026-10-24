"use client";

import { C } from "@/lib/colors";
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

export function DeviceBox({
  device,
  level,
  state,
  hovered,
  zero,
  onHover,
}: {
  device: Device;
  level: number;
  state?: DeviceStateRow;
  hovered: boolean;
  /** Patient zero of the selected run: its own red, so the start of the spread stays findable. */
  zero?: boolean;
  onHover: (id: string | null) => void;
}) {
  const [w, h, d] = SIZE[device.type] ?? DEFAULT_SIZE;
  const infected = !!state?.infected;
  const color = zero ? C.zero : infected ? C.infected : C.healthy;

  return (
    <group position={to3(device.position, level, h / 2)}>
      <mesh
        castShadow
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover(device.id);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          onHover(null);
          document.body.style.cursor = "";
        }}
      >
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={hovered ? 0.9 : infected ? 0.55 : 0.1}
          roughness={0.5}
        />
      </mesh>

    </group>
  );
}
