// Test helper (never used at runtime): run rows through the watcher relay's own code,
// apps/watcher/src/relay.ts, unchanged. relayMessage/relayStatus parse each row with the
// relay's strict zod schemas, and the side-effect payloads (question, round_state,
// recommendation) as for a session that exists. Fake reducers: nothing is written.
//
//   node --experimental-transform-types relay_check.mjs <relay.ts> <rows.json>
//
// rows.json: [{"table": "agent_message" | "agent_status", "row": {...}}, ...]
// Prints a JSON array: [{"ok": true} | {"ok": false, "status": 400, "error": "..."}].

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const [relayPath, rowsPath] = process.argv.slice(2);
const relay = await import(pathToFileURL(relayPath).href);
const noop = async () => {};
const deps = {
  reducers: { agentMessageAdd: noop, questionAdd: noop, roundStateSet: noop, recommendationUpsert: noop, agentStatusSet: noop },
  session: () => ({}), // every session "exists", so the strict payload schemas run too
  token: "test",
};
const out = [];
for (const { table, row } of JSON.parse(readFileSync(rowsPath, "utf8"))) {
  try {
    await (table === "agent_message" ? relay.relayMessage(deps, row) : relay.relayStatus(deps, row));
    out.push({ ok: true });
  } catch (e) {
    out.push({ ok: false, status: e.status ?? null, error: String(e.message ?? e) });
  }
}
console.log(JSON.stringify(out));
