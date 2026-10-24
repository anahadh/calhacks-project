"use client";

import { useEffect, useState } from "react";
import { Counters } from "@/components/panel/counters";
import { ImpactPanel } from "@/components/panel/impact";
import { InspectorPanel } from "@/components/panel/inspector";
import { ServicesPanel } from "@/components/panel/services";
import { HospitalScene } from "@/components/scene/hospital-scene";
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

  if (session.source === "error" || session.source === "missing" || !session.hospital.devices.length) {
    const text =
      session.source === "missing" ? `Session "${sessionId}" doesn't exist.`
      : session.source === "error" ? session.error ?? "Something went wrong."
      : "Connecting to SpacetimeDB…";
    return <div role="status" className="flex h-screen items-center justify-center p-8 text-sm text-ink-muted">{text}</div>;
  }

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
            <Timeline session={session} index={index} />
            <DemoSteps session={session} onAgents={() => setView("agents")} />

            <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1.6fr)_minmax(340px,0.9fr)]">
              <div className="panel flex flex-col overflow-hidden">
                <div className="panel-h">
                  <div className="num flex flex-wrap items-center gap-1.5 text-[11.5px]">
                    <span className="font-semibold text-ink">{session.hospital.name}</span>
                    <span className="text-ink-faint">· {session.hospital.floors.length} floors, synthetic layout</span>
                  </div>
                  <div className="ml-auto flex items-center gap-2.5">
                    <button className="num rounded-md border border-line px-2.5 py-1 text-[11px] text-ink-muted hover:border-line2 hover:text-ink">
                      Change conditions
                    </button>
                    <div className="flex overflow-hidden rounded-[7px] border border-line" role="group" aria-label="View mode">
                      <button aria-pressed className="num bg-accent px-3.5 py-1 text-[11px] font-bold tracking-[0.06em] text-bg">
                        3D
                      </button>
                      <button aria-pressed={false} className="num px-3.5 py-1 text-[11px] tracking-[0.06em] text-ink-muted">
                        2D
                      </button>
                    </div>
                  </div>
                </div>

                <div className="relative min-h-[620px] flex-1">
                  <HospitalScene session={session} index={index} hovered={hovered} onHover={setHovered} />
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
                <ImpactPanel session={session} index={index} />
                <ServicesPanel session={session} index={index} />
                <InspectorPanel session={session} index={index} deviceId={hovered} />
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-3.5 space-y-3.5">
            <Counters session={session} index={index} />
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

function DemoSteps({ session, onAgents }: { session: SessionSnapshot; onAgents: () => void }) {
  const run = session.runs.find((r) => r.id === session.activeRunId);
  const blocker = defendBlocker(session);
  const [error, setError] = useState<string>();
  const round = session.roundState.state;
  const negotiating = round === "running" || round === "waiting_for_human";

  // Step 2 is Create aggregate fix itself; disabled while the run is running (spec 7.4).
  const defend = async () => {
    setError(undefined);
    try {
      await session.actions.defend();
      onAgents();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const next =
    error ?? (!run ? "Click a device to make it patient zero, then press Run."
    : run.status === "running" ? "The attack is spreading. Agents stay idle until it finishes or you pause it."
    : negotiating ? "The agents are negotiating. Press 2 to watch."
    : blocker ?? "Press Create aggregate fix to let the agents negotiate a plan.");

  return (
    <div className="flex flex-wrap items-stretch gap-2.5">
      <Step n={1} title="Run the attack" sub="infect a device, watch it spread" state={!blocker || negotiating ? undefined : "on"} />
      <Arrow />
      <Step
        n={2} title="Create aggregate fix" sub="four agents negotiate a plan"
        state={!blocker || negotiating ? "on" : undefined}
        disabled={!!blocker && !negotiating}
        onClick={negotiating ? onAgents : defend}
      />
      <Arrow />
      <Step n={3} title="Show the solution" sub="same attack, with the plan" disabled />
      <p className="min-w-[200px] flex-[1_1_220px] self-center pl-1.5 font-disp text-[15px] text-ink-muted">{next}</p>
    </div>
  );
}

function Step({
  n,
  title,
  sub,
  state,
  disabled,
  onClick,
}: {
  n: number;
  title: string;
  sub: string;
  state?: "on";
  disabled?: boolean;
  onClick?: () => void;
}) {
  const on = state === "on";
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`flex items-center gap-2.5 rounded-panel border bg-panel px-3.5 py-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-45 ${
        on ? "border-accent shadow-[inset_0_0_0_1px_#E9ECEE]" : "border-line hover:border-line2"
      }`}
    >
      <span
        className={`num grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full border text-[12px] font-bold ${
          on ? "border-accent bg-accent text-bg" : "border-line2 bg-panel2"
        }`}
      >
        {n}
      </span>
      <span>
        <b className="block font-disp text-[14.5px]">{title}</b>
        <small className="block text-[11.5px] text-ink-faint">{sub}</small>
      </span>
    </button>
  );
}

function Arrow() {
  return (
    <span className="self-center text-lg text-ink-faint" aria-hidden>
      →
    </span>
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
