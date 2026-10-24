import { describe, expect, it } from "vitest";
import {
  BASE, HOSPITAL, NONE, PAIR, PLAN, PRESENTER, RUNS, SESSION, STRANGER, VIEWER, run, session, tables,
} from "./fixtures/rows";
import { EMPTY_HOSPITAL, EMPTY_TABLES, ZERO_TOTALS, hospitalOf, runOf, runViewOf, snapshotOf, stringsOf } from "./snapshot";

describe("snapshotOf", () => {
  it("reads one session's runs, oldest first, including the solution pair", () => {
    const s = snapshotOf(SESSION, tables(), VIEWER);
    // The pair's two runs start together, so their order falls back to the id.
    expect(s.runs.map((r) => r.id)).toEqual([BASE, NONE, PLAN]);
    expect(s.solutionPairId).toBe(PAIR);
    expect(s.entryPoints).toEqual(["ws_img", "ws_er"]);
    expect(s.hospital).toEqual(HOSPITAL.hospital);
  });

  it("maps every run column, parsing the JSON lists", () => {
    const s = snapshotOf(SESSION, tables(), VIEWER);
    expect(s.activeRunId).toBe(BASE);
    expect(s.activeRun).toEqual({
      id: BASE, label: "Baseline", patientZero: "ws_img", seed: 1337, tick: 2, status: "done", speed: 1, pairId: "",
      policyJson: "", finalTick: 2, detail: "", stepPending: false, removedFlows: [], protectedBroken: [],
      assumptions: ["[S] Lateral reach uses smb."], recommendationId: "",
      patientsAffected: 12, devicesCompromised: 3, servicesDown: 2, delayedProcedures: 7,
    });
    const plan = s.runs.find((r) => r.id === PLAN);
    expect(plan).toMatchObject({ pairId: PAIR, recommendationId: "s1:2", removedFlows: ["fl_1"], policyJson: '{"strategy":"keep_scans"}' });
  });

  it("copies the totals from the run row instead of summing state rows", () => {
    const s = snapshotOf(SESSION, tables(), VIEWER);
    // patient_state alone would give 7 patients affected (pg_scan disrupted); the column says 12.
    expect(s.totals).toEqual({ patientsAffected: 12, devicesCompromised: 3, servicesDown: 2, delayedProcedures: 7 });
    expect(s.delayedProcedures).toBe(7);
  });

  it("shows only the active run's rows, in row order", () => {
    const s = snapshotOf(SESSION, tables(), VIEWER);
    expect(s.devices).toEqual([
      { deviceId: "ws_img", infected: true, infectedAtTick: 0, infectedBy: undefined },
      { deviceId: "mri_1", infected: false, infectedAtTick: undefined, infectedBy: undefined },
      { deviceId: "srv_file", infected: true, infectedAtTick: 1, infectedBy: "ws_img" },
      { deviceId: "ws_er", infected: true, infectedAtTick: 2, infectedBy: "srv_file" },
    ]);
    expect(s.services).toEqual([
      { serviceId: "svc_imaging", down: true, downSinceTick: 2 },
      { serviceId: "svc_files", down: false, downSinceTick: undefined },
    ]);
    expect(s.patients).toEqual([{ groupId: "pg_scan", state: "disrupted" }, { groupId: "pg_er", state: "ok" }]);
    expect(s.attempts).toEqual([
      { tick: 1, from: "ws_img", to: "srv_file", flowId: "fl_1", success: true },
      { tick: 2, from: "srv_file", to: "ws_er", flowId: "fl_3", success: true },
    ]);
    expect(s.events.map((e) => e.kind)).toEqual(["patient_zero", "device_infected", "device_infected", "service_down"]);
    expect(s.snapshots).toEqual([{ tick: 0, infectedCount: 1 }, { tick: 1, infectedCount: 2 }, { tick: 2, infectedCount: 3 }]);
    expect(s.chokePoints).toEqual([{ deviceId: "srv_file", share: 0.5 }]);
  });

  it("has no active run before the first attack (IDLE_RUN bug: '' never matches a run)", () => {
    const s = snapshotOf(SESSION, tables({ session: [session({ activeRunId: "" })], run: [] }), VIEWER);
    expect(s.activeRunId).toBe("");
    expect(s.activeRun).toBeUndefined();
    expect(s.runs).toEqual([]);
    expect(s.runs.find((r) => r.id === s.activeRunId)).toBeUndefined();
    expect(s.devices).toEqual([]);
    expect(s.totals).toEqual(ZERO_TOTALS);
  });

  it("waits for the active run's row instead of showing its stale rows", () => {
    const s = snapshotOf(SESSION, tables({ run: RUNS.filter((r) => r.id !== BASE) }), VIEWER);
    expect(s.activeRunId).toBe("");
    expect(s.activeRun).toBeUndefined();
    expect(s.devices).toEqual([]);
    expect(s.events).toEqual([]);
  });

  it("knows the presenter, this tab's presence and its own pins", () => {
    const asPresenter = snapshotOf(SESSION, tables(), PRESENTER);
    expect(asPresenter).toMatchObject({ isPresenter: true, presenterName: "Ana", me: { name: "Ana", role: "security" } });
    expect(asPresenter.annotations).toEqual([
      { id: "9", targetId: "srv_file", note: "Feeds the ER", authorName: "Kai", role: "operations", active: true, mine: false },
    ]);

    const asViewer = snapshotOf(SESSION, tables(), VIEWER);
    expect(asViewer).toMatchObject({ isPresenter: false, presenterName: "Ana", me: { name: "Kai", role: "operations" } });
    expect(asViewer.annotations[0].mine).toBe(true);
    expect(asViewer.presence.map((p) => p.name)).toEqual(["Ana", "Kai"]);

    const anonymous = snapshotOf(SESSION, tables(), STRANGER);
    expect(anonymous).toMatchObject({ isPresenter: false, me: undefined });
    expect(snapshotOf(SESSION, tables()).isPresenter).toBe(false);
  });

  it("filters the agent tables to the session", () => {
    const s = snapshotOf(SESSION, tables(), VIEWER);
    expect(s.roundState).toEqual({ state: "done", round: 2, maxRounds: 4, detail: undefined });
    expect(s.agentStatus).toEqual([{ agent: "flow", status: "idle" }]);
    expect(s.messages.map((m) => m.seq)).toEqual([1, 2, 3, 5, 6, 7]);
    expect(s.questions.map((q) => q.questionId)).toEqual(["q1", "q2"]);
    expect(s.recommendations.map((r) => r.id)).toEqual(["s1:2", "s1:1"]);
  });

  it("gives a blank session without rows", () => {
    const s = snapshotOf("", EMPTY_TABLES);
    expect(s.hospital).toBe(EMPTY_HOSPITAL);
    expect(s).toMatchObject({
      runs: [], activeRunId: "", activeRun: undefined, entryPoints: [], solutionPairId: "", totals: ZERO_TOTALS,
      roundState: { state: "idle", round: 0 }, isPresenter: false, presenterName: "the presenter",
    });
  });
});

