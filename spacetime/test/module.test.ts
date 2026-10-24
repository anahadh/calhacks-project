import { beforeEach, describe, expect, it } from "vitest";
import { ConnectionId } from "spacetimedb";
import { createModuleTestHarness, TestAuth } from "spacetimedb/server/test-utils";
import { runToEnd, type Hospital, type Policy } from "@hippo/sim-core";
import demo from "../../data/hospitals/demo.json";
import spacetimedb, * as mod from "../src/index";
import { KEEP_ATTEMPT_TICKS } from "../src/constants";

const hospitalJson = JSON.stringify(demo);
const h = (demo as unknown as { hospital: Hospital }).hospital;

const user = (sub: string) => TestAuth.fromJwtPayload(JSON.stringify({ iss: "hippo-test", sub, aud: ["spacetimedb"] }), ConnectionId.random());
const SERVER = user("server");
const ANA = user("ana"); // presenter, security
const DEV = user("dev"); // clinical engineering
const OBS = user("obs"); // observer
const SCHED = TestAuth.internal();

type H = ReturnType<typeof createModuleTestHarness<any>>;
let t: H;
const call = (auth: any, fn: any, args: object = {}) => t.withReducerTx(auth, (ctx: any) => fn(ctx, args));
const rows = (table: string) => [...(t.db as any)[table].iter()] as any[];
const runRow = (id: string) => rows("run").find((r) => r.id === id);

function tickAll() {
  for (const timer of rows("tick_timer")) call(SCHED, mod.run_tick, { arg: timer });
}

function startRun(over: Partial<Record<string, unknown>> = {}) {
  call(ANA, mod.run_start, {
    session_id: "demo", run_id: "run_1", label: "Baseline", patient_zero: "mri_2",
    seed: 1337, speed: 1, policy_json: "", pair_id: "", autoplay: true, ...over,
  });
}

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
});

describe("runs", () => {
  it("writes tick 0 for every device, service and patient group", () => {
    startRun({ autoplay: false });
    expect(rows("device_state")).toHaveLength(h.devices.length);
    expect(rows("service_state")).toHaveLength(h.services.length);
    expect(rows("patient_state")).toHaveLength(h.patients.length);
    expect(rows("device_state").find((d) => d.device_id === "mri_2").infected).toBe(true);
    expect(runRow("run_1").tick).toBe(0);
    expect(rows("tick_timer")).toHaveLength(0);
  });

  it("advances on the scheduler and matches hippo-sim exactly (one engine, rule 5)", () => {
    startRun();
    expect(rows("tick_timer")).toHaveLength(1);
    for (let i = 0; i < 60 && rows("tick_timer").length; i++) tickAll();
    const expected = runToEnd(h, "mri_2", 1337);
    const r = runRow("run_1");
    expect(r.status).toBe("done");
    expect(r.tick).toBe(expected.final.tick);
    expect(r.devices_compromised).toBe(expected.final.devicesCompromised);
    expect(r.patients_affected).toBe(expected.final.patientsAffected);
    expect(rows("tick_snapshot").map((s) => s.infected_count).sort((a, b) => a - b))
      .toEqual(expected.ticks.map((x) => x.devicesCompromised).sort((a, b) => a - b));
    expect(rows("tick_timer")).toHaveLength(0); // timer removed when done
  });

  it("keeps only the latest spread attempts", () => {
    startRun();
    for (let i = 0; i < 6; i++) tickAll();
    const tick = runRow("run_1").tick;
    expect(rows("spread_attempt").every((a) => a.tick > tick - KEEP_ATTEMPT_TICKS)).toBe(true);
  });

  it("refuses run_tick from a client", () => {
    startRun();
    const timer = rows("tick_timer")[0];
    expect(() => call(ANA, mod.run_tick, { arg: timer })).toThrow(/scheduler/);
  });

  it("lets only the presenter control playback", () => {
    startRun();
    expect(() => call(DEV, mod.run_pause, { run_id: "run_1" })).toThrow(/presenter/);
    call(ANA, mod.run_pause, { run_id: "run_1" });
    expect(runRow("run_1").status).toBe("paused");
    expect(rows("tick_timer")).toHaveLength(0);
    call(ANA, mod.run_step, { run_id: "run_1" });
    expect(runRow("run_1").tick).toBe(1);
    call(ANA, mod.run_set_speed, { run_id: "run_1", speed: 2 });
    call(ANA, mod.run_resume, { run_id: "run_1" });
    expect(rows("tick_timer")).toHaveLength(1);
    expect(runRow("run_1").speed).toBe(2);
  });

  it("resets to tick 0", () => {
    startRun();
    for (let i = 0; i < 4; i++) tickAll();
    call(ANA, mod.run_reset, { run_id: "run_1" });
    expect(runRow("run_1").tick).toBe(0);
    expect(rows("device_state").filter((d) => d.infected).map((d) => d.device_id)).toEqual(["mri_2"]);
    expect(rows("tick_snapshot")).toHaveLength(1);
  });

  it("advances a solution pair in lockstep with one timer", () => {
    const plan: Policy = {
      strategy: "protect_critical_care", name: "Scans only",
      rules: [{ id: "r1", from: { zone: "imaging", deviceType: "mri" }, to: { role: "pacs" }, protocol: "dicom", plain: "MRIs send scans to PACS." }],
    };
    startRun({ run_id: "left", pair_id: "pair_1", label: "No segmentation" });
    startRun({ run_id: "right", pair_id: "pair_1", label: "Plan", policy_json: JSON.stringify(plan) });
    expect(rows("tick_timer")).toHaveLength(1);
    for (let i = 0; i < 3; i++) tickAll();
    expect(runRow("left").tick).toBe(3);
    expect(runRow("right").tick).toBeLessThanOrEqual(3); // the plan may settle early
    expect(runRow("right").devices_compromised).toBeLessThanOrEqual(runRow("left").devices_compromised);
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
