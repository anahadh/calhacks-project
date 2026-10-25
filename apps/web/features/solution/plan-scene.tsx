"use client";

import { useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, Line, OrbitControls, QuadraticBezierLine } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { arcMid, arcPoint, type Vec3 } from "@/components/scene/arcs";
import { FloorSlab } from "@/components/scene/building";
import { FLOOR_GAP, to3 } from "@/components/scene/space";
import { C } from "@/lib/colors";
import type { Device, DeviceStateRow, Flow, Hospital, Point } from "@/lib/stdb/types";
import { hullOf, type Segment } from "./pair";

// One side of the solution view's split screen (UX.md "Solution view", the
// design's screen 4): the same isometric floors as the simulation, with devices
// as plain dots and the run's infection paths dotted orange. The plan side also
// draws the plan: each segment filled and outlined in its color (the walls),
// kept clinical flows as solid blue lines, cut connections as dashed lines, and
// a ✕ on every cut connection the infection reached (cutStops). The "none" side
// draws no walls and no flows, so the two buildings differ only by the plan.
// Everything drawn comes from the hospital file and a run's rows (rule 16):
// nothing here computes spread.

const DOT_LIFT = 0.6;

/**
 * The camera the two sides share: whichever canvas the person drags writes its
 * camera here, and the other follows each frame, so the buildings stay aligned.
 */
export type SharedCamera = { position: THREE.Vector3; target: THREE.Vector3; owner: string | null; stamp: number };
export function sharedCamera(): SharedCamera {
  // One cross-shaped floor centred on the origin: high and back enough that each half shows the whole building.
  return { position: new THREE.Vector3(6, 78, 92), target: new THREE.Vector3(0, 0, 2), owner: null, stamp: 0 };
}

function FollowCamera({ id, shared, controls }: { id: string; shared: SharedCamera; controls: RefObject<OrbitControlsImpl | null> }) {
  const { camera } = useThree();
  const seen = useRef(0);
  useFrame(() => {
    if (shared.owner === id || shared.stamp === seen.current || !controls.current) return;
    seen.current = shared.stamp;
    camera.position.copy(shared.position);
    controls.current.target.copy(shared.target);
    controls.current.update();
  });
  return null;
}

