"use client";

// The rows of one agent round that has no session row: a round started from
// ASI:One chat (session ids "chat-…"). Subscribes to its agent_message and
// agent_status rows only, and reshapes them like the session view does
// (agent-rows.ts). Computes nothing (AGENTS.md rules 3, 16).

import { useEffect, useState } from "react";
import { messagesOf, recommendationsFromMessages, roundStateFromMessages, statusOf } from "./agent-rows";
import { getConnection, onConnectionLost } from "./connection";
import type { DbConnection } from "./module_bindings";
import type { AgentMessageRow, AgentStatusRow, RecommendationRow, RoundState } from "./types";

const SAFE_ID = /^[a-z0-9_-]{2,40}$/;

export type RoomRows = {
  source: "connecting" | "live" | "error";
  error?: string;
  messages: AgentMessageRow[];
  agentStatus: AgentStatusRow[];
  roundState: RoundState;
  recommendations: RecommendationRow[];
};

export function roomQueries(sessionId: string): string[] {
  if (!SAFE_ID.test(sessionId)) return [];
  return ["agent_message", "agent_status"].map((t) => `SELECT * FROM ${t} WHERE session_id = '${sessionId}'`);
}

export function roomOf(conn: DbConnection | undefined, sessionId: string): Omit<RoomRows, "source" | "error"> {
  const rows = conn ? [...conn.db.agentMessage.iter()].filter((m) => m.sessionId === sessionId) : [];
  const status = conn ? [...conn.db.agentStatus.iter()].filter((s) => s.sessionId === sessionId) : [];
  return {
    messages: messagesOf(rows), agentStatus: statusOf(status), roundState: roundStateFromMessages(rows),
    recommendations: recommendationsFromMessages(rows),
  };
}

export function useRoomRows(sessionId: string): RoomRows {
  const [conn, setConn] = useState<DbConnection>();
  const [state, setState] = useState<{ source: RoomRows["source"]; error?: string }>({ source: "connecting" });
  const [, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const off = onConnectionLost((reason) => !cancelled && setState({ source: "error", error: reason }));
    getConnection()
      .then((live) => !cancelled && setConn(live.conn))
      .catch((e: Error) => !cancelled && setState({ source: "error", error: `Can't reach SpacetimeDB: ${e?.message ?? e}` }));
    return () => {
      cancelled = true;
      off();
    };
  }, []);

  useEffect(() => {
    const queries = roomQueries(sessionId);
    if (!queries.length) {
      setState({ source: "error", error: `"${sessionId}" is not a valid session id.` });
      return;
    }
    if (!conn) return;
    let cancelled = false;
    const bump = () => !cancelled && setVersion((v) => v + 1);
    const tables = [conn.db.agentMessage, conn.db.agentStatus] as any[];
    for (const t of tables) {
      t.onInsert(bump);
      t.onDelete(bump);
      t.onUpdate?.(bump);
    }
    const handle = conn
      .subscriptionBuilder()
      .onApplied(() => !cancelled && setState({ source: "live" }))
      .onError((ctx) => !cancelled && setState({ source: "error", error: String(ctx?.event?.message ?? "Subscription failed.") }))
      .subscribe(queries);
    return () => {
      cancelled = true;
      for (const t of tables) {
        t.removeOnInsert(bump);
        t.removeOnDelete(bump);
        t.removeOnUpdate?.(bump);
      }
      try {
        handle.unsubscribe();
      } catch {
        // Already ended.
      }
    };
  }, [conn, sessionId]);

  return { ...state, ...roomOf(conn, sessionId) };
}
