"use client";

import { useEffect, useState } from "react";
import { Counters } from "@/components/panel/counters";
import { DeviceCard } from "@/components/panel/device-card";
import { SpreadStats, SystemsDown } from "@/components/panel/spread";
import { HospitalScene } from "@/components/scene/hospital-scene";
import { SceneBoundary } from "@/components/scene/scene-boundary";
import { PatientBadge } from "@/components/shell/badges";
import { SessionHeader, type ViewId } from "@/components/shell/header";
import { Timeline } from "@/components/timeline";
import { AgentRoom } from "@/features/agents/agent-room";
import { defendBlocker } from "@/features/agents/defend-button";
import { QuestionBanner } from "@/features/agents/question-card";
import { JoinModal } from "@/features/review/join-modal";
import { useSession, useSessionIndex } from "@/lib/stdb/use-session";
import type { SessionSnapshot } from "@/lib/stdb/types";

export function SessionView({ sessionId }: { sessionId: string }) {
  const session = useSession(sessionId);
  const index = useSessionIndex(session);
  const [view, setView] = useState<ViewId>("simulation");
  const [hovered, setHovered] = useState<string | null>(null);
  const [floor, setFloor] = useState("all");

  // ?view=agents opens straight onto the Agents tab.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("view") === "agents") setView("agents");
  }, []);

  // 1 and 2 switch views.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "1") setView("simulation");
      if (e.key === "2") setView("agents");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (session.source === "error" || session.source === "missing" || !session.hospital.devices.length) {
    const text =
      session.source === "missing" ? `Session "${sessionId}" doesn't exist.`
      : session.source === "error" ? session.error ?? "Something went wrong."
      : "Connecting to SpacetimeDB…";
    return <div role="status" className="flex h-screen items-center justify-center p-8 text-sm text-ink-muted">{text}</div>;
  }

  const { hospital } = session;
  const deviceCount = (fid: string) => hospital.devices.filter((d) => index.room.get(d.roomId)?.floorId === fid).length;
  const floors = [...hospital.floors].sort((a, b) => b.level - a.level);

  return (
    <div className="flex min-h-screen flex-col">
      <SessionHeader sessionId={sessionId} session={session} view={view} onView={setView} />
      <JoinModal session={session} sessionId={sessionId} />

      <div className="px-4 empty:hidden md:px-6 [&:not(:empty)]:pt-6">
        <QuestionBanner session={session} index={index} />
      </div>

      {view === "simulation" ? (
        <main className="flex flex-grow flex-wrap items-stretch gap-6 p-4 md:p-6">
          <section aria-label="Simulation" className="panel flex min-w-0 flex-[999_1_760px] flex-col overflow-hidden">
            <Timeline session={session} index={index} />

            <div className="flex flex-grow flex-col bg-scene-ground">
              <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 p-4">
                <div className="relative inline-flex">
                  <label htmlFor="floor" className="sr-only">Floor</label>
                  <select
                    id="floor"
                    value={floor}
                    onChange={(e) => {
                      setFloor(e.target.value);
                      setHovered(null);
                    }}
                    className="num h-11 cursor-pointer appearance-none rounded-ctl border border-line2 bg-panel2 pl-3 pr-9 text-xs text-ink"
                  >
                    <option value="all">All floors · {hospital.devices.length} devices</option>
                    {floors.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} · {deviceCount(f.id)} devices
                      </option>
                    ))}
                  </select>
                  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted">
                    <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <Legend />
              </div>

              <div className="relative min-h-[620px] flex-1">
                <SceneBoundary session={session}>
                  <HospitalScene
                    session={session}
                    index={index}
                    hovered={hovered}
                    onHover={setHovered}
                    floorId={floor === "all" ? undefined : floor}
                  />
                </SceneBoundary>
                {hovered && (
                  <div className="pointer-events-none absolute right-4 top-4 z-10">
                    <DeviceCard session={session} index={index} deviceId={hovered} />
                  </div>
                )}
                {!session.activeRun && <StartAttack session={session} />}
                <span className="num pointer-events-none absolute bottom-3 left-4 text-[11px] text-ink-faint">
                  Drag to rotate · scroll to zoom · hover a device
                </span>
              </div>
            </div>
          </section>

          <aside aria-label="Infection statistics" className="flex min-w-0 flex-[1_1_380px] flex-col gap-4">
            <SpreadStats session={session} index={index} />
            <SystemsDown session={session} index={index} />
            <PlanButton session={session} onAgents={() => setView("agents")} />
          </aside>
        </main>
      ) : (
        <main className="flex-grow space-y-3.5 p-4 md:p-6">
          <Counters session={session} />
          <AgentRoom session={session} index={index} />
        </main>
      )}

      <footer className="num mt-auto border-t border-line px-4 py-3 text-[11px] text-ink-faint md:px-6">
        Synthetic data · illustrative simulation · humans approve every plan.
      </footer>
    </div>
  );
}

