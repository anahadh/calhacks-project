"use client";

// One SpacetimeDB connection per browser tab. The token is kept in
// localStorage so a reload keeps the same identity (and the presenter role).

import type { Identity } from "spacetimedb";
import { DbConnection } from "./module_bindings";

export const STDB_URI = process.env.NEXT_PUBLIC_STDB_URI ?? "";
export const STDB_MODULE = process.env.NEXT_PUBLIC_STDB_MODULE || "hippocratech";
const TOKEN_KEY = `hippo.stdb.token.${STDB_MODULE}`;

export type Connected = { conn: DbConnection; identity: Identity };

let pending: Promise<Connected> | null = null;

/** Told when this tab's connection drops, with a line to show as-is (rule 14). */
type LostListener = (reason: string) => void;
const lostListeners = new Set<LostListener>();

// A page that is leaving (a reload, opening a new demo) closes its socket on purpose.
let leaving = false;
if (typeof window !== "undefined") window.addEventListener("pagehide", () => (leaving = true));

/** Calls `listener` if this tab's connection drops after connecting. Returns the unsubscribe. */
export function onConnectionLost(listener: LostListener): () => void {
  lostListeners.add(listener);
  return () => {
    lostListeners.delete(listener);
  };
}

/** The line a dropped connection shows: the screen would otherwise freeze on its last rows. */
export function lostReason(err?: unknown): string {
  const why = (err instanceof Error ? err.message : err ? String(err) : "").replace(/\.+$/, "");
  return `Lost the connection to SpacetimeDB${why ? `: ${why}` : ""}. Reload the page to reconnect.`;
}

function readToken(): string | undefined {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

function saveToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Private mode: the identity lasts for this tab only.
  }
}

export function getConnection(): Promise<Connected> {
  if (!STDB_URI) return Promise.reject(new Error("NEXT_PUBLIC_STDB_URI is not set."));
  if (!pending) {
    pending = new Promise<Connected>((resolve, reject) => {
      DbConnection.builder()
        .withUri(STDB_URI)
        .withDatabaseName(STDB_MODULE)
        .withToken(readToken())
        .onConnect((conn, identity, token) => {
          saveToken(token);
          resolve({ conn, identity });
        })
        .onConnectError((_ctx, err) => {
          pending = null;
          reject(err);
        })
        .onDisconnect((_ctx, err) => {
          pending = null;
          if (leaving) return;
          const reason = lostReason(err);
          for (const listener of [...lostListeners]) listener(reason);
        })
        .build();
    });
  }
  return pending;
}
