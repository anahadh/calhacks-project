"use client";

// Subscribes to one session's rows in SpacetimeDB and turns them into the
// SessionSnapshot the UI renders. Indexing and reshaping only: every number
// comes from rows the module wrote (AGENTS.md rules 3-4).

import { useEffect, useRef, useState } from "react";
import type { Identity } from "spacetimedb";
import demo from "../../../../data/hospitals/demo.json";
import { viewRole, type ArcData, type DeviceCardData } from "../../../../spacetime/src/role_views";
import { messagesOf, questionsOf, recommendationsOf, roundStateOf, statusOf } from "./agent-rows";
import { getConnection } from "./connection";
import type { DbConnection } from "./module_bindings";
import type {
  AnnotationRow, ChokePoint, Hospital, PresenceRow, RunRow, SessionActions, SessionSnapshot, SessionSource,
} from "./types";

const ROLES = new Set(["security", "clinical_engineering", "operations", "observer"]);
const SAFE_ID = /^[a-z0-9_-]{2,40}$/;

/** Shown before the presenter starts a run. UI state only, not simulation. */
const IDLE_RUN: RunRow = { id: "", label: "Not started", patientZero: "mri_2", seed: 1337, tick: 0, status: "paused", speed: 1 };

const EMPTY_HOSPITAL: Hospital = { id: "", name: "", floors: [], rooms: [], devices: [], flows: [], services: [], patients: [] };


type Live = { conn: DbConnection; identity: Identity };

/** This browser's my_device_card and my_arcs rows, back in role_views.ts's shapes. */
function roleViewOf(db: DbConnection["db"], sessionId: string, role: string): NonNullable<SessionSnapshot["roleView"]> {
  const cards = [...db.myDeviceCard.iter()].filter((c) => c.sessionId === sessionId).map(
    (c): DeviceCardData => ({
      device_id: c.deviceId, services: c.services, os: c.os, vulnerability: c.vulnerability, vlan: c.vlan, ports: c.ports,
      infected_by: c.infectedBy, criticality: c.criticality, clinical_flows: c.clinicalFlows,
      clinical_services: c.clinicalServices, patients: c.patients, service_impact: c.serviceImpact,
    }),
  );
  const arcs = [...db.myArcs.iter()].filter((a) => a.sessionId === sessionId).map(
    (a): ArcData => ({
      id: a.id, kind: a.kind === "dependency" ? "dependency" : "flow", from: a.fromDevice, to: a.toId,
      emphasis: a.emphasis === "strong" || a.emphasis === "faint" ? a.emphasis : "normal", label: a.label,
    }),
  );
  return { role: viewRole(role), cards, arcs };
}

function presenceOf(p: { name: string; role: string; following: boolean }): PresenceRow {
  return { name: p.name, role: (ROLES.has(p.role) ? p.role : "observer") as PresenceRow["role"], following: p.following };
}

