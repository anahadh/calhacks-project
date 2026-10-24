"use client";

import { Html } from "@react-three/drei";
import { C } from "@/lib/colors";
import type { Device, DeviceStateRow, DeviceType } from "@/lib/stdb/types";
import { to3 } from "./space";

// Device-type glyphs (16x16 stroke icons), so each marker reads as what it is —
// a monitor, a scanner, a server, a pump — the way the design draws them.
const GLYPH: Record<string, JSX.Element> = {
  monitor: <><rect x="2.5" y="3" width="11" height="7.5" rx="1" /><path d="M6.5 13h3M8 10.5V13" /></>,
  scanner: <><rect x="2.5" y="3.5" width="11" height="9" rx="2.5" /><circle cx="8" cy="8" r="2.4" /></>,
  server: <><rect x="3.5" y="2.5" width="9" height="11" rx="1" /><path d="M5.5 5h5M5.5 8h5M5.5 11h2.5" /></>,
  heart: <path d="M2.5 8h2l1.5-3 2 6 1.5-3h4" />,
  pump: <><rect x="4" y="2.5" width="8" height="11" rx="1.5" /><path d="M8 5.5v3M6.5 7h3" /></>,
  flask: <><path d="M6.5 2.5v3.5L3.5 12a1 1 0 0 0 .9 1.5h7.2a1 1 0 0 0 .9-1.5L9.5 6V2.5" /><path d="M5.5 2.5h5" /></>,
  pill: <><rect x="2.5" y="5.5" width="11" height="5" rx="2.5" transform="rotate(-30 8 8)" /></>,
  fan: <><circle cx="8" cy="8" r="1.3" /><path d="M8 6.7V2.5M8 9.3v4.2M9.3 8h4.2M6.7 8H2.5" /></>,
  door: <><rect x="4" y="2.5" width="8" height="11" rx="1" /><circle cx="9.8" cy="8" r="0.8" /></>,
  unknown: <><circle cx="8" cy="8" r="5.5" /><path d="M6.4 6.3a1.6 1.6 0 1 1 2.2 1.5c-.5.3-.6.6-.6 1.2M8 11.2h.01" /></>,
  dot: <circle cx="8" cy="8" r="2.5" />,
};

const GLYPH_OF: Partial<Record<DeviceType, keyof typeof GLYPH>> = {
  mri: "scanner", ct: "scanner",
  workstation: "monitor", nurse_station: "monitor",
  server_rack: "server",
  patient_monitor: "heart",
  infusion_pump: "pump",
  lab_analyzer: "flask",
  pharmacy_cabinet: "pill",
  anesthesia_machine: "pump",
  badge_reader: "door",
  hvac: "fan",
  unknown: "unknown",
};

const CHIP_LIFT = 3.1; // how high the marker floats above its floor

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
  const infected = !!state?.infected;
  const color = zero ? C.zero : infected ? C.infected : C.healthy;
  const glyph = GLYPH[GLYPH_OF[device.type] ?? "dot"];

  const over = () => {
    onHover(device.id);
    document.body.style.cursor = "pointer";
  };
  const out = () => {
    onHover(null);
    document.body.style.cursor = "";
  };

  return (
    <group position={to3(device.position, level, 0)}>
      {/* pedestal: a thin stem and a small base disc on the floor */}
      <mesh position={[0, CHIP_LIFT / 2, 0]}>
        <cylinderGeometry args={[0.05, 0.05, CHIP_LIFT, 6]} />
        <meshBasicMaterial color={infected || zero ? color : "#39424A"} transparent opacity={0.8} />
      </mesh>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.32, 16]} />
        <meshBasicMaterial color={infected || zero ? color : "#39424A"} transparent opacity={0.55} />
      </mesh>

      {/* the device marker: an icon chip that always faces the camera */}
      <Html position={[0, CHIP_LIFT, 0]} center distanceFactor={26} zIndexRange={[20, 0]} pointerEvents="auto">
        <div
          onPointerOver={over}
          onPointerOut={out}
          style={{
            display: "grid",
            placeItems: "center",
            width: 30,
            height: 30,
            borderRadius: 8,
            color: infected || zero ? "#0B0D0E" : color,
            background: infected || zero ? color : "rgba(16,19,21,0.9)",
            border: `1.5px solid ${infected || zero ? color : "rgba(77,176,255,0.55)"}`,
            boxShadow: zero
              ? `0 0 0 3px rgba(255,59,59,0.25), 0 4px 10px rgba(0,0,0,0.5)`
              : hovered
                ? `0 0 0 3px ${color}44, 0 4px 10px rgba(0,0,0,0.5)`
                : "0 3px 8px rgba(0,0,0,0.45)",
            transform: hovered ? "scale(1.18)" : "scale(1)",
            transition: "transform 120ms ease, box-shadow 120ms ease",
            cursor: "pointer",
          }}
        >
          <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
            {glyph}
          </svg>
        </div>
      </Html>
    </group>
  );
}
