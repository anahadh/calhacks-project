import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppSession, type AppSessionRequest, type EngineReply } from "../src/engine";
import { TICK_MS, watchRuns, type RunInfo } from "../src/run";
import hospitalFile from "./fixtures/hospital.handwritten.json";
import baseJson from "./fixtures/session.handwritten.json";
import planJson from "./fixtures/session.handwritten.plan.json";

// The engine's output for the baseline (no policy) and for the plan run, parsed
// as strictly as callEngine parses a reply. The expectations below are written
// from the fixtures, not from their numbers, so the engine's real output
// (engine/tests/fixtures/app_session.demo.mri_2*.json) drops in by changing the
// three imports above.
const base = AppSession.parse(baseJson);
const plan = AppSession.parse(planJson);
const hospital = hospitalFile.hospital;
const policy = { strategy: "isolate", name: "Isolate admin", rules: [], rationale: "r", tradeoff: "t" };

// ------------------------------------------------------------ a fake module
// The run table and the reducers the driver depends on, as INTEGRATION.md 5b
// specifies them. Like the SDK, a transaction updates every row first, then
// fires the callbacks, and a reducer's own update lands before its promise
// resolves.

type Row = RunInfo & { autoplay: boolean; detail: string };
type Listener = (...args: any[]) => void;

let rows: Row[];
let calls: [string, any][];
let listeners: { insert: Listener[]; update: Listener[]; delete: Listener[] };
let engineReply: (body: AppSessionRequest) => EngineReply;
let beforeApply: (() => void) | undefined;
/** A refusal for the whole call, as the module would give it; checked before the run rules. */
let refuseFrames: ((items: { runId: string; frame: any }[]) => string | undefined) | undefined;
/** How many run_fail calls to refuse, as the module does for a caller that isn't the server identity. */
let failRefusals: number;
let applyDelay: number;
let inFlight: number;
let maxInFlight: number;

const conn = {
  db: {
    run: {
      onInsert: (cb: Listener) => listeners.insert.push(cb),
      onUpdate: (cb: Listener) => listeners.update.push(cb),
      onDelete: (cb: Listener) => listeners.delete.push(cb),
    },
  },
} as any;

const find = (id: string) => rows.find((r) => r.id === id)!;
const keyOf = (r: Row) => r.pairId || r.id;
const under = (id: string) => rows.filter((r) => keyOf(r) === keyOf(find(id)));

function insert(...added: Row[]): void {
  rows.push(...added);
  for (const r of added) for (const cb of listeners.insert) cb({}, r);
}

function update(changed: Row[]): void {
  const pairs = changed.map((n) => {
    const i = rows.findIndex((r) => r.id === n.id);
    const before = rows[i];
    rows[i] = n;
    return [before, n] as const;
  });
  for (const [before, n] of pairs) for (const cb of listeners.update) cb({}, before, n);
}

function newRun(id: string, over: Partial<Row> = {}): Row {
  return {
    id, sessionId: "demo", pairId: "", patientZero: "ws_admin", policyJson: "", challengesJson: "[]",
    status: "requested", tick: 0, finalTick: 0, speed: 1, stepPending: false, autoplay: true, detail: "", ...over,
  };
}

/** What other clients do: the presenter reducers, applied to every run under the key. */
const presenter = {
  start: (id: string, over: Partial<Row> = {}) => insert(newRun(id, over)),
  pause: (id: string) => update(under(id).filter((r) => r.status === "running").map((r) => ({ ...r, status: "paused" }))),
  resume: (id: string) => update(under(id).filter((r) => r.status === "paused").map((r) => ({ ...r, status: "running" }))),
  speed: (id: string, speed: number) => update(under(id).map((r) => ({ ...r, speed }))),
  step: (id: string) => update(under(id).filter((r) => r.status === "paused").map((r) => ({ ...r, stepPending: true }))),
  reset: (id: string) => update(under(id).map((r) => ({
    ...r, status: "requested", tick: 0, finalTick: 0, autoplay: false, stepPending: false, detail: "",
  }))),
};

