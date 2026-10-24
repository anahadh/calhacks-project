// Module unit tests, against the module's own contract only: reducer args in,
// public rows out. Run frames come from checked-in fixtures that follow the
// engine's TickFrame contract (INTEGRATION.md 5a), and the expected rows are
// read straight off the frames (oracle.ts); nothing here computes spread.

import { beforeEach, describe, expect, it } from "vitest";
import { ConnectionId, Timestamp } from "spacetimedb";
import { createModuleTestHarness, TestAuth } from "spacetimedb/server/test-utils";
import spacetimedb, * as mod from "../src/index";
import { DETAIL_MAX, FRAMES_MAX, KEEP_ATTEMPT_TICKS } from "../src/constants";
import {
  DEMO_HOSPITAL_JSON, ENGINE, ENGINE_FILES, HANDWRITTEN, PAIRS, actualRows, expectedRows, rowCount, type Fixture,
} from "./oracle";

const BASE = HANDWRITTEN.base;
const PLAN = HANDWRITTEN.plan;
const hospitalJson = BASE.hospitalJson;
const h = JSON.parse(hospitalJson).hospital as { devices: any[]; services: any[]; patients: any[] };

const user = (sub: string) => TestAuth.fromJwtPayload(JSON.stringify({ iss: "hippo-test", sub, aud: ["spacetimedb"] }), ConnectionId.random());
const SERVER = user("server");
const ANA = user("ana"); // presenter, security
const DEV = user("dev"); // clinical engineering
const OBS = user("obs"); // observer

type H = ReturnType<typeof createModuleTestHarness<any>>;
let t: H;
const call = (auth: any, fn: any, args: object = {}) => t.withReducerTx(auth, (ctx: any) => fn(ctx, args));
const rows = (table: string) => [...(t.db as any)[table].iter()] as any[];
const runRow = (id: string) => rows("run").find((r) => r.id === id);
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

function startRun(over: Partial<Record<string, unknown>> = {}) {
  call(ANA, mod.run_start, {
    session_id: "demo", run_id: "run_1", label: "Baseline", patient_zero: BASE.patientZero,
    seed: 1337, speed: 1, policy_json: "", pair_id: "", autoplay: true, ...over,
  });
}

/** One run_frames_apply call carrying these [runId, frame] items. */
function apply(items: [string, unknown][], auth: any = SERVER) {
  call(auth, mod.run_frames_apply, { frames_json: JSON.stringify(items.map(([runId, frame]) => ({ runId, frame }))) });
}

/** Feeds frames from..to (inclusive) of a fixture, one call per tick, as the watcher does. */
function feed(runId: string, fx: Fixture, from: number, to: number) {
  for (let k = from; k <= to; k++) apply([[runId, fx.frames[k]]]);
}

/** Every row the run shows equals the frames after tick k: state, history, snapshot and the run row. */
function expectRowsAt(runId: string, fx: Fixture, k: number, status = "running") {
  expect(actualRows(runId, rows)).toEqual(expectedRows(runId, fx, k, status));
}

/** A session on the fixture's own hospital, presented by Ana. */
function sessionFor(fx: Fixture, sessionId = "fx") {
  call(ANA, mod.session_create, { session_id: sessionId, hospital_json: fx.hospitalJson });
  return sessionId;
}

const stateRowCount = (runId: string) => rowCount(runId, rows);

beforeEach(() => {
  t = createModuleTestHarness(spacetimedb as any, mod as any);
  call(SERVER, mod.init);
  call(ANA, mod.session_create, { session_id: "demo", hospital_json: hospitalJson });
  call(ANA, mod.presence_join, { session_id: "demo", name: "Ana", role: "security" });
  call(DEV, mod.presence_join, { session_id: "demo", name: "Dev", role: "clinical_engineering" });
  call(OBS, mod.presence_join, { session_id: "demo", name: "Obi", role: "observer" });
});

