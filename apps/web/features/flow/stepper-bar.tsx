"use client";

import { useState } from "react";
import type { ViewId } from "@/components/shell/header";
import type { SessionIndex } from "@/lib/stdb/use-session";
import type { SessionSnapshot } from "@/lib/stdb/types";
import { startNewDemo } from "./new-demo";
import { stepperOf, type StepAction } from "./stepper";

// The demo steps on both tabs: 1 Run the attack → 2 Create aggregate fix →
// 3 Show the solution, one line saying what happens next, and the action that
// moves the session on. Every tab reads the same rows, so every tab shows the
// same step; only the presenter's patient-zero pick is local until Start attack.
export function StepperBar({
  session,
  index,
  view,
  repick,
  selected,
  onRepick,
  onAgents,
}: {
  session: SessionSnapshot;
  index: SessionIndex;
  view: ViewId;
  repick: boolean;
  /** The presenter's patient zero, if Start attack is pressed now. */
  selected?: string;
  onRepick: (on: boolean) => void;
  onAgents: () => void;
}) {
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const stepper = stepperOf(session, { repick, selected, nameOf: (id) => index.device.get(id)?.name ?? id });
  const actions = stepper.actions.filter((a) => !(a.kind === "agents" && view === "agents"));

  const act = async (a: StepAction) => {
    setError(undefined);
    setBusy(true);
    // New demo opens another session: stay busy while the page leaves, so it can't make two.
    let leaving = false;
    try {
      switch (a.kind) {
        case "start":
          if (selected) await session.actions.startRun(selected, session.activeRun?.speed);
          onRepick(false);
          break;
        case "defend":
          await session.actions.defend();
          onAgents();
          break;
        case "agents":
          onAgents();
          break;
        case "repick":
          onRepick(true);
          break;
        case "cancel_repick":
          onRepick(false);
          break;
        case "new_demo":
          await startNewDemo();
          leaving = true;
          break;
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      if (!leaving) setBusy(false);
    }
  };

  const tile = (n: 1 | 2 | 3) => (n < stepper.step ? "done" : n === stepper.step ? "on" : "next");
  // A reason the line already says is not repeated under the buttons.
  const blocked = actions.find((a) => a.blocked && !stepper.line.startsWith(a.blocked))?.blocked;

  return (
    <div className="flex flex-wrap items-stretch gap-2.5">
      <Tile n={1} title="Run the attack" sub="pick patient zero, watch it spread" state={tile(1)} />
      <Arrow />
      <Tile n={2} title="Create aggregate fix" sub="four agents negotiate a plan" state={tile(2)} />
      <Arrow />
      <Tile n={3} title="Show the solution" sub="same attack, with the plan" state={tile(3)} />

      <div className="flex min-w-[240px] flex-[1_1_320px] flex-col justify-center gap-2 pl-1.5">
        <p className="font-disp text-[15px] leading-snug text-ink-muted" aria-live="polite">
          {stepper.line}
        </p>
        {(actions.length > 0 || error) && (
          <div className="flex flex-wrap items-center gap-2">
            {actions.map((a, i) => (
              <button
                key={a.kind}
                disabled={!!a.blocked || busy}
                onClick={() => act(a)}
                title={a.blocked ?? (a.kind === "new_demo" ? "Start the next run on a fresh session; every tab here follows." : undefined)}
                className={`num rounded-[7px] border px-3 py-1.5 text-[11.5px] font-semibold transition disabled:cursor-not-allowed disabled:border-line2 disabled:bg-transparent disabled:text-ink-faint ${
                  // New demo is never the lit next step: the flow's own action is.
                  i === 0 && a.kind !== "new_demo"
                    ? "border-accent bg-accent text-bg hover:brightness-110"
                    : "border-line2 text-ink-muted hover:border-accent hover:text-ink"
                }`}
              >
                {a.label}
              </button>
            ))}
            {(error || blocked) && (
              <span role={error ? "alert" : undefined} className="num text-[10.5px] leading-snug text-ink-faint">
                {error ?? blocked}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Tile({ n, title, sub, state }: { n: number; title: string; sub: string; state: "done" | "on" | "next" }) {
  const on = state === "on";
  return (
    <div
      aria-current={on ? "step" : undefined}
      className={`flex items-center gap-2.5 rounded-panel border bg-panel px-3.5 py-2.5 transition ${
        on ? "border-accent shadow-[inset_0_0_0_1px_#E9ECEE]" : "border-line"
      } ${state === "next" ? "opacity-45" : ""}`}
    >
      <span
        className={`num grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full border text-[12px] font-bold ${
          on ? "border-accent bg-accent text-bg" : "border-line2 bg-panel2"
        }`}
      >
        {state === "done" ? "✓" : n}
      </span>
      <span>
        <b className="block font-disp text-[14.5px]">{title}</b>
        <small className="block text-[11.5px] text-ink-faint">{sub}</small>
      </span>
    </div>
  );
}

function Arrow() {
  return (
    <span className="self-center text-lg text-ink-faint" aria-hidden>
      →
    </span>
  );
}
