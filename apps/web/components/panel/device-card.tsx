"use client";

import { CARD_FIELDS } from "../../../../spacetime/src/role_views";
import { RoleBadge } from "@/features/review/role-badge";
import { FIELD_LABEL, ROLE_SHORT, type RoleView } from "@/lib/role-views";
import type { SessionIndex } from "@/lib/stdb/use-session";
import type { SessionSnapshot } from "@/lib/stdb/types";

const TYPE_LABEL: Record<string, string> = {
  mri: "MRI", ct: "CT scanner", workstation: "Workstation", nurse_station: "Nurse station",
  patient_monitor: "Patient monitor", infusion_pump: "Infusion pump", server_rack: "Server rack",
  pharmacy_cabinet: "Dispensing cabinet", lab_analyzer: "Lab analyzer",
  anesthesia_machine: "Anesthesia machine", badge_reader: "Badge reader", hvac: "HVAC controller", unknown: "Unidentified",
};
const ROLE: Record<string, string> = { pacs: "PACS", ehr_engine: "EHR engine", file_server: "File server", domain_controller: "Domain controller" };

/**
 * The hovered device's record, shown over the scene. Everyone sees name, type,
 * room, state and the services that depend on it; the rest comes from the
 * caller's role view (spacetime/src/role_views.ts).
 */
export function DeviceCard({
  session, index, deviceId, view,
}: { session: SessionSnapshot; index: SessionIndex; deviceId: string; view: RoleView }) {
  const d = index.device.get(deviceId);
  if (!d) return null;
  const st = index.deviceState.get(deviceId);
  const zero = session.runs.find((r) => r.id === session.activeRunId)?.patientZero === deviceId && !!st?.infected;
  const state = zero ? "Patient zero" : st?.infected ? "Infected" : "Healthy";
  const glyph = zero ? "◉" : st?.infected ? "●" : "○";
  const stateClass = zero ? "text-state-zero" : st?.infected ? "text-state-infected" : "text-state-healthy";
  const card = view.cards.get(deviceId);
  const services = card?.services
    ?? session.hospital.services.filter((s) => s.dependsOnDevices.includes(deviceId)).map((s) => s.name).join(", ");
  const pins = session.annotations.filter((a) => a.kind === "focus" && a.active && a.targetId === deviceId);

  const rows: [string, string][] = [
    ["Type", `${TYPE_LABEL[d.type] ?? d.type}${d.role && ROLE[d.role] ? ` · ${ROLE[d.role]}` : ""}`],
    ["Room", index.room.get(d.roomId)?.name ?? d.roomId],
    ["Services", services || "None"],
    ...(card ? CARD_FIELDS[view.role].filter((f) => card[f]).map((f) => [FIELD_LABEL[f], card[f]] as [string, string]) : []),
  ];

  return (
    <div role="tooltip" className="flex w-[300px] flex-col gap-2.5 rounded-ctl border border-line2 bg-panel2 p-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[15px] font-medium leading-5">{d.name}</span>
        <span className={`eyebrow inline-flex items-center gap-1 ${stateClass}`}>
          <span aria-hidden>{glyph}</span>
          {state}
        </span>
      </div>
      <dl className="num m-0 flex flex-col gap-1.5 text-xs leading-4">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3">
            <dt className="shrink-0 text-ink-muted">{k}</dt>
            <dd className="m-0 whitespace-pre-line text-right">{v}</dd>
          </div>
        ))}
      </dl>
      {pins.length > 0 && (
        <ul className="num m-0 flex list-none flex-col gap-1 border-t border-line p-0 pt-2 text-[11px] leading-4">
          {pins.map((p) => (
            <li key={p.id} className="flex flex-wrap items-baseline gap-1.5">
              <span className="text-ink-muted">Pinned by {p.authorName}</span>
              <RoleBadge role={p.role} />
              {p.note && <span className="w-full text-ink">{p.note}</span>}
            </li>
          ))}
        </ul>
      )}
      <span className="num text-[10px] text-ink-faint">Your view: {ROLE_SHORT[view.role]}</span>
    </div>
  );
}
