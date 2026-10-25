// Watchers: one Node process that connects SpacetimeDB to the Python engine
// and the Fetch.ai uAgents (spec: Watchers). It connects as the server
// identity, then starts the round watcher, the answer watcher, the run driver
// (engine frames into run_frames_apply), the entry-point watcher and the
// message/status relay.

import { ConfigError, loadConfig } from "./config";
import { watchAnswers } from "./answer";
import { cachedRoundConfig } from "./cached";
import { callEngine, callEntryPoints } from "./engine";
import { watchEntryPoints } from "./entry";
import { createRelayServer } from "./relay";
import { watchRounds } from "./round";
import { runInfo, watchRuns } from "./run";
import { connect, hospitalOf, reportError, sessionInfo, subscribe } from "./stdb";

async function main(): Promise<void> {
  const config = loadConfig();
  const { conn, identity } = await connect(config);
  console.log(`[watcher] connected to ${config.stdbUri}/${config.stdbModule} as ${identity.toHexString().slice(0, 16)}…`);
  await subscribe(conn);
  const cached = cachedRoundConfig();
  watchRounds(conn, config.coordinatorUrl, cached);
  watchAnswers(conn, config.coordinatorUrl, !!cached);
  const hospital = (id: string) => hospitalOf(conn, id);
  watchRuns(conn, {
    reducers: conn.reducers, engine: (body) => callEngine(config.engineUrl, body),
    runs: () => [...conn.db.run.iter()].map(runInfo), hospital,
  });
  watchEntryPoints(conn, {
    reducers: conn.reducers, entryPoints: (h) => callEntryPoints(config.engineUrl, h), hospital,
    report: (id, detail) => reportError(conn, id, detail),
  });
  console.log(`[run] driving visible runs with the engine at ${config.engineUrl}`);

  const relay = createRelayServer({ reducers: conn.reducers, session: (id) => sessionInfo(conn, id), token: config.relayToken });
  relay.listen(config.relayPort, "127.0.0.1", () => {
    console.log(`[relay] listening on http://127.0.0.1:${config.relayPort} (agents: WATCHER_RELAY_URL)`);
    if (cached) console.log(`[round] CACHED_ROUND is set: Create aggregate fix replays agents/cache/demo_round.json at ${cached.speed}x, labeled "Cached run"`);
    else console.log(`[round] waking the Sign-off Coordinator at ${config.coordinatorUrl} on Create aggregate fix`);
  });
}

main().catch((e) => {
  console.error(`[watcher] ${e instanceof ConfigError ? e.message : (e?.stack ?? e)}`);
  process.exit(1);
});
