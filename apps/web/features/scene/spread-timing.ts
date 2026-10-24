// When each spread effect plays, read from the rows one run has written so far.
// Every effect here stands for a row (AGENTS.md rule 16): a pulse is a
// spread_attempt row, a flash is a device_state row turning infected, a "down"
// pop is a service_state row going down, a toast is a sim_event row. This file
// only decides *when* this tab saw each row land, so effects play once, in
// order, and never for rows that were already there when the tab opened.
// Pure: no React and no three.js, so it is tested on its own.

import type { DeviceStateRow, Flow, ServiceStateRow, SimEventRow, SpreadAttemptRow } from "@/lib/stdb/types";

/** One step lasts this long at 1x. Mirrors TICK_MS in spacetime/src/constants.ts, which the run watcher paces by. */
export const TICK_MS = 1000;
/** Pulses finish a little before the next step lands. */
const TRAVEL_SHARE = 0.9;
/** A toast is on screen this long, fade included (UX rule 5: at least 2 seconds readable). */
export const TOAST_MS = 2600;
/** At most this many toasts at once; the oldest goes first. */
const MAX_TOASTS = 8;
/** sim_event kinds that get a toast. A service going down pops its own "Down" chip instead. */
const TOAST_KINDS = new Set(["patient_zero", "device_infected", "diversion"]);

export const stepMsOf = (speed: number) => TICK_MS / (speed > 0 ? speed : 1);

/** One spread_attempt row, scheduled. `success: false` is a fizzle: half the way, then gone. */
export type Pulse = {
  key: string;
  from: string;
  to: string;
  flowId: string;
  success: boolean;
  /** performance.now() time the pulse leaves `from`. */
  start: number;
  duration: number;
};

/** One sim_event row as a toast anchored in the building. */
export type Toast = { key: string; kind: string; targetId: string; text: string; start: number };

/**
 * The attempts of one step as pulses. An engine move that crosses several hops
 * arrives as one attempt per hop, in order; a hop that leaves where an earlier
 * hop of the same step arrived waits for it, so the chain reads left to right.
 */
export function schedule(attempts: readonly SpreadAttemptRow[], tick: number, start: number, stepMs: number): Pulse[] {
  const now = attempts.filter((a) => a.tick === tick);
  const depth: number[] = [];
  now.forEach((a, i) => {
    let d = 0;
    for (let j = 0; j < i; j++) if (now[j].success && now[j].to === a.from) d = Math.max(d, depth[j] + 1);
    depth.push(d);
  });
  const levels = Math.max(0, ...depth) + 1;
  const duration = (stepMs * TRAVEL_SHARE) / levels;
  return now.map((a, i) => ({
    key: `${tick}:${i}:${a.from}>${a.to}:${a.flowId}`,
    from: a.from,
    to: a.to,
    flowId: a.flowId,
    success: a.success,
    start: start + depth[i] * duration,
    duration,
  }));
}

/**
 * Cut connections where the infection stopped: a flow the plan removed with
 * exactly one end infected. Read from run.removed_flows_json and device_state.
 */
export function stoppedAt(
  removedFlows: readonly string[],
  flow: ReadonlyMap<string, Pick<Flow, "from" | "to">>,
  deviceState: ReadonlyMap<string, Pick<DeviceStateRow, "infected">>,
): Set<string> {
  const out = new Set<string>();
  for (const id of removedFlows) {
    const f = flow.get(id);
    if (!f) continue;
    const a = !!deviceState.get(f.from)?.infected;
    const b = !!deviceState.get(f.to)?.infected;
    if (a !== b) out.add(id);
  }
  return out;
}

export type SpreadRows = {
  runId: string;
  tick: number;
  speed: number;
  devices: readonly DeviceStateRow[];
  services: readonly ServiceStateRow[];
  attempts: readonly SpreadAttemptRow[];
  events: readonly SimEventRow[];
};

