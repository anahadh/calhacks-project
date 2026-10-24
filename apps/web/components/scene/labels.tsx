"use client";

import { Html } from "@react-three/drei";
import { PatientBadge } from "@/components/shell/badges";
import type { PatientStateValue, Service } from "@/lib/stdb/types";
import { MAX_FIGURES } from "./patients";

type Pos = [number, number, number];

export function RoomChip({
  position,
  name,
  infected,
  total,
  patients,
  servicesDown,
}: {
  position: Pos;
  name: string;
  infected: number;
  total: number;
  patients?: { count: number; state: PatientStateValue };
  servicesDown: Service[];
}) {
  return (
    <Html position={position} center zIndexRange={[20, 10]} style={{ pointerEvents: "none" }}>
      <div className="flex flex-col items-center gap-1">
      {/* A service that goes down shows over the room that broke it. */}
      {servicesDown.map((svc) => (
        <div key={svc.id} className="flex items-center gap-1.5 whitespace-nowrap rounded-md border border-line bg-surface/95 px-2 py-0.5 text-[11px]">
          <span className="rounded bg-ink px-1 text-[10px] font-semibold uppercase tracking-wide text-bg">Down</span>
          <span className="text-ink">{svc.name} offline</span>
        </div>
      ))}
      <div className="flex items-center gap-2 whitespace-nowrap rounded-full border border-line/80 bg-bg/80 px-2.5 py-1 text-[11px] backdrop-blur-sm">
        <span className="text-ink-muted">{name}</span>
        <span className="num">
          <span className={infected > 0 ? "text-state-infected" : "text-ink-faint"}>{infected}</span>
          <span className="text-ink-faint">/{total}</span>
        </span>
        {patients && patients.state !== "ok" && <PatientBadge state={patients.state} />}
        {patients && patients.count > MAX_FIGURES && (
          <span className="num text-ink-faint">+{patients.count - MAX_FIGURES}</span>
        )}
      </div>
      </div>
    </Html>
  );
}
