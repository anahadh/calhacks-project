"use client";

// Subscribes to one session's rows in SpacetimeDB and hands the client cache
// to the pure mappers in snapshot.ts. A run advances only when the run watcher
// writes the engine's next frame through a reducer (AGENTS.md rule 4): this
// file subscribes and calls reducers, and computes nothing.

import { useEffect, useRef, useState } from "react";
import type { Identity } from "spacetimedb";
import demo from "../../../../data/hospitals/demo.json";
import { sessionActions } from "./actions";
import { getConnection, onConnectionLost } from "./connection";
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
    // Role views: per caller, filtered by the role on this browser's presence row (spacetime/src/views.ts).
    "SELECT * FROM my_device_card",
    "SELECT * FROM my_arcs",
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

/**
 * One subscription per query set per connection, shared by every component that
 * asks for it and released a moment after the last one lets go. React's dev mode
 * mounts each effect twice (subscribe, unsubscribe, subscribe): tearing down the
 * first subscription would drop rows the second one shares, so a run's rows
 * stopped updating until a reload.
 */
type Shared = {
  handle?: Handle; users: number; applied: boolean; timer?: ReturnType<typeof setTimeout>;
  onApplied: Set<() => void>; onError: Set<(e: string) => void>;
};
const shared = new WeakMap<DbConnection, Map<string, Shared>>();
const RELEASE_MS = 1500;

function acquire(conn: DbConnection, queries: string[], onApplied: () => void, onError: (e: string) => void): () => void {
  let byKey = shared.get(conn);
  if (!byKey) shared.set(conn, (byKey = new Map()));
  const key = queries.join("\n");
  let s = byKey.get(key);
  if (!s) {
    const entry: Shared = { users: 0, applied: false, onApplied: new Set(), onError: new Set() };
    entry.handle = conn
      .subscriptionBuilder()
      .onApplied(() => {
        entry.applied = true;
        for (const f of [...entry.onApplied]) f();
      })
      .onError((ctx) => {
        const msg = String(ctx?.event?.message ?? "Subscription failed.");
        for (const f of [...entry.onError]) f(msg);
      })
      .subscribe(queries);
    byKey.set(key, (s = entry));
  }
  const sub = s;
  if (sub.timer) {
    clearTimeout(sub.timer);
    sub.timer = undefined;
  }
  sub.users += 1;
  sub.onApplied.add(onApplied);
  sub.onError.add(onError);
  if (sub.applied) onApplied();
  return () => {
    sub.users -= 1;
    sub.onApplied.delete(onApplied);
    sub.onError.delete(onError);
    if (sub.users > 0) return;
    sub.timer = setTimeout(() => {
      if (sub.users > 0) return;
      byKey!.delete(key);
      if (sub.handle) unsubscribe(sub.handle);
    }, RELEASE_MS);
  };
}

/** This tab's connection (one per tab, connection.ts), or why there is none, including a dropped one. */
function useLive(): { live?: Live; error?: string } {
  const [state, setState] = useState<{ live?: Live; error?: string }>({});
  useEffect(() => {
    let cancelled = false;
    const off = onConnectionLost((reason) => !cancelled && setState({ error: reason }));
    getConnection()
      .then((live) => !cancelled && setState({ live }))
      .catch((e: Error) => !cancelled && setState({ error: `Can't reach SpacetimeDB: ${e?.message ?? e}` }));
    return () => {
      cancelled = true;
      off();
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
      conn.db.agentStatus, conn.db.question, conn.db.recommendation, conn.db.myDeviceCard, conn.db.myArcs,
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
    const release = acquire(conn, queries, () => !cancelled && setApplied(runId), (e) => !cancelled && report.current(e));
    return () => {
      cancelled = true;
      release();
    };
  }, [conn, runId]);
  return applied;
}

/** The session row's active run id, kept in state and updated from the session table's callbacks. */
function useActiveRunId(conn: DbConnection | undefined, sessionId: string): string {
  const [runId, setRunId] = useState("");
  useEffect(() => {
    if (!conn) return;
    const sync = () => setRunId([...conn.db.session.iter()].find((s) => s.id === sessionId)?.activeRunId ?? "");
    sync();
    conn.db.session.onInsert(sync);
    conn.db.session.onUpdate(sync);
    conn.db.session.onDelete(sync);
    return () => {
      conn.db.session.removeOnInsert(sync);
      conn.db.session.removeOnUpdate(sync);
      conn.db.session.removeOnDelete(sync);
    };
  }, [conn, sessionId]);
  return runId;
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
    const release = acquire(
      conn,
      queries,
      () => {
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
      },
      (e) => !cancelled && setStatus({ source: "error", error: e }),
    );
    return () => {
      cancelled = true;
      release();
    };
  }, [conn, sessionId]);

  // The active run's rows; resubscribed when the active run changes. The id is
  // React state, not read from the row cache during render: a render that React
  // bails out of (a same-value setState) would otherwise store the new id as the
  // effect's deps without running it, and open tabs never subscribed to a new run.
  const activeRunId = useActiveRunId(conn, sessionId);
  useRunSubscription(conn, activeRunId, (error) => setStatus({ source: "error", error }));

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
