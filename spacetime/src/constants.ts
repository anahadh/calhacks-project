// Module constants. Kept out of index.ts because every export there must be a
// table, reducer or lifecycle hook, or SpacetimeDB refuses to load the module.

/** One tick lasts this long at 1x. */
export const TICK_MS = 1000;
export const SPEEDS = [0.5, 1, 2, 4] as const;
/** Spread attempts older than this many ticks are deleted, so subscriptions stay light. */
export const KEEP_ATTEMPT_TICKS = 2;
export const NOTE_MAX = 140;
export const ROLES = ["security", "clinical_engineering", "operations", "observer"] as const;
export const ANNOTATING_ROLES = ["security", "clinical_engineering", "operations"] as const;


// Agent rows (F1). Names match agents/protocol.py.
export const AGENT_NAMES = ["inventory", "flow", "clinical_workflow", "coordinator"] as const;
/** Who can appear on either end of an agent_message row. "relay" receives round_state and recommendation. */
export const SPEAKERS = [...AGENT_NAMES, "humans", "relay"] as const;
export const MESSAGE_TYPES = [
  "proposal_request", "proposal", "revision", "verdict", "question", "answer", "recommendation", "round_state", "chat",
] as const;
export const AGENT_STATUSES = ["idle", "thinking", "speaking", "waiting"] as const;
export const ROUND_STATES = ["idle", "running", "waiting_for_human", "done"] as const;
export const TEXT_SOURCES = ["claude", "template", ""] as const;
/** Largest payload the relay may store per message. */
export const PAYLOAD_MAX = 64 * 1024;
