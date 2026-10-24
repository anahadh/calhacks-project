// A whole test run, for hippo-sim and the agents. Never animated.

import { initialState, isSettled, step, summarize, type StepOptions, type Summary } from "./engine";
import { protectedBroken } from "./policy";
import type { Hospital } from "./types";

export const MAX_TICKS = 48; // 12 simulated hours

export type RunResult = {
  patientZero: string;
  seed: number;
  ticks: Summary[];
  final: Summary;
  protectedBroken: string[];
};

export function runToEnd(
  h: Hospital, patientZero: string, seed: number, opts: StepOptions = {}, maxTicks = MAX_TICKS,
): RunResult {
  let { state } = initialState(h, patientZero, seed);
  const ticks: Summary[] = [summarize(h, state)];
  while (state.tick < maxTicks && !isSettled(h, state, opts)) {
    state = step(h, state, opts).state;
    ticks.push(summarize(h, state));
  }
  return {
    patientZero,
    seed,
    ticks,
    final: ticks[ticks.length - 1],
    protectedBroken: protectedBroken(h, opts.policy).map((f) => f.id),
  };
}
