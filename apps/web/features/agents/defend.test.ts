import { describe, expect, it } from "vitest";
import { flow, runRow, withRun } from "@/features/fixtures";
import { defendBlocker, MOCK_REFUSAL } from "./defend";

// defendBlocker mirrors defend_request's refusals (spacetime/src/agents.ts), in its order.
describe("defendBlocker", () => {
  const done = runRow({ status: "done", tick: 15, finalTick: 15 });

  it("allows a finished baseline with no round open", () => {
    expect(defendBlocker(withRun(done))).toBeNull();
  });

  it("allows a paused baseline: the agents work from where it stopped", () => {
    expect(defendBlocker(withRun(runRow({ status: "paused", tick: 4, finalTick: 15 })))).toBeNull();
  });

  it("says the mock can't act, before anything else", () => {
    expect(defendBlocker(withRun(done, { source: "mock", me: undefined }))).toBe(MOCK_REFUSAL);
  });

  it("asks to join first", () => {
    expect(defendBlocker(withRun(done, { me: undefined }))).toBe("Join the session before creating an aggregate fix.");
  });

  it("needs an attack first (no placeholder run)", () => {
    expect(defendBlocker(flow())).toBe("Run the attack first. The agents work from a baseline run.");
  });

  it("blocks while the attack is still being computed", () => {
    expect(defendBlocker(withRun(runRow({ status: "requested" })))).toMatch(/still being computed/);
  });

  it("blocks on a failed run", () => {
    expect(defendBlocker(withRun(runRow({ status: "error", detail: "Engine refused the run" })))).toMatch(/run failed/);
  });

  it("blocks while the run is playing (rule 5)", () => {
    expect(defendBlocker(withRun(runRow({ status: "running", tick: 3, finalTick: 15 })))).toMatch(/finish, or pause it/);
  });

  it("blocks while any session run is busy, solution pairs included", () => {
    const pair = runRow({ id: "pair_x_1_none", pairId: "pair_x_1", status: "running" });
    expect(defendBlocker(withRun(done, { runs: [done, pair] }))).toBe(
      "Wait for every run in this session to finish, or pause it, before creating an aggregate fix.",
    );
  });

  it("blocks while a round is open, and allows another once it is done", () => {
    expect(defendBlocker(withRun(done, { roundState: { state: "running", round: 1, maxRounds: 4 } }))).toMatch(/already being negotiated/);
    expect(defendBlocker(withRun(done, { roundState: { state: "waiting_for_human", round: 1, maxRounds: 4 } }))).toMatch(
      /already being negotiated/,
    );
    expect(defendBlocker(withRun(done, { roundState: { state: "done", round: 1, maxRounds: 4 } }))).toBeNull();
  });
});
