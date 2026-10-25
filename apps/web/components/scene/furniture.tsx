"use client";

import { useMemo } from "react";
import { C } from "@/lib/colors";
import type { Device, Room } from "@/lib/stdb/types";
import { doorOf, nearestWall } from "./plan";
import { bounds, to3 } from "./space";

// The furniture of the clinic, so each room reads as what it is: a bed beside
// every patient monitor, a desk under every workstation, a scanner at every
// MRI, racks in the server room, rows of chairs in the waiting area. All of it
// is placed from the hospital file (device type and position, room type and
// shape) and faces away from the nearest wall. It is set dressing: nothing here
// carries state, and the device chips above it stay the interactive layer.

type Vec3 = [number, number, number];

/** Everything on one room's floor. */
export function Furniture({ room, devices, level, floorCenter }: { room: Room; devices: readonly Device[]; level: number; floorCenter: [number, number] }) {
  const chairs = useMemo(() => (room.type === "waiting" ? waitingChairs(room, floorCenter) : []), [room, floorCenter]);
  return (
    <group>
      {devices.map((d) => (
        <Piece key={d.id} device={d} room={room} level={level} />
      ))}
      {chairs.map((c, i) => (
        <group key={i} position={to3(c.at, level, 0)} rotation={[0, c.angle, 0]}>
          <Chair />
        </group>
      ))}
    </group>
  );
}

/** The piece that belongs under one device, in a frame whose +z points into the room from the nearest wall. */
function Piece({ device, room, level }: { device: Device; room: Room; level: number }) {
  const wall = useMemo(() => nearestWall(room, device.position), [room, device.position]);
  // Local +z must map onto the inward normal (plan x → scene x, plan y → scene z).
  const angle = Math.atan2(wall.inward[0], wall.inward[1]);
  const at = to3(device.position, level, 0);
  const t = device.type;
  return (
    <group position={at} rotation={[0, angle, 0]}>
      {t === "patient_monitor" && (room.type === "or" ? <OperatingTable /> : <Bed />)}
      {(t === "workstation") && <Desk />}
      {t === "nurse_station" && <Counter />}
      {t === "mri" && <Scanner bore={1.05} depth={1.6} />}
      {t === "ct" && <Scanner bore={0.9} depth={0.9} />}
      {t === "server_rack" && <Rack />}
      {t === "lab_analyzer" && <Bench />}
      {t === "pharmacy_cabinet" && <Cabinet />}
      {t === "anesthesia_machine" && <Cart />}
      {t === "infusion_pump" && <Pole />}
      {t === "badge_reader" && <WallPlate offset={wall.distance} />}
      {t === "hvac" && <AirHandler />}
      {t === "unknown" && <Crate />}
    </group>
  );
}

const clay = (color: string) => <meshLambertMaterial color={color} />;

function Box({ size, at, color, shadow = true }: { size: Vec3; at: Vec3; color: string; shadow?: boolean }) {
  return (
    <mesh position={at} castShadow={shadow} receiveShadow>
      <boxGeometry args={size} />
      {clay(color)}
    </mesh>
  );
}

/** A bed beside the monitor at its head, reaching into the room. */
function Bed() {
  return (
    <group position={[0.95, 0, 1.25]}>
      <Box size={[1.0, 0.42, 2.2]} at={[0, 0.21, 0]} color={C.furniture} />
      <Box size={[0.96, 0.1, 2.1]} at={[0, 0.47, 0]} color={C.furnitureLight} />
      <Box size={[0.9, 0.06, 1.3]} at={[0, 0.55, 0.35]} color={C.linen} />
      <Box size={[0.6, 0.12, 0.4]} at={[0, 0.58, -0.8]} color={C.linen} />
      {/* headboard */}
      <Box size={[1.0, 0.7, 0.06]} at={[0, 0.5, -1.13]} color={C.furniture} />
    </group>
  );
}

