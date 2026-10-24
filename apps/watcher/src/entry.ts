// Entry-point watcher: asks the engine which devices it accepts as patient zero
// (POST /app/entry_points) for each new session, and stores the list through
// the server-only session_entry_points_set. The UI dims every other device, so
// a judge can only start an attack the engine will run (INTEGRATION.md 9, Q4).
// After a restart, sessions still on the default "[]" are asked again.
// Failures go to session.round_detail; they are not run failures.

import type { DbConnection } from "../../web/lib/stdb/module_bindings";
import type { EntryPointsReply } from "./engine";

export type EntryDeps = {
  reducers: Pick<DbConnection["reducers"], "sessionEntryPointsSet">;
  entryPoints: (hospital: object) => Promise<EntryPointsReply>;
  /** The session's hospital, as the engine takes it (the `hospital` of the session's hospital file). */
  hospital: (sessionId: string) => object | undefined;
  /** Shows a failure on every screen (stdb.ts reportError). */
  report: (sessionId: string, detail: string) => Promise<void>;
};

export function watchEntryPoints(conn: DbConnection, deps: EntryDeps): void {
  const asking = new Set<string>();
  const fill = async (sessionId: string) => {
    if (asking.has(sessionId)) return;
    asking.add(sessionId);
    try {
      await fillEntryPoints(deps, sessionId);
    } catch (e) {
      // The deps never throw by contract; this keeps a broken one from taking the whole watcher down.
      const detail = `Couldn't get the engine's patient-zero list: ${(e as Error)?.message ?? e}`;
      await deps.report(sessionId, detail).catch((err) => console.error(`[entry] ${sessionId}: ${detail} (${(err as Error)?.message ?? err})`));
    } finally {
      asking.delete(sessionId);
    }
  };
  conn.db.session.onInsert((_ctx, s) => void fill(s.id));
  for (const s of conn.db.session.iter()) if (s.entryPointsJson === "[]") void fill(s.id);
}

async function fillEntryPoints(deps: EntryDeps, sessionId: string): Promise<void> {
  const hospital = deps.hospital(sessionId);
  if (!hospital) return deps.report(sessionId, "Couldn't ask the engine for patient zeros: the watcher can't read this session's hospital.");
  const reply = await deps.entryPoints(hospital);
  if (!reply.ok) return deps.report(sessionId, `Couldn't get the engine's patient-zero list: ${reply.detail}`);
  try {
    await deps.reducers.sessionEntryPointsSet({ sessionId, entryPointsJson: JSON.stringify(reply.entryPoints) });
    console.log(`[entry] ${sessionId}: the engine accepts ${reply.entryPoints.length} devices as patient zero`);
  } catch (e) {
    await deps.report(sessionId, `SpacetimeDB refused the engine's patient-zero list: ${(e as Error)?.message ?? e}`);
  }
}
