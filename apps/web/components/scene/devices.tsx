"use client";

import { Html } from "@react-three/drei";
import { C } from "@/lib/colors";
import { tickClock } from "@/lib/format";
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
  infectedByName,
  hovered,
  onHover,
}: {
  device: Device;
  level: number;
  state?: DeviceStateRow;
  infectedByName?: string;
  hovered: boolean;
  onHover: (id: string | null) => void;
}) {
  const [w, h, d] = SIZE[device.type] ?? DEFAULT_SIZE;
  const infected = !!state?.infected;
  const color = infected ? C.infected : C.healthy;

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
          emissiveIntensity={infected ? 0.55 : hovered ? 0.35 : 0.12}
          roughness={0.5}
        />
      </mesh>

      {hovered && (
        <Html position={[0, h / 2 + 0.6, 0]} center zIndexRange={[40, 30]} style={{ pointerEvents: "none" }}>
          <div className="w-max max-w-[220px] rounded-md border border-line bg-raised/95 px-3 py-2 text-xs shadow-lg">
            <div className="font-medium text-ink">{device.name}</div>
            <div className="num mt-0.5 text-[11px] text-ink-faint">{device.id}</div>
            <div className="mt-1.5 flex items-center gap-1.5 text-ink-muted">
              <span
                className="inline-block h-2 w-2 rounded-sm"
                style={{ background: color }}
                aria-hidden
              />
              {infected ? (
                <span>
                  Infected at <span className="num">{tickClock(state?.infectedAtTick ?? 0)}</span>
                  {infectedByName ? <> via {infectedByName}</> : <> (patient zero)</>}
                </span>
              ) : (
                <span>Healthy</span>
              )}
            </div>
            {device.vulnerable && <div className="mt-1 text-ink-muted">Unpatched or end-of-life</div>}
          </div>
        </Html>
      )}
    </group>
  );
}
