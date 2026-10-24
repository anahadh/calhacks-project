// Turns subscribed SpacetimeDB rows (the generated bindings' row types) into
// the shapes the UI renders. Pure: no connection and no React, so it is tested
// against fixture rows. Indexing and reshaping only: every number is a column
// the module wrote from an engine frame (AGENTS.md rules 3-4). The client
// cache may hold other sessions' and runs' rows, so everything is filtered here.

import type { Identity } from "spacetimedb";
import { messagesOf, questionsOf, recommendationsOf, roundStateOf, statusOf } from "./agent-rows";
import type {
  AgentMessage, AgentStatus, Annotation, DeviceState, PatientState, Presence, Question, Recommendation, Run,
  ServiceState, Session, SimEvent, SpreadAttempt, TickSnapshot,
} from "./module_bindings/types";
import { runStatusOf, speedOf } from "./run-status";
import type {
  AnnotationRow, ChokePoint, Hospital, PatientStateValue, PresenceRow, RunRow, RunTotals, RunView, SessionSnapshot,
} from "./types";

/** A session snapshot without where it came from or its controls. */
export type SessionData = Omit<SessionSnapshot, "actions" | "source" | "error">;

/** The six row sets one run writes. Property names match `conn.db`, so the live cache can be passed as-is. */
export type RunTables = {
  deviceState: Iterable<DeviceState>;
  serviceState: Iterable<ServiceState>;
  patientState: Iterable<PatientState>;
  spreadAttempt: Iterable<SpreadAttempt>;
  simEvent: Iterable<SimEvent>;
  tickSnapshot: Iterable<TickSnapshot>;
};

/** Every table the session view subscribes to. */
export type SessionTables = RunTables & {
  session: Iterable<Session>;
  run: Iterable<Run>;
  presence: Iterable<Presence>;
  annotation: Iterable<Annotation>;
  agentMessage: Iterable<AgentMessage>;
  agentStatus: Iterable<AgentStatus>;
  question: Iterable<Question>;
  recommendation: Iterable<Recommendation>;
};

export const EMPTY_HOSPITAL: Hospital = { id: "", name: "", floors: [], rooms: [], devices: [], flows: [], services: [], patients: [] };
export const ZERO_TOTALS: RunTotals = { patientsAffected: 0, devicesCompromised: 0, servicesDown: 0, delayedProcedures: 0 };

export const EMPTY_TABLES: SessionTables = {
  session: [], run: [], presence: [], annotation: [], agentMessage: [], agentStatus: [], question: [], recommendation: [],
  deviceState: [], serviceState: [], patientState: [], spreadAttempt: [], simEvent: [], tickSnapshot: [],
};

const ROLES = new Set(["security", "clinical_engineering", "operations", "observer"]);

function parse(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return undefined;
  }
}

