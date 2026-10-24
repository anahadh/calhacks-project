"use client";

import { tickClock } from "@/lib/format";
import type { SessionSnapshot } from "@/lib/stdb/types";

// Playback controls and scrubber. History comes from tick_snapshot rows.
// Controls are inert until the run reducers exist.
const SPAN_TICKS = 48; // 12 simulated hours

export function Timeline({ session }: { session: SessionSnapshot }) {
  const run = session.runs.find((r) => r.id === session.activeRunId)!;
  const maxInfected = Math.max(1, session.hospital.devices.length);
  const pct = (tick: number) => `${(tick / SPAN_TICKS) * 100}%`;
  const markers = session.events.filter((e) => e.kind === "service_down" || e.kind === "diversion");

  return (
    <footer className="flex h-16 items-center gap-5 border-t border-line px-5">
      <div className="flex items-center gap-1">
        <IconButton label={run.status === "running" ? "Pause" : "Play"}>
          {run.status === "running" ? (
            <path d="M5 3.5v9M11 3.5v9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          ) : (
            <path d="M5 3l8 5-8 5z" fill="currentColor" />
          )}
        </IconButton>
        <IconButton label="Step">
          <path d="M4 3l6 5-6 5z M12 3v10" fill="currentColor" stroke="currentColor" strokeWidth="1.4" />
        </IconButton>
        <IconButton label="Reset">
          <path d="M3.5 8a4.5 4.5 0 1 0 1.3-3.2M3.5 2.5v2.8h2.8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </IconButton>
      </div>

      <div className="flex rounded-md border border-line p-0.5 text-xs">
        {[0.5, 1, 2, 4].map((s) => (
          <span key={s} className={`num rounded px-1.5 py-0.5 ${s === run.speed ? "bg-raised text-ink" : "text-ink-faint"}`}>
            {s}×
          </span>
        ))}
      </div>

      {/* Scrubber: heat strip of infected count, event markers, playhead */}
      <div className="relative h-8 flex-1">
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-line" />
        <div className="absolute inset-x-0 bottom-0 flex h-3 items-end">
          {session.snapshots.map((s) => (
            <span
              key={s.tick}
              className="block h-full bg-state-infected"
              style={{ width: pct(1), opacity: 0.15 + (s.infectedCount / maxInfected) * 0.85 }}
            />
          ))}
        </div>
        {markers.map((e, i) => (
          <span
            key={i}
            title={`${tickClock(e.tick)} · ${e.text}`}
            className="absolute top-0 h-2.5 w-px bg-ink-muted"
            style={{ left: pct(e.tick + 0.5) }}
          />
        ))}
        <span
          className="absolute top-0 h-full w-0.5 -translate-x-1/2 rounded bg-ink"
          style={{ left: pct(run.tick + 1) }}
          aria-label={`Tick ${run.tick}`}
        />
      </div>

      <span className="num w-24 text-right text-xs text-ink-faint">
        {tickClock(run.tick)} / {tickClock(SPAN_TICKS)}
      </span>
    </footer>
  );
}

function IconButton({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <button aria-label={label} title={label} className="flex h-8 w-8 items-center justify-center rounded-md text-ink-muted hover:bg-raised hover:text-ink">
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
        {children}
      </svg>
    </button>
  );
}