export function PlanScene({
  id,
  shared,
  hospital,
  devices,
  segments,
  kept,
  cut,
  stops,
  patientZero,
  hoveredZone,
  onHoverZone,
  floorId,
  pickable,
  onPick,
}: {
  /** Which side this is, for the shared camera. */
  id: string;
  shared: SharedCamera;
  hospital: Hospital;
  /** This side's run's device_state rows. */
  devices: readonly DeviceStateRow[];
  /** The walls to draw: the plan's segments, or none on the "no segmentation" side. */
  segments: readonly Segment[];
  kept: readonly Flow[];
  cut: readonly Flow[];
  /** The cut connections the infection reached (cutStops): a ✕ each. */
  stops: readonly Flow[];
  patientZero?: string;
  /** A segment lit from the list or from a hovered device; infected segments are always lit. */
  hoveredZone: string | null;
  onHoverZone: (zone: string | null) => void;
  /** Show one floor, brought down to ground height; all floors when unset. */
  floorId?: string;
  /** Devices an attack can start from; clicking one calls onPick (rerun both sides from there). */
  pickable?: ReadonlySet<string>;
  onPick?: (deviceId: string) => void;
}) {
  const floorLevel = useMemo(() => new Map(hospital.floors.map((f) => [f.id, f.level])), [hospital.floors]);
  const room = useMemo(() => new Map(hospital.rooms.map((r) => [r.id, r])), [hospital.rooms]);
  const device = useMemo(() => new Map(hospital.devices.map((d) => [d.id, d])), [hospital.devices]);
  const state = useMemo(() => new Map(devices.map((d) => [d.deviceId, d])), [devices]);
  const zoneOf = (d: Device) => room.get(d.roomId)?.zone ?? "";
  const floorOf = (d: Device) => room.get(d.roomId)?.floorId ?? "";
  const levelOf = (d: Device) => floorLevel.get(floorOf(d)) ?? 0;
  const onFloor = (fid: string) => !floorId || fid === floorId;
  const shown = (id: string) => {
    const d = device.get(id);
    return !!d && onFloor(floorOf(d));
  };
  const point = (id: string, lift = DOT_LIFT): Vec3 => {
    const d = device.get(id)!;
    return to3(d.position, levelOf(d), lift);
  };
  const drop = floorId ? (hospital.floors.find((f) => f.id === floorId)?.level ?? 0) * FLOOR_GAP : 0;

  // One outline per segment per floor, around that floor's devices of the zone.
  const outlines = useMemo(() => {
    const out: { key: string; segment: Segment; floorId: string; level: number; hull: Point[]; anchor: Point }[] = [];
    for (const s of segments) {
      for (const fid of s.floorIds) {
        const pts = s.deviceIds
          .map((id) => device.get(id))
          .filter((d): d is Device => !!d && floorOf(d) === fid)
          .map((d) => d.position);
        const hull = hullOf(pts);
        if (!hull.length) continue;
        const top = hull.reduce((a, p) => (p[1] < a[1] ? p : a), hull[0]);
        out.push({ key: `${s.zone}:${fid}`, segment: s, floorId: fid, level: floorLevel.get(fid) ?? 0, hull, anchor: top });
      }
    }
    return out;
    // device/floorOf read only hospital maps.
  }, [segments, device, room, floorLevel]);

  const infectionPath = devices.filter((d) => d.infected && d.infectedBy && shown(d.deviceId) && shown(d.infectedBy));
  // Only links ransomware can travel over (file sharing, remote desktop) are drawn; clinical traffic is left out.
  const lateral = (f: Flow) => f.protocol === "smb" || f.protocol === "rdp";
  const flowShown = (f: Flow) => lateral(f) && shown(f.from) && shown(f.to);
  const controls = useRef<OrbitControlsImpl | null>(null);
  const publish = () => {
    if (!controls.current) return;
    shared.owner = id;
    shared.position.copy(controls.current.object.position);
    shared.target.copy(controls.current.target);
    shared.stamp += 1;
  };

  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: shared.position.toArray(), fov: 34, near: 0.5, far: 400 }}
      onPointerMissed={() => onHoverZone(null)}
    >
      <color attach="background" args={[C.bg]} />
      <fog attach="fog" args={[C.bg, 80, 150]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[20, 40, 25]} intensity={0.9} />
      <OrbitControls
        ref={controls}
        target={shared.target.toArray()}
        enableDamping
        maxPolarAngle={Math.PI / 2.1}
        minDistance={20}
        maxDistance={170}
        onStart={() => (shared.owner = id)}
        onChange={() => shared.owner === id && publish()}
        onEnd={() => (shared.owner = null)}
      />
      <FollowCamera id={id} shared={shared} controls={controls} />

      <group position={[0, -drop, 0]}>
        {hospital.floors.filter((f) => onFloor(f.id)).map((f) => (
          <FloorSlab key={f.id} floor={f} subtitle="" />
        ))}

        {hospital.rooms.filter((r) => onFloor(r.floorId)).map((r) => (
          <RoomOutline key={r.id} polygon={r.polygon} level={floorLevel.get(r.floorId) ?? 0} />
        ))}

        {outlines.filter((o) => onFloor(o.floorId)).map((o) => (
          <SegmentOutline
            key={o.key}
            hull={o.hull}
            level={o.level}
            color={o.segment.color}
            lit={o.segment.infected > 0 || hoveredZone === o.segment.zone}
            label={
              o.segment.infected > 0 || hoveredZone === o.segment.zone
                ? { name: o.segment.name, infected: o.segment.infected, total: o.segment.total, at: o.anchor }
                : undefined
            }
          />
        ))}

        {/* By default only the holes: kept connections that cross a segment wall (scans to PACS, vitals and ADT, NTP).
            A hovered segment also shows its own internal connections. */}
        {kept.filter((f) => {
          if (!flowShown(f)) return false;
          const za = device.get(f.from) ? zoneOf(device.get(f.from)!) : "";
          const zb = device.get(f.to) ? zoneOf(device.get(f.to)!) : "";
          return za !== zb || (!!hoveredZone && (za === hoveredZone || zb === hoveredZone));
        }).map((f) => {
          const za = device.get(f.from) ? zoneOf(device.get(f.from)!) : "";
          const zb = device.get(f.to) ? zoneOf(device.get(f.to)!) : "";
          return <PlanArc key={f.id} from={point(f.from)} to={point(f.to)} kind={za !== zb ? "hole" : "kept"} />;
        })}
        {cut.filter(flowShown).map((f) => (
          <PlanArc key={f.id} from={point(f.from)} to={point(f.to)} kind="cut" />
        ))}
        {infectionPath.map((d) => (
          <PlanArc key={`inf_${d.deviceId}`} from={point(d.infectedBy!)} to={point(d.deviceId)} kind="infection" />
        ))}
        {stops.filter(flowShown).map((f) => (
          <CutStop key={`stop_${f.id}`} at={arcPoint(point(f.from), point(f.to), 0.5)} />
        ))}

        {hospital.devices.filter((d) => onFloor(floorOf(d))).map((d) => (
          <DeviceDot
            key={d.id}
            position={to3(d.position, levelOf(d), DOT_LIFT)}
            infected={!!state.get(d.id)?.infected}
            zero={d.id === patientZero}
            onHover={(on) => onHoverZone(on ? zoneOf(d) : null)}
            pick={onPick && pickable?.has(d.id) && d.id !== patientZero ? () => onPick(d.id) : undefined}
          />
        ))}
      </group>
    </Canvas>
  );
}

