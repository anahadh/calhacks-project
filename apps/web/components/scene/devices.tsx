"use client";

import { useMemo } from "react";
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
  heart: <><rect x="2.5" y="3" width="11" height="9" rx="1.5" /><path d="M4.5 8h1.6l1-2 1.6 4 1-2h1.8" /></>,
  pump: <><rect x="4" y="2.5" width="8" height="11" rx="1.5" /><path d="M8 5.5v3M6.5 7h3" /></>,
  flask: <><path d="M6.5 2.5v3.5L3.5 12a1 1 0 0 0 .9 1.5h7.2a1 1 0 0 0 .9-1.5L9.5 6V2.5" /><path d="M5.5 2.5h5" /></>,
  pill: <><rect x="3" y="3" width="10" height="10" rx="1" /><path d="M3 8h10M8 3v10" /></>,
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

/** How high the chip floats above its floor (scene units). */
export const CHIP_LIFT = 2.6;
/** Chip size in CSS px at the design distance (Html distanceFactor in hospital-scene.tsx). */
const CHIP_PX = 30;

/**
 * One device as the design draws it: an icon chip (rounded square, dark fill,
 * state-colored outline and glyph) on a thin stem with a small base ellipse on
 * the floor. Healthy is blue, infected is orange, and the run's patient zero is
 * red with a small red mono "patient zero" label beside it.
 */
export function DeviceBox({
  device,
  level,
  state,
  hovered,
  zero,
  onHover,
  flashAt,
  distanceFactor = 22,
}: {
  device: Device;
  level: number;
  state?: DeviceStateRow;
  hovered: boolean;
  /** Patient zero of the selected run: its own red, so the start of the spread stays findable. */
  zero?: boolean;
  onHover: (id: string | null) => void;
  /** performance.now() when this tab saw the device's row turn infected: the chip pops as the path lands. */
  flashAt?: number;
  /** drei Html distance factor, chosen by the scene so a chip is ~30px at the default camera. */
  distanceFactor?: number;
}) {
  const infected = !!state?.infected;
  const hot = infected || !!zero;
  const color = zero ? C.zero : infected ? C.infected : C.healthy;
  const glyph = GLYPH[GLYPH_OF[device.type] ?? "dot"];
  // Fixed per infection (flashAt is stable for one), so a re-render never restarts the pop.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const popDelay = useMemo(() => (flashAt === undefined ? undefined : Math.round(flashAt - performance.now())), [flashAt]);
  const pop = infected && popDelay !== undefined;

  const over = () => {
    onHover(device.id);
    document.body.style.cursor = "pointer";
  };
  const out = () => {
    onHover(null);
    document.body.style.cursor = "";
  };

  const stemColor = hot ? color : C.stem;

  return (
    <group position={to3(device.position, level, 0)}>
      {/* pedestal: a thin stem and a small base ellipse on the floor */}
      <mesh position={[0, CHIP_LIFT / 2, 0]}>
        <cylinderGeometry args={[0.035, 0.035, CHIP_LIFT, 6]} />
        <meshBasicMaterial color={stemColor} transparent opacity={hot ? 0.55 : 0.9} />
      </mesh>
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.42, 20]} />
        <meshBasicMaterial color="#0E1012" transparent opacity={0.95} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.36, 0.42, 20]} />
        <meshBasicMaterial color={hot ? color : C.slabRim} transparent opacity={hot ? 0.6 : 0.7} depthWrite={false} />
      </mesh>

      {/* the device marker: an icon chip that always faces the camera */}
      <Html position={[0, CHIP_LIFT, 0]} center distanceFactor={distanceFactor} zIndexRange={[30, 20]} pointerEvents="auto">
        <div style={{ position: "relative", width: CHIP_PX, height: CHIP_PX }}>
          {zero && (
            <span
              className="num"
              style={{
                position: "absolute",
                right: CHIP_PX + 8,
                top: -2,
                whiteSpace: "nowrap",
                fontSize: 11,
                letterSpacing: "0.02em",
                color: C.zero,
                textShadow: "0 1px 2px rgba(0,0,0,0.8)",
                pointerEvents: "none",
              }}
            >
              patient zero
            </span>
          )}
          <div
            onPointerOver={over}
            onPointerOut={out}
            className={pop ? "fx-pop" : undefined}
            style={{
              display: "grid",
              placeItems: "center",
              width: CHIP_PX,
              height: CHIP_PX,
              borderRadius: 7,
              color,
              background: C.chipBg,
              border: `1.5px solid ${color}`,
              boxShadow: zero
                ? `0 0 0 3px rgba(255,59,59,0.18), 0 0 14px rgba(255,59,59,0.35), 0 4px 10px rgba(0,0,0,0.5)`
                : hovered
                  ? `0 0 0 3px ${color}33, 0 4px 10px rgba(0,0,0,0.5)`
                  : infected
                    ? `0 0 10px rgba(255,106,46,0.25), 0 3px 8px rgba(0,0,0,0.45)`
                    : "0 3px 8px rgba(0,0,0,0.45)",
              transform: hovered ? "scale(1.15)" : "scale(1)",
              transition: "transform 120ms ease, box-shadow 120ms ease, border-color 600ms ease, color 600ms ease",
              cursor: "pointer",
              ...(pop ? { animationDelay: `${Math.max(0, popDelay)}ms` } : {}),
            }}
          >
            <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
              {glyph}
            </svg>
          </div>
        </div>
      </Html>
    </group>
  );
}
