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

