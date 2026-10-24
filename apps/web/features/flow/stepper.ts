// The demo stepper's state, read from rows: which step the session is on, one
// line saying what happens next, and the one action that moves it on. Pure, so
// it is tested on its own; stepper-bar.tsx renders it. The reducers stay the
// authority: a blocked action carries the same reason the reducer would give.

import { defendBlocker, MOCK_REFUSAL } from "@/features/agents/defend";
import { flowStage, runProgress, type FlowStage } from "@/lib/stdb/run-status";
import type { SessionSnapshot } from "@/lib/stdb/types";

/** The demo's patient zero, pre-selected whenever the engine accepts it. */
export const DEMO_PATIENT_ZERO = "mri_2";

export type StepperInputs = Pick<
  SessionSnapshot,
  | "source" | "me" | "isPresenter" | "presenterName" | "activeRun" | "runs" | "roundState" | "recommendations"
  | "solutionPairId" | "entryPoints"
>;

/** UI-only state: the presenter's patient-zero pick, which is never written to a row until Start attack. */
export type StepperUi = {
  /** The presenter chose "Pick another device" over an existing run. */
  repick: boolean;
  /** The device patient zero will be, if Start attack is pressed now. */
  selected?: string;
  nameOf: (deviceId: string) => string;
};

export type StepActionKind = "start" | "cancel_repick" | "repick" | "defend" | "agents" | "new_demo";
/** `blocked` is why the action can't run now (shown, and the button disabled), or null. */
export type StepAction = { kind: StepActionKind; label: string; blocked: string | null };

export type Stepper = {
  stage: FlowStage;
  /** The tile that is lit: 1 Run the attack, 2 Create aggregate fix, 3 Show the solution. */
  step: 1 | 2 | 3;
  line: string;
  actions: StepAction[];
};

/** The device to pre-select: the demo's patient zero, when the engine lists it. */
export function defaultPick(entryPoints: readonly string[]): string | undefined {
  return entryPoints.includes(DEMO_PATIENT_ZERO) ? DEMO_PATIENT_ZERO : undefined;
}

/** The presenter's click if the engine accepts that device, else the default. */
export function pickedOf(chosen: string | undefined, entryPoints: readonly string[]): string | undefined {
  return chosen && entryPoints.includes(chosen) ? chosen : defaultPick(entryPoints);
}

/**
 * The presenter may leave the current run for a new patient zero when it failed
 * or finished, before any agent round. Once the agents have worked from a
 * baseline, a new one would change what their recommendations are measured against.
 */
export function canRepick(s: Pick<StepperInputs, "isPresenter" | "activeRun" | "roundState">): boolean {
  const run = s.activeRun;
  if (!s.isPresenter || !run || s.roundState.state !== "idle") return false;
  return run.status === "error" || run.status === "done";
}

/**
 * Once the agents' round is over (and no solution is open), the presenter can
 * start the next judge on a fresh session (new-demo.ts). This is the way back to
 * step 1 after a round: canRepick stays off on this session for the reason above.
 */
export function canStartNewDemo(s: Pick<StepperInputs, "isPresenter" | "roundState" | "solutionPairId">): boolean {
  return s.isPresenter && s.roundState.state === "done" && !s.solutionPairId;
}

const STEP: Record<FlowStage, 1 | 2 | 3> = {
  pick: 1, spread: 1, defend: 2, negotiating: 2, pick_solution: 3, solution: 3,
};

export function stepperOf(s: StepperInputs, ui: StepperUi): Stepper {
  const mock = s.source === "mock" ? MOCK_REFUSAL : null;
  const stage: FlowStage = ui.repick && canRepick(s) && !s.solutionPairId ? "pick" : flowStage(s);
  const at = (line: string, actions: StepAction[] = []): Stepper => ({ stage, step: STEP[stage], line, actions });
  const repick: StepAction[] = canRepick(s) ? [{ kind: "repick", label: "Pick another device", blocked: mock }] : [];
  const agents: StepAction = { kind: "agents", label: "Open the Agents tab", blocked: null };
  const newDemo: StepAction[] = canStartNewDemo(s) ? [{ kind: "new_demo", label: "New demo", blocked: mock }] : [];
  const run = s.activeRun;

  switch (stage) {
    case "pick": {
      const cancel: StepAction[] = ui.repick && run ? [{ kind: "cancel_repick", label: "Cancel", blocked: null }] : [];
      if (!s.isPresenter) return at(`Waiting for ${s.presenterName} to pick patient zero and start the attack.`);
      if (!s.entryPoints.length) {
        const why = "Waiting for the engine to list the devices an attack can start from.";
        const detail = s.roundState.detail ? ` ${s.roundState.detail}` : "";
        return at(why + detail, [{ kind: "start", label: "Start attack", blocked: mock ?? why }, ...cancel]);
      }
      const picked = ui.selected ? ui.nameOf(ui.selected) : undefined;
      return at(
        picked
          ? `Patient zero: ${picked}. Click another highlighted device to change it, or start the attack.`
          : "Click a highlighted device to make it patient zero.",
        [{ kind: "start", label: "Start attack", blocked: mock ?? (ui.selected ? null : "Pick patient zero first.") }, ...cancel],
      );
    }
    case "spread": {
      if (!run) return at("Computing the attack…");
      if (run.status === "requested") return at("Computing the attack… The engine works out the whole spread before the first step plays.");
      if (run.status === "error") return at(runProgress(run), [...repick, ...newDemo]);
      if (run.status === "paused") {
        return at(`${runProgress(run)}, paused. Play or step to go on, or create an aggregate fix from here.`, [
          { kind: "defend", label: "Create aggregate fix", blocked: defendBlocker(s) },
        ]);
      }
      return at(`${runProgress(run)}. The attack is spreading; the agents stay idle until it finishes or is paused.`);
    }
    case "defend": {
      const defend: StepAction = { kind: "defend", label: "Create aggregate fix", blocked: defendBlocker(s) };
      if (s.roundState.state === "done") {
        return at("No recommendation came out of the last round. Create an aggregate fix to negotiate again.", [
          defend,
          ...newDemo,
        ]);
      }
      const line = run
        ? `The attack reached ${run.devicesCompromised} devices and affected ${run.patientsAffected} patients. Create an aggregate fix to let the agents negotiate a plan.`
        : "Create an aggregate fix to let the agents negotiate a plan.";
      return at(line, [defend, ...repick]);
    }
    case "negotiating":
      return at(
        s.roundState.state === "waiting_for_human"
          ? "The agents are waiting for a human to answer their question."
          : "The agents are negotiating a plan. Follow them on the Agents tab.",
        [agents],
      );
    case "pick_solution": {
      const n = s.recommendations.length;
      return at(
        `The agents recommend ${n} plan${n === 1 ? "" : "s"}. Press Show the solution on one to rerun the same attack with it.`,
        [agents, ...newDemo],
      );
    }
    case "solution":
      return at("The same attack is rerunning with and without the plan.");
  }
}
