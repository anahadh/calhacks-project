// Headless replay of the web client's subscription sequence (live-session.ts).
import fs from "node:fs";
import * as bindings from "../web/lib/stdb/module_bindings";
const DbConnection: any = ((bindings as any).default ?? bindings).DbConnection;
const demo = fs.readFileSync("../../data/hospitals/demo.json", "utf8");
const pz = process.argv[2] ?? "ws_lab";
const t0 = Date.now(); const log = (m: string) => console.log(`${String(Date.now() - t0).padStart(5)}ms ${m}`);
const sessionId = `probe-${Date.now().toString(36)}`;
const conn = DbConnection.builder().withUri("ws://127.0.0.1:3000").withDatabaseName("hippocratech")
  .onConnect(async (c, identity) => {
    log(`connected as ${identity.toHexString().slice(0, 10)}`);
    for (const t of [c.db.session, c.db.run, c.db.deviceState, c.db.spreadAttempt, c.db.tickSnapshot] as any[]) {
      t.onInsert(() => {}); t.onUpdate?.(() => {});
    }
    c.db.session.onUpdate((_x, b, a) => log(`session update active_run_id ${b.activeRunId || "''"} -> ${a.activeRunId}`));
    c.db.run.onInsert((_x, r) => log(`run insert ${r.id} pz=${r.patientZero} status=${r.status}`));
    c.db.run.onUpdate((_x, _b, r) => log(`run update ${r.id} status=${r.status} tick=${r.tick}/${r.finalTick}`));
    c.db.deviceState.onInsert((_x, d) => d.infected && log(`device_state insert ${d.deviceId} infected run=${d.runId}`));
    await c.reducers.sessionCreate({ sessionId, hospitalJson: demo });
    log(`session_create ${sessionId}`);
    const tables = ["run", "presence", "annotation", "agent_message", "agent_status", "question", "recommendation"];
    c.subscriptionBuilder().onApplied(async () => {
      log("session subscription applied");
      const runId = `run_${Date.now().toString(36)}`;
      try {
        await c.reducers.runStart({ sessionId, runId, label: "Baseline", patientZero: pz, seed: 0, speed: 4, policyJson: "", pairId: "", autoplay: true });
        log(`run_start ok ${runId} pz=${pz}`);
      } catch (e) { log(`run_start FAILED: ${(e as Error).message}`); }
      // what the web does on active_run_id change: subscribe to the run's rows
      const rt = ["device_state", "service_state", "patient_state", "spread_attempt", "sim_event", "tick_snapshot"];
      c.subscriptionBuilder().onApplied(() => log(`run subscription applied; device_state rows=${[...c.db.deviceState.iter()].length}`))
        .onError((ctx: any) => log(`run sub error ${ctx?.event?.message}`))
        .subscribe([`SELECT * FROM run WHERE id = '${runId}'`, ...rt.map((t) => `SELECT * FROM ${t} WHERE run_id = '${runId}'`)]);
      setTimeout(() => {
        const s = [...c.db.session.iter()].find((x) => x.id === sessionId);
        const inf = [...c.db.deviceState.iter()].filter((d) => d.runId === runId && d.infected).length;
        log(`FINAL session.active_run_id=${s?.activeRunId} infected=${inf} snapshots=${[...c.db.tickSnapshot.iter()].filter((x) => x.runId === runId).length}`);
        process.exit(0);
      }, 15000);
    }).onError((ctx: any) => log(`session sub error ${ctx?.event?.message}`))
      .subscribe([`SELECT * FROM session WHERE id = '${sessionId}'`, ...tables.map((t) => `SELECT * FROM ${t} WHERE session_id = '${sessionId}'`)]);
  })
  .onConnectError((_c, e) => { log(`connect error ${e}`); process.exit(1); })
  .build();
