"use client";

import { PATIENT_STATE, PatientBadge } from "@/components/shell/badges";
import { tickClock } from "@/lib/format";
import type { SessionIndex } from "@/lib/stdb/use-session";
import type { PatientStateValue, SessionSnapshot } from "@/lib/stdb/types";

// The Damage tab. Patients affected leads, devices compromised is second
// (UX rule 1). Every number here is read from subscribed rows.
export function Dashboard({ session, index }: { session: SessionSnapshot; index: SessionIndex }) {
  const { hospital } = session;

  const byState: Record<PatientStateValue, number> = { ok: 0, delayed: 0, disrupted: 0, diverted: 0 };
  for (const g of hospital.patients) byState[index.patientState.get(g.id) ?? "ok"] += g.count;
  const totalPatients = hospital.patients.reduce((a, g) => a + g.count, 0);
  const affected = byState.delayed + byState.disrupted + byState.diverted;

  const infected = session.devices.filter((d) => d.infected).length;
  const servicesDown = session.services
    .filter((s) => s.down)
    .map((s) => ({ row: s, svc: index.service.get(s.serviceId)! }))
    .sort((a, b) => (a.row.downSinceTick ?? 0) - (b.row.downSinceTick ?? 0));
  const events = [...session.events].reverse();

  return (
    <div className="flex h-full flex-col">
      <div className="scroll-quiet flex-1 overflow-y-auto px-6 pb-6">
        {/* Headline */}
        <section className="pt-6">
          <div className="text-[13px] text-ink-muted">Patients affected</div>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="num text-[56px] font-medium leading-none tracking-tight">{affected}</span>
            <span className="num text-sm text-ink-faint">of {totalPatients}</span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {(["delayed", "disrupted", "diverted"] as const).map((st) => (
              <div key={st} className="rounded-lg bg-surface px-3 py-2.5">
                <div className="flex items-center gap-1.5 text-xs text-ink-muted">
                  <PatientBadge state={st} />
                  {PATIENT_STATE[st].label}
                </div>
                <div className="num mt-1 text-xl">{byState[st]}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Secondary numbers */}
        <section className="mt-6 grid grid-cols-3 gap-x-4 border-t border-line pt-5">
          <Stat label="Devices compromised" value={infected} of={hospital.devices.length} large />
          <Stat label="Services down" value={servicesDown.length} of={hospital.services.length} />
          <Stat label="Delayed procedures" value={session.delayedProcedures} />
        </section>

        {/* Services down */}
        <Section title="Services down">
          {servicesDown.length === 0 ? (
            <Empty>All services running.</Empty>
          ) : (
            <ul className="space-y-3">
              {servicesDown.map(({ row, svc }) => (
                <li key={svc.id} className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm">
                      {svc.name}
                      {svc.critical && <span className="ml-2 text-[11px] text-ink-faint">Critical</span>}
                    </div>
                    <div className="mt-0.5 text-[13px] text-ink-muted">{svc.consequence}</div>
                  </div>
                  <span className="num shrink-0 pt-0.5 text-xs text-ink-faint">since {tickClock(row.downSinceTick ?? 0)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Choke points */}
        <Section title="Choke points" hint="Share of downstream infections">
          <ul className="space-y-2.5">
            {session.chokePoints.map((c) => (
              <li key={c.deviceId} className="grid grid-cols-[1fr_96px_40px] items-center gap-3 text-sm">
                <span className="truncate">{index.device.get(c.deviceId)?.name ?? c.deviceId}</span>
                <span className="h-1.5 overflow-hidden rounded-full bg-raised">
                  <span className="block h-full rounded-full bg-ink-muted" style={{ width: `${c.share * 100}%` }} />
                </span>
                <span className="num text-right text-xs text-ink-muted">{Math.round(c.share * 100)}%</span>
              </li>
            ))}
          </ul>
        </Section>

        {/* Event feed */}
        <Section title="Events">
          <ol className="space-y-2">
            {events.map((e, i) => (
              <li key={`${e.tick}-${e.targetId}-${i}`} className="grid grid-cols-[44px_1fr] gap-2 text-[13px]">
                <span className="num pt-px text-xs text-ink-faint">{tickClock(e.tick)}</span>
                <span className={i === 0 ? "text-ink" : "text-ink-muted"}>{e.text}</span>
              </li>
            ))}
          </ol>
        </Section>
      </div>

      {/* Actions. Neutral chrome: state colors are for the building only. */}
      <div className="flex gap-2 border-t border-line px-6 py-4">
        <button className="h-10 flex-1 rounded-lg border border-line text-sm text-ink hover:bg-raised">Run</button>
        <button className="h-10 flex-1 rounded-lg bg-ink text-sm font-medium text-bg hover:bg-white">Defend</button>
      </div>
    </div>
  );
}

function Stat({ label, value, of, large }: { label: string; value: number; of?: number; large?: boolean }) {
  return (
    <div>
      <div className="text-xs leading-snug text-ink-muted">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className={`num ${large ? "text-[28px]" : "text-xl"} leading-none`}>{value}</span>
        {of !== undefined && <span className="num text-xs text-ink-faint">/{of}</span>}
      </div>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 border-t border-line pt-5">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-[13px] font-medium text-ink-muted">{title}</h3>
        {hint && <span className="text-[11px] text-ink-faint">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-[13px] text-ink-faint">{children}</p>;
}