/** An operating table with its lamp over it. */
function OperatingTable() {
  return (
    <group position={[0.95, 0, 1.6]}>
      <Box size={[0.5, 0.5, 0.5]} at={[0, 0.25, 0]} color={C.furniture} />
      <Box size={[0.8, 0.12, 2.1]} at={[0, 0.85, 0]} color={C.furnitureLight} />
      <Box size={[0.74, 0.05, 1.3]} at={[0, 0.94, 0.2]} color={C.linen} />
      <mesh position={[0.9, 1.6, 0]} rotation={[0, 0, 0.35]}>
        <cylinderGeometry args={[0.03, 0.03, 2.2, 6]} />
        {clay(C.metal)}
      </mesh>
      <mesh position={[0.25, 2.35, 0]} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[0.48, 0.42, 0.1, 20]} />
        {clay(C.furnitureLight)}
      </mesh>
      <mesh position={[0.25, 2.29, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.36, 20]} />
        <meshBasicMaterial color="#CFD6DC" />
      </mesh>
    </group>
  );
}

/** A desk under the workstation, chair on the room side. */
function Desk() {
  return (
    <group>
      <Box size={[1.5, 0.06, 0.7]} at={[0, 0.72, 0.1]} color={C.furnitureLight} />
      <Box size={[0.06, 0.7, 0.6]} at={[-0.7, 0.36, 0.1]} color={C.furniture} />
      <Box size={[0.06, 0.7, 0.6]} at={[0.7, 0.36, 0.1]} color={C.furniture} />
      <Box size={[0.5, 0.32, 0.04]} at={[0, 0.93, -0.12]} color={C.furniture} />
      <group position={[0, 0, 0.85]}>
        <Chair />
      </group>
    </group>
  );
}

function Chair() {
  return (
    <group>
      <Box size={[0.5, 0.08, 0.5]} at={[0, 0.44, 0]} color={C.furniture} />
      <Box size={[0.5, 0.5, 0.06]} at={[0, 0.72, 0.24]} color={C.furniture} />
      <Box size={[0.06, 0.42, 0.06]} at={[0, 0.2, 0]} color={C.metal} />
    </group>
  );
}

/** A nurses' counter. */
function Counter() {
  return (
    <group>
      <Box size={[3.0, 1.0, 0.9]} at={[0, 0.5, 0.2]} color={C.furniture} />
      <Box size={[3.1, 0.06, 1.0]} at={[0, 1.03, 0.2]} color={C.furnitureLight} />
      <Box size={[0.44, 0.3, 0.04]} at={[-0.9, 1.21, 0.1]} color={C.furniture} />
      <Box size={[0.44, 0.3, 0.04]} at={[0.9, 1.21, 0.1]} color={C.furniture} />
    </group>
  );
}

/** An MRI or CT: a housing with a bore facing the room and a patient table in front of it. */
function Scanner({ bore, depth }: { bore: number; depth: number }) {
  return (
    <group>
      <Box size={[bore * 2.3, bore * 2.1, depth]} at={[0, bore * 1.05, 0]} color={C.furniture} />
      <mesh position={[0, bore * 1.05, depth / 2 + 0.02]}>
        <torusGeometry args={[bore * 0.72, bore * 0.2, 10, 28]} />
        {clay(C.furnitureLight)}
      </mesh>
      <mesh position={[0, bore * 1.05, depth / 2 + 0.03]}>
        <circleGeometry args={[bore * 0.55, 24]} />
        <meshBasicMaterial color="#0E1012" />
      </mesh>
      <Box size={[0.7, 0.1, 2.4]} at={[0, bore * 0.95, depth / 2 + 1.3]} color={C.furnitureLight} />
      <Box size={[0.5, bore * 0.9, 0.9]} at={[0, bore * 0.45, depth / 2 + 1.6]} color={C.furniture} />
    </group>
  );
}

/** A server rack with a column of small blue status lights. */
function Rack() {
  return (
    <group>
      <Box size={[0.7, 2.0, 1.0]} at={[0, 1.0, 0]} color={C.furniture} />
      <Box size={[0.62, 1.9, 0.04]} at={[0, 1.0, 0.5]} color="#1A1E22" shadow={false} />
      {[0.45, 0.85, 1.25, 1.65].map((y) => (
        <mesh key={y} position={[-0.18, y, 0.53]}>
          <boxGeometry args={[0.12, 0.03, 0.02]} />
          <meshBasicMaterial color={C.healthy} />
        </mesh>
      ))}
    </group>
  );
}

