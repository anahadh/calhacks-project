"use client";

import { PATIENT_STATE, PatientBadge } from "@/components/shell/badges";
import type { SessionIndex } from "@/lib/stdb/use-session";
import type { PatientStateValue, SessionSnapshot } from "@/lib/stdb/types";

// Patients affected leads; devices compromised is second (UX rule 1). The
// headline numbers are the run row's columns, copied from the engine's frame;
// only the split by state groups the patient_state rows.
export function ImpactPanel({ session, index }: { session: SessionSnapshot; index: SessionIndex }) {
  const { hospital, totals } = session;
  const byState: Record<PatientStateValue, number> = { ok: 0, delayed: 0, disrupted: 0, diverted: 0 };
  for (const g of hospital.patients) byState[index.patientState.get(g.id) ?? "ok"] += g.count;
  const total = hospital.patients.reduce((a, g) => a + g.count, 0);
  const devices = hospital.devices.length || 1;

  return (
    <div className="panel">
      <div className="panel-h">
        <h2>Patients affected</h2>
        <span className="eyebrow ml-auto">of {total} in the building</span>
      </div>
      <div className="p-3.5">
        <div className="font-disp text-[44px] font-bold leading-none tracking-[-0.02em] tabular-nums">{totals.patientsAffected}</div>

        <div className="mt-3.5 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-line bg-line">
          {(["delayed", "disrupted", "diverted"] as const).map((st) => (
            <div key={st} className="bg-panel2 px-3 py-2">
              <div className="flex items-center gap-1.5 text-[11px] text-ink-muted">
                <PatientBadge state={st} />
                {PATIENT_STATE[st].label}
              </div>
              <div className="mt-0.5 font-disp text-lg font-semibold tabular-nums">{byState[st]}</div>
            </div>
          ))}
        </div>

        <div className="mt-3.5 grid grid-cols-2 gap-4 border-t border-line pt-3">
          <div>
            <div className="eyebrow !tracking-[0.1em]">Devices compromised</div>
            <div className="mt-1 font-disp text-2xl font-semibold tabular-nums">
              {totals.devicesCompromised} <small className="text-[13px] font-medium text-ink-muted">/ {hospital.devices.length}</small>
            </div>
            <div className="mt-2 h-[3px] overflow-hidden rounded-sm bg-line2">
              <i
                className="block h-full rounded-sm bg-state-infected"
                style={{ width: `${Math.min(100, (totals.devicesCompromised / devices) * 100)}%` }}
              />
            </div>
          </div>
          <div>
            <div className="eyebrow !tracking-[0.1em]">Delayed procedures</div>
            <div className="mt-1 font-disp text-2xl font-semibold tabular-nums">{totals.delayedProcedures}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
