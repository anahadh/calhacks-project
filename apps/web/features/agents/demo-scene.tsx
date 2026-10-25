"use client";

import { useMemo } from "react";
import demo from "../../../../data/hospitals/demo.json";
import { roundedHullOf } from "@/features/solution/pair";
import { SEGMENT, segmentOf, type FunctionalSegment } from "@/features/solution/segments";
import { ZONE_STYLE, zoneName } from "@/features/solution/pair";
import type { Hospital, Point } from "@/lib/stdb/types";

// The skeleton beside the scripted negotiation: room outlines, one dot per machine,
// and the segmentation of the plan on the table as soft blobs that grow in when the
// plan changes. Plan 1 walls off Imaging alone (naive), plan 2 walls every department,
// plan 3 is the five networks by function with the feeds care needs drawn as lines.
// Scripted (demo-script.ts): the shapes come from the hospital file, the counts from the script.

const H = (demo as unknown as { hospital: Hospital }).hospital;
const BASELINE_INFECTED = ["mri_2", "ws_img_1", "ws_img_2", "ws_rad_1", "ws_rad_2", "srv_file", "srv_ehr", "srv_dc", "ws_lab"];
const PAD = 1.4;

type Blob = { key: string; color: string; pts: Point[]; label?: string };

export function DemoScene({ plan, infected, reopened }: { plan: number; infected: number; /** Live: the feeds reopened so far (flow ids); the plan is then always the five networks. */ reopened?: string[] }) {
  const rooms = H.rooms.filter((r) => r.polygon.length >= 3);
  const zoneOf = useMemo(() => new Map(H.rooms.map((r) => [r.id, r.zone])), []);
  const devices = H.devices;
  const bounds = useMemo(() => {
    const xs = rooms.flatMap((r) => r.polygon.map((p) => p[0]));
    const ys = rooms.flatMap((r) => r.polygon.map((p) => p[1]));
    return { x0: Math.min(...xs) - 3, y0: Math.min(...ys) - 3, x1: Math.max(...xs) + 3, y1: Math.max(...ys) + 3 };
  }, [rooms]);
  const infectedIds = useMemo(() => new Set(BASELINE_INFECTED.slice(0, plan === 0 ? BASELINE_INFECTED.length : Math.min(infected, 5))), [plan, infected]);

  const blobs = useMemo<Blob[]>(() => {
    const byKey = new Map<string, { color: string; pts: Point[]; label: string }>();
    const add = (key: string, color: string, label: string, p: Point) => {
      const g = byKey.get(key) ?? { color, pts: [], label };
      g.pts.push(p);
      byKey.set(key, g);
    };
    for (const d of devices) {
      const zone = zoneOf.get(d.roomId) ?? "";
      if (reopened) {
        const s = segmentOf(d, zone) as FunctionalSegment;
        add(`${s}:${d.roomId}`, SEGMENT[s].color, SEGMENT[s].name, d.position);
      } else if (plan === 1) {
        if (zone === "imaging") add("imaging", ZONE_STYLE.imaging.color, "Imaging, walled off", d.position);
      } else if (plan === 2) {
        add(`${zone}:${d.roomId}`, ZONE_STYLE[zone]?.color ?? "#7D858B", zoneName(zone), d.position);
      } else if (plan >= 3) {
        const s = segmentOf(d, zone) as FunctionalSegment;
        add(`${s}:${d.roomId}`, SEGMENT[s].color, SEGMENT[s].name, d.position);
      }
    }
    return [...byKey.entries()].map(([key, g]) => ({ key, color: g.color, label: g.label, pts: roundedHullOf(g.pts, PAD) }));
  }, [plan, devices, zoneOf, reopened]);

  // Plan 3: the feeds reopened for care, as lines between the machines they join.
  const holes = useMemo(() => {
    if (!reopened && plan < 3) return [];
    const pos = new Map(devices.map((d) => [d.id, d.position]));
    const seg = new Map(devices.map((d) => [d.id, segmentOf(d, zoneOf.get(d.roomId) ?? "")]));
    const open = reopened ? new Set(reopened) : null;
    return H.flows
      .filter((f) => f.active !== false && (open ? open.has(f.id) : f.protocol === "hl7" && seg.get(f.from) !== seg.get(f.to)))
      .map((f) => ({ id: f.id, a: pos.get(f.from)!, b: pos.get(f.to)! }))
      .filter((l) => l.a && l.b);
  }, [plan, devices, zoneOf, reopened]);

  const vb = `${bounds.x0} ${bounds.y0} ${bounds.x1 - bounds.x0} ${bounds.y1 - bounds.y0}`;
  const labels = new Map<string, Blob>();
  for (const b of blobs) if (b.label && !labels.has(b.label)) labels.set(b.label, b);

  return (
    <div className="relative h-full w-full bg-scene-ground">
      <style>{`@keyframes demo-grow { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }`}</style>
      <svg viewBox={vb} className="h-full w-full" role="img" aria-label="The hospital's rooms and machines with the plan's segments">
        <g fill="none" stroke="#2A2E32" strokeWidth={0.25}>
          {rooms.map((r) => (
            <polygon key={r.id} points={r.polygon.map((p) => p.join(",")).join(" ")} />
          ))}
        </g>
        <g key={plan}>
          {blobs.map((b, i) => (
            <polygon
              key={b.key}
              points={b.pts.map((p) => p.join(",")).join(" ")}
              fill={b.color}
              fillOpacity={0.16}
              stroke={b.color}
              strokeWidth={0.3}
              style={{ transformBox: "fill-box", transformOrigin: "center", animation: `demo-grow 900ms cubic-bezier(0.22,1,0.36,1) ${i * 90}ms both` }}
            />
          ))}
          {holes.map((l) => (
            <line key={l.id} x1={l.a[0]} y1={l.a[1]} x2={l.b[0]} y2={l.b[1]} stroke="#3ECFB2" strokeWidth={0.22} strokeDasharray="0.9 0.6" opacity={0.9} />
          ))}
        </g>
        {devices.map((d) => {
          const hit = infectedIds.has(d.id);
          return <circle key={d.id} cx={d.position[0]} cy={d.position[1]} r={hit ? 0.75 : 0.55} fill={hit ? "#FF6A2E" : "#4DB0FF"} stroke={d.id === "mri_2" ? "#E9ECEE" : "none"} strokeWidth={0.2} />;
        })}
        {[...labels.values()].map((b) => {
          const top = b.pts.reduce((a, p) => (p[1] < a[1] ? p : a), b.pts[0]);
          return (
            <text key={b.label} x={top[0]} y={top[1] - 0.8} textAnchor="middle" fontSize={1.4} fontFamily="ui-monospace, Menlo, monospace" fill={b.color}>
              {b.label}
            </text>
          );
        })}
      </svg>
      <span className="num pointer-events-none absolute bottom-3 left-4 text-[11px] text-ink-faint">
        {reopened
          ? plan === 0
            ? "No plan yet: where the attack reaches"
            : `Plan ${plan} · five networks by function · teal lines: ${reopened.length ? `${reopened.length} feeds reopened for care` : "no feeds reopened yet"}`
          : plan === 0
          ? "No plan: where the attack from MRI 2 reaches"
          : plan === 1
            ? "Plan 1 · one wall around Imaging"
            : plan === 2
              ? "Plan 2 · a wall around every department"
              : "Plan 3 · five networks by function · teal lines: feeds reopened for care"}
      </span>
    </div>
  );
}