/** A room's edge on the slab: a thin line, the way the design draws floor divisions. */
function RoomOutline({ polygon, level }: { polygon: Point[]; level: number }) {
  const points = useMemo(
    () => (polygon.length ? [...polygon, polygon[0]].map((p) => to3(p, level, 0.03)) : []),
    [polygon, level],
  );
  if (points.length < 2) return null;
  return <Line points={points} color={C.slabEdge} lineWidth={1} transparent opacity={0.9} />;
}

/**
 * A segment's wall around its devices: always a translucent fill and a line in
 * the segment's color, so the building reads as zones at a glance; stronger
 * when lit (infected, or hovered), with its label.
 */
function SegmentOutline({
  hull,
  level,
  color,
  lit,
  label,
}: {
  hull: Point[];
  level: number;
  color: string;
  lit: boolean;
  label?: { name: string; infected: number; total: number; at: Point };
}) {
  const points = useMemo(() => [...hull, hull[0]].map((p) => to3(p, level, 0.08)), [hull, level]);
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    hull.forEach(([x, y], i) => (i === 0 ? s.moveTo(x, y) : s.lineTo(x, y)));
    s.closePath();
    return s;
  }, [hull]);
  const [ox, , oz] = to3([0, 0], level);
  return (
    <group>
      {/* Drawn in the x/y plane, then laid flat onto x/z (as RoomShell does). */}
      <mesh position={[ox, level * FLOOR_GAP + 0.06, oz]} rotation={[Math.PI / 2, 0, 0]}>
        <shapeGeometry args={[shape]} />
        <meshBasicMaterial color={color} transparent opacity={lit ? 0.22 : 0.12} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <Line points={points} color={color} lineWidth={lit ? 2.2 : 1.6} transparent opacity={lit ? 1 : 0.8} />
      {label && (
        <Html position={to3(label.at, level, 0.4)} center zIndexRange={[20, 10]} style={{ pointerEvents: "none" }}>
          <div
            className="num flex items-center gap-2 whitespace-nowrap rounded-ctl border bg-bg/90 px-2.5 py-0.5 text-[11px]"
            style={{ borderColor: color }}
          >
            <span className="text-ink">{label.name}</span>
            <span className={label.infected > 0 ? "text-state-infected" : "text-ink-faint"}>
              {label.infected > 0 ? `${label.infected}/${label.total}` : label.total}
            </span>
          </div>
        </Html>
      )}
    </group>
  );
}

