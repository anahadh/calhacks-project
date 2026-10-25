"use client";

import { useEffect, useRef, useState } from "react";
import { Counters } from "@/components/panel/counters";
import { DeviceCard } from "@/components/panel/device-card";
import { SpreadStats, SystemsDown } from "@/components/panel/spread";
import { HospitalScene } from "@/components/scene/hospital-scene";
import { SceneBoundary } from "@/components/scene/scene-boundary";
import { SolutionView } from "@/features/solution/solution-view";
import { PatientBadge } from "@/components/shell/badges";
import { SessionHeader, type ViewId } from "@/components/shell/header";
import { Timeline } from "@/components/timeline";
import { AgentRoom, OptionCards } from "@/features/agents/agent-room";
import { RecommendationCard } from "@/features/policy/card-body";
import { showBlocker } from "@/features/solution/pair";
import { DemoRoom, LiveNegotiationRoom } from "@/features/agents/demo-room";
import { defendBlocker } from "@/features/agents/defend-button";
import { QuestionBanner } from "@/features/agents/question-card";
import { JoinModal } from "@/features/review/join-modal";
import { useRoleView } from "@/lib/role-views";
import { useSession, useSessionIndex } from "@/lib/stdb/use-session";
import type { SessionSnapshot } from "@/lib/stdb/types";

export function SessionView({ sessionId }: { sessionId: string }) {
  const session = useSession(sessionId);
  const [view, setView] = useState<ViewId>("simulation");
  const [hovered, setHovered] = useState<string | null>(null);
  const [floor, setFloor] = useState("all");
  const [pickingNew, setPickingNew] = useState(false);
  const [pickError, setPickError] = useState<string>();
  // Leave picking as soon as a new run is the active one in the rows, not when the reducer's promise
  // settles: a slow or lost promise left the board blank until a reload.
  const pickedFrom = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (pickingNew && session.activeRunId && session.activeRunId !== pickedFrom.current) setPickingNew(false);
  }, [pickingNew, session.activeRunId]);

  // Picking patient zero: before the first attack, or after + New run. The
  // building itself is the picker — the presenter clicks a device to start.
  const picking = !session.activeRun || pickingNew;
  // While picking a new run, show the empty hospital (no run's rows), not the last attack.
  const shown: SessionSnapshot =
    picking && session.activeRun
      ? { ...session, devices: [], services: [], patients: [], attempts: [], events: [], snapshots: [], activeRun: undefined, activeRunId: "" }
      : session;
  const index = useSessionIndex(shown);
  const roleView = useRoleView(shown);
  const canPick = picking && session.isPresenter && session.source === "live";
  const pick = async (id: string) => {
    if (!canPick || !session.entryPoints.includes(id)) return;
    setPickError(undefined);
    try {
      await session.actions.startRun(id);
      setPickingNew(false);
    } catch (e) {
      setPickError((e as Error).message);
    }
  };

  // ?view=agents opens straight onto the Agents tab; ?demo=1 plays the scripted negotiation there.
  // The negotiation room runs on the live rows; ?demo=1 plays the scripted version instead; ?demo=0 the classic Agent Room.
  const [demo, setDemo] = useState<"live" | "script" | "classic">("live");
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("view") === "agents") setView("agents");
    if (q.get("demo") === "1") setDemo("script");
    if (q.get("demo") === "0") setDemo("classic");
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

  // When the presenter shows a solution, every tab follows into the split-screen rerun.
  if (session.solutionPairId) return <SolutionView session={session} />;

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
            <Timeline session={session} index={index} onNewRun={() => { pickedFrom.current = session.activeRunId; setPickingNew(true); }} />

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
                <SceneBoundary session={shown}>
                  <HospitalScene
                    session={shown}
                    index={index}
                    hovered={hovered}
                    onHover={setHovered}
                    floorId={floor === "all" ? undefined : floor}
                    onPick={canPick ? pick : undefined}
                    pickable={picking ? (id) => session.entryPoints.includes(id) : undefined}
                    view={roleView}
                  />
                </SceneBoundary>
                {hovered && (
                  <div className="pointer-events-none absolute right-4 top-4 z-10">
                    <DeviceCard session={session} index={index} deviceId={hovered} view={roleView} />
                  </div>
                )}
                <span className="num pointer-events-none absolute bottom-3 left-4 text-[11px] text-ink-faint">
                  {picking
                    ? session.isPresenter
                      ? pickError ?? "Click a device to start the attack from it"
                      : `Waiting for ${session.presenterName || "the presenter"} to pick patient zero`
                    : "Drag to rotate · scroll to zoom · hover a device"}
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
          {demo !== "classic" ? (
            <div className="fixed inset-0 z-40 flex items-center justify-center bg-bg/80 p-4 backdrop-blur-[2px] md:p-8" role="dialog" aria-modal="true">
              <div className="h-full w-full max-w-[1760px]">
                {demo === "live" ? (
                  <LiveNegotiationRoom
                    messages={session.messages}
                    roundState={session.roundState}
                    names={index}
                    onClose={() => setView("simulation")}
                    status={session.roundState.state === "idle" && !session.messages.length ? "Press Create segmentation plan to wake the agents." : undefined}
                    options={
                      session.recommendations.length ? (
                        <OptionCards
                          recs={session.recommendations.filter((r) => r.round === session.recommendations[0]?.round)}
                          review={(rec) => (
                            <RecommendationCard rec={rec} index={index} blocked={showBlocker(session, rec.id)} onShow={() => session.actions.showSolution(rec.id)} />
                          )}
                        />
                      ) : undefined
                    }
                  />
                ) : (
                <DemoRoom
                  onClose={() => setView("simulation")}
                  status={session.roundState.state === "running" ? "The agents are finalizing the plan behind the scenes…" : session.roundState.state === "idle" && !session.messages.length ? "Press Create segmentation plan to wake the agents." : undefined}
                  options={
                    session.recommendations.length ? (
                      <OptionCards
                        recs={session.recommendations.filter((r) => r.round === session.recommendations[0]?.round)}
                        review={(rec) => (
                          <RecommendationCard rec={rec} index={index} blocked={showBlocker(session, rec.id)} onShow={() => session.actions.showSolution(rec.id)} />
                        )}
                      />
                    ) : undefined
                  }
                />
                )}
              </div>
            </div>
          ) : (
            <AgentRoom session={session} index={index} onClose={() => setView("simulation")} />
          )}
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
    console.log(`[plan] press: round=${round} blocker=${blocker ?? "none"} activeRun=${session.activeRunId} source=${session.source}`);
    if (negotiating) return onAgents();
    setError(undefined);
    setBusy(true);
    try {
      await session.actions.defend();
      console.log("[plan] defend_request accepted by SpacetimeDB");
      onAgents();
    } catch (e) {
      console.error("[plan] defend_request refused:", (e as Error).message);
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
        className="num inline-flex min-h-[60px] w-full items-center justify-center gap-2.5 rounded-panel bg-state-infected text-[15px] font-medium text-bg transition-[filter] duration-fade enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:border disabled:border-line2 disabled:bg-transparent disabled:text-ink-faint"
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
        <span className="h-2 w-2 rounded-full" style={{ background: "#6FCF97" }} />
        Patients
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
