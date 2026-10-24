"use client";

import { ROLE_LABEL, tickClock } from "@/lib/format";
import type { SessionIndex } from "@/lib/stdb/use-session";
import type { SessionSnapshot } from "@/lib/stdb/types";

export function SessionHeader({ session, index }: { session: SessionSnapshot; index: SessionIndex }) {
  const run = session.runs.find((r) => r.id === session.activeRunId)!;
  const patientZero = index.device.get(run.patientZero)?.name ?? run.patientZero;

  return (
    <header className="grid h-16 grid-cols-[1fr_auto_1fr] items-center gap-6 border-b border-line px-5">
      {/* Left: where you are */}
      <div className="flex min-w-0 items-center gap-4">
        <span className="text-sm font-semibold tracking-tight">Hippocra.tech</span>
        <span className="h-4 w-px bg-line" />
        <span className="truncate text-sm text-ink-muted">{session.hospital.name}</span>
        <button className="flex items-center gap-2 rounded-md border border-line px-2.5 py-1 text-[13px] text-ink-muted hover:bg-raised">
          {run.label} · {patientZero}
          <Chevron />
        </button>
      </div>

      {/* Center: the clock */}
      <div className="text-center">
        <div className="num text-lg leading-none">
          {tickClock(run.tick)}
          <span className="ml-2 text-xs text-ink-faint">tick {run.tick}</span>
        </div>
        <div className="mt-1 text-[10px] text-ink-faint">
          Illustrative simulation. Spread rates are not measured from real incidents.
        </div>
      </div>

      {/* Right: session controls */}
      <div className="flex items-center justify-end gap-3">
        <button className="rounded-md px-2.5 py-1 text-[13px] text-ink-muted hover:bg-raised hover:text-ink">
          Change conditions
        </button>
        <div className="flex rounded-md border border-line p-0.5 text-xs">
          <span className="rounded bg-raised px-2 py-0.5 text-ink">3D</span>
          <span className="px-2 py-0.5 text-ink-faint">2D</span>
        </div>
        <div className="flex -space-x-1.5">
          {session.presence.map((p) => (
            <span
              key={p.name}
              title={`${p.name} · ${ROLE_LABEL[p.role]}`}
              className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-bg bg-raised text-[11px] font-medium text-ink-muted"
            >
              {p.name[0]}
            </span>
          ))}
        </div>
        <span className="rounded-full border border-line px-2.5 py-1 text-xs text-ink-muted">
          Following {session.presenterName}
        </span>
        <button className="rounded-md px-2.5 py-1 text-[13px] text-ink-muted hover:bg-raised hover:text-ink">Log</button>
      </div>
    </header>
  );
}

function Chevron() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden className="text-ink-faint">
      <path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}
