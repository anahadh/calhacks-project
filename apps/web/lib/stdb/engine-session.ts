import engine from "./engine-demo-session.json";
import { mockSession } from "./mock-session";
import type { SessionSnapshot } from "./types";

// The demo hospital run computed by the Python causal engine (hippo-backtest),
// overlaid on the mock scaffolding so the 3D scene animates OUR engine's run
// instead of the hand-written one. Source: engine/sim_core/app_bridge.run_session
// on data/hospitals/demo.json (see engine-demo-session.json). This is the offline
// "driven by the causal engine" view; the live SpacetimeDB path is separate.
export const engineSession: SessionSnapshot = {
  ...mockSession,
  devices: engine.devices as SessionSnapshot["devices"],
  services: engine.services as SessionSnapshot["services"],
  patients: engine.patients as SessionSnapshot["patients"],
  attempts: engine.attempts as SessionSnapshot["attempts"],
  events: engine.events as SessionSnapshot["events"],
  snapshots: engine.snapshots as SessionSnapshot["snapshots"],
  chokePoints: engine.chokePoints as SessionSnapshot["chokePoints"],
  delayedProcedures: engine.delayedProcedures,
  runs: mockSession.runs.map((r) => ({ ...r, tick: engine.finalTick, patientZero: engine.patientZero })),
};
