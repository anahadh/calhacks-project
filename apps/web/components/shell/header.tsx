"use client";

import { InviteButton } from "@/features/review/invite";
import type { SessionSnapshot } from "@/lib/stdb/types";

export type ViewId = "simulation" | "agents";

const TABS: { id: ViewId; key: string; label: string }[] = [
  { id: "simulation", key: "1", label: "Simulation" },
  { id: "agents", key: "2", label: "Agents" },
];

export function SessionHeader({
  sessionId,
  session,
  view,
  onView,
}: {
  sessionId: string;
  session: SessionSnapshot;
  view: ViewId;
  onView: (v: ViewId) => void;
}) {
  const { hospital } = session;
  const spreading = session.devices.some((d) => d.infected);

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-4 px-4 py-[11px] md:px-6">
        <div className="flex min-w-0 items-center gap-[11px]">
          <span
            className={`h-[11px] w-[11px] shrink-0 rounded-full ${spreading ? "bg-state-infected" : "bg-state-healthy"}`}
            aria-hidden
          />
          <b className="truncate font-disp text-[15px]">{hospital.name}</b>
          <span className="num hidden whitespace-nowrap text-[10.5px] uppercase text-ink-faint sm:inline">
            {hospital.floors.length} floors · {hospital.devices.length} devices · synthetic
          </span>
        </div>

        <nav className="ml-auto flex gap-1" role="tablist" aria-label="Views">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={view === t.id}
              onClick={() => onView(t.id)}
              className={`num rounded-md px-3 py-1.5 text-[12px] transition ${
                view === t.id ? "bg-accent font-semibold text-bg" : "text-ink-muted hover:text-ink"
              }`}
            >
              <span className="mr-1.5 text-[10px] opacity-60">{t.key}</span>
              {t.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <div className="flex -space-x-1.5">
            {session.presence.map((p, i) => (
              <span
                key={`${p.name}-${i}`}
                title={p.name}
                className="grid h-7 w-7 place-items-center rounded-full border-2 border-bg bg-panel2 font-disp text-[11px] font-bold text-ink-muted"
              >
                {p.name[0]}
              </span>
            ))}
          </div>
          {session.source === "live" && <InviteButton sessionId={sessionId} />}
          <button className="num rounded-md border border-line px-2.5 py-1 text-[11px] text-ink-muted hover:border-line2 hover:text-ink">
            Log
          </button>
        </div>
      </div>
    </header>
  );
}
