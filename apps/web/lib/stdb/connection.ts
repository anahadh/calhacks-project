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
        .onDisconnect(() => {
          pending = null;
        })
        .build();
    });
  }
  return pending;
}
