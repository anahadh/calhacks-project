"use client";

import { tickClock } from "@/lib/format";
import type { SessionIndex } from "@/lib/stdb/use-session";
import type { DeviceType, SessionSnapshot } from "@/lib/stdb/types";

// The simulation's side column, from the selected run's rows: devices
// infected with services offline under it, then what is down and who
// depends on it, newest first. Counting and lookup only.

export function SpreadStats({ session, index }: { session: SessionSnapshot; index: SessionIndex }) {
  const total = session.hospital.devices.length;
  const infected = session.devices.filter((d) => d.infected).length;
  const share = total ? Math.round((infected / total) * 100) : 0;
  const services = session.hospital.services;
  const down = services.filter((s) => index.serviceState.get(s.id)?.down);

  return (
    <div className="panel flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-3">
        <span className="eyebrow">Devices infected</span>
        <div className="flex items-baseline gap-2 tabular-nums">
          <span className="readout text-readout-l">{infected}</span>
          <span className="readout text-readout-m text-ink-muted">/ {total}</span>
          <span className="num ml-auto text-xs text-ink-muted">{share}%</span>
        </div>
        <div
          role="progressbar"
          aria-label="Devices infected"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={infected}
          className="relative h-2.5 overflow-hidden rounded-[1px] bg-panel2"
        >
          <span
            className="absolute inset-y-0 left-0 bg-state-infected transition-[width] duration-fade ease-breath"
            style={{ width: `${share}%` }}
          />
        </div>
      </div>
      <div className="flex items-center gap-3 border-t border-line pt-3">
        <span className="eyebrow flex-auto">Services offline</span>
        <span className="num text-xs tabular-nums">
          {down.length} / {services.length}
        </span>
        <span aria-hidden className="flex gap-0.5">
          {services.map((s) => (
            <span
              key={s.id}
              className={`h-2 w-2 rounded-[1px] ${index.serviceState.get(s.id)?.down ? "bg-state-infected" : "bg-line2"}`}
            />
          ))}
        </span>
      </div>
    </div>
  );
}

const TYPE_PLURAL: Partial<Record<DeviceType, string>> = {
  mri: "MRI scanners", ct: "CT scanners", workstation: "Workstations", patient_monitor: "Monitors",
  infusion_pump: "Pumps", server_rack: "Servers", lab_analyzer: "Lab devices", nurse_station: "Nurse stations",
};

type Item = { key: string; tick: number; title: string; what: string; chip?: { label: string; infected: number; total: number } };

export function SystemsDown({ session, index }: { session: SessionSnapshot; index: SessionIndex }) {
  const { hospital } = session;
  const run = session.runs.find((r) => r.id === session.activeRunId);
  const items: Item[] = [];

  for (const svc of hospital.services) {
    const st = index.serviceState.get(svc.id);
    if (!st?.down) continue;
    const devices = svc.dependsOnDevices.map((id) => index.device.get(id)!).filter(Boolean);
    const types = new Set(devices.map((d) => d.type));
    const rooms = new Set(devices.map((d) => d.roomId));
    const label =
      devices.length === 1 ? devices[0].name
      : types.size === 1 ? TYPE_PLURAL[devices[0].type] ?? `${devices.length} devices`
      : rooms.size === 1 ? index.room.get(devices[0].roomId)?.name ?? `${devices.length} devices`
      : `${devices.length} devices`;
    const groups = hospital.patients.filter((g) => g.dependsOnServices.includes(svc.id));
    const people = groups.reduce((n, g) => n + g.count, 0);
    const where = [...new Set(groups.map((g) => index.room.get(g.roomId)?.name).filter(Boolean))] as string[];
    items.push({
      key: svc.id,
      tick: st.downSinceTick ?? 0,
      title: `${svc.name} offline`,
      what: people ? `${svc.consequence}. ${people} patients ${where.length ? `in ${list(where)} ` : ""}depend on it.` : `${svc.consequence}.`,
      chip: { label, infected: devices.filter((d) => index.deviceState.get(d.id)?.infected).length, total: devices.length },
    });
  }
  for (const e of session.events) {
    if (e.kind !== "diversion") continue;
    items.push({ key: `div_${e.tick}_${e.targetId}`, tick: e.tick, title: e.text, what: "Arriving ambulances are sent to other hospitals." });
  }
  items.sort((a, b) => b.tick - a.tick);

  return (
    <section aria-labelledby="systems-down" className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="systems-down" className="m-0 text-[15px] font-medium leading-5">Relevant systems down</h2>
        {items.length > 1 && <span className="num text-xs text-ink-faint">Newest first</span>}
      </div>
      {items.length === 0 ? (
        <p className="m-0 rounded-panel border border-dashed border-line px-4 py-5 text-sm text-ink-muted">
          {run ? "Every clinical service is still running." : "Nothing is down. Start a run to see what the attack takes offline."}
        </p>
      ) : (
        <ol className="m-0 flex list-none flex-col gap-2 p-0">
          {items.map((it) => (
            <li
              key={it.key}
              className={`flex flex-col gap-3 rounded-panel border bg-panel p-4 ${it.tick === run?.tick ? "border-line2" : "border-line"}`}
            >
              <div className="num flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs">
                <span className="text-ink-faint">{tickClock(it.tick)}</span>
                {it.chip && (
                  <span className="inline-flex items-center gap-1.5 rounded-ctl border border-state-infected/45 px-2 py-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-state-infected" />
                    {it.chip.label}{" "}
                    <span className="text-state-infected">
                      {it.chip.infected}/{it.chip.total}
                    </span>
                  </span>
                )}
              </div>
              <div className="flex items-start gap-2.5">
                <svg width="16" height="20" viewBox="0 0 16 20" aria-hidden className="flex-none text-ink-muted">
                  <path d="M8 3.5v6M4.6 6.2a5 5 0 1 0 6.8 0" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="text-[15px] font-medium leading-5">{it.title}</span>
                  <span className="text-sm leading-[21px] text-ink-muted">{it.what}</span>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function list(xs: string[]) {
  return xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
}
