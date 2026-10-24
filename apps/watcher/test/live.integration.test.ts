// End-to-end check of the agent loop against a running stack (AGENTS.md:
// "show it working on two laptops or two tabs subscribed to the same session").
// Skipped unless E2E_STDB_URI is set:
//
//   spacetime start; npm run publish:local -w hippocratech-module
//   npm run dev -w watcher                                 # with STDB_SERVER_TOKEN, RELAY_TOKEN
//   cd agents && HIPPO_SIM_FIXTURES=1 WATCHER_RELAY_URL=http://127.0.0.1:8010 RELAY_TOKEN=… .venv/bin/python run_all.py
//   E2E_STDB_URI=ws://127.0.0.1:3000 npm test -w watcher
//
// Two independent clients play two humans. Fixture results exist only for MRI 2.

import { describe, expect, it } from "vitest";
import demo from "../../../data/hospitals/demo.json";
import { DbConnection } from "../../web/lib/stdb/module_bindings";

const URI = process.env.E2E_STDB_URI;
const MODULE = process.env.STDB_MODULE ?? "hippocratech";
const COORDINATOR = process.env.COORDINATOR_URL ?? "http://127.0.0.1:8004";

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