describe("sessions", () => {
  it("rejects a hospital file with a patient name", () => {
    const bad = JSON.parse(hospitalJson);
    bad.hospital.patients[0].name = "Jane";
    expect(() => call(ANA, mod.session_create, { session_id: "bad", hospital_json: JSON.stringify(bad) })).toThrow(/counts only/);
  });

  it("starts with no entry points and no solution open", () => {
    expect(rows("session")[0]).toMatchObject({ entry_points_json: "[]", solution_pair_id: "", active_run_id: "" });
  });

  it("stores the engine's entry points, from the server only, and run_start then refuses other devices", () => {
    const set = (auth: any, json: string) => call(auth, mod.session_entry_points_set, { session_id: "demo", entry_points_json: json });
    expect(() => set(ANA, '["ws_admin"]')).toThrow(/server identity/);
    expect(() => set(SERVER, '["nope"]')).toThrow(/does not exist/);
    expect(() => set(SERVER, '["ws_admin","ws_admin"]')).toThrow(/twice/);
    expect(() => set(SERVER, '{"a":1}')).toThrow(/list of device ids/);
    set(SERVER, '["ws_admin","ws_er"]');
    expect(rows("session")[0].entry_points_json).toBe('["ws_admin","ws_er"]');
    expect(() => startRun({ patient_zero: "mri_1" })).toThrow(/"mri_1" is not one of the engine's entry points/);
    expect(rows("run")).toHaveLength(0);
    startRun({ patient_zero: "ws_er" });
    expect(runRow("run_1").patient_zero).toBe("ws_er");
  });

  it("accepts the demo hospital the engine's frames are computed from", () => {
    call(ANA, mod.session_create, { session_id: "demo_hospital", hospital_json: DEMO_HOSPITAL_JSON });
    call(SERVER, mod.session_entry_points_set, { session_id: "demo_hospital", entry_points_json: '["mri_2"]' });
    startRun({ session_id: "demo_hospital", run_id: "d", patient_zero: "mri_2" });
    expect(runRow("d")).toMatchObject({ status: "requested", patient_zero: "mri_2" });
    expect(rows("session").find((s) => s.id === "demo_hospital").hospital_name).toBe(JSON.parse(DEMO_HOSPITAL_JSON).hospital.name);
  });
});

describe("run_start", () => {
  it("inserts a requested run, writes no state rows and sets the session's active run", () => {
    startRun();
    expect(runRow("run_1")).toMatchObject({
      status: "requested", tick: 0, autoplay: true, step_pending: false, final_tick: 0, detail: "",
      challenges_json: "[]", removed_flows_json: "[]", assumptions_json: "[]", protected_broken_json: "[]",
      recommendation_id: "", seed: 1337, policy_json: "",
    });
    expect(stateRowCount("run_1")).toBe(0);
    expect(rows("session")[0].active_run_id).toBe("run_1");
  });

  it("keeps the active run when the new run belongs to a pair", () => {
    startRun();
    startRun({ run_id: "p_left", pair_id: "p" });
    expect(rows("session")[0].active_run_id).toBe("run_1");
  });

  it("validates as before: presenter, unique id, speed, patient zero, policy JSON", () => {
    expect(() => call(DEV, mod.run_start, {
      session_id: "demo", run_id: "x", label: "", patient_zero: "ws_admin", seed: 1, speed: 1, policy_json: "", pair_id: "", autoplay: true,
    })).toThrow(/presenter/);
    expect(() => startRun({ speed: 3 })).toThrow(/Speed/);
    expect(() => startRun({ patient_zero: "nope" })).toThrow(/does not exist/);
    expect(() => startRun({ policy_json: "{" })).toThrow(/not valid JSON/);
    startRun({ policy_json: '{"name":"opaque"}' });
    expect(() => startRun()).toThrow(/already exists/);
  });
});

describe("run_frames_apply (ingestion)", () => {
  it("is server only, as are run_fail and session_entry_points_set", () => {
    startRun();
    expect(() => apply([["run_1", BASE.frames[0]]], ANA)).toThrow(/server identity/);
    expect(() => apply([["run_1", BASE.frames[0]]], DEV)).toThrow(/server identity/);
    expect(() => call(ANA, mod.run_fail, { run_id: "run_1", detail: "x" })).toThrow(/server identity/);
    expect(() => call(ANA, mod.session_entry_points_set, { session_id: "demo", entry_points_json: "[]" })).toThrow(/server identity/);
    expect(runRow("run_1").status).toBe("requested");
    expect(stateRowCount("run_1")).toBe(0);
  });

  it("frame 0 writes every device, service and patient row, the history and the run's engine columns", () => {
    startRun();
    apply([["run_1", BASE.frames[0]]]);
    expect(rows("device_state")).toHaveLength(h.devices.length);
    expect(rows("service_state")).toHaveLength(h.services.length);
    expect(rows("patient_state")).toHaveLength(h.patients.length);
    expect(rows("device_state").find((d) => d.device_id === "ws_admin")).toMatchObject({
      id: "run_1:ws_admin", infected: true, infected_at_tick: 0, infected_by: "",
    });
    expect(rows("tick_snapshot")).toHaveLength(1);
    expect(rows("sim_event")).toEqual([expect.objectContaining({ tick: 0, kind: "patient_zero", target_id: "ws_admin" })]);
    expectRowsAt("run_1", BASE, 0);
    const run0 = BASE.frames[0].run!;
    expect(runRow("run_1")).toMatchObject({
      status: "running", final_tick: BASE.finalTick,
      removed_flows_json: JSON.stringify(run0.removedFlows), protected_broken_json: JSON.stringify(run0.protectedBroken),
      assumptions_json: JSON.stringify(run0.assumptions),
    });
  });

  it("updates rows on a later frame instead of inserting", () => {
    startRun();
    feed("run_1", BASE, 0, 1);
    expect(rows("device_state")).toHaveLength(h.devices.length);
    expect(rows("device_state").find((d) => d.device_id === "srv_file")).toMatchObject({
      infected: true, infected_at_tick: 1, infected_by: "ws_admin",
    });
  });

  it("keeps only the latest spread attempts", () => {
    startRun();
    feed("run_1", BASE, 0, BASE.finalTick);
    const tick = runRow("run_1").tick;
    const left = rows("spread_attempt");
    expect(left.length).toBeGreaterThan(0);
    expect(left.every((a) => a.tick > tick - KEEP_ATTEMPT_TICKS)).toBe(true);
  });

  it("refuses frames out of order, and a refused call writes nothing", () => {
    startRun();
    expect(() => apply([["run_1", BASE.frames[1]]])).toThrow(/waiting for frame 0/);
    apply([["run_1", BASE.frames[0]]]);
    expect(() => apply([["run_1", BASE.frames[0]]])).toThrow(/only frame 0 carries run/);
    expect(() => apply([["run_1", BASE.frames[2]]])).toThrow(/next frame is tick 1, not 2/);
    expect(runRow("run_1").tick).toBe(0);
    expect(rows("tick_snapshot")).toHaveLength(1);
  });

  it("refuses an incomplete frame 0, a frame 0 without run, and the wrong final flag", () => {
    startRun();
    const missing = clone(BASE.frames[0]);
    missing.devices.pop();
    expect(() => apply([["run_1", missing]])).toThrow(/every device \(6\), not 5/);
    const noRun = clone(BASE.frames[0]);
    delete noRun.run;
    expect(() => apply([["run_1", noRun]])).toThrow(/frame 0 must carry run/);
    const early = clone(BASE.frames[0]);
    early.final = true;
    expect(() => apply([["run_1", early]])).toThrow(/final must be true exactly on tick 3/);
    expect(stateRowCount("run_1")).toBe(0);
  });

  it("refuses ids the session's hospital lacks, unknown fields and unknown event kinds", () => {
    startRun();
    const bad = (edit: (f: any) => void) => {
      const f = clone(BASE.frames[0]);
      edit(f);
      return () => apply([["run_1", f]]);
    };
    expect(bad((f) => (f.devices[1].deviceId = "ghost"))).toThrow(/device "ghost", which is not in the session's hospital/);
    expect(bad((f) => (f.services[0].serviceId = "svc_x"))).toThrow(/service "svc_x"/);
    expect(bad((f) => (f.patients[0].groupId = "pg_x"))).toThrow(/patient group "pg_x"/);
    expect(bad((f) => f.attempts.push({ from: "ws_admin", to: "srv_file", flowId: "fl_99", success: true }))).toThrow(/flow "fl_99"/);
    expect(bad((f) => (f.snapshot.infectedIds = ["ghost"]))).toThrow(/device "ghost"/);
    expect(bad((f) => (f.run.removedFlows = ["fl_99"]))).toThrow(/flow "fl_99"/);
    expect(bad((f) => (f.events[0].kind = "outcome"))).toThrow(/kind must be one of/);
    expect(bad((f) => (f.events[0].kind = "toString"))).toThrow(/kind must be one of/);
    expect(bad((f) => (f.extra = 1))).toThrow(/unknown field "extra"/);
    expect(bad((f) => (f.devices[1].infectedAtTick = 0))).toThrow(/not infected, so infectedAtTick must be -1/);
    expect(bad((f) => (f.patients[0].state = "worse"))).toThrow(/state must be one of/);
    expect(stateRowCount("run_1")).toBe(0);
  });

  it("refuses unknown runs, the same run twice in one call, empty calls and calls over the size cap", () => {
    startRun();
    expect(() => apply([["ghost", BASE.frames[0]]])).toThrow(/Run "ghost" does not exist/);
    expect(() => apply([["run_1", BASE.frames[0]], ["run_1", BASE.frames[0]]])).toThrow(/appears twice/);
    expect(() => call(SERVER, mod.run_frames_apply, { frames_json: "[]" })).toThrow(/no frames/);
    expect(() => call(SERVER, mod.run_frames_apply, { frames_json: "{" })).toThrow(/not valid JSON/);
    const items = JSON.stringify([{ runId: "run_1", frame: BASE.frames[0] }]);
    const padded = (n: number) => items.slice(0, -1) + " ".repeat(n - Buffer.byteLength(items, "utf8")) + "]";
    expect(() => call(SERVER, mod.run_frames_apply, { frames_json: padded(FRAMES_MAX + 1) })).toThrow(/larger than 256 KiB/);
    call(SERVER, mod.run_frames_apply, { frames_json: padded(FRAMES_MAX) }); // at the cap is fine
    expect(runRow("run_1").status).toBe("running");
  });

  it("measures the size cap in UTF-8 bytes, not characters", () => {
    startRun();
    // "…" is one character and three UTF-8 bytes; "😀" is two UTF-16 units and four bytes.
    const wide = (text: string, bytes: number) => {
      const f = clone(BASE.frames[0]);
      f.events[0].text = text;
      const items = JSON.stringify([{ runId: "run_1", frame: f }]);
      const size = Buffer.byteLength(items, "utf8");
      return items.slice(0, -1) + " ".repeat(bytes - size) + "]";
    };
    const many = "…".repeat(80_000) + "😀".repeat(10);
    expect(Buffer.byteLength(wide(many, FRAMES_MAX + 1), "utf8")).toBe(FRAMES_MAX + 1);
    expect(wide(many, FRAMES_MAX + 1).length).toBeLessThan(FRAMES_MAX); // under the cap in characters
    expect(() => call(SERVER, mod.run_frames_apply, { frames_json: wide(many, FRAMES_MAX + 1) })).toThrow(/larger than 256 KiB/);
    expect(runRow("run_1").status).toBe("requested");
    call(SERVER, mod.run_frames_apply, { frames_json: wide(many, FRAMES_MAX) }); // exactly 256 KiB of bytes lands
    expect(rows("sim_event")[0].text).toBe(many);
  });

  it("lands frame 0 paused without autoplay, and a paused run takes one frame per step", () => {
    startRun({ autoplay: false });
    apply([["run_1", BASE.frames[0]]]);
    expect(runRow("run_1").status).toBe("paused");
    expect(() => apply([["run_1", BASE.frames[1]]])).toThrow(/paused and no step was asked for/);
    call(ANA, mod.run_step, { run_id: "run_1" });
    expect(runRow("run_1").step_pending).toBe(true);
    apply([["run_1", BASE.frames[1]]]);
    expect(runRow("run_1")).toMatchObject({ tick: 1, status: "paused", step_pending: false });
    expect(() => apply([["run_1", BASE.frames[2]]])).toThrow(/no step was asked for/);
  });

  it("stores a blocked attempt as a success:false row, and the plan's removed flows on the run", () => {
    startRun({ policy_json: '{"name":"plan"}' });
    apply([["run_1", PLAN.frames[0]]]);
    expect(runRow("run_1")).toMatchObject({ removed_flows_json: '["fl_1"]', final_tick: PLAN.finalTick });
    expect(rows("spread_attempt")).toEqual([
      expect.objectContaining({ tick: 0, from_device: "ws_admin", to_device: "srv_file", flow_id: "fl_1", success: false }),
    ]);
  });
});

// ---------------------------------------------------------------- the core oracle
// Every fixture present (the engine's real frames first, once copied in) replays
// through run_frames_apply one tick per call, as the watcher sends it. After
// every call the run's rows must equal the frames exactly: device, service and
// patient state, the spread attempts kept (blocked ones included), the events,
// the snapshots, and the run row's engine columns.

const FIXTURES = PAIRS.flatMap((p) => [p.base, p.plan]);
const MISSING = `the engine's real frames: ${ENGINE_FILES.join(", ")} are not in test/fixtures yet`;

describe("run oracle", () => {
  it.each(FIXTURES.map((fx) => [fx.name, fx] as const))("%s lands as exactly its frames, tick by tick, then done", (_name, fx) => {
    const session_id = sessionFor(fx);
    startRun({ session_id, run_id: "r", patient_zero: fx.patientZero });
    expect(stateRowCount("r")).toBe(0);
    for (let k = 0; k <= fx.finalTick; k++) {
      apply([["r", fx.frames[k]]]);
      expectRowsAt("r", fx, k);
    }
    expect(runRow("r").status).toBe("done");
    expect(() => apply([["r", fx.frames[fx.finalTick]]])).toThrow(/done and takes no frames/);
  });

  if (!ENGINE) it.skip(MISSING, () => {});
});

describe("lockstep pair", () => {
  it.each(PAIRS.map((p) => [p.name, p] as const))("%s: both frame 0s in one call or neither, one beat per call, the shorter run ends first", (_name, pair) => {
    const session_id = sessionFor(pair.base);
    const sides = [["left", pair.base], ["right", pair.plan]] as const;
    startRun({ session_id, run_id: "left", patient_zero: pair.base.patientZero, pair_id: "pair_1" });
    startRun({ session_id, run_id: "right", patient_zero: pair.plan.patientZero, pair_id: "pair_1", policy_json: '{"name":"plan"}' });

    const broken = clone(pair.plan.frames[0]);
    broken.devices[0].deviceId = "ghost";
    expect(() => apply([["left", pair.base.frames[0]], ["right", broken]])).toThrow(/ghost/);
    expect(stateRowCount("left") + stateRowCount("right")).toBe(0);
    expect([runRow("left").status, runRow("right").status]).toEqual(["requested", "requested"]);

    const [short, long] = [...sides].sort((a, b) => a[1].finalTick - b[1].finalTick);
    for (let beat = 0; beat <= long[1].finalTick; beat++) {
      // As the watcher does: every run under the key that still takes frames, in one call.
      const live = sides.filter(([, fx]) => beat <= fx.finalTick);
      if (live.length < sides.length) {
        // A frame for the finished side is refused, and so is the whole call.
        expect(() => apply(sides.map(([id, fx]) => [id, fx.frames[Math.min(beat, fx.finalTick)]] as [string, unknown])))
          .toThrow(/done and takes no frames/);
      }
      apply(live.map(([id, fx]) => [id, fx.frames[beat]] as [string, unknown]));
      for (const [id, fx] of sides) expectRowsAt(id, fx, Math.min(beat, fx.finalTick));
      if (beat === short[1].finalTick && short[1].finalTick < long[1].finalTick) {
        expect([runRow(short[0]).status, runRow(long[0]).status]).toEqual(["done", "running"]);
      }
    }
    expect([runRow("left").status, runRow("right").status]).toEqual(["done", "done"]);
  });

  if (!ENGINE) it.skip(MISSING, () => {});
});

describe("run_fail", () => {
  it("marks the run error with the detail, truncated", () => {
    startRun();
    call(SERVER, mod.run_fail, { run_id: "run_1", detail: "Engine refused the run (invalid_app_input): " + "x".repeat(600) });
    const r = runRow("run_1");
    expect(r.status).toBe("error");
    expect(r.detail).toHaveLength(DETAIL_MAX);
    expect(r.detail).toMatch(/^Engine refused the run/);
    expect(() => apply([["run_1", BASE.frames[0]]])).toThrow(/error and takes no frames/);
    expect(() => call(SERVER, mod.run_fail, { run_id: "ghost", detail: "" })).toThrow(/does not exist/);
  });
});

describe("playback (presenter reducers the watcher obeys)", () => {
  it("lets only the presenter control playback", () => {
    startRun();
    apply([["run_1", BASE.frames[0]]]);
    expect(() => call(DEV, mod.run_pause, { run_id: "run_1" })).toThrow(/presenter/);
    expect(() => call(DEV, mod.run_reset, { run_id: "run_1" })).toThrow(/presenter/);
    call(ANA, mod.run_pause, { run_id: "run_1" });
    expect(runRow("run_1").status).toBe("paused");
    call(ANA, mod.run_set_speed, { run_id: "run_1", speed: 2 });
    expect(() => call(ANA, mod.run_set_speed, { run_id: "run_1", speed: 3 })).toThrow(/Speed/);
    call(ANA, mod.run_resume, { run_id: "run_1" });
    expect(runRow("run_1")).toMatchObject({ status: "running", speed: 2 });
  });

  it("refuses resume and step on a requested, done or failed run, and step while running", () => {
    startRun();
    expect(() => call(ANA, mod.run_resume, { run_id: "run_1" })).toThrow(/still being computed/);
    expect(() => call(ANA, mod.run_step, { run_id: "run_1" })).toThrow(/still being computed/);
    apply([["run_1", BASE.frames[0]]]);
    expect(() => call(ANA, mod.run_step, { run_id: "run_1" })).toThrow(/Pause the run/);
    feed("run_1", BASE, 1, BASE.finalTick);
    expect(() => call(ANA, mod.run_resume, { run_id: "run_1" })).toThrow(/finished/);
    expect(() => call(ANA, mod.run_step, { run_id: "run_1" })).toThrow(/finished/);
    startRun({ run_id: "run_2" });
    call(SERVER, mod.run_fail, { run_id: "run_2", detail: "boom" });
    expect(() => call(ANA, mod.run_resume, { run_id: "run_2" })).toThrow(/failed/);
  });

  it("pauses, resumes, steps and sets the speed of a whole pair", () => {
    startRun({ run_id: "left", pair_id: "pair_1" });
    startRun({ run_id: "right", pair_id: "pair_1" });
    apply([["left", BASE.frames[0]], ["right", PLAN.frames[0]]]);
    call(ANA, mod.run_pause, { run_id: "right" });
    expect([runRow("left").status, runRow("right").status]).toEqual(["paused", "paused"]);
    call(ANA, mod.run_step, { run_id: "left" });
    expect([runRow("left").step_pending, runRow("right").step_pending]).toEqual([true, true]);
    call(ANA, mod.run_set_speed, { run_id: "left", speed: 4 });
    expect([runRow("left").speed, runRow("right").speed]).toEqual([4, 4]);
    call(ANA, mod.run_resume, { run_id: "left" });
    expect([runRow("left").status, runRow("right").status]).toEqual(["running", "running"]);
  });

  it("resumes and steps a pair through the side that already finished", () => {
    startRun({ run_id: "left", pair_id: "pair_1" });
    startRun({ run_id: "right", pair_id: "pair_1" });
    apply([["left", BASE.frames[0]], ["right", PLAN.frames[0]]]);
    apply([["left", BASE.frames[1]], ["right", PLAN.frames[1]]]);
    expect([runRow("left").status, runRow("right").status]).toEqual(["running", "done"]);
    expect(() => call(ANA, mod.run_step, { run_id: "right" })).toThrow(/Pause the run/);
    call(ANA, mod.run_pause, { run_id: "right" });
    call(ANA, mod.run_step, { run_id: "right" });
    expect([runRow("left").step_pending, runRow("right").step_pending]).toEqual([true, false]);
    apply([["left", BASE.frames[2]]]);
    call(ANA, mod.run_resume, { run_id: "right" });
    expect([runRow("left").status, runRow("right").status]).toEqual(["running", "done"]);
    apply([["left", BASE.frames[3]]]);
    expect(() => call(ANA, mod.run_resume, { run_id: "right" })).toThrow(/finished/);
    expect(() => call(ANA, mod.run_step, { run_id: "left" })).toThrow(/finished/);
  });

  it("drops a pending step on resume and on pause, so a paused run takes no frame nobody asked for", () => {
    startRun({ autoplay: false });
    apply([["run_1", BASE.frames[0]]]);
    call(ANA, mod.run_step, { run_id: "run_1" });
    call(ANA, mod.run_resume, { run_id: "run_1" });
    expect(runRow("run_1")).toMatchObject({ status: "running", step_pending: false });
    call(ANA, mod.run_pause, { run_id: "run_1" });
    expect(runRow("run_1")).toMatchObject({ status: "paused", step_pending: false });
    expect(() => apply([["run_1", BASE.frames[1]]])).toThrow(/no step was asked for/);
  });

  it("starts, resumes and steps no run while an aggregate-fix round is open (rule 5)", () => {
    const round = (state: string) => call(SERVER, mod.round_state_set, { session_id: "demo", round: 1, state, detail: "" });
    startRun();
    apply([["run_1", BASE.frames[0]]]);
    call(ANA, mod.run_pause, { run_id: "run_1" });
    call(DEV, mod.defend_request, { session_id: "demo" });
    for (const state of ["running", "waiting_for_human"]) {
      round(state);
      expect(() => call(ANA, mod.run_resume, { run_id: "run_1" })).toThrow(/finish negotiating before playing a run/);
      expect(() => call(ANA, mod.run_step, { run_id: "run_1" })).toThrow(/finish negotiating before playing a run/);
      expect(() => startRun({ run_id: "run_2" })).toThrow(/finish negotiating before starting an attack/);
      expect(() => startRun({ run_id: "p_left", pair_id: "p" })).toThrow(/finish negotiating/);
      expect(() => call(SERVER, mod.run_resume, { run_id: "run_1" })).toThrow(/finish negotiating/); // no caller is exempt
    }
    expect(runRow("run_1")).toMatchObject({ status: "paused", step_pending: false });
    expect(rows("run")).toHaveLength(1);
    expect(rows("session")[0].active_run_id).toBe("run_1");
    expect(() => apply([["run_1", BASE.frames[1]]])).toThrow(/no step was asked for/);
    round("done");
    call(ANA, mod.run_resume, { run_id: "run_1" });
    expect(runRow("run_1").status).toBe("running");
  });

  it("resets to requested with every row cleared, autoplay off, and the engine columns emptied", () => {
    startRun();
    feed("run_1", BASE, 0, 2);
    call(ANA, mod.run_reset, { run_id: "run_1" });
    expect(runRow("run_1")).toMatchObject({
      status: "requested", tick: 0, autoplay: false, step_pending: false, detail: "", final_tick: 0,
      devices_compromised: 0, choke_points_json: "[]", assumptions_json: "[]",
    });
    expect(stateRowCount("run_1")).toBe(0);
    expect(() => call(ANA, mod.run_reset, { run_id: "run_1" })).toThrow(/still being computed/);
    // The watcher recomputes: the same frames replay from 0 and land paused.
    feed("run_1", BASE, 0, 0);
    expectRowsAt("run_1", BASE, 0, "paused");
  });

  it("resets a failed run so the watcher can try again", () => {
    startRun();
    call(SERVER, mod.run_fail, { run_id: "run_1", detail: "Engine unreachable" });
    call(ANA, mod.run_reset, { run_id: "run_1" });
    expect(runRow("run_1")).toMatchObject({ status: "requested", detail: "" });
  });
});

// ---------------------------------------------------------------- solution view

const rec = (name: string) => JSON.stringify({
  policy: { strategy: "protect_critical_care", name, rules: [], rationale: "", tradeoff: "" },
  testResult: { ticks: 1 }, verdicts: [], explanation: "Why.", explanationSource: "template", requiredRoles: ["security"],
});

/** Moves the harness clock on, so rows written next carry a later timestamp. */
const later = () => t.clock.set(new Timestamp(t.clock.now().microsSinceUnixEpoch + 1_000_000n));

/** A finished baseline, a Create aggregate fix request on it, then the Coordinator's plan. */
function finishedBaselineWithRecommendation(round = 1, name = "Cut admin SMB") {
  startRun();
  feed("run_1", BASE, 0, BASE.finalTick);
  call(DEV, mod.defend_request, { session_id: "demo" });
  later();
  call(SERVER, mod.recommendation_upsert, { session_id: "demo", round, recommendation_json: rec(name), fixture: false });
}

describe("solution_start / solution_close", () => {
  it("inserts a requested lockstep pair, opens it on every tab, and keeps the baseline active", () => {
    finishedBaselineWithRecommendation();
    call(ANA, mod.solution_start, { session_id: "demo", recommendation_id: "demo:1", speed: 2 });
    const s = rows("session")[0];
    expect(s.active_run_id).toBe("run_1");
    expect(s.solution_pair_id).toBe("pair_demo_1_1");
    const pair = rows("run").filter((r) => r.pair_id === s.solution_pair_id);
    expect(pair).toHaveLength(2);
    const none = pair.find((r) => r.policy_json === "");
    const plan = pair.find((r) => r.policy_json !== "");
    expect(none).toMatchObject({ label: "No segmentation", recommendation_id: "", status: "requested", autoplay: true, speed: 2,
      patient_zero: BASE.patientZero, seed: 1337, tick: 0 });
    expect(plan).toMatchObject({ label: "With plan: Cut admin SMB", recommendation_id: "demo:1", status: "requested", autoplay: true,
      patient_zero: BASE.patientZero, challenges_json: "[]" });
    expect(JSON.parse(plan.policy_json).name).toBe("Cut admin SMB");
    expect(rows("recommendation")[0].status).toBe("draft"); // rule 9: not a deployment

    // The watcher feeds both sides in one call; the baseline's rows are untouched.
    apply([[none.id, BASE.frames[0]], [plan.id, PLAN.frames[0]]]);
    expectRowsAt("run_1", BASE, BASE.finalTick);
  });

  it("refuses while a run is computing or playing, while a round is open, and for strangers", () => {
    finishedBaselineWithRecommendation();
    const start = (auth: any = ANA, over: object = {}) =>
      () => call(auth, mod.solution_start, { session_id: "demo", recommendation_id: "demo:1", speed: 1, ...over });
    expect(start(DEV)).toThrow(/presenter/);
    expect(start(ANA, { recommendation_id: "demo:9" })).toThrow(/does not exist/);
    expect(start(ANA, { speed: 3 })).toThrow(/Speed/);
    call(SERVER, mod.round_state_set, { session_id: "demo", round: 1, state: "waiting_for_human", detail: "" });
    expect(start()).toThrow(/finish negotiating/);
    call(SERVER, mod.round_state_set, { session_id: "demo", round: 1, state: "done", detail: "" });
    startRun({ run_id: "other", pair_id: "x" });
    expect(start()).toThrow(/every run in this session/);
    expect(rows("session")[0].solution_pair_id).toBe("");
  });

  it("makes a fresh pair on each press, and solution_close returns every tab to the session", () => {
    finishedBaselineWithRecommendation();
    call(ANA, mod.solution_start, { session_id: "demo", recommendation_id: "demo:1", speed: 1 });
    const first = rows("session")[0].solution_pair_id;
    for (const r of rows("run").filter((x) => x.pair_id === first)) {
      apply([[r.id, (r.policy_json ? PLAN : BASE).frames[0]]]);
      call(SERVER, mod.run_fail, { run_id: r.id, detail: "stopped for the test" });
    }
    expect(() => call(DEV, mod.solution_close, { session_id: "demo" })).toThrow(/presenter/);
    call(ANA, mod.solution_close, { session_id: "demo" });
    expect(rows("session")[0].solution_pair_id).toBe("");
    expect(rows("run").filter((x) => x.pair_id === first)).toHaveLength(2); // runs are kept
    call(ANA, mod.solution_start, { session_id: "demo", recommendation_id: "demo:1", speed: 1 });
    expect(rows("session")[0].solution_pair_id).toBe("pair_demo_1_2");
  });

  it("reruns only the attack the plan was tested on, and never a failed one", () => {
    finishedBaselineWithRecommendation(); // tested on BASE.patientZero
    const start = () => call(ANA, mod.solution_start, { session_id: "demo", recommendation_id: "demo:1", speed: 1 });
    startRun({ run_id: "run_2" });
    call(SERVER, mod.run_fail, { run_id: "run_2", detail: "Engine refused" });
    expect(start).toThrow(/attack run failed, so there is no attack to rerun/);
    startRun({ run_id: "run_3", patient_zero: "ws_er", autoplay: false });
    apply([["run_3", BASE.frames[0]]]);
    expect(start).toThrow(new RegExp(`tested on the attack from "${BASE.patientZero}", not the one on screen`));
    expect(rows("run").filter((r) => r.pair_id)).toHaveLength(0);
    startRun({ run_id: "run_4", patient_zero: BASE.patientZero });
    feed("run_4", BASE, 0, BASE.finalTick);
    start(); // the same attack again: the same engine inputs
    expect(rows("run").filter((r) => r.pair_id).map((r) => r.patient_zero)).toEqual([BASE.patientZero, BASE.patientZero]);
  });

  it("matches each plan to its own request by time, since round numbers restart on every request", () => {
    finishedBaselineWithRecommendation(2, "Older plan"); // request A on BASE.patientZero, then demo:2
    later();
    startRun({ run_id: "run_2", patient_zero: "ws_er", autoplay: false });
    apply([["run_2", BASE.frames[0]]]);
    call(DEV, mod.defend_request, { session_id: "demo" }); // request B, on ws_er
    later();
    call(SERVER, mod.recommendation_upsert, { session_id: "demo", round: 1, recommendation_json: rec("Newer plan"), fixture: false });
    const start = (id: string) => () => call(ANA, mod.solution_start, { session_id: "demo", recommendation_id: id, speed: 1 });
    expect(start("demo:2")).toThrow(new RegExp(`tested on the attack from "${BASE.patientZero}"`));
    start("demo:1")();
    expect(rows("run").filter((r) => r.pair_id).map((r) => r.patient_zero)).toEqual(["ws_er", "ws_er"]);
  });

  it("refuses a plan with no aggregate fix request behind it", () => {
    startRun();
    feed("run_1", BASE, 0, BASE.finalTick);
    call(SERVER, mod.recommendation_upsert, { session_id: "demo", round: 1, recommendation_json: rec("Orphan"), fixture: true });
    expect(() => call(ANA, mod.solution_start, { session_id: "demo", recommendation_id: "demo:1", speed: 1 }))
      .toThrow(/no aggregate fix request in this session/);
  });
});

describe("focus annotations", () => {
  beforeEach(() => startRun({ autoplay: false }));

  it("lets a clinical engineer pin a device, visible as a row", () => {
    call(DEV, mod.annotation_add, { session_id: "demo", target_id: "srv_file", note: "Feeding the ER" });
    const [a] = rows("annotation");
    expect(a).toMatchObject({ target_id: "srv_file", author_name: "Dev", role: "clinical_engineering", active: true, run_id: "run_1" });
  });

  it("refuses observers, unknown devices, long notes and duplicates", () => {
    expect(() => call(OBS, mod.annotation_add, { session_id: "demo", target_id: "srv_file", note: "" })).toThrow(/Observers/);
    expect(() => call(DEV, mod.annotation_add, { session_id: "demo", target_id: "nope", note: "" })).toThrow(/does not exist/);
    expect(() => call(DEV, mod.annotation_add, { session_id: "demo", target_id: "srv_file", note: "x".repeat(141) })).toThrow(/140/);
    call(DEV, mod.annotation_add, { session_id: "demo", target_id: "srv_file", note: "" });
    expect(() => call(DEV, mod.annotation_add, { session_id: "demo", target_id: "srv_file", note: "" })).toThrow(/already/);
  });

  it("can be cleared by its author or the presenter only", () => {
    call(DEV, mod.annotation_add, { session_id: "demo", target_id: "srv_file", note: "" });
    const id = rows("annotation")[0].id;
    expect(() => call(OBS, mod.annotation_clear, { annotation_id: id })).toThrow(/author or the presenter/);
    call(ANA, mod.annotation_clear, { annotation_id: id });
    expect(rows("annotation")[0].active).toBe(false);
  });
});

describe("aggregate fix (defend_request)", () => {
  const defend = (auth: any = ANA) => () => call(auth, mod.defend_request, { session_id: "demo" });

  it("refuses before any run, while it is computing, while it runs, and after it failed", () => {
    expect(defend()).toThrow(/Run the attack first/);
    startRun();
    expect(defend()).toThrow(/still being computed/);
    apply([["run_1", BASE.frames[0]]]);
    expect(defend()).toThrow(/finish, or pause/);
    startRun({ run_id: "run_2" });
    call(SERVER, mod.run_fail, { run_id: "run_2", detail: "Engine refused" });
    expect(defend()).toThrow(/failed/);
    expect(rows("defend_request_log")).toHaveLength(0);
  });

  it("refuses while any run in the session, pair runs included, is requested or running (rule 5)", () => {
    startRun();
    feed("run_1", BASE, 0, BASE.finalTick);
    startRun({ run_id: "p_left", pair_id: "p" });
    expect(defend()).toThrow(/every run in this session/);
    apply([["p_left", BASE.frames[0]]]);
    expect(defend()).toThrow(/every run in this session/);
    call(ANA, mod.run_pause, { run_id: "p_left" });
    defend()();
    expect(rows("defend_request_log")).toHaveLength(1);
  });

  it("records the baseline run once it is paused or done, for any joined human, with the run's challenges", () => {
    startRun();
    apply([["run_1", BASE.frames[0]]]);
    call(ANA, mod.run_pause, { run_id: "run_1" });
    expect(defend(user("stranger"))).toThrow(/Join the session/);
    defend(DEV)();
    expect(rows("defend_request_log")[0]).toMatchObject({
      session_id: "demo", run_id: "run_1", patient_zero: BASE.patientZero, seed: 1337, challenges_json: "[]", requester_name: "Dev",
    });
  });

  it("refuses a second request while a round is open", () => {
    startRun({ autoplay: false });
    apply([["run_1", BASE.frames[0]]]);
    call(SERVER, mod.round_state_set, { session_id: "demo", round: 1, state: "running", detail: "" });
    expect(defend()).toThrow(/already being negotiated/);
    call(SERVER, mod.round_state_set, { session_id: "demo", round: 2, state: "done", detail: "" });
    defend()();
    expect(rows("session")[0]).toMatchObject({ round_state: "done", round: 2 });
  });
});

describe("agent rows (server identity only)", () => {
  const msg = (over: object = {}) => ({
    session_id: "demo", round: 1, from_agent: "flow", to_agent: "coordinator", type: "proposal",
    payload_json: "{}", reason: "Cut SMB.", reason_source: "template", direction: "sent", fixture: true, ...over,
  });

  it("refuses humans on every server-only reducer", () => {
    expect(() => call(ANA, mod.agent_message_add, msg())).toThrow(/server identity/);
    expect(() => call(ANA, mod.agent_status_set, { session_id: "demo", agent: "flow", status: "idle" })).toThrow(/server identity/);
    expect(() => call(ANA, mod.round_state_set, { session_id: "demo", round: 1, state: "done", detail: "" })).toThrow(/server identity/);
    expect(() => call(ANA, mod.recommendation_upsert, { session_id: "demo", round: 1, recommendation_json: "{}", fixture: true })).toThrow(/server identity/);
    expect(() => call(ANA, mod.question_add, {
      session_id: "demo", question_id: "q", round: 1, agent: "inventory", target_id: "mri_1", text: "?",
      text_source: "template", choices_json: '["a","b"]', allowed_roles_json: '["security"]',
    })).toThrow(/server identity/);
  });

  it("numbers messages per session and rejects unknown types", () => {
    call(SERVER, mod.agent_message_add, msg());
    call(SERVER, mod.agent_message_add, msg({ direction: "received" }));
    call(SERVER, mod.agent_message_add, msg({ session_id: "asi1-chat", type: "chat", from_agent: "humans" }));
    expect(rows("agent_message").map((m) => [m.session_id, m.seq])).toEqual([["demo", 1], ["demo", 2], ["asi1-chat", 1]]);
    expect(() => call(SERVER, mod.agent_message_add, msg({ type: "approval" }))).toThrow(/type must be/);
    expect(() => call(SERVER, mod.agent_message_add, msg({ payload_json: "{" }))).toThrow(/valid JSON/);
  });

  it("keeps one status row per agent", () => {
    call(SERVER, mod.agent_status_set, { session_id: "demo", agent: "flow", status: "thinking" });
    call(SERVER, mod.agent_status_set, { session_id: "demo", agent: "flow", status: "idle" });
    expect(rows("agent_status")).toEqual([expect.objectContaining({ id: "demo:flow", status: "idle" })]);
  });
});

describe("questions", () => {
  beforeEach(() => {
    call(SERVER, mod.question_add, {
      session_id: "demo", question_id: "q-r1-mri_1", round: 1, agent: "inventory", target_id: "mri_1",
      text: "Is it a workstation or a scanner?", text_source: "template",
      choices_json: '["workstation","scanner"]', allowed_roles_json: '["clinical_engineering"]',
    });
  });

  it("lets only an allowed role answer, with one of the choices, once", () => {
    const q = { session_id: "demo", question_id: "q-r1-mri_1" };
    expect(() => call(ANA, mod.question_answer, { ...q, choice: "workstation" })).toThrow(/Only clinical_engineering/);
    expect(() => call(OBS, mod.question_answer, { ...q, choice: "workstation" })).toThrow(/Only clinical_engineering/);
    expect(() => call(SERVER, mod.question_answer, { ...q, choice: "workstation" })).toThrow(/Only humans/);
    expect(() => call(DEV, mod.question_answer, { ...q, choice: "printer" })).toThrow(/not one of the choices/);
    call(DEV, mod.question_answer, { ...q, choice: "workstation" });
    expect(rows("question")[0]).toMatchObject({ answered: true, answer_choice: "workstation", answer_author: "Dev", answer_role: "clinical_engineering" });
    expect(() => call(DEV, mod.question_answer, { ...q, choice: "scanner" })).toThrow(/already been answered/);
  });
});

describe("recommendations", () => {
  it("starts as draft, and an update never changes the status", () => {
    call(SERVER, mod.recommendation_upsert, { session_id: "demo", round: 2, recommendation_json: rec("Keep scans"), fixture: true });
    expect(rows("recommendation")[0]).toMatchObject({ id: "demo:2", name: "Keep scans", status: "draft", required_roles_json: '["security"]' });
    const t2 = rows("recommendation")[0];
    (t.db as any).recommendation.id.update({ ...t2, status: "ready" }); // as review_submit would
    call(SERVER, mod.recommendation_upsert, { session_id: "demo", round: 2, recommendation_json: rec("Keep scans v2"), fixture: true });
    expect(rows("recommendation")).toEqual([expect.objectContaining({ name: "Keep scans v2", status: "ready" })]);
  });
});
