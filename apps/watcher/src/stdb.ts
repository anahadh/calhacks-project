// The watcher's one SpacetimeDB connection, as the server identity stored in
// the module's config table. Only that identity can call the server-only
// reducers (AGENTS.md rule 11); a wrong token shows up as their errors.

import type { Identity } from "spacetimedb";
import * as bindings from "../../web/lib/stdb/module_bindings";
import type { DbConnection } from "../../web/lib/stdb/module_bindings";
import type { Config } from "./config";

// tsx runs the generated bindings as CommonJS (apps/web has no "type": "module"),
// so Node gives this ES module only their default export; vitest gives the named one.
const { DbConnection: Connection } = (bindings as unknown as { default?: typeof bindings }).default ?? bindings;

/** The reducers the watcher calls. Narrowed so the relay and the run driver can be tested without a server. */
export type ServerReducers = Pick<
  DbConnection["reducers"],
  | "agentMessageAdd" | "agentStatusSet" | "questionAdd" | "recommendationUpsert" | "roundStateSet"
  | "runFramesApply" | "runFail" | "sessionEntryPointsSet"
>;

export type SessionInfo = { roundState: string; round: number };

export function connect(config: Config): Promise<{ conn: DbConnection; identity: Identity }> {
  return new Promise((resolve, reject) => {
    Connection.builder()
      .withUri(config.stdbUri)
      .withDatabaseName(config.stdbModule)
      .withToken(config.serverToken)
      .onConnect((conn, identity) => resolve({ conn, identity }))
      .onConnectError((_ctx, err) => reject(err))
      .onDisconnect((_ctx, err) => {
        console.error(`[watcher] disconnected from SpacetimeDB${err ? `: ${err.message ?? err}` : ""}. Exiting.`);
        process.exit(1);
      })
      .build();
  });
}

/** Subscribes to the tables the watchers act on. Resolves once the first rows have arrived. */
export function subscribe(conn: DbConnection): Promise<void> {
  return new Promise((resolve, reject) => {
    conn
      .subscriptionBuilder()
      .onApplied(() => resolve())
      .onError((ctx: any) => reject(new Error(String(ctx?.event?.message ?? ctx?.event ?? "Subscription failed."))))
      .subscribe(["SELECT * FROM session", "SELECT * FROM defend_request_log", "SELECT * FROM question", "SELECT * FROM run"]);
  });
}

export function sessionInfo(conn: DbConnection, sessionId: string): SessionInfo | undefined {
  const s = conn.db.session.id.find(sessionId);
  return s ? { roundState: s.roundState, round: s.round } : undefined;
}

/** The session's hospital as the engine takes it: the `hospital` of its `{schemaVersion, hospital}` file. */
export function hospitalOf(conn: DbConnection, sessionId: string): object | undefined {
  const s = conn.db.session.id.find(sessionId);
  if (!s) return undefined;
  try {
    const h: unknown = (JSON.parse(s.hospitalJson) as { hospital?: unknown }).hospital;
    return h !== null && typeof h === "object" && !Array.isArray(h) ? h : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Show a watcher-side failure on every screen (rule 14): the round state stays
 * as it is, and `detail` carries the error.
 */
export async function reportError(conn: DbConnection, sessionId: string, detail: string): Promise<void> {
  console.error(`[watcher] ${sessionId}: ${detail}`);
  const s = sessionInfo(conn, sessionId);
  if (!s) return;
  try {
    await conn.reducers.roundStateSet({ sessionId, round: s.round, state: s.roundState, detail });
  } catch (e) {
    console.error(`[watcher] could not record the error on ${sessionId}: ${(e as Error).message}`);
  }
}
