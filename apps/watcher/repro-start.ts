import * as bindings from "../web/lib/stdb/module_bindings";
const DbConnection: any = ((bindings as any).default ?? bindings).DbConnection;
const [sessionId, pz, token] = process.argv.slice(2);
DbConnection.builder().withUri("ws://127.0.0.1:3000").withDatabaseName("hippocratech").withToken(token)
  .onConnect(async (c: any, identity: any) => {
    const runId = `run_${Date.now().toString(36)}`;
    try {
      await c.reducers.runStart({ sessionId, runId, label: "Baseline", patientZero: pz, seed: 0, speed: 4, policyJson: "", pairId: "", autoplay: true });
      console.log(`run_start ok ${runId} pz=${pz} as ${identity.toHexString().slice(0, 10)}`);
    } catch (e) { console.log(`run_start FAILED: ${(e as Error).message}`); }
    process.exit(0);
  }).onConnectError((_c: any, e: any) => { console.log(`connect error ${e}`); process.exit(1); }).build();