export function useLiveSession(sessionId: string): SessionSnapshot {
  const [live, setLive] = useState<Live | null>(null);
  const [source, setSource] = useState<SessionSource>("connecting");
  const [error, setError] = useState<string>();
  const [version, setVersion] = useState(0);
  const hospitalCache = useRef<{ json: string; hospital: Hospital }>({ json: "", hospital: EMPTY_HOSPITAL });
  const runSub = useRef<{ runId: string; unsubscribe: () => void } | null>(null);
  const created = useRef(false);

  // Connect and subscribe to the session-level tables.
  useEffect(() => {
    if (!SAFE_ID.test(sessionId)) {
      setSource("error");
      setError(`"${sessionId}" is not a valid session id.`);
      return;
    }
    let cancelled = false;
    let frame = 0;
    const bump = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setVersion((v) => v + 1);
      });
    };

    getConnection()
      .then(({ conn, identity }) => {
        if (cancelled) return;
        setLive({ conn, identity });
        for (const table of [
          conn.db.session, conn.db.run, conn.db.presence, conn.db.annotation, conn.db.deviceState,
          conn.db.serviceState, conn.db.patientState, conn.db.spreadAttempt, conn.db.simEvent, conn.db.tickSnapshot,
          conn.db.agentMessage, conn.db.agentStatus, conn.db.question, conn.db.recommendation,
          conn.db.myDeviceCard, conn.db.myArcs,
        ] as any[]) {
          table.onInsert(bump);
          table.onDelete(bump);
          table.onUpdate?.(bump);
        }
        conn
          .subscriptionBuilder()
          .onApplied(() => {
            if (cancelled) return;
            const exists = [...conn.db.session.iter()].some((s) => s.id === sessionId);
            if (!exists && sessionId === "demo" && !created.current) {
              // First visitor to the demo session creates it and becomes the presenter.
              created.current = true;
              conn.reducers.sessionCreate({ sessionId, hospitalJson: JSON.stringify(demo) }).catch((e: Error) => {
                setSource("error");
                setError(e.message);
              });
            }
            setSource(exists || sessionId === "demo" ? "live" : "missing");
            bump();
          })
          .onError((ctx: any) => {
            setSource("error");
            setError(String(ctx?.event?.message ?? ctx?.event ?? "Subscription failed."));
          })
          .subscribe([
            `SELECT * FROM session WHERE id = '${sessionId}'`,
            `SELECT * FROM run WHERE session_id = '${sessionId}'`,
            `SELECT * FROM presence WHERE session_id = '${sessionId}'`,
            `SELECT * FROM annotation WHERE session_id = '${sessionId}'`,
            `SELECT * FROM agent_message WHERE session_id = '${sessionId}'`,
            `SELECT * FROM agent_status WHERE session_id = '${sessionId}'`,
            `SELECT * FROM question WHERE session_id = '${sessionId}'`,
            `SELECT * FROM recommendation WHERE session_id = '${sessionId}'`,
            // Role views: per caller, filtered by the role on this browser's presence row.
            "SELECT * FROM my_device_card",
            "SELECT * FROM my_arcs",
          ]);
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setSource("error");
        setError(`Can't reach SpacetimeDB: ${e?.message ?? e}`);
      });

    return () => {
      cancelled = true;
      if (frame) cancelAnimationFrame(frame);
    };
  }, [sessionId]);

  const sessionRow = live ? [...live.conn.db.session.iter()].find((s) => s.id === sessionId) : undefined;
  const activeRunId = sessionRow?.activeRunId ?? "";

  // Subscribe to the active run's rows; resubscribe when the active run changes.
  useEffect(() => {
    if (!live || runSub.current?.runId === activeRunId) return;
    runSub.current?.unsubscribe();
    runSub.current = null;
    if (!activeRunId || !SAFE_ID.test(activeRunId)) return;
    const handle = live.conn.subscriptionBuilder().subscribe(
      ["device_state", "service_state", "patient_state", "spread_attempt", "sim_event", "tick_snapshot"].map(
        (t) => `SELECT * FROM ${t} WHERE run_id = '${activeRunId}'`,
      ),
    );
    runSub.current = { runId: activeRunId, unsubscribe: () => handle.unsubscribe() };
  }, [live, activeRunId]);

  useEffect(() => () => runSub.current?.unsubscribe(), []);

  // ---- snapshot (recomputed on each row change; `version` forces the re-render)
  void version;
  let hospital = EMPTY_HOSPITAL;
  if (sessionRow) {
    if (hospitalCache.current.json !== sessionRow.hospitalJson) {
      hospitalCache.current = { json: sessionRow.hospitalJson, hospital: JSON.parse(sessionRow.hospitalJson).hospital };
    }
    hospital = hospitalCache.current.hospital;
  }

  const db = live?.conn.db;
  const me = live?.identity;
  const runRows = db ? [...db.run.iter()].filter((r) => r.sessionId === sessionId && r.pairId === "") : [];
  const runs: RunRow[] = runRows.map((r) => ({
    id: r.id, label: r.label, patientZero: r.patientZero, seed: r.seed, tick: r.tick,
    status: r.status as RunRow["status"], speed: r.speed as RunRow["speed"],
  }));
  const activeRow = runRows.find((r) => r.id === activeRunId);
  const inRun = <T extends { runId: string }>(rows: Iterable<T>) => [...rows].filter((x) => x.runId === activeRunId);

  const presenceRows = db ? [...db.presence.iter()].filter((p) => p.sessionId === sessionId) : [];
  const presenter = sessionRow ? presenceRows.find((p) => p.identity.isEqual(sessionRow.presenter)) : undefined;
  const isPresenter = !!(sessionRow && me && sessionRow.presenter.isEqual(me));
  const mine = me ? presenceRows.find((p) => p.identity.isEqual(me)) : undefined;
  const ofSession = <T extends { sessionId: string }>(rows: Iterable<T>) => [...rows].filter((x) => x.sessionId === sessionId);

  let chokePoints: ChokePoint[] = [];
  try {
    chokePoints = activeRow ? JSON.parse(activeRow.chokePointsJson) : [];
  } catch {
    chokePoints = [];
  }

  const session: Omit<SessionSnapshot, "actions"> = {
    hospital,
    runs: runs.length && activeRow ? runs : [IDLE_RUN, ...runs],
    activeRunId: activeRow ? activeRunId : "",
    presenterName: presenter?.name ?? (isPresenter ? "you" : "the presenter"),
    devices: db && activeRow
      ? inRun(db.deviceState.iter()).map((d) => ({
          deviceId: d.deviceId, infected: d.infected,
          infectedAtTick: d.infectedAtTick >= 0 ? d.infectedAtTick : undefined,
          infectedBy: d.infectedBy || undefined,
        }))
      : [],
    services: db && activeRow
      ? inRun(db.serviceState.iter()).map((s) => ({
          serviceId: s.serviceId, down: s.down, downSinceTick: s.downSinceTick >= 0 ? s.downSinceTick : undefined,
        }))
      : [],
    patients: db && activeRow
      ? inRun(db.patientState.iter()).map((p) => ({ groupId: p.groupId, state: p.state as SessionSnapshot["patients"][number]["state"] }))
      : [],
    attempts: db && activeRow
      ? inRun(db.spreadAttempt.iter()).map((a) => ({ tick: a.tick, from: a.fromDevice, to: a.toDevice, flowId: a.flowId, success: a.success }))
      : [],
    events: db && activeRow
      ? inRun(db.simEvent.iter())
          .sort((a, b) => (a.id < b.id ? -1 : 1))
          .map((e) => ({ tick: e.tick, kind: e.kind, targetId: e.targetId, text: e.text }))
      : [],
    snapshots: db && activeRow
      ? inRun(db.tickSnapshot.iter()).sort((a, b) => a.tick - b.tick).map((s) => ({ tick: s.tick, infectedCount: s.infectedCount }))
      : [],
    chokePoints,
    delayedProcedures: activeRow?.delayedProcedures ?? 0,
    presence: presenceRows.map(presenceOf),
    me: mine ? presenceOf(mine) : undefined,
    roleView: db && mine ? roleViewOf(db, sessionId, mine.role) : undefined,
    annotations: db
      ? [...db.annotation.iter()]
          .filter((a) => a.sessionId === sessionId && a.active)
          .map(
            (a): AnnotationRow => ({
              id: a.id.toString(), kind: a.kind === "note" ? "note" : "focus", runId: a.runId, targetId: a.targetId,
              tick: a.tick >= 0 ? a.tick : undefined, note: a.note, authorName: a.authorName,
              role: (ROLES.has(a.role) ? a.role : "observer") as AnnotationRow["role"],
              active: a.active, mine: !!me && a.author.isEqual(me),
            }),
          )
      : [],
    roundState: roundStateOf(sessionRow),
    agentStatus: db ? statusOf(ofSession(db.agentStatus.iter())) : [],
    messages: db ? messagesOf(ofSession(db.agentMessage.iter())) : [],
    questions: db ? questionsOf(ofSession(db.question.iter())) : [],
    recommendations: db ? recommendationsOf(ofSession(db.recommendation.iter())) : [],
    source,
    error,
    isPresenter,
  };

  // ---- actions. Errors from reducers (e.g. "Only the presenter...") are rethrown for the UI to show.
  const reducers = live?.conn.reducers;
  const need = () => reducers ?? Promise.reject(new Error("Not connected to SpacetimeDB."));
  const runId = session.activeRunId;
  const actions: SessionActions = {
    startRun: async (patientZero, speed = 1) => {
      const r = await need();
      await r.runStart({
        sessionId, runId: `run_${Date.now().toString(36)}`, label: "Baseline", patientZero,
        seed: 1337, speed, policyJson: "", pairId: "", autoplay: true,
      });
    },
    play: async () => {
      const r = await need();
      if (!runId) return actions.startRun(IDLE_RUN.patientZero);
      await r.runResume({ runId });
    },
    pause: async () => { if (runId) await (await need()).runPause({ runId }); },
    step: async () => { if (runId) await (await need()).runStep({ runId }); },
    reset: async () => { if (runId) await (await need()).runReset({ runId }); },
    setSpeed: async (speed) => { if (runId) await (await need()).runSetSpeed({ runId, speed }); },
    join: async (name, role) => (await need()).presenceJoin({ sessionId, name, role }),
    addFocus: async (deviceId, note = "") => (await need()).annotationAdd({ sessionId, targetId: deviceId, note }),
    addNote: async (tick, note) => (await need()).annotationAddNote({ sessionId, tick, note }),
    clearFocus: async (id) => (await need()).annotationClear({ annotationId: BigInt(id) }),
    defend: async () => (await need()).defendRequest({ sessionId }),
    answerQuestion: async (questionId, choice) => (await need()).questionAnswer({ sessionId, questionId, choice }),
  };

  return { ...session, actions };
}
