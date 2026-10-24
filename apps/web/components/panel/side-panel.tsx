"use client";

import { useState } from "react";
import type { SessionIndex } from "@/lib/stdb/use-session";
import type { SessionSnapshot } from "@/lib/stdb/types";
import { Dashboard } from "./dashboard";

const TABS = [
  { id: "damage", label: "Damage" },
  { id: "agents", label: "Agents" },
  { id: "recommendations", label: "Recommendations" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function SidePanel({ session, index }: { session: SessionSnapshot; index: SessionIndex }) {
  const [tab, setTab] = useState<TabId>("damage");

  return (
    <aside className="flex h-full min-h-0 flex-col border-l border-line bg-bg">
      <nav className="flex gap-6 border-b border-line px-6" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 py-3.5 text-sm transition-colors ${
              tab === t.id ? "border-ink text-ink" : "border-transparent text-ink-faint hover:text-ink-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="min-h-0 flex-1">
        {tab === "damage" && <Dashboard session={session} index={index} />}
        {/* The Agent Room (F1) and recommendation cards (F2) mount here. */}
        {tab === "agents" && (
          <Placeholder title="No round yet" body="Press Defend to start a round. The agents' conversation appears here as it happens." />
        )}
        {tab === "recommendations" && (
          <Placeholder title="No recommendations yet" body="When a round finishes, up to three recommendations appear here for review." />
        )}
      </div>
    </aside>
  );
}

function Placeholder({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-10 text-center">
      <div className="text-sm text-ink">{title}</div>
      <p className="mt-2 max-w-[280px] text-[13px] leading-relaxed text-ink-faint">{body}</p>
    </div>
  );
}
