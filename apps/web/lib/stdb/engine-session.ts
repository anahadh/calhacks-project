"use client";

import { useEffect, useState } from "react";
import engine from "./engine-demo-session.json";
import { mockSession } from "./mock-session";
import type { SessionSnapshot } from "./types";

// The causal engine's HTTP server (sim_core.api). Override with NEXT_PUBLIC_ENGINE_URL.
const ENGINE_URL = (process.env.NEXT_PUBLIC_ENGINE_URL ?? "http://localhost:8000").replace(/\/$/, "");

// The sim-rows shape the engine's /app/run (and the baked JSON) return.
type Sim = {
  patientZero: string;
  finalTick: number;
  devices: SessionSnapshot["devices"];
  services: SessionSnapshot["services"];
  patients: SessionSnapshot["patients"];
  attempts: SessionSnapshot["attempts"];
  events: SessionSnapshot["events"];
  snapshots: SessionSnapshot["snapshots"];
  chokePoints: SessionSnapshot["chokePoints"];
  delayedProcedures: number;
};

function overlay(sim: Sim): SessionSnapshot {
  return {
    ...mockSession,
    devices: sim.devices,
    services: sim.services,
    patients: sim.patients,
    attempts: sim.attempts,
    events: sim.events,
    snapshots: sim.snapshots,
    chokePoints: sim.chokePoints,
    delayedProcedures: sim.delayedProcedures,
    runs: mockSession.runs.map((r) => ({ ...r, tick: sim.finalTick, patientZero: sim.patientZero })),
  };
}

// Baked fallback: a frozen run shipped with the app, shown until (or unless) the
// live engine answers.
export const engineSession: SessionSnapshot = overlay(engine as unknown as Sim);

/** Live: POST the hospital to the engine (sim_core.api `/app/run`) and render the
 *  fresh result. Falls back to the baked run if the engine is not reachable. */
export function useEngineSession(patientZero = "mri_2"): SessionSnapshot {
  const [session, setSession] = useState<SessionSnapshot>(engineSession);
  useEffect(() => {
    let cancelled = false;
    fetch(`${ENGINE_URL}/app/run`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ hospital: mockSession.hospital, patient_zero: patientZero }),
    })
      .then((response) => (response.ok ? response.json() : Promise.reject(response.status)))
      .then((sim: Sim) => {
        if (!cancelled) setSession(overlay(sim));
      })
      .catch(() => {
        /* engine not running — keep the baked fallback */
      });
    return () => {
      cancelled = true;
    };
  }, [patientZero]);
  return session;
}
