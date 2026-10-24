"use client";

import { SidePanel } from "@/components/panel/side-panel";
import { HospitalScene } from "@/components/scene/hospital-scene";
import { SessionHeader } from "@/components/shell/header";
import { Timeline } from "@/components/timeline";
import { useSession, useSessionIndex } from "@/lib/stdb/use-session";

export function SessionView({ sessionId }: { sessionId: string }) {
  const session = useSession(sessionId);
  const index = useSessionIndex(session);

  return (
    <div className="grid h-screen grid-rows-[auto_1fr_auto] overflow-hidden">
      <SessionHeader session={session} index={index} />

      <main className="grid min-h-0 grid-cols-[minmax(0,65fr)_minmax(360px,35fr)]">
        <div className="relative min-h-0 overflow-hidden">
          <HospitalScene session={session} index={index} />
          <SceneLegend />
        </div>
        <SidePanel session={session} index={index} />
      </main>

      <Timeline session={session} index={index} />
    </div>
  );
}

function SceneLegend() {
  return (
    <div className="pointer-events-none absolute bottom-4 left-5 flex items-center gap-4 text-[11px] text-ink-faint">
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm bg-state-healthy" /> Healthy
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm bg-state-infected" /> Infected
      </span>
      <span>Hover a device to see its connections</span>
    </div>
  );
}
