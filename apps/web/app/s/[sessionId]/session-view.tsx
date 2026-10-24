"use client";

import { useEffect, useRef, useState } from "react";
import { Counters } from "@/components/panel/counters";
import { ImpactPanel } from "@/components/panel/impact";
import { InspectorPanel } from "@/components/panel/inspector";
import { ServicesPanel } from "@/components/panel/services";
import { HospitalScene, type ScenePick } from "@/components/scene/hospital-scene";
import { SceneBoundary } from "@/components/scene/scene-boundary";
import { PatientBadge } from "@/components/shell/badges";
import { SessionHeader, type ViewId } from "@/components/shell/header";
import { Timeline } from "@/components/timeline";
import { AgentRoom } from "@/features/agents/agent-room";
import { QuestionBanner } from "@/features/agents/question-card";
import { useFollowNewDemo } from "@/features/flow/new-demo";
import { canRepick, pickedOf } from "@/features/flow/stepper";
import { StepperBar } from "@/features/flow/stepper-bar";
import { JoinModal } from "@/features/review/join-modal";
import { sceneOf } from "@/features/solution/pair";
import { SolutionView } from "@/features/solution/solution-view";
import { flowStage, pairOf } from "@/lib/stdb/run-status";
import { useSession, useSessionIndex } from "@/lib/stdb/use-session";

