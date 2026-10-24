// Watchers: one Node process that connects SpacetimeDB to the Fetch.ai
// uAgents (spec: Watchers). It connects as the server identity, then starts
// the round watcher, the answer watcher and the message/status relay.

import { ConfigError, loadConfig } from "./config";
import { watchAnswers } from "./answer";
import { createRelayServer } from "./relay";
import { watchRounds } from "./round";
import { connect, sessionInfo, subscribe } from "./stdb";

async function main(): Promise<void> {
  const config = loadConfig();
  const { conn, identity } = await connect(config);
  console.log(`[watcher] connected to ${config.stdbUri}/${config.stdbModule} as ${identity.toHexString().slice(0, 16)}…`);
  await subscribe(conn);
  watchRounds(conn, config.coordinatorUrl);
  watchAnswers(conn, config.coordinatorUrl);

  const relay = createRelayServer({ reducers: conn.reducers, session: (id) => sessionInfo(conn, id), token: config.relayToken });
  relay.listen(config.relayPort, "127.0.0.1", () => {
    console.log(`[relay] listening on http://127.0.0.1:${config.relayPort} (agents: WATCHER_RELAY_URL)`);
    console.log(`[round] waking the Sign-off Coordinator at ${config.coordinatorUrl} on Create aggregate fix`);
  });
}

main().catch((e) => {
  console.error(`[watcher] ${e instanceof ConfigError ? e.message : (e?.stack ?? e)}`);
  process.exit(1);
});