const reducers = {
  runFramesApply: async ({ framesJson }: { framesJson: string }) => {
    const items = JSON.parse(framesJson) as { runId: string; frame: any }[];
    calls.push(["runFramesApply", items]);
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    try {
      if (applyDelay) await new Promise((r) => setTimeout(r, applyDelay));
      beforeApply?.(); // another client's transaction that lands first
      beforeApply = undefined;
      const refusal = refuseFrames?.(items);
      if (refusal) throw new Error(refusal);
      // The module's run rules (ingest.ts checkAgainstRun), checked before anything is written.
      const next = items.map(({ runId, frame }, i) => {
        const r = find(runId);
        const path = `frames[${i}]`;
        if (r.status === "requested") {
          if (frame.tick !== 0) throw new Error(`${path}: run "${r.id}" is waiting for frame 0, not tick ${frame.tick}.`);
        } else {
          if (r.status !== "running" && r.status !== "paused") throw new Error(`${path}: run "${r.id}" is ${r.status} and takes no frames.`);
          if (frame.tick !== r.tick + 1) throw new Error(`${path}: run "${r.id}" is at tick ${r.tick}, so the next frame is tick ${r.tick + 1}, not ${frame.tick}.`);
          if (r.status === "paused" && !r.stepPending) throw new Error(`${path}: run "${r.id}" is paused and no step was asked for.`);
        }
        const n: Row = { ...r, tick: frame.tick, stepPending: false };
        if (frame.run) {
          n.finalTick = frame.run.finalTick;
          n.status = r.autoplay ? "running" : "paused";
        }
        if (frame.final) n.status = "done";
        return n;
      });
      update(next);
    } finally {
      inFlight -= 1;
    }
  },
  runFail: async ({ runId, detail }: { runId: string; detail: string }) => {
    calls.push(["runFail", { runId, detail }]);
    if (failRefusals > 0) {
      failRefusals -= 1;
      throw new Error("Only the server identity can call this reducer.");
    }
    update([{ ...find(runId), status: "error", stepPending: false, detail }]);
  },
};

const engine = async (body: AppSessionRequest): Promise<EngineReply> => {
  calls.push(["engine", body]);
  return engineReply(body);
};

function start(): void {
  watchRuns(conn, {
    reducers: reducers as any, engine,
    runs: () => rows.map((r) => ({ ...r })),
    hospital: (id) => (id === "demo" ? hospital : undefined),
  });
}

// ------------------------------------------------------------ helpers

const settle = () => vi.advanceTimersByTimeAsync(0);
const wait = (ms: number) => vi.advanceTimersByTimeAsync(ms);
const engineCall = (over: Partial<AppSessionRequest> = {}) =>
  ["engine", { hospital, patient_zero: "ws_admin", policy: null, challenges: [], ...over }] as [string, any];
const frameCall = (...items: [string, AppSession, number][]) =>
  ["runFramesApply", items.map(([runId, s, tick]) => ({ runId, frame: s.frames[tick] }))] as [string, any];
/** The (runId@tick) of each runFramesApply call, one string per call. */
const applied = () => calls.filter((c) => c[0] === "runFramesApply").map((c) => c[1].map((i: any) => `${i.runId}@${i.frame.tick}`).join(" "));

