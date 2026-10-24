// End-to-end checks against a running stack (AGENTS.md: "show it working on two
// laptops or two tabs subscribed to the same session"). Skipped unless
// E2E_STDB_URI is set:
//
//   spacetime start; npm run publish:local -w hippocratech-module
//   cd engine && uv run uvicorn sim_core.api:app --port 8000
//   npm run dev -w watcher                                 # with STDB_SERVER_TOKEN, RELAY_TOKEN, ENGINE_URL
//   cd agents && WATCHER_RELAY_URL=http://127.0.0.1:8010 RELAY_TOKEN=… .venv/bin/python run_all.py
//   E2E_STDB_URI=ws://127.0.0.1:3000 npm test -w watcher
//
// "live run" needs only SpacetimeDB, the engine and the watcher (-t "live run").
// It runs E2E_HOSPITAL (a hospital file; default data/hospitals/demo.json) from
// E2E_PATIENT_ZERO (default mri_2). The agent tests use demo.json and MRI 2.
// Two independent clients play two humans.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import demo from "../../../data/hospitals/demo.json";
import { DbConnection } from "../../web/lib/stdb/module_bindings";

const URI = process.env.E2E_STDB_URI;
const MODULE = process.env.STDB_MODULE ?? "hippocratech";
const COORDINATOR = process.env.COORDINATOR_URL ?? "http://127.0.0.1:8004";
const ENGINE = (process.env.ENGINE_URL ?? "http://127.0.0.1:8000").replace(/\/+$/, "");
const HOSPITAL_FILE: { hospital: object } = process.env.E2E_HOSPITAL ? JSON.parse(readFileSync(process.env.E2E_HOSPITAL, "utf8")) : demo;
const PATIENT_ZERO = process.env.E2E_PATIENT_ZERO ?? "mri_2";

function connect(): Promise<DbConnection> {
  return new Promise((resolve, reject) => {
    DbConnection.builder().withUri(URI!).withDatabaseName(MODULE)
      .onConnect((conn) => resolve(conn)).onConnectError((_c, e) => reject(e)).build();
  });
}

function subscribe(conn: DbConnection, sessionId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    conn.subscriptionBuilder().onApplied(() => resolve()).onError((ctx) => reject(ctx.event)).subscribe(
      ["session WHERE id", "run WHERE session_id", "agent_message WHERE session_id", "agent_status WHERE session_id",
        "question WHERE session_id", "recommendation WHERE session_id"].map((q) => `SELECT * FROM ${q} = '${sessionId}'`),
    );
  });
}

const until = async (check: () => boolean, what: string, ms = 90_000) => {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > ms) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 200));
  }
};

async function twoHumans(sessionId: string) {
  const [a, b] = await Promise.all([connect(), connect()]);
  await Promise.all([subscribe(a, sessionId), subscribe(b, sessionId)]);
  await a.reducers.sessionCreate({ sessionId, hospitalJson: JSON.stringify(demo) });
  await a.reducers.presenceJoin({ sessionId, name: "Ana", role: "security" });
  await b.reducers.presenceJoin({ sessionId, name: "Dev", role: "clinical_engineering" });
  const session = (c: DbConnection) => c.db.session.id.find(sessionId)!;
  const thread = (c: DbConnection) => [...c.db.agentMessage.iter()].sort((x, y) => x.seq - y.seq).map((m) => `${m.seq} ${m.fromAgent}>${m.toAgent} ${m.type} ${m.direction}`);
  return { a, b, session, thread };
}

describe.skipIf(!URI)("live aggregate fix", () => {
  it("runs a round only after Create aggregate fix, and both humans see the same conversation", async () => {
    const sessionId = `e2e_${Date.now().toString(36)}`;
    const { a, b, session, thread } = await twoHumans(sessionId);
    const runId = `${sessionId}_run`;
    await a.reducers.runStart({ sessionId, runId, label: "Baseline", patientZero: "mri_2", seed: 1337, speed: 4, policyJson: "", pairId: "", autoplay: true });
    await until(() => (a.db.run.id.find(runId)?.tick ?? 0) >= 2, "two ticks");

    await expect(b.reducers.defendRequest({ sessionId })).rejects.toThrow(/finish, or pause/);
    expect([...a.db.agentMessage.iter()]).toHaveLength(0); // no agent traffic during a running run (rule 5)

    await a.reducers.runPause({ runId });
    await b.reducers.defendRequest({ sessionId });
    await until(() => session(a).roundState === "done", "the round to finish");
    await until(() => thread(b).length === thread(a).length && b.db.recommendation.count() > 0, "the second client to catch up");

    const types = new Set([...a.db.agentMessage.iter()].map((m) => m.type));
    for (const t of ["proposal_request", "proposal", "verdict", "round_state", "recommendation"]) expect(types.has(t)).toBe(true);
    expect(thread(b)).toEqual(thread(a));
    const [rec] = [...b.db.recommendation.iter()];
    expect(rec.status).toBe("draft"); // agents never mark anything ready (rule 9)
    expect(JSON.parse(rec.requiredRolesJson)).toContain("security");
    expect([...a.db.agentStatus.iter()].every((s) => s.status === "idle")).toBe(true);
    console.log(`[e2e] ${sessionId}: round ${session(a).round} ${session(a).roundState}, ${thread(a).length} rows, recommendation "${rec.name}"`);
    a.disconnect();
    b.disconnect();
  }, 120_000);

  it("pauses for a human question and resumes on the answer", async () => {
    // challenge_add isn't built yet, so the challenge round is started at the
    // Coordinator directly, as the round watcher will once defend_request rows
    // carry challenges. Everything after that goes through SpacetimeDB.
    const sessionId = `e2eq_${Date.now().toString(36)}`;
    const { a, b, session, thread } = await twoHumans(sessionId);
    const resp = await fetch(`${COORDINATOR}/start_round`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId, runId: `${sessionId}_run`, patientZero: "mri_2", seed: 1337, challenges: ["unknown_device_imaging"] }),
    });
    expect((await resp.json()).ok).toBe(true);
    await until(() => b.db.question.count() > 0 && session(b).roundState === "waiting_for_human", "the question");
    const [q] = [...b.db.question.iter()];
    expect(q.targetId).toBe("dev_unknown_7");

    const obs = await connect(); // a third human, an observer, may not answer
    await obs.reducers.presenceJoin({ sessionId, name: "Obi", role: "observer" });
    await expect(obs.reducers.questionAnswer({ sessionId, questionId: q.questionId, choice: JSON.parse(q.choicesJson)[0] }))
      .rejects.toThrow(/Only clinical_engineering or security/);
    obs.disconnect();
    await b.reducers.questionAnswer({ sessionId, questionId: q.questionId, choice: JSON.parse(q.choicesJson)[0] });
    await until(() => session(a).roundState === "done", "the round to resume and finish");
    expect(thread(a).some((r) => r.includes("humans>coordinator answer"))).toBe(true);
    console.log(`[e2e] ${sessionId}: asked ${q.questionId}, Dev answered, round ${session(a).round} ${session(a).roundState}`);
    a.disconnect();
    b.disconnect();
  }, 120_000);
});

