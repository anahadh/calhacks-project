"use client";

import { useMemo } from "react";
import { refusingActions } from "./actions";
import { STDB_URI } from "./connection";
import { useLiveRunRows, useLiveSession } from "./live-session";
import { mockRunRows, mockSession } from "./mock-session";
import { EMPTY_TABLES, runViewOf, snapshotOf } from "./snapshot";
import type { RunSubscription, SessionSnapshot } from "./types";

export type SessionMode = "mock" | "live" | "error";

/**
 * Which rows this build renders. Live SpacetimeDB rows when a host is set. The
 * explicit mock only with NEXT_PUBLIC_MOCK=1 (labeled "Mock data"). Otherwise an
 * error: there is no silent fallback (rule 14).
 */
export function sessionMode(env: { mock?: string; uri?: string }): SessionMode {
  if (env.mock === "1") return "mock";
  return env.uri ? "live" : "error";
}

export const NOT_CONNECTED = "Not connected: set NEXT_PUBLIC_STDB_URI";

const MODE = sessionMode({ mock: process.env.NEXT_PUBLIC_MOCK, uri: STDB_URI });

const notConnected: SessionSnapshot = {
  ...snapshotOf("", EMPTY_TABLES), source: "error", error: NOT_CONNECTED, actions: refusingActions(NOT_CONNECTED),
};
const notConnectedRun: RunSubscription = { ...runViewOf("", EMPTY_TABLES, undefined), source: "error", error: NOT_CONNECTED };

const useMockSession = (_sessionId: string): SessionSnapshot => mockSession;
const useNotConnected = (_sessionId: string): SessionSnapshot => notConnected;

/** The session's rows, chosen once per build (see sessionMode). */
export const useSession: (sessionId: string) => SessionSnapshot =
  MODE === "live" ? useLiveSession : MODE === "mock" ? useMockSession : useNotConnected;

/** One run's rows by id, e.g. each side of the solution pair. Same choice as useSession. */
export const useRunRows: (runId: string) => RunSubscription =
  MODE === "live" ? useLiveRunRows : MODE === "mock" ? mockRunRows : (_runId: string) => notConnectedRun;

// Lookup tables over the subscribed rows. Indexing only, no simulation.
export function useSessionIndex(s: SessionSnapshot) {
  return useMemo(() => {
    const device = new Map(s.hospital.devices.map((d) => [d.id, d]));
    const room = new Map(s.hospital.rooms.map((r) => [r.id, r]));
    const service = new Map(s.hospital.services.map((x) => [x.id, x]));
    const group = new Map(s.hospital.patients.map((g) => [g.id, g]));
    const flow = new Map(s.hospital.flows.map((f) => [f.id, f]));
    const deviceState = new Map(s.devices.map((d) => [d.deviceId, d]));
    const serviceState = new Map(s.services.map((x) => [x.serviceId, x]));
    const patientState = new Map(s.patients.map((p) => [p.groupId, p.state]));
    /** Devices the engine accepts as patient zero; the rest are dimmed in the pick step. */
    const entryPoint = new Set(s.entryPoints);
    return { device, room, service, group, flow, deviceState, serviceState, patientState, entryPoint };
  }, [s]);
}

export type SessionIndex = ReturnType<typeof useSessionIndex>;
