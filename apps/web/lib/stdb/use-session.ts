"use client";

import { useMemo } from "react";
import { mockSession } from "./mock-session";
import type { SessionSnapshot } from "./types";

// Will subscribe to the session's rows in SpacetimeDB. For now it returns a
// fixed snapshot so the UI can be built against the row shapes.
export function useSession(_sessionId: string): SessionSnapshot {
  return mockSession;
}

// Lookup tables over the subscribed rows. Indexing only, no simulation.
export function useSessionIndex(s: SessionSnapshot) {
  return useMemo(() => {
    const device = new Map(s.hospital.devices.map((d) => [d.id, d]));
    const room = new Map(s.hospital.rooms.map((r) => [r.id, r]));
    const service = new Map(s.hospital.services.map((x) => [x.id, x]));
    const group = new Map(s.hospital.patients.map((g) => [g.id, g]));
    const deviceState = new Map(s.devices.map((d) => [d.deviceId, d]));
    const serviceState = new Map(s.services.map((x) => [x.serviceId, x]));
    const patientState = new Map(s.patients.map((p) => [p.groupId, p.state]));
    return { device, room, service, group, deviceState, serviceState, patientState };
  }, [s]);
}

export type SessionIndex = ReturnType<typeof useSessionIndex>;
