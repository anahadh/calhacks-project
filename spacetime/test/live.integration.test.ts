// Live check against a running server (AGENTS.md: "show it working on two
// tabs subscribed to the same session"). Skipped unless STDB_URI is set:
//
//   spacetime start                                   # terminal 1
//   npm run publish:local -w hippocratech-module   # once
//   STDB_URI=ws://127.0.0.1:3000 npm test -w hippocratech-module
//
// Two independent clients connect, one creates a session and starts a run,
// and both must see the same ticks arrive from the scheduled run_tick.

import { describe, expect, it } from "vitest";
import { runToEnd, type Hospital } from "@hippo/sim-core";
import demo from "../../data/hospitals/demo.json";
import { DbConnection } from "../../apps/web/lib/stdb/module_bindings";

const URI = process.env.STDB_URI;
const MODULE = process.env.STDB_MODULE ?? "hippocratech";
const h = (demo as unknown as { hospital: Hospital }).hospital;

function connect(): Promise<DbConnection> {
  return new Promise((resolve, reject) => {
    DbConnection.builder()
      .withUri(URI!)
      .withDatabaseName(MODULE)
      .onConnect((conn) => resolve(conn))
      .onConnectError((_ctx, err) => reject(err))
      .build();
  });
}

function subscribe(conn: DbConnection, queries: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    conn.subscriptionBuilder().onApplied(() => resolve()).onError((ctx) => reject(ctx.event)).subscribe(queries);
  });
}

const until = async (check: () => boolean, ms = 20000) => {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > ms) throw new Error("timed out");
    await new Promise((r) => setTimeout(r, 100));
  }
};

describe.skipIf(!URI)("live SpacetimeDB", () => {
  it("shows the same run on two clients, tick for tick, matching sim-core", async () => {
    const sessionId = `it_${Date.now().toString(36)}`;
    const runId = `${sessionId}_run`;
    const [a, b] = await Promise.all([connect(), connect()]);
    const queries = [
      `SELECT * FROM session WHERE id = '${sessionId}'`,
      `SELECT * FROM run WHERE session_id = '${sessionId}'`,
      `SELECT * FROM tick_snapshot WHERE run_id = '${runId}'`,
      `SELECT * FROM annotation WHERE session_id = '${sessionId}'`,
    ];
    await Promise.all([subscribe(a, queries), subscribe(b, queries)]);

    await a.reducers.sessionCreate({ sessionId, hospitalJson: JSON.stringify(demo) });
    await a.reducers.presenceJoin({ sessionId, name: "Ana", role: "security" });
    await b.reducers.presenceJoin({ sessionId, name: "Dev", role: "clinical_engineering" });
    await a.reducers.runStart({
      sessionId, runId, label: "Baseline", patientZero: "mri_2", seed: 1337, speed: 4,
      policyJson: "", pairId: "", autoplay: true,
    });

    const run = (c: DbConnection) => [...c.db.run.iter()].find((r) => r.id === runId);
    await until(() => run(a)?.status === "done" && run(b)?.status === "done");

    const ticks = (c: DbConnection) =>
      [...c.db.tickSnapshot.iter()].sort((x, y) => x.tick - y.tick).map((s) => [s.tick, s.infectedCount, s.patientsAffected]);
    expect(ticks(a)).toEqual(ticks(b));
    const expected = runToEnd(h, "mri_2", 1337).ticks.map((t) => [t.tick, t.devicesCompromised, t.patientsAffected]);
    expect(ticks(a)).toEqual(expected);

    // A focus pinned on one laptop shows up on the other.
    await b.reducers.annotationAdd({ sessionId, targetId: "srv_file", note: "Feeding the ER" });
    await until(() => [...a.db.annotation.iter()].some((x) => x.targetId === "srv_file" && x.active));

    // Only the presenter controls playback.
    await expect(b.reducers.runReset({ runId })).rejects.toThrow(/presenter/);

    a.disconnect();
    b.disconnect();
  }, 60000);
});