/**
 * Create segmentation plan: writes defend_request and opens the Agents view.
 * Disabled while the run is running (spec 7.4); the agents never start on their own.
 */
function PlanButton({ session, onAgents }: { session: SessionSnapshot; onAgents: () => void }) {
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const blocker = defendBlocker(session);
  const round = session.roundState.state;
  const negotiating = round === "running" || round === "waiting_for_human";

  const press = async () => {
    if (negotiating) return onAgents();
    setError(undefined);
    setBusy(true);
    try {
      await session.actions.defend();
      onAgents();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-auto flex flex-col gap-2">
      <button
        type="button"
        onClick={press}
        disabled={(!!blocker && !negotiating) || busy}
        className="num inline-flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-ctl bg-state-infected text-[13px] font-medium text-bg transition-[filter] duration-fade enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:border disabled:border-line2 disabled:bg-transparent disabled:text-ink-faint"
      >
        {negotiating ? "Watch the agents negotiate" : busy ? "Starting…" : "Create segmentation plan"}
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
          <path d="M3 8h10M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {(error || (blocker && !negotiating)) && <p className="num m-0 text-xs leading-snug text-ink-faint">{error ?? blocker}</p>}
    </div>
  );
}

/** Before any run: the presenter starts the attack. This is the entry to the core loop. */
function StartAttack({ session }: { session: SessionSnapshot }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const pz = session.entryPoints.includes("mri_2") ? "mri_2" : session.entryPoints[0];

  if (!session.isPresenter) {
    return (
      <div className="absolute inset-0 z-10 flex items-center justify-center">
        <span className="num rounded-ctl bg-panel2/90 px-4 py-2 text-xs text-ink-muted">
          Waiting for {session.presenterName || "the presenter"} to start the attack…
        </span>
      </div>
    );
  }
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2">
      <button
        type="button"
        disabled={busy || !pz}
        onClick={async () => {
          setError(undefined);
          setBusy(true);
          try {
            await session.actions.startRun(pz);
          } catch (e) {
            setError((e as Error).message);
            setBusy(false);
          }
        }}
        className="num inline-flex min-h-[52px] items-center gap-2.5 rounded-ctl bg-state-infected px-6 text-[14px] font-medium text-bg transition-[filter] enabled:hover:brightness-110 disabled:opacity-50"
      >
        {busy ? "Starting…" : "Start attack"}
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
          <path d="M3 8h10M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {error && <span className="num text-xs text-ink-faint">{error}</span>}
    </div>
  );
}

function Legend() {
  return (
    <ul className="num m-0 flex list-none flex-wrap gap-x-5 gap-y-2 p-0 text-xs leading-4 text-ink-muted">
      <li className="inline-flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-state-healthy" />
        Healthy
      </li>
      <li className="inline-flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-state-zero shadow-[0_0_0_2px_#111315,0_0_0_3px_#E9ECEE]" />
        Patient zero
      </li>
      <li className="inline-flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-state-infected" />
        Infected
      </li>
      <li className="inline-flex items-center gap-2">
        <svg width="22" height="8" viewBox="0 0 22 8" aria-hidden>
          <path d="M1 7Q11 -1 19 5" fill="none" stroke="#FF6A2E" strokeWidth="1.5" />
          <path d="M21 6.5 17 6.8 18.6 3.3z" fill="#FF6A2E" />
        </svg>
        Infection path
      </li>
      <li className="inline-flex items-center gap-2">
        <PatientBadge state="delayed" /> Delayed
      </li>
      <li className="inline-flex items-center gap-2">
        <PatientBadge state="disrupted" /> Disrupted
      </li>
    </ul>
  );
}
