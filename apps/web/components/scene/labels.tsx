"use client";

import { useState } from "react";
import { Html } from "@react-three/drei";
import { PatientBadge } from "@/components/shell/badges";
import { C } from "@/lib/colors";
import type { PatientStateValue, Service } from "@/lib/stdb/types";
import { MAX_FIGURES } from "./patients";

type Pos = [number, number, number];

/**
 * A room's name as a dark rounded slab pill lying on the floor (the design),
 * with its infected count. Services that go down pop a "Down" chip above it.
 */
export function RoomChip({
  position,
  name,
  infected,
  total,
  patients,
  servicesDown,
  downAt,
}: {
  position: Pos;
  name: string;
  infected: number;
  total: number;
  patients?: { count: number; state: PatientStateValue };
  servicesDown: Service[];
  /** serviceId → when this tab saw it go down (spread-timing.ts). Those chips pop in; the rest just show. */
  downAt?: ReadonlyMap<string, number>;
}) {
  return (
    <Html position={position} center zIndexRange={[15, 5]} style={{ pointerEvents: "none" }}>
      <div className="flex flex-col items-center gap-1">
        {/* A service that goes down shows over the room that broke it. */}
        {servicesDown.map((svc) => (
          <DownChip key={svc.id} service={svc} at={downAt?.get(svc.id)} />
        ))}
        <div
          className="flex items-center gap-2 whitespace-nowrap rounded-[5px] px-3 py-[5px] text-[11px]"
          style={{
            background: C.pill,
            border: `1px solid ${infected > 0 ? "rgba(255,106,46,0.35)" : "#3E4448"}`,
            boxShadow: "0 6px 16px rgba(0,0,0,0.45)",
          }}
        >
          <span className="font-disp font-semibold text-ink-muted">{name}</span>
          <span className="num text-[10.5px]">
            <span className={infected > 0 ? "text-state-infected" : "text-ink-faint"}>{infected}</span>
            <span className="text-ink-faint">/{total}</span>
          </span>
          {patients && patients.state !== "ok" && <PatientBadge state={patients.state} />}
          {patients && patients.count > MAX_FIGURES && (
            <span className="num text-[10px] text-ink-faint">+{patients.count - MAX_FIGURES}</span>
          )}
        </div>
      </div>
    </Html>
  );
}

function DownChip({ service, at }: { service: Service; at?: number }) {
  // Fixed when the chip mounts, so a re-render never restarts the pop.
  const [delay] = useState(() => (at === undefined ? undefined : at - performance.now()));
  return (
    <div
      className={`flex items-center gap-1.5 whitespace-nowrap rounded-[5px] border border-line2 px-2 py-0.5 text-[11px] ${
        delay === undefined ? "" : "fx-pop"
      }`}
      style={{ background: C.pill, ...(delay === undefined ? {} : { animationDelay: `${Math.round(delay)}ms` }) }}
    >
      <span className="rounded bg-ink px-1 text-[10px] font-semibold uppercase tracking-wide text-bg">Down</span>
      <span className="text-ink">{service.name} offline</span>
    </div>
  );
}