describe.skipIf(!URI)("live run", () => {
  it("drives a run with the engine's frames, obeys reset and step, and both clients see the same rows", async () => {
    const sessionId = `e2er_${Date.now().toString(36)}`;
    const runId = `${sessionId}_run`;
    const watch = (c: DbConnection) => new Promise<void>((resolve, reject) => {
      c.subscriptionBuilder().onApplied(() => resolve()).onError((ctx) => reject(ctx.event)).subscribe([
        `SELECT * FROM session WHERE id = '${sessionId}'`, `SELECT * FROM run WHERE session_id = '${sessionId}'`,
        ...["tick_snapshot", "device_state", "sim_event"].map((t) => `SELECT * FROM ${t} WHERE run_id = '${runId}'`),
      ]);
    });
    const [a, b] = await Promise.all([connect(), connect()]);
    await Promise.all([watch(a), watch(b)]);
    const session = (c: DbConnection) => c.db.session.id.find(sessionId);
    const run = (c: DbConnection) => c.db.run.id.find(runId);
    const rowsOf = (c: DbConnection) => ({
      snapshots: [...c.db.tickSnapshot.iter()].map((s) => s.tick).sort((x, y) => x - y),
      infected: [...c.db.deviceState.iter()].filter((d) => d.infected).map((d) => d.deviceId).sort(),
      events: [...c.db.simEvent.iter()].map((e) => `${e.tick} ${e.kind} ${e.targetId}`).sort(),
    });

    await a.reducers.sessionCreate({ sessionId, hospitalJson: JSON.stringify(HOSPITAL_FILE) });
    await until(() => (session(b)?.entryPointsJson ?? "[]") !== "[]", "the engine's entry points", 20_000);
    expect(JSON.parse(session(b)!.entryPointsJson)).toContain(PATIENT_ZERO);

    // What the engine says for the same inputs; the rows must say exactly that.
    const resp = await fetch(`${ENGINE}/app/session`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ hospital: HOSPITAL_FILE.hospital, patient_zero: PATIENT_ZERO, policy: null, challenges: [] }),
    });
    const engine = await resp.json();
    const last = engine.frames[engine.finalTick];
    const want = {
      snapshots: engine.frames.map((f: any) => f.tick),
      infected: [...last.snapshot.infectedIds].sort(),
      events: engine.frames.flatMap((f: any) => f.events.map((e: any) => `${f.tick} ${e.kind} ${e.targetId}`)).sort(),
    };

    await a.reducers.runStart({ sessionId, runId, label: "Baseline", patientZero: PATIENT_ZERO, seed: 1337, speed: 4, policyJson: "", pairId: "", autoplay: true });
    await until(() => run(a)?.status === "done" && run(b)?.status === "done", "the run to finish on both clients", 60_000);
    for (const c of [a, b]) {
      expect(run(c)).toMatchObject({
        tick: engine.finalTick, finalTick: engine.finalTick, devicesCompromised: last.summary.devicesCompromised,
        patientsAffected: last.summary.patientsAffected, servicesDown: last.summary.servicesDown, detail: "",
        removedFlowsJson: JSON.stringify(engine.removedFlows), assumptionsJson: JSON.stringify(engine.assumptions),
      });
      expect(rowsOf(c)).toEqual(want);
    }

    // Reset clears autoplay: the watcher recomputes and waits on frame 0, then a step sends one frame.
    await a.reducers.runReset({ runId });
    await until(() => run(b)?.status === "paused" && run(b)?.tick === 0 && Number(b.db.tickSnapshot.count()) === 1, "the recomputed frame 0");
    await a.reducers.runStep({ runId });
    await until(() => run(b)?.tick === 1, "one step");
    await new Promise((r) => setTimeout(r, 1500));
    expect(run(b)).toMatchObject({ status: engine.finalTick === 1 ? "done" : "paused", tick: 1, stepPending: false });
    expect(rowsOf(b)).toEqual(rowsOf(a));
    console.log(`[e2e] ${sessionId}: ${runId} played ${engine.finalTick + 1} frames from ${PATIENT_ZERO}, reset and stepped`);
    a.disconnect();
    b.disconnect();
  }, 120_000);
});
