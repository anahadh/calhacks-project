"use client";

import { useMemo } from "react";
import { Html } from "@react-three/drei";
import { arcPoint, NetworkArc, type Arc, type Vec3 } from "@/components/scene/arcs";
import { CHIP_LIFT } from "@/components/scene/devices";
import { to3 } from "@/components/scene/space";
import type { Flow, Hospital } from "@/lib/stdb/types";

// The plan's cuts drawn over the building (HospitalScene's children): every
// connection the plan removed is a dashed arc between the two machines, and the
// ones the infection actually reached carry a ✕ at the peak, where the attack
// stopped. Kept connections that cross a segment wall are thin blue arcs, so the
// clinical traffic the plan lets through is visible too. Everything comes from
// the hospital file and the plan run's rows (removed_flows, device_state).

export function PlanArcs({
  hospital,
  cut,
  stops,
  keptAcross,
  floorId,
  showArcs = true,
}: {
  hospital: Hospital;
  /** The flows the plan removed (run.removedFlows). */
  cut: readonly Flow[];
  /** The removed flows the infection reached (cutStops). */
  stops: readonly Flow[];
  /** Kept flows whose two ends are in different segments. */
  keptAcross: readonly Flow[];
  floorId?: string;
  /** false: only the ✕ marks where the attack met a cut, no arcs (the halo view). */
  showArcs?: boolean;
}) {
  const { arcs, marks } = useMemo(() => {
    const device = new Map(hospital.devices.map((d) => [d.id, d]));
    const room = new Map(hospital.rooms.map((r) => [r.id, r]));
    const level = new Map(hospital.floors.map((f) => [f.id, f.level]));
    const shown = (id: string) => {
      const r = room.get(device.get(id)?.roomId ?? "");
      return !!r && (!floorId || r.floorId === floorId);
    };
    const point = (id: string): Vec3 | undefined => {
      const d = device.get(id);
      const r = d && room.get(d.roomId);
      return d && r ? to3(d.position, level.get(r.floorId) ?? 0, CHIP_LIFT) : undefined;
    };
    const stopped = new Set(stops.map((f) => f.id));
    const arcs: Arc[] = [];
    const marks: { key: string; at: Vec3; label: string }[] = [];
    for (const f of keptAcross) {
      if (!shown(f.from) || !shown(f.to)) continue;
      const from = point(f.from);
      const to = point(f.to);
      if (from && to) arcs.push({ key: `kept_${f.id}`, from, to, kind: "kept", emphasis: f.protected ? "normal" : "faint" });
    }
    for (const f of cut) {
      if (!shown(f.from) || !shown(f.to)) continue;
      const from = point(f.from);
      const to = point(f.to);
      if (!from || !to) continue;
      const hit = stopped.has(f.id);
      arcs.push({ key: `cut_${f.id}`, from, to, kind: "cut", emphasis: hit ? "strong" : "normal" });
      if (hit) marks.push({ key: f.id, at: arcPoint(from, to, 0.5), label: `${f.protocol.toUpperCase()} ${f.port}` });
    }
    return { arcs, marks };
  }, [hospital, cut, stops, keptAcross, floorId]);

  return (
    <>
      {showArcs && arcs.map((a) => (
        <NetworkArc key={a.key} arc={a} />
      ))}
      {marks.map((m) => (
        <Html key={m.key} position={m.at} center zIndexRange={[26, 16]} style={{ pointerEvents: "none" }}>
          <span className="num inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-state-infected bg-bg/95 px-2 py-0.5 text-[11px] text-state-infected">
            <span className="font-disp font-bold" aria-hidden>✕</span>
            stopped · {m.label}
          </span>
        </Html>
      ))}
    </>
  );
}
