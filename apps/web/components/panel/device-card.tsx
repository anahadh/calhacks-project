"use client";

import { RoleBadge } from "@/features/review/role-badge";
import { ROLE_SHORT, type RoleView } from "@/lib/role-views";
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
 * The hovered device, shown over the scene. Kept short for the demo: name and
 * state, one line of type and room, then the few lines the caller's role sees
 * (at most three, from spacetime/src/role_views.ts), and the latest focus pin.
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
  const kind = d.role && ROLE[d.role] ? ROLE[d.role] : TYPE_LABEL[d.type] ?? d.type;
  const lines = view.cards.get(deviceId)?.lines ?? [];
  const pins = session.annotations.filter((a) => a.active && a.kind === "focus" && a.targetId === deviceId);
  const pin = pins[pins.length - 1];

  return (
    <div role="tooltip" className="flex w-[272px] flex-col gap-2 rounded-ctl border border-line2 bg-panel2 p-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[15px] font-medium leading-5">{d.name}</span>
        <span className={`eyebrow inline-flex shrink-0 items-center gap-1 ${stateClass}`}>
          <span aria-hidden>{glyph}</span>
          {state}
        </span>
      </div>
      <div className="num flex items-center justify-between gap-3 text-[11px] text-ink-muted">
        <span className="truncate">
          {kind} · {index.room.get(d.roomId)?.name ?? d.roomId}
        </span>
        {view.role !== "observer" && <RoleBadge role={view.role} />}
      </div>
      {lines.length > 0 && (
        <dl className="num m-0 flex flex-col gap-1 border-t border-line pt-2 text-xs leading-4">
          {lines.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3">
              <dt className="shrink-0 text-ink-muted">{k}</dt>
              <dd className="m-0 truncate text-right" title={v}>{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {pin && (
        <p className="num m-0 truncate border-t border-line pt-2 text-[11px] text-ink-muted" title={pin.note}>
          Pinned by {pin.authorName} ({ROLE_SHORT[pin.role]}){pin.note ? `: ${pin.note}` : ""}
          {pins.length > 1 && ` +${pins.length - 1}`}
        </p>
      )}
    </div>
  );
}
