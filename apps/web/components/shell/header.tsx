"use client";

import { Brand } from "@/components/shell/brand";
import { InviteButton } from "@/features/review/invite";
import { Presence } from "@/components/timeline";
import type { SessionSnapshot } from "@/lib/stdb/types";

export type ViewId = "simulation" | "agents";

const TABS: { id: ViewId; key: string; label: string }[] = [
  { id: "simulation", key: "1", label: "Simulation" },
  { id: "agents", key: "2", label: "Agents" },
];

// Logo, hospital, and on the right the two views (keys 1 and 2) and Invite.
// Presence sits beside Invite: it shows who is here on both views, before any run.
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
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg">
      <div className="flex min-h-[72px] flex-wrap items-center gap-x-5 gap-y-3 px-6 py-2 md:px-8">
        <Brand />
        <span aria-hidden className="h-7 w-px bg-line2" />
        <span className="min-w-0 truncate text-[20px] leading-6 text-ink">{session.hospital.name}</span>

        <nav className="ml-auto flex gap-0.5 rounded-ctl border border-line2 p-[3px]" role="tablist" aria-label="Views">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={view === t.id}
              onClick={() => onView(t.id)}
              className={`num h-9 rounded-[1px] px-3 text-xs transition-colors duration-fade ${
                view === t.id ? "bg-select font-medium text-select-on" : "text-ink-muted hover:text-ink"
              }`}
            >
              <span className="mr-1.5 opacity-60">{t.key}</span>
              {t.label}
            </button>
          ))}
        </nav>
        {session.source === "live" && session.presence.length > 0 && <Presence session={session} />}
        {session.source === "live" && <InviteButton sessionId={sessionId} />}
      </div>
    </header>
  );
}
