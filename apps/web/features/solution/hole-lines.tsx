"use client";

import { useMemo } from "react";
import { Html, Line } from "@react-three/drei";
import { to3 } from "@/components/scene/space";
import type { Flow, Hospital } from "@/lib/stdb/types";

// The holes, on demand (HospitalScene's children): while a segment is hovered, each
// kept connection that crosses its wall is a thin line on the floor from machine
// to machine, labeled with the protocol it carries. Nothing is drawn otherwise.
// From the hospital's flows minus the run's removed ones (rule 16).

const COLOR: Record<string, string> = { hl7: "#3ECFB2", dicom: "#B08CFF", https: "#4DB0FF", http: "#4DB0FF", other: "#A1A8AE", smb: "#FFC53D", rdp: "#FFC53D" };
const NAME: Record<string, string> = { hl7: "HL7", dicom: "DICOM", https: "HTTPS", http: "HTTP", smb: "SMB", rdp: "RDP" };

export function HoleLines({
  hospital,
  kept,
  segmentOf,
  litZone,
  floorId,
}: {
  hospital: Hospital;
  /** The plan's kept flows. */
  kept: readonly Flow[];
  segmentOf: Map<string, string>;
  litZone: string | null;
  floorId?: string;
}) {
  const lines = useMemo(() => {
    if (!litZone) return [];
    const device = new Map(hospital.devices.map((d) => [d.id, d]));
    const room = new Map(hospital.rooms.map((r) => [r.id, r]));
    const level = new Map(hospital.floors.map((f) => [f.id, f.level]));
    const at = (id: string): [number, number, number] | undefined => {
      const d = device.get(id);
      const r = d && room.get(d.roomId);
      if (!d || !r || (floorId && r.floorId !== floorId)) return undefined;
      return to3(d.position, level.get(r.floorId) ?? 0, 0.12);
    };
    const out: { key: string; a: [number, number, number]; b: [number, number, number]; color: string; label: string }[] = [];
    for (const f of kept) {
      const sa = segmentOf.get(f.from);
      const sb = segmentOf.get(f.to);
      if (!sa || !sb || sa === sb || (sa !== litZone && sb !== litZone)) continue;
      const a = at(f.from);
      const b = at(f.to);
      if (!a || !b) continue;
      out.push({ key: f.id, a, b, color: COLOR[f.protocol] ?? "#A1A8AE", label: f.port === 123 ? "NTP" : NAME[f.protocol] ?? f.protocol.toUpperCase() });
    }
    return out;
  }, [hospital, kept, segmentOf, litZone, floorId]);

  return (
    <>
      {lines.map((l) => (
        <group key={l.key}>
          <Line points={[l.a, l.b]} color={l.color} lineWidth={1.2} transparent opacity={0.7} dashed dashSize={0.6} gapSize={0.3} />
          <Html position={[(l.a[0] + l.b[0]) / 2, l.a[1] + 0.3, (l.a[2] + l.b[2]) / 2]} center zIndexRange={[18, 8]} style={{ pointerEvents: "none" }}>
            <span className="num whitespace-nowrap rounded-[3px] border bg-bg/90 px-1 py-px text-[9px]" style={{ borderColor: l.color, color: l.color }}>{l.label}</span>
          </Html>
        </group>
      ))}
    </>
  );
}
