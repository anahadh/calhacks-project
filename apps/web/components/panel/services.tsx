"use client";

import { tickClock } from "@/lib/format";
import type { SessionIndex } from "@/lib/stdb/use-session";
import type { SessionSnapshot } from "@/lib/stdb/types";

// Service tiles stay neutral: a service is not a device, so it shows state
// with words and an inverted badge rather than a state color.
export function ServicesPanel({ session, index }: { session: SessionSnapshot; index: SessionIndex }) {
  const services = session.hospital.services;
  const down = services.filter((s) => index.serviceState.get(s.id)?.down).length;

  return (
    <div className="panel">
      <div className="panel-h">
        <h2>Clinical services</h2>
        <span className="eyebrow ml-auto">{down ? `${down} of ${services.length} down` : "running"}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 p-3">
        {services.map((svc) => {
          const st = index.serviceState.get(svc.id);
          const isDown = !!st?.down;
          return (
            <div
              key={svc.id}
              title={isDown ? svc.consequence : undefined}
              className={`flex min-w-0 items-center gap-2.5 rounded-[9px] border p-2.5 ${
                isDown ? "border-line2 bg-panel2" : "border-line bg-panel2/50"
              }`}
            >
              <span
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg font-disp text-[11px] font-bold ${
                  isDown ? "bg-ink text-bg" : "bg-line text-ink-muted"
                }`}
                aria-hidden
              >
                {initials(svc.name)}
              </span>
              <div className="min-w-0">
                <b className={`block truncate text-[12.5px] font-semibold leading-tight ${isDown ? "text-ink" : "text-ink-muted"}`}>
                  {svc.name}
                </b>
                <span className={`num text-[10px] font-bold uppercase tracking-[0.08em] ${isDown ? "text-ink" : "text-ink-faint"}`}>
                  {isDown ? `Down · ${tickClock(st?.downSinceTick ?? 0)}` : "Running"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}