const ARC: Record<"kept" | "hole" | "cut" | "infection", { color: string; width: number; opacity: number; dash?: [number, number] }> = {
  // A hole in a segment wall: the minimum traffic that still crosses it. Faint, so the walls read first.
  hole: { color: C.healthy, width: 1, opacity: 0.35 },
  // The plan's kept clinical flows: solid blue, bright enough to read from across the room.
  kept: { color: C.healthy, width: 1.4, opacity: 0.85 },
  // A connection the plan removed: dashed grey (UX rule 3), at full strength.
  cut: { color: C.cut, width: 1.6, opacity: 1, dash: [0.5, 0.35] },
  // The one infection path left, from infected_by: dotted orange.
  infection: { color: C.infected, width: 1.8, opacity: 0.95, dash: [0.25, 0.3] },
};

function PlanArc({ from, to, kind }: { from: Vec3; to: Vec3; kind: keyof typeof ARC }) {
  const s = ARC[kind];
  // drei rebuilds the line whenever these arrays change identity, so keep them while the ends stay put.
  const at = `${from.join()}|${to.join()}`;
  const ends = useMemo(() => ({ start: from, end: to, mid: arcMid(from, to) }), [at]);
  const dash = s.dash ? { dashed: true, dashSize: s.dash[0], gapSize: s.dash[1] } : {};
  return <QuadraticBezierLine {...ends} color={s.color} lineWidth={s.width} transparent opacity={s.opacity} {...dash} />;
}

/** The ✕ on a cut connection the infection reached: where the spread stopped at the wall. */
function CutStop({ at }: { at: Vec3 }) {
  return (
    <Html position={at} center zIndexRange={[25, 15]} style={{ pointerEvents: "none" }}>
      <span
        className="font-disp grid h-7 w-7 place-items-center rounded-full border-[1.5px] border-state-infected bg-bg/95 text-[15px] font-bold leading-none text-state-infected shadow-[0_0_0_3px_rgba(255,106,46,0.25)]"
        aria-label="The infection stopped here"
      >
        ✕
      </span>
    </Html>
  );
}

/** A device as a plain dot: blue, orange once infected, red with a ring for patient zero. */
function DeviceDot({
  position,
  infected,
  zero,
  onHover,
  pick,
}: {
  position: Vec3;
  infected: boolean;
  zero: boolean;
  onHover: (on: boolean) => void;
  /** Set on a device an attack can start from: click to rerun from it. */
  pick?: () => void;
}) {
  const color = zero ? C.zero : infected ? C.infected : C.healthy;
  return (
    <group position={position}>
      {pick && (
        // A ringed entry point: click to start the attack here.
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.62, 0.74, 28]} />
          <meshBasicMaterial color={C.ok} transparent opacity={0.45} side={THREE.DoubleSide} />
        </mesh>
      )}
      <mesh
        onClick={(e) => {
          if (!pick) return;
          e.stopPropagation();
          pick();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          onHover(false);
          document.body.style.cursor = "";
        }}
      >
        <sphereGeometry args={[0.42, 14, 14]} />
        <meshBasicMaterial color={color} />
      </mesh>
      {zero && (
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.7, 0.86, 28]} />
          <meshBasicMaterial color={C.ok} transparent opacity={0.9} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}
