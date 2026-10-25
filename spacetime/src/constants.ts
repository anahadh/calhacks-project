// Module constants. Kept out of index.ts because every export there must be a
// table, reducer or lifecycle hook, or SpacetimeDB refuses to load the module.

/** One tick lasts this long at 1x. The run watcher paces frames at TICK_MS / speed (apps/watcher mirrors it). */
export const TICK_MS = 1000;
export const SPEEDS = [0.5, 1, 2, 4] as const;
/** Spread attempts older than this many ticks are deleted, so subscriptions stay light. */
export const KEEP_ATTEMPT_TICKS = 2;
export const NOTE_MAX = 140;
/** Timeline notes are written to be read, so they get more room than focus pins. */
export const TIMELINE_NOTE_MAX = 280;
/** The furthest tick a timeline note may mark (the rail shows 48; runs can go longer). */
export const TIMELINE_TICK_MAX = 10_000;
export const ROLES = ["security", "network", "clinical_engineering", "operations", "observer"] as const;
export const ANNOTATING_ROLES = ["security", "network", "clinical_engineering", "operations"] as const;

// Runs. The engine computes every frame; the run watcher feeds them in (ingest.ts).
/** requested: waiting for the engine. running/paused: frames arriving. done: the final frame landed. error: see run.detail. */
export const RUN_STATUSES = ["requested", "running", "paused", "done", "error"] as const;
/** Largest frames_json one run_frames_apply call may carry, in UTF-8 bytes. */
export const FRAMES_MAX = 256 * 1024;
/** Longest run.detail kept from run_fail. */
export const DETAIL_MAX = 500;
/** sim_event kinds a frame may carry, and the hospital list each one's targetId names. */
export const EVENT_TARGETS = {
  patient_zero: "devices",
  device_infected: "devices",
  service_down: "services",
  diversion: "rooms",
} as const;
export const PATIENT_STATES = ["ok", "delayed", "disrupted", "diverted"] as const;

// Agent rows (F1). Names match agents/protocol.py.
export const AGENT_NAMES = ["inventory", "flow", "clinical_workflow", "coordinator"] as const;
/** Who can appear on either end of an agent_message row. "relay" receives round_state and recommendation. */
export const SPEAKERS = [...AGENT_NAMES, "humans", "relay"] as const;
export const MESSAGE_TYPES = [
  "proposal_request", "proposal", "revision", "verdict", "question", "answer", "recommendation", "round_state", "chat",
] as const;
export const AGENT_STATUSES = ["idle", "thinking", "speaking", "waiting"] as const;
export const ROUND_STATES = ["idle", "running", "waiting_for_human", "done"] as const;
export const TEXT_SOURCES = ["claude", "asi1", "template", ""] as const;
/** Largest payload the relay may store per message. */
export const PAYLOAD_MAX = 64 * 1024;
