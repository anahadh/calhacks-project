"use client";

// Starts a new shared session: a fresh id, and session_create with the
// hospital file. The caller becomes the presenter. Everyone who opens
// /s/<id> subscribes to the same rows, so they all watch the same run.

import { getConnection } from "./connection";

/** 10 random base-36 characters after "s-", within session_create's [a-z0-9_-]{2,40}. */
export function newSessionId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return `s-${[...bytes].map((b) => (b % 36).toString(36)).join("")}`;
}

export async function createSession(hospitalJson: string): Promise<string> {
  const { conn } = await getConnection();
  const sessionId = newSessionId();
  await conn.reducers.sessionCreate({ sessionId, hospitalJson });
  return sessionId;
}
