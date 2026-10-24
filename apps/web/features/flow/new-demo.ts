// "New demo": once this session's agent round is over, the presenter starts the
// next judge on a fresh session with the demo hospital. A new attack on the same
// session would sit next to the old round's messages and recommendations, which
// were measured against the old baseline, so the next run gets a clean session
// instead. The watcher lists the new session's entry points when it is inserted.
//
// Every tab on this session follows: each one watches for a newer session by the
// same presenter (session.presenter) and opens it. That is a read of rows, like
// the solution view following session.solution_pair_id; nothing is computed.

import { useEffect } from "react";
import type { Identity } from "spacetimedb";
import demo from "../../../../data/hospitals/demo.json";
import { getConnection } from "@/lib/stdb/connection";

/** The module's session id rule (session_create): 2-40 of a-z, 0-9, _ or -. */
const SESSION_ID = /^[a-z0-9_-]{2,40}$/;

/** A fresh session id for the next demo, e.g. "demo-mh5k2x9a". */
export function newDemoId(now: number): string {
  return `demo-${Math.max(0, Math.floor(now)).toString(36)}`;
}

/** The path a session opens at. */
export const sessionPath = (sessionId: string) => `/s/${encodeURIComponent(sessionId)}`;

/** The subscription for every session one presenter created, or null for a malformed identity. */
export function presenterQuery(presenterHex: string): string | null {
  const hex = presenterHex.replace(/^0x/i, "");
  return /^[0-9a-f]{64}$/i.test(hex) ? `SELECT * FROM session WHERE presenter = 0x${hex}` : null;
}

export type SessionStamp = { id: string; presenterHex: string; createdMicros: bigint };

/**
 * Whether a session row that just arrived is the presenter's next demo: same
 * presenter, created after this one, and not one this tab already knew about
 * when it started watching (an older demo reopened later is never followed).
 */
export function isNextDemo(row: SessionStamp, here: SessionStamp, known: ReadonlySet<string>): boolean {
  return (
    row.id !== here.id &&
    !known.has(row.id) &&
    row.presenterHex === here.presenterHex &&
    row.createdMicros > here.createdMicros
  );
}

type SessionRow = { id: string; presenter: Identity; createdAt: { microsSinceUnixEpoch: bigint } };
const stampOf = (s: SessionRow): SessionStamp => ({
  id: s.id,
  presenterHex: s.presenter.toHexString(),
  createdMicros: s.createdAt.microsSinceUnixEpoch,
});

/** Leaves for a session once, even if the presenter's tab and the follow hook both ask. */
let leaving = false;
function open(sessionId: string): void {
  if (leaving || !SESSION_ID.test(sessionId)) return;
  leaving = true;
  window.location.assign(sessionPath(sessionId));
}

/**
 * Creates the next demo's session (session_create, so this tab is its
 * presenter) and opens it. Rejects with the reducer's message, e.g. when not connected.
 */
export async function startNewDemo(now: number = Date.now()): Promise<void> {
  const { conn } = await getConnection();
  const sessionId = newDemoId(now);
  await conn.reducers.sessionCreate({ sessionId, hospitalJson: JSON.stringify(demo) });
  open(sessionId);
}

/**
 * Follows this session's presenter to their next demo while mounted. Live rows
 * only: the mock and the not-connected view never move.
 */
export function useFollowNewDemo(sessionId: string, live: boolean): void {
  useEffect(() => {
    if (!live || !SESSION_ID.test(sessionId)) return;
    let cancelled = false;
    let stop = () => {};

    getConnection()
      .then(({ conn }) => {
        if (cancelled) return;
        const table = conn.db.session;
        let here: SessionStamp | undefined;
        let known: Set<string> | undefined;
        let handle: { unsubscribe: () => void } | undefined;

        const onRow = (_ctx: unknown, row: SessionRow) => {
          if (!here) return watch();
          if (known && isNextDemo(stampOf(row), here, known)) open(row.id);
        };
        // Starts once this session's row is in the cache (its own subscription brings it).
        const watch = () => {
          const row = [...table.iter()].find((s) => s.id === sessionId);
          if (!row || here) return;
          here = stampOf(row);
          const query = presenterQuery(here.presenterHex);
          if (!query) return;
          handle = conn
            .subscriptionBuilder()
            .onApplied(() => {
              if (!cancelled) known = new Set([...table.iter()].map((s) => s.id));
            })
            .onError(() => {
              // Following is a convenience: the session view still works, and the presenter's link opens the new demo.
            })
            .subscribe([query]);
        };

        table.onInsert(onRow);
        watch();
        stop = () => {
          table.removeOnInsert(onRow);
          try {
            handle?.unsubscribe();
          } catch {
            // Already ended.
          }
        };
      })
      .catch(() => {
        // live-session.ts reports a failed connection; there is nothing to follow.
      });

    return () => {
      cancelled = true;
      stop();
    };
  }, [sessionId, live]);
}