/** A JSON column holding a list of strings (ids, or the engine's notes). Anything else reads as []. */
export function stringsOf(json: string): string[] {
  const v = parse(json);
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function chokePointsOf(json: string): ChokePoint[] {
  const v = parse(json);
  if (!Array.isArray(v)) return [];
  return v
    .filter((c) => typeof c?.deviceId === "string" && typeof c?.share === "number")
    .map((c) => ({ deviceId: c.deviceId, share: c.share }));
}

let parsed = { json: "", hospital: EMPTY_HOSPITAL };

/** session.hospital_json holds {schemaVersion, hospital}. Parsed once per distinct string. */
export function hospitalOf(json: string): Hospital {
  if (parsed.json !== json) parsed = { json, hospital: (JSON.parse(json) as { hospital: Hospital }).hospital };
  return parsed.hospital;
}

const byId = (a: { id: bigint }, b: { id: bigint }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export function totalsOf(r: RunTotals): RunTotals {
  return {
    patientsAffected: r.patientsAffected, devicesCompromised: r.devicesCompromised,
    servicesDown: r.servicesDown, delayedProcedures: r.delayedProcedures,
  };
}

/** One run row. The JSON list columns are parsed; the summary columns are copied, never recomputed. */
export function runOf(r: Run): RunRow {
  return {
    id: r.id, label: r.label, patientZero: r.patientZero, seed: r.seed, tick: r.tick,
    status: runStatusOf(r.status), speed: speedOf(r.speed), pairId: r.pairId, policyJson: r.policyJson,
    finalTick: r.finalTick, detail: r.detail, stepPending: r.stepPending,
    removedFlows: stringsOf(r.removedFlowsJson), protectedBroken: stringsOf(r.protectedBrokenJson),
    assumptions: stringsOf(r.assumptionsJson), recommendationId: r.recommendationId,
    ...totalsOf(r),
  };
}

/** One run's rows. Empty until its run row exists, so stale rows never show under a missing run. */
export function runViewOf(runId: string, tables: RunTables, row: Run | undefined): RunView {
  if (!runId || !row || row.id !== runId) {
    return { devices: [], services: [], patients: [], attempts: [], events: [], snapshots: [], chokePoints: [], totals: ZERO_TOTALS };
  }
  const mine = <T extends { runId: string }>(rows: Iterable<T>) => [...rows].filter((x) => x.runId === runId);
  const run = runOf(row);
  return {
    run,
    devices: mine(tables.deviceState).map((d) => ({
      deviceId: d.deviceId, infected: d.infected,
      infectedAtTick: d.infectedAtTick >= 0 ? d.infectedAtTick : undefined,
      infectedBy: d.infectedBy || undefined,
    })),
    services: mine(tables.serviceState).map((s) => ({
      serviceId: s.serviceId, down: s.down, downSinceTick: s.downSinceTick >= 0 ? s.downSinceTick : undefined,
    })),
    patients: mine(tables.patientState).map((p) => ({ groupId: p.groupId, state: p.state as PatientStateValue })),
    attempts: mine(tables.spreadAttempt)
      .sort(byId)
      .map((a) => ({ tick: a.tick, from: a.fromDevice, to: a.toDevice, flowId: a.flowId, success: a.success })),
    events: mine(tables.simEvent)
      .sort(byId)
      .map((e) => ({ tick: e.tick, kind: e.kind, targetId: e.targetId, text: e.text })),
    snapshots: mine(tables.tickSnapshot)
      .sort((a, b) => a.tick - b.tick)
      .map((s) => ({ tick: s.tick, infectedCount: s.infectedCount })),
    chokePoints: chokePointsOf(row.chokePointsJson),
    totals: totalsOf(run),
  };
}

function presenceOf(p: { name: string; role: string; following: boolean }): PresenceRow {
  return { name: p.name, role: (ROLES.has(p.role) ? p.role : "observer") as PresenceRow["role"], following: p.following };
}

const started = (a: Run, b: Run) => {
  const x = a.startedAt.microsSinceUnixEpoch;
  const y = b.startedAt.microsSinceUnixEpoch;
  return x < y ? -1 : x > y ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
};

/** The whole session as the session view renders it. `me` is this tab's identity, once connected. */
export function snapshotOf(sessionId: string, tables: SessionTables, me?: Identity): SessionData {
  const session = [...tables.session].find((s) => s.id === sessionId);
  const ofSession = <T extends { sessionId: string }>(rows: Iterable<T>) => [...rows].filter((x) => x.sessionId === sessionId);

  const runRows = ofSession(tables.run).sort(started);
  const activeRow = session?.activeRunId ? runRows.find((r) => r.id === session.activeRunId) : undefined;
  const active = runViewOf(activeRow?.id ?? "", tables, activeRow);

  const presenceRows = ofSession(tables.presence);
  const presenter = session ? presenceRows.find((p) => p.identity.isEqual(session.presenter)) : undefined;
  const isPresenter = !!(session && me && session.presenter.isEqual(me));
  const mine = me ? presenceRows.find((p) => p.identity.isEqual(me)) : undefined;

  return {
    hospital: session ? hospitalOf(session.hospitalJson) : EMPTY_HOSPITAL,
    runs: runRows.map(runOf),
    activeRunId: active.run?.id ?? "",
    activeRun: active.run,
    presenterName: presenter?.name ?? (isPresenter ? "you" : "the presenter"),
    devices: active.devices,
    services: active.services,
    patients: active.patients,
    attempts: active.attempts,
    events: active.events,
    snapshots: active.snapshots,
    chokePoints: active.chokePoints,
    totals: active.totals,
    delayedProcedures: active.totals.delayedProcedures,
    entryPoints: session ? stringsOf(session.entryPointsJson) : [],
    solutionPairId: session?.solutionPairId ?? "",
    presence: presenceRows.map(presenceOf),
    me: mine ? presenceOf(mine) : undefined,
    annotations: ofSession(tables.annotation)
      .filter((a) => a.active)
      .map(
        (a): AnnotationRow => ({
          id: a.id.toString(), targetId: a.targetId, note: a.note, authorName: a.authorName,
          role: (ROLES.has(a.role) ? a.role : "observer") as AnnotationRow["role"],
          active: a.active, mine: !!me && a.author.isEqual(me),
        }),
      ),
    roundState: roundStateOf(session),
    agentStatus: statusOf(ofSession(tables.agentStatus)),
    messages: messagesOf(ofSession(tables.agentMessage)),
    questions: questionsOf(ofSession(tables.question)),
    recommendations: recommendationsOf(ofSession(tables.recommendation)),
    isPresenter,
  };
}