export type SpreadTiming = {
  stepMs: number;
  /** The current step's pulses, when this tab saw the step land. */
  pulses: Pulse[];
  /** deviceId → when its flash starts (when the pulse that infected it arrives). */
  flashAt: ReadonlyMap<string, number>;
  /** serviceId → when its "Down" chip pops. */
  downAt: ReadonlyMap<string, number>;
  toasts: readonly Toast[];
};

/**
 * Remembers what this tab has seen of one run, so each effect plays once.
 * observe() is idempotent for the same rows, which keeps it safe to call on
 * every render (React may render twice). A run seen for the first time part
 * way through plays nothing until its next step; a run seen from frame 0 (or
 * reset back to it) plays everything.
 */
export class SpreadTracker {
  private runId: string | undefined;
  /** The last step seen with rows; -1 after the rows were cleared (a reset). */
  private last = -1;
  /** step → when this tab saw it land. Missing for steps that were already there. */
  private liveAt = new Map<number, number>();
  private infected = new Map<string, boolean>();
  private down = new Map<string, boolean>();
  private seenEvents = new Set<string>();
  private flashAt = new Map<string, number>();
  private downAt = new Map<string, number>();
  private toasts: Toast[] = [];

  private reset(runId: string | undefined): void {
    this.runId = runId;
    this.last = -1;
    this.liveAt = new Map();
    this.infected = new Map();
    this.down = new Map();
    this.seenEvents = new Set();
    this.flashAt = new Map();
    this.downAt = new Map();
    this.toasts = [];
  }

  observe(rows: SpreadRows, now: number): SpreadTiming {
    const stepMs = stepMsOf(rows.speed);
    const first = rows.runId !== this.runId;
    if (first) this.reset(rows.runId);

    // Frame 0 lists every device, so a run with frames always has device rows.
    if (!rows.devices.length) {
      if (!first) this.reset(rows.runId);
      return { stepMs, pulses: [], flashAt: this.flashAt, downAt: this.downAt, toasts: this.toasts };
    }

    if (rows.tick !== this.last) {
      if ((!first || rows.tick === 0) && !this.liveAt.has(rows.tick)) this.liveAt.set(rows.tick, now);
      this.last = rows.tick;
    }
    const live = this.liveAt.get(rows.tick);
    const pulses = live === undefined ? [] : schedule(rows.attempts, rows.tick, live, stepMs);

    for (const d of rows.devices) {
      const was = this.infected.get(d.deviceId) ?? false;
      if (d.infected && !was && live !== undefined) {
        const hit = pulses.find((p) => p.success && p.to === d.deviceId);
        this.flashAt.set(d.deviceId, hit ? hit.start + hit.duration : live);
      }
      if (!d.infected) this.flashAt.delete(d.deviceId);
      this.infected.set(d.deviceId, d.infected);
    }

    for (const s of rows.services) {
      const was = this.down.get(s.serviceId) ?? false;
      if (s.down && !was && live !== undefined) this.downAt.set(s.serviceId, live);
      if (!s.down) this.downAt.delete(s.serviceId);
      this.down.set(s.serviceId, s.down);
    }

    for (const e of rows.events) {
      const key = `${e.tick}:${e.kind}:${e.targetId}`;
      if (this.seenEvents.has(key)) continue;
      this.seenEvents.add(key);
      if (e.tick !== rows.tick || live === undefined || !TOAST_KINDS.has(e.kind)) continue;
      const start = e.kind === "diversion" ? live : this.flashAt.get(e.targetId) ?? live;
      this.toasts.push({ key, kind: e.kind, targetId: e.targetId, text: e.text, start });
    }
    this.toasts = this.toasts.filter((t) => now < t.start + TOAST_MS).slice(-MAX_TOASTS);

    return { stepMs, pulses, flashAt: this.flashAt, downAt: this.downAt, toasts: this.toasts };
  }
}
