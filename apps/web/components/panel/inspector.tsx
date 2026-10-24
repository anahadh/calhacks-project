"use client";

import { tickClock } from "@/lib/format";
import type { SessionIndex } from "@/lib/stdb/use-session";
import type { SessionSnapshot } from "@/lib/stdb/types";

const TYPE_LABEL: Record<string, string> = {
  mri: "MRI", ct: "CT", workstation: "Workstation", nurse_station: "Nurse station",
  patient_monitor: "Patient monitor", infusion_pump: "Infusion pump", server_rack: "Server",
  pharmacy_cabinet: "Pharmacy cabinet", lab_analyzer: "Lab analyzer",
  anesthesia_machine: "Anesthesia machine", badge_reader: "Badge reader", hvac: "HVAC", unknown: "Unidentified",
};

export function InspectorPanel({
  session,
  index,
  deviceId,
}: {
  session: SessionSnapshot;
  index: SessionIndex;
  deviceId: string | null;
}) {
  const device = deviceId ? index.device.get(deviceId) : undefined;

  return (
    <div className="panel">
      <div className="panel-h">
        <h2>Inspector</h2>
        {device && <span className="num ml-auto text-[10.5px] text-ink-faint">{device.id}</span>}
      </div>
      <div className="p-3.5">
        {device ? <DeviceRecord session={session} index={index} deviceId={device.id} /> : <Empty session={session} index={index} />}
      </div>
    </div>
  );
}

function DeviceRecord({ session, index, deviceId }: { session: SessionSnapshot; index: SessionIndex; deviceId: string }) {
  const d = index.device.get(deviceId)!;
  const st = index.deviceState.get(deviceId);
  const room = index.room.get(d.roomId);
  const via = st?.infectedBy ? index.device.get(st.infectedBy)?.name : undefined;
  const flows = session.hospital.flows.filter((f) => f.active !== false && (f.from === deviceId || f.to === deviceId));

  return (
    <>
      <div className="flex flex-wrap items-center gap-2.5">
        <h3 className="text-base font-semibold">{d.name}</h3>
        {st?.infected ? (
          <span className="num rounded-full bg-state-infected/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-state-infected">
            Infected
          </span>
        ) : (
          <span className="num rounded-full bg-state-healthy/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-state-healthy">
            Healthy
          </span>
        )}
      </div>
      <div className="num mt-0.5 text-[11px] text-ink-faint">
        {TYPE_LABEL[d.type] ?? d.type} · {room?.name}
      </div>

      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1.5 text-[12.5px]">
        <Row k="Infected">{st?.infected ? `${tickClock(st.infectedAtTick ?? 0)}${via ? ` via ${via}` : " (patient zero)"}` : "No"}</Row>
        <Row k="OS">{d.os}</Row>
        <Row k="VLAN">{d.vlan}</Row>
        <Row k="Criticality">{d.criticality.replace("_", " ")}</Row>
        <Row k="Patched">{d.vulnerable ? "No, unpatched or end-of-life" : "Yes"}</Row>
      </dl>

      <div className="mt-3 border-t border-line pt-2.5">
        <div className="eyebrow !tracking-[0.08em]">Connections</div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {flows.map((f) => {
            const other = index.device.get(f.from === deviceId ? f.to : f.from)?.name;
            return (
              <span
                key={f.id}
                title={f.purpose}
                className="num rounded border border-line2 bg-panel2 px-1.5 py-0.5 text-[10px] text-ink-muted"
              >
                {f.from === deviceId ? "→" : "←"} {other} · {f.protocol}
                {f.protected && <span className="ml-1 text-ink">keep</span>}
              </span>
            );
          })}
        </div>
      </div>
    </>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="num text-[11px] text-ink-faint">{k}</dt>
      <dd className="min-w-0 text-ink">{children}</dd>
    </>
  );
}

function Empty({ session, index }: { session: SessionSnapshot; index: SessionIndex }) {
  return (
    <>
      <p className="num text-[11.5px] leading-relaxed text-ink-faint">Hover a device in the building for its record.</p>
      <div className="mt-3 border-t border-line pt-2.5">
        <div className="eyebrow !tracking-[0.08em]">Choke points · share of downstream infections</div>
        <ul className="mt-2 space-y-2">
          {session.chokePoints.map((c) => (
            <li key={c.deviceId} className="grid grid-cols-[1fr_80px_36px] items-center gap-3 text-[12.5px]">
              <span className="truncate">{index.device.get(c.deviceId)?.name ?? c.deviceId}</span>
              <span className="h-1 overflow-hidden rounded-full bg-line2">
                <span className="block h-full rounded-full bg-ink-muted" style={{ width: `${c.share * 100}%` }} />
              </span>
              <span className="num text-right text-[10.5px] text-ink-muted">{Math.round(c.share * 100)}%</span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