beforeEach(() => {
  vi.useFakeTimers();
  rows = [];
  calls = [];
  listeners = { insert: [], update: [], delete: [] };
  engineReply = (body) => ({ ok: true, session: body.policy ? plan : base });
  beforeApply = undefined;
  refuseFrames = undefined;
  failRefusals = 0;
  applyDelay = 0;
  inFlight = 0;
  maxInFlight = 0;
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ------------------------------------------------------------ tests

describe("run driver", () => {
  it("plays fixtures long enough for these tests", () => {
    expect(base.finalTick).toBeGreaterThanOrEqual(3); // the restart test continues runs from ticks 1 and 2
    expect(plan.finalTick).toBeGreaterThanOrEqual(1); // the pair test steps both sides once
  });

  it("computes a requested run, applies frame 0, then one frame per beat until done", async () => {
    start();
    presenter.start("run_1");
    await settle();
    expect(calls).toEqual([engineCall(), frameCall(["run_1", base, 0])]);
    expect(find("run_1")).toMatchObject({ status: "running", tick: 0, finalTick: base.finalTick });

    await wait(TICK_MS - 1);
    expect(applied()).toHaveLength(1);
    await wait(1);
    expect(applied()).toEqual(["run_1@0", "run_1@1"]);

    await wait(TICK_MS * (base.finalTick + 5));
    expect(calls).toEqual([engineCall(), ...base.frames.map((_, t) => frameCall(["run_1", base, t]))]);
    expect(find("run_1")).toMatchObject({ status: "done", tick: base.finalTick });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("paces beats at TICK_MS / speed and restarts the beat when the speed changes", async () => {
    start();
    presenter.start("run_1", { speed: 4 });
    await settle();
    await wait(TICK_MS / 4);
    expect(applied()).toEqual(["run_1@0", "run_1@1"]);

    await wait(100);
    presenter.speed("run_1", 0.5); // the next beat is TICK_MS / 0.5 from now
    await wait(TICK_MS / 0.5 - 1);
    expect(applied()).toHaveLength(2);
    await wait(1);
    expect(applied()).toEqual(["run_1@0", "run_1@1", "run_1@2"]);
  });

  it("stops on pause and continues from run.tick + 1 on resume", async () => {
    start();
    presenter.start("run_1");
    await settle();
    await wait(TICK_MS);
    presenter.pause("run_1");
    await settle();
    expect(vi.getTimerCount()).toBe(0);
    await wait(TICK_MS * 10);
    expect(applied()).toEqual(["run_1@0", "run_1@1"]);

    presenter.resume("run_1");
    await wait(TICK_MS);
    expect(applied()).toEqual(["run_1@0", "run_1@1", "run_1@2"]);
    expect(calls.filter((c) => c[0] === "engine")).toHaveLength(1); // the cached frames, not a recompute
  });

  it("sends one frame at once for a step while paused, and nothing else", async () => {
    start();
    presenter.start("run_1", { autoplay: false });
    await settle();
    expect(find("run_1").status).toBe("paused");
    await wait(TICK_MS * 5);
    expect(applied()).toEqual(["run_1@0"]);

    presenter.step("run_1");
    await settle();
    expect(applied()).toEqual(["run_1@0", "run_1@1"]);
    expect(find("run_1")).toMatchObject({ status: "paused", tick: 1, stepPending: false });
    await wait(TICK_MS * 5);
    expect(applied()).toHaveLength(2);

    presenter.step("run_1");
    await settle();
    expect(applied()).toEqual(["run_1@0", "run_1@1", "run_1@2"]);
  });

  it("recomputes after a reset and waits paused on frame 0 (reset clears autoplay)", async () => {
    start();
    presenter.start("run_1");
    await settle();
    await wait(TICK_MS * 2);
    presenter.reset("run_1");
    await settle();
    expect(calls).toEqual([
      engineCall(), frameCall(["run_1", base, 0]), frameCall(["run_1", base, 1]), frameCall(["run_1", base, 2]),
      engineCall(), frameCall(["run_1", base, 0]),
    ]);
    expect(find("run_1")).toMatchObject({ status: "paused", tick: 0 });
    await wait(TICK_MS * 5);
    expect(applied()).toHaveLength(4);

    presenter.resume("run_1");
    await wait(TICK_MS);
    expect(applied().at(-1)).toBe("run_1@1");
  });

  it("computes both sides of a pair, applies both frame 0s in one call, and keeps them in lockstep", async () => {
    start();
    const pairId = "pair_rec_1_1";
    insert( // solution_start: both runs in one transaction
      newRun(`${pairId}_none`, { pairId }),
      newRun(`${pairId}_plan`, { pairId, policyJson: JSON.stringify(policy) }),
    );
    await settle();
    expect(calls).toEqual([
      engineCall(), engineCall({ policy }),
      frameCall([`${pairId}_none`, base, 0], [`${pairId}_plan`, plan, 0]),
    ]);

    // One call per beat holds every side still playing; the longer side plays on alone.
    const sides = [[`${pairId}_none`, base], [`${pairId}_plan`, plan]] as const;
    const beat = (t: number) => sides.filter(([, s]) => s.finalTick >= t).map(([id]) => `${id}@${t}`).join(" ");
    const longest = Math.max(base.finalTick, plan.finalTick);
    await wait(TICK_MS * (longest + 3));
    expect(applied()).toEqual(Array.from({ length: longest + 1 }, (_, t) => beat(t)));
    expect(rows.map((r) => r.status)).toEqual(["done", "done"]);

    // Pause, step and reset apply to the whole key, and a reset recomputes both sides.
    presenter.reset(`${pairId}_plan`);
    await settle();
    expect(calls.slice(-3)).toEqual([
      engineCall(), engineCall({ policy }),
      frameCall([`${pairId}_none`, base, 0], [`${pairId}_plan`, plan, 0]),
    ]);
    presenter.step(`${pairId}_none`);
    await settle();
    expect(applied().at(-1)).toBe(beat(1));
  });

  it("forwards a run's policy and challenges to the engine as they are", async () => {
    start();
    presenter.start("run_1", { policyJson: JSON.stringify(policy), challengesJson: '["unknown_device_imaging"]' });
    await settle();
    expect(calls[0]).toEqual(engineCall({ policy, challenges: ["unknown_device_imaging"] }));
  });

  it("ends the run with run_fail when the engine refuses it", async () => {
    engineReply = () => ({ ok: false, detail: "Engine refused the run (invalid_app_input): patient zero 'mri_1' is a medical device" });
    start();
    presenter.start("run_1", { patientZero: "mri_1" });
    await settle();
    expect(calls).toEqual([
      engineCall({ patient_zero: "mri_1" }),
      ["runFail", { runId: "run_1", detail: "Engine refused the run (invalid_app_input): patient zero 'mri_1' is a medical device" }],
    ]);
    expect(find("run_1").status).toBe("error");
    await wait(TICK_MS * 5);
    expect(calls).toHaveLength(2);
  });

  it("fails only the side the engine refuses, and starts the other", async () => {
    engineReply = (body) => (body.policy ? { ok: false, detail: "Engine refused the run (invalid_policy): unknown zone 'lab' in rule r1" } : { ok: true, session: base });
    start();
    insert(newRun("p_none", { pairId: "p" }), newRun("p_plan", { pairId: "p", policyJson: JSON.stringify(policy) }));
    await settle();
    expect(calls).toEqual([
      engineCall(), engineCall({ policy }),
      ["runFail", { runId: "p_plan", detail: "Engine refused the run (invalid_policy): unknown zone 'lab' in rule r1" }],
      frameCall(["p_none", base, 0]),
    ]);
  });

  it("fails the run on bad inputs without calling the engine", async () => {
    start();
    presenter.start("run_x", { sessionId: "gone" });
    presenter.start("run_p", { policyJson: "[1]" });
    presenter.start("run_c", { challengesJson: "{" });
    await settle();
    expect(calls).toEqual([
      ["runFail", { runId: "run_x", detail: 'The watcher can\'t read the hospital of session "gone".' }],
      ["runFail", { runId: "run_p", detail: "The run's policy is not a JSON object." }],
      ["runFail", { runId: "run_c", detail: "The run's challenges are not a JSON list of ids." }],
    ]);
  });

  it("ends the run with run_fail when the module refuses the same frame twice", async () => {
    const flowRefusal = 'frames[0].frame.attempts[0].flowId names flow "fl_9", which is not in the session\'s hospital.';
    start();
    presenter.start("run_1");
    await settle();
    refuseFrames = (items) => (items[0].frame.tick === 1 ? flowRefusal : undefined);
    await wait(TICK_MS); // the first refusal could be a race, so the frame goes again on the next beat
    expect(applied()).toEqual(["run_1@0", "run_1@1"]);
    expect(find("run_1")).toMatchObject({ status: "running", tick: 0 });
    await wait(TICK_MS);
    expect(applied()).toEqual(["run_1@0", "run_1@1", "run_1@1"]);
    expect(calls.at(-1)).toEqual(["runFail", { runId: "run_1", detail: `SpacetimeDB refused engine frame 1: ${flowRefusal}` }]);
    expect(find("run_1").status).toBe("error");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("sends a refused step once more at once, and fails a refused frame 0 with no resend", async () => {
    start();
    presenter.start("run_1", { autoplay: false });
    await settle();
    refuseFrames = () => "frames[0].frame.devices[0].deviceId must be a string.";
    presenter.step("run_1");
    await settle();
    expect(applied()).toEqual(["run_1@0", "run_1@1", "run_1@1"]);
    expect(calls.at(-1)).toEqual(["runFail", { runId: "run_1", detail: "SpacetimeDB refused engine frame 1: frames[0].frame.devices[0].deviceId must be a string." }]);

    calls = [];
    refuseFrames = () => "frames[0]: frame 0 must list every device (6), not 5.";
    presenter.start("run_2");
    await settle();
    expect(calls).toEqual([
      engineCall(), frameCall(["run_2", base, 0]),
      ["runFail", { runId: "run_2", detail: "SpacetimeDB refused engine frame 0: frames[0]: frame 0 must list every device (6), not 5." }],
    ]);
  });

  it("does not fail a run when a pause lands just before its frame", async () => {
    start();
    presenter.start("run_1");
    await settle();
    beforeApply = () => presenter.pause("run_1");
    await wait(TICK_MS);
    expect(calls.map((c) => c[0])).toEqual(["engine", "runFramesApply", "runFramesApply"]); // the second was refused
    expect(find("run_1")).toMatchObject({ status: "paused", tick: 0 });

    presenter.resume("run_1");
    await wait(TICK_MS);
    expect(applied().at(-1)).toBe("run_1@1");
    expect(calls.some((c) => c[0] === "runFail")).toBe(false);
  });

  it("does not fail a run when a pause and a resume land around its frame", async () => {
    start();
    presenter.start("run_1");
    await settle();
    // The pause commits just before the beat's call and the resume just after it. The SDK hands over the
    // refusal only after both updates, so the row looks as it did when the frame was built.
    refuseFrames = () => {
      refuseFrames = undefined;
      presenter.pause("run_1");
      presenter.resume("run_1");
      return 'frames[0]: run "run_1" is paused and no step was asked for.';
    };
    await wait(TICK_MS);
    expect(find("run_1")).toMatchObject({ status: "running", tick: 0 });
    await wait(TICK_MS);
    expect(applied()).toEqual(["run_1@0", "run_1@1", "run_1@1"]);
    expect(find("run_1")).toMatchObject({ status: "running", tick: 1 });
    expect(calls.some((c) => c[0] === "runFail")).toBe(false);
  });

  it("leaves a run alone when SpacetimeDB won't record its failure, instead of recomputing it in a loop", async () => {
    failRefusals = 20; // a cap, so a loop shows up as a count, not a hang
    engineReply = () => ({ ok: false, detail: "Engine refused the run (invalid_app_input): patient zero 'mri_1' is a medical device" });
    start();
    presenter.start("run_1", { patientZero: "mri_1" });
    await settle();
    await wait(TICK_MS * 5);
    expect(calls.map((c) => c[0])).toEqual(["engine", "runFail"]);
    expect(find("run_1").status).toBe("requested");
    expect(vi.getTimerCount()).toBe(0);

    // A row change (the speed control also reaches a requested run) earns one more try.
    failRefusals = 0;
    presenter.speed("run_1", 2);
    await settle();
    expect(calls.map((c) => c[0])).toEqual(["engine", "runFail", "engine", "runFail"]);
    expect(find("run_1").status).toBe("error");

    // A refused frame 0 whose failure can't be recorded doesn't loop either.
    calls = [];
    failRefusals = 20;
    engineReply = () => ({ ok: true, session: base });
    refuseFrames = () => "frames[0]: frame 0 must list every device (6), not 5.";
    presenter.start("run_2");
    await settle();
    expect(calls.map((c) => c[0])).toEqual(["engine", "runFramesApply", "runFail"]);
  });

  it("stops beating a running run whose refused frame it can't record as a failure", async () => {
    start();
    presenter.start("run_1");
    await settle();
    failRefusals = 20;
    refuseFrames = () => "frames[0].frame.events[0].targetId names device \"ws_gone\", which is not in the session's hospital.";
    await wait(TICK_MS * 6);
    expect(applied()).toEqual(["run_1@0", "run_1@1", "run_1@1"]);
    expect(calls.filter((c) => c[0] === "runFail")).toHaveLength(1);
    expect(find("run_1")).toMatchObject({ status: "running", tick: 0 });
    expect(vi.getTimerCount()).toBe(0);

    // A pause and a resume move the row, so the driver tries the frame again.
    failRefusals = 0;
    refuseFrames = undefined;
    presenter.pause("run_1");
    presenter.resume("run_1");
    await wait(TICK_MS);
    expect(applied().at(-1)).toBe("run_1@1");
    expect(find("run_1")).toMatchObject({ status: "running", tick: 1 });
  });

  it("never overlaps calls: a slow apply delays the next beat", async () => {
    start();
    presenter.start("run_1", { speed: 4 });
    await settle();
    applyDelay = TICK_MS * 3;
    await wait(TICK_MS * 20);
    expect(maxInFlight).toBe(1);
    expect(applied()).toEqual(base.frames.map((_, t) => `run_1@${t}`));
  });

  it("after a restart, recomputes every run in play and continues from run.tick", async () => {
    rows = [
      newRun("run_a", { status: "running", tick: 1, finalTick: base.finalTick }),
      newRun("run_b", { status: "paused", tick: 0, finalTick: base.finalTick, stepPending: true }),
      newRun("run_c"),
      newRun("run_d", { status: "paused", tick: 2, finalTick: base.finalTick }),
      newRun("run_e", { status: "done", tick: base.finalTick, finalTick: base.finalTick }),
    ];
    start();
    await settle();
    expect(calls.filter((c) => c[0] === "engine")).toHaveLength(4); // a, b, c, d; not the finished run
    expect(applied().sort()).toEqual(["run_b@1", "run_c@0"]);

    await wait(TICK_MS);
    expect(applied()).toContain("run_a@2");
    expect(applied()).toContain("run_c@1");
    expect(find("run_d")).toMatchObject({ status: "paused", tick: 2 });
  });

  it("fails a recovered run whose recomputed frames no longer match its rows", async () => {
    const stale = base.finalTick + 4;
    rows = [newRun("run_a", { status: "running", tick: 1, finalTick: stale })];
    start();
    await settle();
    expect(calls).toEqual([
      engineCall(),
      ["runFail", { runId: "run_a", detail: `The engine now ends this run at tick ${base.finalTick}, not ${stale}. Reset the run to recompute it.` }],
    ]);
  });
});