// The session: one flow on subscribed rows. Pick patient zero and start the
// attack → watch it spread → Create aggregate fix → the agents negotiate →
// Show the solution → the split-screen rerun. Every tab on the session reads
// the same rows, so every tab moves through it together.
export function SessionView({ sessionId }: { sessionId: string }) {
  const session = useSession(sessionId);
  const [view, setView] = useState<ViewId>("simulation");
  const [hovered, setHovered] = useState<string | null>(null);
  // UI-only until Start attack: the presenter's pick, and "Pick another device".
  const [chosen, setChosen] = useState<string>();
  const [repick, setRepick] = useState(false);

  const stage = flowStage(session);
  const picking = !session.solutionPairId && (stage === "pick" || (repick && canRepick(session)));
  // While picking a new patient zero over an old run, the building is shown clean.
  const shown = picking && session.activeRun ? sceneOf(session) : session;
  const index = useSessionIndex(shown);
  const selected = pickedOf(chosen, session.entryPoints);
  // When the presenter starts a New demo, every tab on this session opens it.
  useFollowNewDemo(sessionId, session.source === "live");

  // ?view=agents opens straight onto the Agents tab.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("view") === "agents") setView("agents");
  }, []);

  // 1 and 2 switch views, as in the design template.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey) return;
      if (e.key === "1") setView("simulation");
      if (e.key === "2") setView("agents");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // When a round starts, every tab moves to the Agents tab to watch it.
  const round = session.roundState.state;
  const lastRound = useRef(round);
  useEffect(() => {
    if (round === "running" && lastRound.current !== "running") setView("agents");
    lastRound.current = round;
  }, [round]);

  // A new attack ends any pick in progress.
  useEffect(() => {
    setRepick(false);
    setChosen(undefined);
  }, [session.activeRunId]);

  // The address bar follows the solution view (UX.md: /s/[sessionId]/solution/[recommendationId]).
  const solutionRec = pairOf(session.runs, session.solutionPairId).plan?.recommendationId;
  useEffect(() => {
    const base = `/s/${encodeURIComponent(sessionId)}`;
    const want = session.solutionPairId && solutionRec ? `${base}/solution/${encodeURIComponent(solutionRec)}` : base;
    if (session.source === "live" && window.location.pathname !== want) window.history.replaceState(null, "", want);
  }, [sessionId, session.source, session.solutionPairId, solutionRec]);

  if (session.source === "error" || session.source === "missing" || !session.hospital.devices.length) {
    const text =
      session.source === "missing" ? `Session "${sessionId}" doesn't exist.`
      : session.source === "error" ? session.error ?? "Something went wrong."
      : "Connecting to SpacetimeDB…";
    return (
      <div role={session.source === "error" ? "alert" : "status"} className="flex h-screen items-center justify-center p-8 text-sm text-ink-muted">
        {text}
      </div>
    );
  }

  if (session.solutionPairId) {
    return (
      <>
        <SolutionView session={session} />
        <JoinModal session={session} />
      </>
    );
  }

  // Everyone sees which devices can start an attack; only the presenter's own tab
  // shows (and changes) the pick, since it is not a row until Start attack.
  const pick: ScenePick | undefined =
    picking && session.entryPoints.length
      ? session.isPresenter
        ? { eligible: index.entryPoint, selected, onPick: setChosen }
        : { eligible: index.entryPoint }
      : undefined;
  const stepper = (
    <StepperBar
      session={session}
      index={index}
      view={view}
      repick={repick}
      selected={selected}
      onRepick={setRepick}
      onAgents={() => setView("agents")}
    />
  );

  return (
    <>
      <SessionHeader session={session} view={view} onView={setView} />
      <JoinModal session={session} />

      <div className="mx-auto max-w-[1440px] px-4 md:px-6">
        <div className="mt-3.5 empty:hidden">
          <QuestionBanner session={session} index={index} />
        </div>
        {view === "simulation" ? (
          <div className="mt-3.5 space-y-3.5">
            <Timeline session={shown} index={index} />
            {stepper}

            <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1.6fr)_minmax(340px,0.9fr)]">
              <div className="panel flex flex-col overflow-hidden">
                <div className="panel-h">
                  <div className="num flex flex-wrap items-center gap-1.5 text-[11.5px]">
                    <span className="font-semibold text-ink">{session.hospital.name}</span>
                    <span className="text-ink-faint">· {session.hospital.floors.length} floors, synthetic layout</span>
                  </div>
                  {pick && (
                    <span className="num ml-auto text-[10.5px] text-ink-muted">
                      {session.isPresenter
                        ? "Highlighted devices can start an attack · click one to make it patient zero"
                        : "Highlighted devices can start an attack"}
                    </span>
                  )}
                </div>

                <div className="relative min-h-[620px] flex-1">
                  <SceneBoundary session={shown}>
                    <HospitalScene session={shown} index={index} hovered={hovered} onHover={setHovered} pick={pick} />
                  </SceneBoundary>
                </div>

                <div className="num flex flex-wrap items-center gap-x-3.5 gap-y-1.5 border-t border-line px-3.5 py-2.5 text-[10.5px] text-ink-muted">
                  <Swatch className="bg-state-healthy">Healthy</Swatch>
                  <Swatch className="bg-state-infected">Infected</Swatch>
                  <span className="inline-flex items-center gap-1.5">
                    <PatientBadge state="delayed" /> Delayed
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <PatientBadge state="disrupted" /> Disrupted
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <PatientBadge state="diverted" /> Diverted
                  </span>
                  <span className="ml-auto text-ink-faint">Drag to rotate · scroll to zoom · hover a device</span>
                </div>
              </div>

              <div className="flex flex-col gap-3.5">
                <ImpactPanel session={shown} index={index} />
                <ServicesPanel session={shown} index={index} />
                <InspectorPanel session={shown} index={index} deviceId={hovered} />
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-3.5 space-y-3.5">
            {stepper}
            <Counters session={session} />
            <AgentRoom session={session} index={index} />
          </div>
        )}

        <footer className="num mt-10 border-t border-line pb-10 pt-4 text-[10.5px] leading-relaxed text-ink-faint">
          <b className="text-ink-muted">All hospital data is synthetic.</b> No field identifies a person; patient groups are
          counts. Agents act only inside the simulation and never touch a real network. Humans approve every plan before
          anything is exported.
        </footer>
      </div>
    </>
  );
}

function Swatch({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <i className={`h-[9px] w-[9px] rounded-[3px] ${className}`} />
      {children}
    </span>
  );
}
