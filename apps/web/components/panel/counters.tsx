"use client";

import type { SessionSnapshot } from "@/lib/stdb/types";

// The template's counter strip. Patients affected is first and largest. Every
// value is the active run row's column, copied (never summed in the browser).
export function Counters({ session }: { session: SessionSnapshot }) {
  const { hospital, totals } = session;
  const patients = hospital.patients.reduce((a, g) => a + g.count, 0);

  const items = [
    { label: "Patients affected", value: totals.patientsAffected, of: patients, bar: "bg-state-disrupted", large: true },
    { label: "Devices compromised", value: totals.devicesCompromised, of: hospital.devices.length, bar: "bg-state-infected" },
    { label: "Services down", value: totals.servicesDown, of: hospital.services.length, bar: "bg-ink-muted" },
    { label: "Delayed procedures", value: totals.delayedProcedures },
  ];

  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-panel border border-line bg-line md:grid-cols-4">
      {items.map((it) => (
        <div key={it.label} className="min-w-0 bg-panel px-4 py-3">
          <div className="eyebrow !tracking-[0.1em]">{it.label}</div>
          <div className={`mt-1 font-disp font-semibold leading-none tabular-nums ${it.large ? "text-[34px]" : "text-[26px]"}`}>
            {it.value}
            {it.of !== undefined && <small className="ml-1 text-[13px] font-medium text-ink-muted">/ {it.of}</small>}
          </div>
          <div className="mt-2 h-[3px] overflow-hidden rounded-sm bg-line2">
            {it.of !== undefined && it.bar && (
              <i className={`block h-full rounded-sm ${it.bar}`} style={{ width: `${it.of ? Math.min(100, (it.value / it.of) * 100) : 0}%` }} />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
