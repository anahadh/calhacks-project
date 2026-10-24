"use client";

import { useState } from "react";
import { PlaybackButtons, SpeedButtons } from "@/components/playback";
import { HospitalScene } from "@/components/scene/hospital-scene";
import { SceneBoundary } from "@/components/scene/scene-boundary";
import { SessionHeader } from "@/components/shell/header";
import { Assumptions } from "@/components/timeline";
import { ROLE_LABEL } from "@/lib/format";
import { pairOf, runProgress } from "@/lib/stdb/run-status";
import { useRunRows, useSessionIndex } from "@/lib/stdb/use-session";
import type { RecommendationRow, RunRow, SessionSnapshot } from "@/lib/stdb/types";
import { beforeAfter, keptWorking, pairClock, pairRefusal, pairTarget, sceneOf, type Delta } from "./pair";

// The payoff screen (UX.md "Solution view"): the same attack rerun as one
// lockstep pair from solution_start, "No segmentation" on the left and the
// plan on the right. Both sides are live runs the watcher feeds through the
// engine; every tab opens this view while session.solution_pair_id is set.
// One shared play control and clock; each side holds on its final frame.
export function SolutionView({ session }: { session: SessionSnapshot }) {
  const { none, plan } = pairOf(session.runs, session.solutionPairId);
  const left = useRunRows(none?.id ?? "");
  const right = useRunRows(plan?.id ?? "");
  const leftScene = sceneOf(session, { ...left, run: left.run ?? none });
  const rightScene = sceneOf(session, { ...right, run: right.run ?? plan });
  const leftIndex = useSessionIndex(leftScene);
  const rightIndex = useSessionIndex(rightScene);
  const [hovered, setHovered] = useState<string | null>(null);
  const [err, setErr] = useState<string>();
  const [closing, setClosing] = useState(false);

  const rec = session.recommendations.find((r) => r.id === plan?.recommendationId);
  const sides = [none, plan];
  const clock = pairClock(sides);
  const targets = {
    play: pairTarget("play", sides), pause: pairTarget("pause", sides), step: pairTarget("step", sides),
    reset: pairTarget("reset", sides), speed: pairTarget("speed", sides),
  };
  const deltas = beforeAfter(none, plan, rec?.rules.length);
  const kept = keptWorking(session.hospital, plan, right.services);
  const brokenPurposes = kept.flows.filter((f) => f.broken.length).map((f) => f.purpose);
  const notes = [...new Set([...(none?.assumptions ?? []), ...(plan?.assumptions ?? [])])];

  const close = async () => {
    setErr(undefined);
    setClosing(true);
    try {
      await session.actions.closeSolution();
    } catch (e) {
      setErr((e as Error).message);
      setClosing(false);
    }
  };

  return (
    <>
      <SessionHeader session={session}>
        <span className="num hidden truncate text-[11px] uppercase tracking-[0.08em] text-ink-muted md:inline">
          Solution rerun{rec ? ` · ${rec.name}` : ""}
        </span>
        {session.isPresenter ? (
          <button
            onClick={close}
            disabled={closing}
            className="num rounded-md border border-line2 px-2.5 py-1 text-[11px] text-ink transition hover:border-accent disabled:opacity-50"
          >
            ← Back to the session
          </button>
        ) : (
          <span className="num text-[10.5px] text-ink-faint">{session.presenterName} leads this view</span>
        )}
      </SessionHeader>

      <div className="mx-auto max-w-[1440px] space-y-3.5 px-4 pb-10 md:px-6">
        {/* One shared play control and clock for both sides. */}
        <section className="mt-3.5 flex flex-wrap items-center gap-3.5 rounded-panel border border-line bg-panel px-4 py-3">
          <PlaybackButtons
            targets={targets}
            refusal={(c) => pairRefusal(c, sides)}
            actions={session.actions}
            isPresenter={session.isPresenter}
            onError={setErr}
          />
          <div className="min-w-0">
            <span className="font-disp text-[19px] font-semibold tabular-nums">{clock.line}</span>
            <div className="num text-[10.5px] uppercase tracking-[0.08em] text-ink-muted">
              Same attack, same patient zero · both sides in lockstep
            </div>
          </div>
          {err && (
            <span role="alert" className="num text-[11px] text-ink-muted">
              {err}
            </span>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-3">
            <SpeedButtons target={targets.speed} actions={session.actions} isPresenter={session.isPresenter} onError={setErr} />
            <span className="num text-[10.5px] text-ink-faint">
              {session.isPresenter ? "You control playback" : `${session.presenterName} controls playback`}
            </span>
          </div>
        </section>

        <div className="grid gap-3.5 lg:grid-cols-2">
          <Side
            title="No segmentation"
            sub="the network as it is today"
            run={none}
            scene={<SceneBoundary session={leftScene}><HospitalScene session={leftScene} index={leftIndex} hovered={hovered} onHover={setHovered} compact /></SceneBoundary>}
          />
          <Side
            title={rec ? `With plan: ${rec.name}` : plan?.label ?? "With the plan"}
            sub="the same attack, with the plan's cuts"
            run={plan}
            warning={
              brokenPurposes.length ? `Breaks a protected flow: ${brokenPurposes.join(", ")}` : undefined
            }
            scene={<SceneBoundary session={rightScene}><HospitalScene session={rightScene} index={rightIndex} hovered={hovered} onHover={setHovered} compact /></SceneBoundary>}
          />
        </div>

        <BeforeAfter deltas={deltas} />

        <div className="grid gap-3.5 lg:grid-cols-2">
          <Rules rec={rec} />
          <KeepsWorking flows={kept.flows} services={kept.services} />
        </div>

        <p className="num text-[11px] leading-relaxed text-ink-faint">
          Illustrative simulation. Spread rates are not measured from real incidents. This rerun is a simulation, not a
          change to any network: only humans decide what gets deployed.
        </p>
        {notes.length > 0 && <Assumptions notes={notes} />}
      </div>
    </>
  );
}

function Side({
  title,
  sub,
  run,
  warning,
  scene,
}: {
  title: string;
  sub: string;
  run?: RunRow;
  warning?: string;
  scene: React.ReactNode;
}) {
  return (
    <div className="panel flex flex-col overflow-hidden">
      <div className="panel-h">
        <div className="min-w-0">
          <h2 className="truncate">{title}</h2>
          <div className="num text-[10.5px] text-ink-faint">{sub}</div>
        </div>
        <span className="num ml-auto text-right text-[11px] text-ink-muted">
          {run ? runProgress(run) : "Computing…"}
          {run?.status === "done" && <span className="block text-[10px] text-ink-faint">holding on the final step</span>}
        </span>
      </div>
      {warning && (
        <p role="alert" className="num border-b border-line bg-panel2 px-4 py-1.5 text-[10.5px] text-ink">
          ✕ {warning}
        </p>
      )}
      <div className="relative h-[440px]">{scene}</div>
      <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-px border-t border-line bg-line">
        <Stat label="Patients affected" value={run?.patientsAffected} lead />
        <Stat label="Devices compromised" value={run?.devicesCompromised} />
        <Stat label="Services down" value={run?.servicesDown} />
      </div>
    </div>
  );
}

function Stat({ label, value, lead }: { label: string; value?: number; lead?: boolean }) {
  return (
    <div className="bg-panel px-3.5 py-2.5">
      <div className="eyebrow !text-[9.5px] !tracking-[0.1em]">{label}</div>
      <div className={`mt-0.5 font-disp font-semibold tabular-nums ${lead ? "text-[28px] leading-none" : "text-lg"}`}>
        {value ?? "—"}
      </div>
    </div>
  );
}

/** Each number from the two run rows, with the difference called out ("212 → 9"). */
function BeforeAfter({ deltas }: { deltas: Delta[] }) {
  return (
    <section className="panel">
      <div className="panel-h">
        <h2>Before and after</h2>
        <span className="eyebrow ml-auto">no segmentation → with the plan</span>
      </div>
      <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-3 lg:grid-cols-6">
        {deltas.map((d) => (
          <div key={d.label} className="bg-panel px-3.5 py-3">
            <div className="eyebrow !text-[9.5px] !tracking-[0.1em]">{d.label}</div>
            <div className={`mt-1 font-disp tabular-nums ${d.lead ? "text-[30px] font-light leading-none" : "text-[19px] font-semibold"}`}>
              <span className="text-ink-faint">{d.before ?? "—"}</span>
              <span className="mx-1.5 text-ink-faint">→</span>
              <span className="text-ink">{d.after ?? "—"}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Rules({ rec }: { rec?: RecommendationRow }) {
  return (
    <section className="panel">
      <div className="panel-h">
        <h2>The plan&apos;s rules</h2>
        <span className="eyebrow ml-auto">everything else is cut</span>
      </div>
      <div className="p-3.5">
        {rec ? (
          <>
            <ul className="space-y-1">
              {rec.rules.map((r, i) => (
                <li key={i} className="rounded border border-line2 bg-panel2 px-2 py-1 text-[12px] text-ink-muted">
                  {r}
                </li>
              ))}
            </ul>
            {rec.explanation && <p className="mt-2.5 text-[12px] leading-snug text-ink-muted">{rec.explanation}</p>}
            <p className="num mt-2.5 text-[10.5px] text-ink-faint">
              The agents&apos; verdicts are theirs, not a sign-off. Sign-off needed from{" "}
              {rec.requiredRoles.length ? rec.requiredRoles.map((r) => ROLE_LABEL[r]).join(", ") : "the required roles"}.
            </p>
          </>
        ) : (
          <p className="num text-[11px] text-ink-faint">Waiting for the plan&apos;s run to arrive.</p>
        )}
      </div>
    </section>
  );
}

function KeepsWorking({
  flows,
  services,
}: {
  flows: ReturnType<typeof keptWorking>["flows"];
  services: ReturnType<typeof keptWorking>["services"];
}) {
  return (
    <section className="panel">
      <div className="panel-h">
        <h2>What keeps working</h2>
        <span className="eyebrow ml-auto">with the plan</span>
      </div>
      <ul className="grid gap-x-4 gap-y-1.5 p-3.5 text-[12px] sm:grid-cols-2">
        {flows.map((f) => (
          <li key={f.purpose} className="flex items-baseline gap-2">
            <span className="num w-3 shrink-0 text-ink">{f.broken.length ? "✕" : "✓"}</span>
            <span className={f.broken.length ? "text-ink" : "text-ink-muted"}>
              {f.purpose}
              <span className="num ml-1 text-[10px] text-ink-faint">
                {f.broken.length ? `${f.broken.length} of ${f.flowIds.length} cut` : `${f.flowIds.length} kept`}
              </span>
            </span>
          </li>
        ))}
        {services.map((s) => (
          <li key={s.id} className="flex items-baseline gap-2">
            <span className="num w-3 shrink-0 text-ink">{s.down ? "✕" : "✓"}</span>
            <span className={s.down ? "text-ink" : "text-ink-muted"}>
              {s.name}
              <span className="num ml-1 text-[10px] text-ink-faint">{s.down ? "down" : "running"}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
