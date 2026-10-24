"use client";

import { Html } from "@react-three/drei";
import { PatientBadge } from "@/components/shell/badges";
import type { PatientStateValue, Service, ServiceStateRow } from "@/lib/stdb/types";
import { MAX_FIGURES } from "./patients";

type Pos = [number, number, number];

export function RoomChip({
  position,
  name,
  infected,
  total,
  patients,
}: {
  position: Pos;
  name: string;
  infected: number;
  total: number;
  patients?: { count: number; state: PatientStateValue };
}) {
  return (
    <Html position={position} center zIndexRange={[20, 10]} style={{ pointerEvents: "none" }}>
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
    </Html>
  );
}

// Floats above its room. When down it dims and shows what stops working.
export function ServiceMarker({ position, service, state }: { position: Pos; service: Service; state?: ServiceStateRow }) {
  const down = !!state?.down;
  return (
    <Html position={position} center zIndexRange={[20, 10]} style={{ pointerEvents: "none" }}>
      <div className={`flex flex-col items-center whitespace-nowrap text-[11px] ${down ? "" : "opacity-60"}`}>
        <div className="flex items-center gap-1.5 rounded-md border border-line bg-surface/90 px-2 py-0.5">
          <span className={down ? "text-ink-faint line-through decoration-ink-faint/60" : "text-ink-muted"}>
            {service.name}
          </span>
          {down && (
            <span className="rounded bg-ink px-1 text-[10px] font-semibold uppercase tracking-wide text-bg">Down</span>
          )}
        </div>
        {down && <div className="mt-1 text-[10px] text-ink-muted">{service.consequence}</div>}
      </div>
    </Html>
  );
}
