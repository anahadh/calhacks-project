"use client";

// Subscribes to one session's rows in SpacetimeDB and hands the client cache
// to the pure mappers in snapshot.ts. A run advances only when the run watcher
// writes the engine's next frame through a reducer (AGENTS.md rule 4): this
// file subscribes and calls reducers, and computes nothing.

import { useEffect, useRef, useState } from "react";
import type { Identity } from "spacetimedb";
import demo from "../../../../data/hospitals/demo.json";
import { sessionActions } from "./actions";
import { getConnection } from "./connection";
import type { DbConnection } from "./module_bindings";
import { EMPTY_TABLES, runViewOf, snapshotOf } from "./snapshot";
import type { RunSubscription, SessionSnapshot, SessionSource } from "./types";

const SAFE_ID = /^[a-z0-9_-]{2,40}$/;
/** Run ids go into SQL text, so only these characters (solution_start's pair run ids fit). */
const RUN_ID = /^[A-Za-z0-9_-]{1,128}$/;
const SESSION_TABLES = ["run", "presence", "annotation", "agent_message", "agent_status", "question", "recommendation"];
const RUN_TABLES = ["device_state", "service_state", "patient_state", "spread_attempt", "sim_event", "tick_snapshot"];

/** The session view's subscription: the session row and every session-scoped table. [] for an unsafe id. */
export function sessionQueries(sessionId: string): string[] {
  if (!SAFE_ID.test(sessionId)) return [];
  return [
    `SELECT * FROM session WHERE id = '${sessionId}'`,
    ...SESSION_TABLES.map((t) => `SELECT * FROM ${t} WHERE session_id = '${sessionId}'`),
  ];
}

/** One run's subscription: its run row and the six row sets it writes. [] for an unsafe id. */
export function runQueries(runId: string): string[] {
  if (!RUN_ID.test(runId)) return [];
  return [`SELECT * FROM run WHERE id = '${runId}'`, ...RUN_TABLES.map((t) => `SELECT * FROM ${t} WHERE run_id = '${runId}'`)];
}

type Live = { conn: DbConnection; identity: Identity };
type Status = { source: SessionSource; error?: string };
type Handle = { unsubscribe: () => void };

function unsubscribe(handle: Handle): void {
  try {
    handle.unsubscribe();
  } catch {
    // Already ended (an error, or the connection dropped).
  }
}

/** This tab's connection (one per tab, connection.ts), or why there is none. */
function useLive(): { live?: Live; error?: string } {
  const [state, setState] = useState<{ live?: Live; error?: string }>({});
  useEffect(() => {
    let cancelled = false;
    getConnection()
      .then((live) => !cancelled && setState({ live }))
      .catch((e: Error) => !cancelled && setState({ error: `Can't reach SpacetimeDB: ${e?.message ?? e}` }));
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}

/** Changes at most once per animation frame whenever any cached row changes, so the snapshot is rebuilt. */
function useRowVersion(conn: DbConnection | undefined): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!conn) return;
    let frame = 0;
    const bump = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setVersion((v) => v + 1);
      });
    };
    const tables = [
      conn.db.session, conn.db.run, conn.db.presence, conn.db.annotation, conn.db.deviceState, conn.db.serviceState,
      conn.db.patientState, conn.db.spreadAttempt, conn.db.simEvent, conn.db.tickSnapshot, conn.db.agentMessage,
      conn.db.agentStatus, conn.db.question, conn.db.recommendation,
    ] as any[];
    for (const t of tables) {
      t.onInsert(bump);
      t.onDelete(bump);
      t.onUpdate?.(bump);
    }
    return () => {
      for (const t of tables) {
        t.removeOnInsert(bump);
        t.removeOnDelete(bump);
        t.removeOnUpdate?.(bump);
      }
      if (frame) cancelAnimationFrame(frame);
    };
  }, [conn]);
  return version;
}

/** Subscribes to one run's row and its six row sets while mounted. Returns the run id once applied. */
function useRunSubscription(conn: DbConnection | undefined, runId: string, onError: (e: string) => void): string {
  const [applied, setApplied] = useState("");
  const report = useRef(onError);
  report.current = onError;
  useEffect(() => {
    const queries = runQueries(runId);
    if (!conn || !queries.length) return;
    let cancelled = false;
    const handle = conn
      .subscriptionBuilder()
      .onApplied(() => !cancelled && setApplied(runId))
      .onError((ctx) => !cancelled && report.current(String(ctx?.event?.message ?? "Subscription failed.")))
      .subscribe(queries);
    return () => {
      cancelled = true;
      unsubscribe(handle);
    };
  }, [conn, runId]);
  return applied;
}

export function useLiveSession(sessionId: string): SessionSnapshot {
  const { live, error: connectError } = useLive();
  const conn = live?.conn;
  const [status, setStatus] = useState<Status>({ source: "connecting" });
  const created = useRef(false);
  void useRowVersion(conn);

  // The session-level tables.
  useEffect(() => {
    const queries = sessionQueries(sessionId);
    if (!conn || !queries.length) return;
    let cancelled = false;
    const handle = conn
      .subscriptionBuilder()
      .onApplied(() => {
        if (cancelled) return;
        const exists = [...conn.db.session.iter()].some((s) => s.id === sessionId);
        if (!exists && sessionId === "demo" && !created.current) {
          // First visitor to the demo session creates it and becomes the presenter.
          created.current = true;
          conn.reducers.sessionCreate({ sessionId, hospitalJson: JSON.stringify(demo) }).catch((e: Error) => {
            setStatus({ source: "error", error: e.message });
          });
        }
        setStatus({ source: exists || sessionId === "demo" ? "live" : "missing" });
      })
      .onError((ctx) => !cancelled && setStatus({ source: "error", error: String(ctx?.event?.message ?? "Subscription failed.") }))
      .subscribe(queries);
    return () => {
      cancelled = true;
      unsubscribe(handle);
    };
  }, [conn, sessionId]);

  // The active run's rows; resubscribed when the active run changes.
  const sessionRow = conn ? [...conn.db.session.iter()].find((s) => s.id === sessionId) : undefined;
  useRunSubscription(conn, sessionRow?.activeRunId ?? "", (error) => setStatus({ source: "error", error }));

  const data = snapshotOf(sessionId, conn?.db ?? EMPTY_TABLES, live?.identity);
  const source: Status = !SAFE_ID.test(sessionId)
    ? { source: "error", error: `"${sessionId}" is not a valid session id.` }
    : connectError
      ? { source: "error", error: connectError }
      : status;
  return { ...data, ...source, actions: sessionActions(conn?.reducers, sessionId, data.activeRun) };
}

/** One run's rows by id, e.g. either side of a solution pair. Subscribes while mounted. */
export function useLiveRunRows(runId: string): RunSubscription {
  const { live, error: connectError } = useLive();
  const conn = live?.conn;
  const [subError, setSubError] = useState<string>();
  void useRowVersion(conn);
  const applied = useRunSubscription(conn, runId, setSubError);

  const row = conn ? [...conn.db.run.iter()].find((r) => r.id === runId) : undefined;
  const view = runViewOf(runId, conn?.db ?? EMPTY_TABLES, row);
  const error = connectError ?? subError ?? (runId && !RUN_ID.test(runId) ? `"${runId}" is not a valid run id.` : undefined);
  const source: SessionSource = error ? "error" : applied !== runId ? "connecting" : view.run ? "live" : "missing";
  return { ...view, source, error };
}
