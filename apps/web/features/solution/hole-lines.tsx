"use client";

import { useMemo, useState } from "react";
import { Html, Line } from "@react-three/drei";
import { to3 } from "@/components/scene/space";
import type { Flow, Hospital } from "@/lib/stdb/types";

// The holes (HospitalScene's children): every kept clinical connection that crosses a
// segment wall is a faint dashed line on the floor from machine to machine. The hovered
// segment's lines draw brighter, and hovering a line shows what it carries and why.
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
    const name = (id: string) => device.get(id)?.name ?? id;
    const out: { key: string; a: [number, number, number]; b: [number, number, number]; color: string; label: string; detail: string; lit: boolean }[] = [];
    for (const f of kept) {
      const sa = segmentOf.get(f.from);
      const sb = segmentOf.get(f.to);
      if (!sa || !sb || sa === sb) continue;
      if (f.protocol === "smb" || f.protocol === "rdp" || f.protocol === "https" || f.protocol === "http") continue; // the clinical holes: HL7, DICOM, vendor, NTP
      const a = at(f.from);
      const b = at(f.to);
      if (!a || !b) continue;
      const proto = f.port === 123 ? "NTP" : NAME[f.protocol] ?? f.protocol.toUpperCase();
      out.push({
        key: f.id, a, b, color: COLOR[f.protocol] ?? "#A1A8AE", label: proto,
        detail: `${name(f.from)} → ${name(f.to)} · ${proto} ${f.port}${f.purpose ? ` · ${f.purpose}` : ""}${f.protected ? " · protected" : ""}`,
        lit: !!litZone && (sa === litZone || sb === litZone),
      });
    }
    return out;
  }, [hospital, kept, segmentOf, litZone, floorId]);
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <>
      {lines.map((l) => {
        const on = hovered === l.key;
        return (
          <group key={l.key}>
            <Line
              points={[l.a, l.b]}
              color={l.color}
              lineWidth={on ? 2.2 : l.lit ? 1.4 : 1}
              transparent
              opacity={on ? 1 : l.lit ? 0.8 : 0.3}
              dashed
              dashSize={0.6}
              gapSize={0.3}
              onPointerOver={(e) => { e.stopPropagation(); setHovered(l.key); }}
              onPointerOut={() => setHovered((h) => (h === l.key ? null : h))}
            />
            {on && (
              <Html position={[(l.a[0] + l.b[0]) / 2, l.a[1] + 0.3, (l.a[2] + l.b[2]) / 2]} center zIndexRange={[28, 18]} style={{ pointerEvents: "none" }}>
                <span className="num whitespace-nowrap rounded-[3px] border bg-bg/95 px-1.5 py-0.5 text-[10px] text-ink" style={{ borderColor: l.color }}>
                  <span style={{ color: l.color }}>{l.label}</span> · {l.detail}
                </span>
              </Html>
            )}
          </group>
        );
      })}
    </>
  );
}
