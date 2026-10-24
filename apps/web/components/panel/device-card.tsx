"use client";

import { tickClock } from "@/lib/format";
import type { SessionIndex } from "@/lib/stdb/use-session";
import type { SessionSnapshot } from "@/lib/stdb/types";

const TYPE_LABEL: Record<string, string> = {
  mri: "MRI", ct: "CT scanner", workstation: "Workstation", nurse_station: "Nurse station",
  patient_monitor: "Patient monitor", infusion_pump: "Infusion pump", server_rack: "Server rack",
  pharmacy_cabinet: "Dispensing cabinet", lab_analyzer: "Lab analyzer",
  anesthesia_machine: "Anesthesia machine", badge_reader: "Badge reader", hvac: "HVAC controller", unknown: "Unidentified",
};
const ROLE: Record<string, string> = { pacs: "PACS", ehr_engine: "EHR engine", file_server: "File server", domain_controller: "Domain controller" };
const OS: Record<string, string> = { windows_7: "Windows 7", linux: "Linux" };
const CRIT: Record<string, string> = { low: "Low", medium: "Medium", high: "High", life_support: "Life support" };

/** The hovered device's record, shown over the scene. */
export function DeviceCard({ session, index, deviceId }: { session: SessionSnapshot; index: SessionIndex; deviceId: string }) {
  const d = index.device.get(deviceId);
  if (!d) return null;
  const st = index.deviceState.get(deviceId);
  const zero = session.runs.find((r) => r.id === session.activeRunId)?.patientZero === deviceId && !!st?.infected;
  const via = st?.infectedBy ? index.device.get(st.infectedBy)?.name : undefined;
  const state = zero ? "Patient zero" : st?.infected ? "Infected" : "Healthy";
  const stateClass = zero ? "text-state-zero" : st?.infected ? "text-state-infected" : "text-state-healthy";

  const rows: [string, string][] = [
    ["Type", TYPE_LABEL[d.type] ?? d.type],
    ...(d.role && ROLE[d.role] ? [["Role", ROLE[d.role]] as [string, string]] : []),
    ["Room", index.room.get(d.roomId)?.name ?? d.roomId],
    ["OS", OS[d.os] ?? d.os],
    ["Known vulnerability", d.vulnerable ? "Yes" : "No"],
    ["Criticality", CRIT[d.criticality] ?? d.criticality],
    ["VLAN", String(d.vlan)],
  ];
  if (st?.infected) rows.push(["Infected at", `${tickClock(st.infectedAtTick ?? 0)}${via ? ` via ${via}` : ""}`]);

  return (
    <div role="tooltip" className="flex w-[248px] flex-col gap-2.5 rounded-ctl border border-line2 bg-panel2 p-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[15px] font-medium leading-5">{d.name}</span>
        <span className={`eyebrow ${stateClass}`}>{state}</span>
      </div>
      <dl className="num m-0 flex flex-col gap-1 text-xs leading-4">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3">
            <dt className="text-ink-muted">{k}</dt>
            <dd className="m-0 text-right">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
