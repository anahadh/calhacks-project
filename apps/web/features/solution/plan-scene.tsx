"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { Html, Line, OrbitControls, QuadraticBezierLine } from "@react-three/drei";
import { arcMid, type Vec3 } from "@/components/scene/arcs";
import { FloorSlab } from "@/components/scene/building";
import { FLOOR_GAP, to3 } from "@/components/scene/space";
import { C } from "@/lib/colors";
import type { Device, DeviceStateRow, Flow, Hospital, Point } from "@/lib/stdb/types";
import { hullOf, type Segment } from "./pair";

// The segmentation plan's scene (UX.md "Solution view", the design's screen 4):
// the same isometric floors as the simulation, with devices as plain dots,
// each segment outlined around its devices, the plan's kept flows as thin blue
// lines and its cut flows dashed grey, and the plan run's remaining infection
// path dotted orange. Everything drawn comes from the hospital file and the
// plan run's rows (rule 16): nothing here computes spread.

const DOT_LIFT = 0.6;

export function PlanScene({
  hospital,
  devices,
  segments,
  kept,
  cut,
  patientZero,
  hoveredZone,
  onHoverZone,
  floorId,
}: {
  hospital: Hospital;
  /** The plan run's device_state rows. */
  devices: readonly DeviceStateRow[];
  segments: readonly Segment[];
  kept: readonly Flow[];
  cut: readonly Flow[];
  patientZero?: string;
  /** A segment lit from the list or from a hovered device; infected segments are always lit. */
  hoveredZone: string | null;
  onHoverZone: (zone: string | null) => void;
  /** Show one floor, brought down to ground height; all floors when unset. */
  floorId?: string;
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
  const flowShown = (f: Flow) => shown(f.from) && shown(f.to);

  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [4, 36, 76], fov: 34, near: 0.5, far: 400 }}
      onPointerMissed={() => onHoverZone(null)}
    >
      <color attach="background" args={[C.bg]} />
      <fog attach="fog" args={[C.bg, 80, 150]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[20, 40, 25]} intensity={0.9} />
      <OrbitControls target={[0, 1, 0]} enableDamping maxPolarAngle={Math.PI / 2.1} minDistance={20} maxDistance={110} />

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

        {kept.filter(flowShown).map((f) => (
          <PlanArc key={f.id} from={point(f.from)} to={point(f.to)} kind="kept" />
        ))}
        {cut.filter(flowShown).map((f) => (
          <PlanArc key={f.id} from={point(f.from)} to={point(f.to)} kind="cut" />
        ))}
        {infectionPath.map((d) => (
          <PlanArc key={`inf_${d.deviceId}`} from={point(d.infectedBy!)} to={point(d.deviceId)} kind="infection" />
        ))}

        {hospital.devices.filter((d) => onFloor(floorOf(d))).map((d) => (
          <DeviceDot
            key={d.id}
            position={to3(d.position, levelOf(d), DOT_LIFT)}
            infected={!!state.get(d.id)?.infected}
            zero={d.id === patientZero}
            onHover={(on) => onHoverZone(on ? zoneOf(d) : null)}
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
 * A segment's outline around its devices: a translucent fill and a line in the
 * segment's color when it is lit (infected, or hovered), else a faint line.
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
      {lit && (
        // Drawn in the x/y plane, then laid flat onto x/z (as RoomShell does).
        <mesh position={[ox, level * FLOOR_GAP + 0.06, oz]} rotation={[Math.PI / 2, 0, 0]}>
          <shapeGeometry args={[shape]} />
          <meshBasicMaterial color={color} transparent opacity={0.16} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      )}
      <Line points={points} color={color} lineWidth={lit ? 1.8 : 1} transparent opacity={lit ? 0.95 : 0.28} />
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

const ARC: Record<"kept" | "cut" | "infection", { color: string; width: number; opacity: number; dash?: [number, number] }> = {
  // The plan's kept clinical flows: thin solid blue.
  kept: { color: C.healthy, width: 0.9, opacity: 0.55 },
  // A connection the plan removed: dashed grey (UX rule 3).
  cut: { color: C.cut, width: 1.2, opacity: 0.85, dash: [0.5, 0.35] },
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

/** A device as a plain dot: blue, orange once infected, red with a ring for patient zero. */
function DeviceDot({
  position,
  infected,
  zero,
  onHover,
}: {
  position: Vec3;
  infected: boolean;
  zero: boolean;
  onHover: (on: boolean) => void;
}) {
  const color = zero ? C.zero : infected ? C.infected : C.healthy;
  return (
    <group position={position}>
      <mesh
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
