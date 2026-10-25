"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { Html } from "@react-three/drei";
import { to3 } from "@/components/scene/space";
import { C } from "@/lib/colors";
import type { DeviceStateRow, Hospital } from "@/lib/stdb/types";
import type { Segment } from "./pair";

// The plan's segmentation drawn as halos (HospitalScene's children): every
// machine in a segment wears a flat ring on the floor in its segment's color,
// so same color means "these can still reach each other over file sharing or
// remote desktop after the plan's cuts". Floors stay neutral. An infected
// machine glows orange inside its halo; a machine no lateral link touches gets
// a faint gray ring. The segment the infection reached, or the hovered one,
// is drawn stronger with its label. Segments come from pair.ts planSegmentsOf
// (topology from the hospital file and the run's removed flows), infection
// from the run's device_state rows (rule 16).

const RING_IN = 0.95;
const RING_OUT = 1.2;
const DISC = 1.7;

export function SegmentHalos({
  hospital,
  segments,
  devices,
  floorId,
  litZone,
}: {
  hospital: Hospital;
  segments: readonly Segment[];
  /** The plan run's device rows (for infected). */
  devices: readonly DeviceStateRow[];
  floorId?: string;
  /** The segment to draw stronger (a hovered device's, or a hovered row's). */
  litZone: string | null;
}) {
  const { halos, labels } = useMemo(() => {
    const room = new Map(hospital.rooms.map((r) => [r.id, r]));
    const level = new Map(hospital.floors.map((f) => [f.id, f.level]));
    const infected = new Set(devices.filter((d) => d.infected).map((d) => d.deviceId));
    const segOf = new Map<string, Segment>();
    for (const s of segments) for (const id of s.deviceIds) segOf.set(id, s);
    const halos: { id: string; at: [number, number, number]; color: string; zone?: string; infected: boolean; floorId: string }[] = [];
    const sums = new Map<string, { x: number; y: number; z: number; n: number; floorId: string }>();
    for (const d of hospital.devices) {
      const r = room.get(d.roomId);
      if (!r) continue;
      const s = segOf.get(d.id);
      const at = to3(d.position, level.get(r.floorId) ?? 0, 0.08);
      halos.push({ id: d.id, at, color: s?.color ?? "#3E4448", zone: s?.zone, infected: infected.has(d.id), floorId: r.floorId });
      if (s) {
        const key = `${s.zone}:${r.floorId}`;
        const a = sums.get(key) ?? { x: 0, y: 0, z: 0, n: 0, floorId: r.floorId };
        a.x += at[0]; a.y += at[1]; a.z += at[2]; a.n += 1;
        sums.set(key, a);
      }
    }
    const labels = [...sums.entries()].map(([key, a]) => {
      const s = segments.find((x) => x.zone === key.split(":")[0])!;
      return { key, zone: s.zone, name: s.name, color: s.color, infected: s.infected, total: s.total, floorId: a.floorId, at: [a.x / a.n, a.y / a.n + 3.4, a.z / a.n] as [number, number, number] };
    });
    return { halos, labels };
  }, [hospital, segments, devices]);

  const shown = (fid: string) => !floorId || fid === floorId;
  const infectedZones = new Set(segments.filter((s) => s.infected > 0).map((s) => s.zone));
  return (
    <>
      {halos.filter((h) => shown(h.floorId)).map((h) => {
        const lit = !!h.zone && (litZone === h.zone || infectedZones.has(h.zone));
        return (
          <group key={h.id} position={h.at}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[h.infected ? DISC + 0.3 : DISC, 40]} />
              <meshBasicMaterial color={h.infected ? C.infected : h.color} transparent opacity={h.infected ? 0.26 : lit ? 0.2 : h.zone ? 0.1 : 0.04} depthWrite={false} side={THREE.DoubleSide} />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
              <ringGeometry args={[RING_IN, RING_OUT, 40]} />
              <meshBasicMaterial color={h.color} transparent opacity={h.zone ? (lit ? 1 : 0.8) : 0.3} depthWrite={false} side={THREE.DoubleSide} />
            </mesh>
          </group>
        );
      })}
      {labels
        .filter((l) => shown(l.floorId) && (litZone === l.zone || l.infected > 0))
        .map((l) => (
          <Html key={l.key} position={l.at} center zIndexRange={[20, 10]} style={{ pointerEvents: "none" }}>
            <div className="num flex items-center gap-2 whitespace-nowrap rounded-ctl border bg-bg/90 px-2.5 py-0.5 text-[11px]" style={{ borderColor: l.color }}>
              <span className="text-ink">{l.name}</span>
              <span className={l.infected > 0 ? "text-state-infected" : "text-ink-faint"}>{l.infected > 0 ? `${l.infected}/${l.total}` : l.total}</span>
            </div>
          </Html>
        ))}
    </>
  );
}