/** A lab bench with the analyzer on it. */
function Bench() {
  return (
    <group>
      <Box size={[2.2, 0.9, 0.8]} at={[0, 0.45, 0]} color={C.furniture} />
      <Box size={[2.3, 0.05, 0.9]} at={[0, 0.93, 0]} color={C.furnitureLight} />
      <Box size={[1.1, 0.6, 0.6]} at={[0, 1.25, 0]} color={C.furnitureLight} />
      <Box size={[0.3, 0.2, 0.02]} at={[0.25, 1.3, 0.31]} color="#0E1012" shadow={false} />
    </group>
  );
}

/** A dispensing cabinet. */
function Cabinet() {
  return (
    <group>
      <Box size={[1.6, 1.9, 0.6]} at={[0, 0.95, 0]} color={C.furniture} />
      {[0.5, 0.9, 1.3].map((y) => (
        <Box key={y} size={[1.5, 0.03, 0.02]} at={[0, y, 0.31]} color={C.furnitureLight} shadow={false} />
      ))}
      <Box size={[0.3, 0.2, 0.02]} at={[0.45, 1.65, 0.31]} color="#0E1012" shadow={false} />
    </group>
  );
}

/** An anesthesia cart. */
function Cart() {
  return (
    <group>
      <Box size={[0.7, 1.1, 0.6]} at={[0, 0.55, 0]} color={C.furniture} />
      <Box size={[0.55, 0.35, 0.05]} at={[0, 1.35, 0]} color={C.furnitureLight} />
      <mesh position={[0.3, 1.5, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.8, 6]} />
        {clay(C.metal)}
      </mesh>
    </group>
  );
}

/** An infusion pole with its pump and bag. */
function Pole() {
  return (
    <group>
      <mesh position={[0, 0.85, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 1.7, 6]} />
        {clay(C.metal)}
      </mesh>
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.3, 12]} />
        {clay(C.metal)}
      </mesh>
      <Box size={[0.3, 0.24, 0.18]} at={[0, 1.1, 0.1]} color={C.furnitureLight} />
      <Box size={[0.16, 0.26, 0.06]} at={[0.18, 1.6, 0]} color={C.linen} shadow={false} />
    </group>
  );
}

/** A badge reader mounted on the wall the device sits against. */
function WallPlate({ offset }: { offset: number }) {
  return <Box size={[0.26, 0.36, 0.08]} at={[0, 1.25, -offset + 0.16]} color={C.furnitureLight} shadow={false} />;
}

/** The HVAC unit. */
function AirHandler() {
  return (
    <group>
      <Box size={[1.3, 1.0, 1.1]} at={[0, 0.5, 0]} color={C.furniture} />
      <mesh position={[0, 1.02, 0]}>
        <torusGeometry args={[0.32, 0.06, 8, 24]} />
        {clay(C.metal)}
      </mesh>
    </group>
  );
}

function Crate() {
  return <Box size={[0.55, 0.5, 0.55]} at={[0, 0.25, 0]} color={C.furniture} />;
}

/** Rows of chairs facing the waiting area's opening onto the corridor. */
function waitingChairs(room: Room, floorCenter: [number, number]): { at: [number, number]; angle: number }[] {
  const b = bounds(room.polygon);
  const door = doorOf(room, floorCenter);
  const out: { at: [number, number]; angle: number }[] = [];
  const facing = Math.atan2(-door.inward[0], -door.inward[1]);
  const horizontalDoor = Math.abs(door.inward[1]) > 0.5;
  // Rows run parallel to the door wall, set back from it and from the far wall.
  const inset = 2.2;
  const pitch = 0.95;
  const rowGap = 1.9;
  const lo = (horizontalDoor ? b.minX : b.minY) + inset;
  const hi = (horizontalDoor ? b.maxX : b.maxY) - inset;
  const n = Math.max(2, Math.min(7, Math.floor((hi - lo) / pitch)));
  const span = (n - 1) * pitch;
  const start = (lo + hi) / 2 - span / 2;
  const depth0 = (horizontalDoor ? (door.inward[1] > 0 ? b.minY : b.maxY) : door.inward[0] > 0 ? b.minX : b.maxX);
  const dir = horizontalDoor ? door.inward[1] : door.inward[0];
  for (let r = 0; r < 3; r++) {
    const depth = depth0 + dir * (3.2 + r * rowGap);
    for (let i = 0; i < n; i++) {
      const along = start + i * pitch;
      out.push({ at: horizontalDoor ? [along, depth] : [depth, along], angle: facing });
      if (out.length >= 21) return out;
    }
  }
  return out;
}