describe("runViewOf", () => {
  it("reads either side of the pair by run id", () => {
    const view = runViewOf(PLAN, tables(), RUNS.find((r) => r.id === PLAN));
    expect(view.run).toMatchObject({ id: PLAN, status: "running", tick: 1, finalTick: 1, recommendationId: "s1:2" });
    expect(view.attempts).toEqual([{ tick: 1, from: "ws_img", to: "srv_file", flowId: "fl_1", success: false }]);
    expect(view.devices.filter((d) => d.infected).map((d) => d.deviceId)).toEqual(["ws_img"]);
    expect(view.totals).toEqual({ patientsAffected: 0, devicesCompromised: 1, servicesDown: 0, delayedProcedures: 0 });
  });

  it("is empty for an unknown run, a missing row or a row of another run", () => {
    const empty = { devices: [], services: [], patients: [], attempts: [], events: [], snapshots: [], chokePoints: [], totals: ZERO_TOTALS };
    expect(runViewOf("", tables(), undefined)).toEqual(empty);
    expect(runViewOf(PLAN, tables(), undefined)).toEqual(empty);
    expect(runViewOf(PLAN, tables(), RUNS.find((r) => r.id === BASE))).toEqual(empty);
  });
});

describe("runOf", () => {
  it("reads a status or speed the UI doesn't know as an error and 1x", () => {
    expect(runOf(run({ id: "x", status: "exploded", speed: 3 }))).toMatchObject({ status: "error", speed: 1 });
    for (const status of ["requested", "running", "paused", "done", "error"]) {
      expect(runOf(run({ id: "x", status })).status).toBe(status);
    }
  });

  it("reads broken JSON list columns as empty", () => {
    const r = runOf(run({ id: "x", removedFlowsJson: "not json", protectedBrokenJson: '{"a":1}', assumptionsJson: '["ok", 3]' }));
    expect(r).toMatchObject({ removedFlows: [], protectedBroken: [], assumptions: ["ok"] });
    expect(stringsOf("[]")).toEqual([]);
  });
});

describe("hospitalOf", () => {
  it("parses the hospital file once per distinct string", () => {
    const json = JSON.stringify(HOSPITAL);
    const a = hospitalOf(json);
    expect(a).toEqual(HOSPITAL.hospital);
    expect(hospitalOf(json)).toBe(a);
  });
});
