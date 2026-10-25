// Run driver: feeds the engine's frames for every visible run into SpacetimeDB
// (AGENTS.md rules 3, 4). run_start, solution_start and run_reset leave a run
// `requested`. The driver then asks the engine for the whole run
// (POST /app/session), applies frame 0, and sends one frame per beat at
// TICK_MS / speed through the server-only run_frames_apply. Pause, resume,
// step, speed and reset are presenter reducers that the driver obeys by
// watching the run rows. It computes nothing: frames go in as the engine sent them.
//
// Every run under one key (pair_id || id) moves together. Both sides of a
// solution pair get their frames in one call, so they land in one transaction,
// and calls for one key never overlap. Engine and module refusals end the run
// with run_fail; they never touch session.round_detail. A refused later frame
// is sent once more first, since a presenter change can race it. A run whose
// failure SpacetimeDB won't record is left alone until its row changes, so
// nothing retries in a loop.
//
// Unlike the round watcher, a restart picks up where it left off: runs are
// idempotent state, and the engine is deterministic, so every run still in play
// is recomputed from its inputs and continues from run.tick.

import type { DbConnection } from "../../web/lib/stdb/module_bindings";
import type { Run } from "../../web/lib/stdb/module_bindings/types";
import type { AppSession, AppSessionRequest, EngineReply, TickFrame } from "./engine";

/** One tick at 1x. Mirrors TICK_MS in spacetime/src/constants.ts. */
export const TICK_MS = 1000;

export type RunReducers = Pick<DbConnection["reducers"], "runFramesApply" | "runFail">;

/** The run columns the driver reads. */
export type RunInfo = {
  id: string; sessionId: string; pairId: string; patientZero: string; policyJson: string; challengesJson: string;
  status: string; tick: number; finalTick: number; speed: number; stepPending: boolean;
};

export type RunDeps = {
  reducers: RunReducers;
  engine: (body: AppSessionRequest) => Promise<EngineReply>;
  /** Every run row, from the subscribed `run` table. */
  runs: () => RunInfo[];
  /** The session's hospital, as the engine takes it (the `hospital` of the session's hospital file). */
  hospital: (sessionId: string) => object | undefined;
  clock?: { setTimeout: typeof setTimeout; clearTimeout: typeof clearTimeout };
};

export function runInfo(r: Run): RunInfo {
  return {
    id: r.id, sessionId: r.sessionId, pairId: r.pairId, patientZero: r.patientZero, policyJson: r.policyJson,
    challengesJson: r.challengesJson, status: r.status, tick: r.tick, finalTick: r.finalTick, speed: r.speed,
    stepPending: r.stepPending,
  };
}

export function watchRuns(conn: DbConnection, deps: RunDeps): void {
  const driver = runDriver(deps);
  conn.db.run.onInsert((_ctx, r) => driver.changed(runInfo(r)));
  conn.db.run.onUpdate((_ctx, _before, r) => driver.changed(runInfo(r)));
  conn.db.run.onDelete((_ctx, r) => driver.changed(runInfo(r)));
  driver.recover();
}

type Item = { run: RunInfo; frame: TickFrame };

type KeyState = {
  queue: Promise<void>; // this key's jobs, one at a time
  timer?: ReturnType<typeof setTimeout>;
  timerSpeed: number;
  beating: boolean; // a beat is queued or applying; the next one is scheduled when it lands
  preparing: boolean; // a frame-0 job is queued and hasn't started
  stepping: boolean; // a step job is queued and hasn't started
};

const PLAYING = ["running", "paused"];

function runDriver(deps: RunDeps) {
  const sessions = new Map<string, AppSession>(); // the engine's run, by run id, while it plays
  const keys = new Map<string, KeyState>();
  const changes = new Map<string, number>(); // row changes seen per run id, so "unchanged since" is exact
  const refused = new Map<string, { tick: number; at: number }>(); // a frame the module refused once, and when
  const held = new Map<string, number>(); // runs whose run_fail was refused, left alone while their row stays put
  const timers = () => deps.clock ?? globalThis; // read on use, so fake timers apply

  const seen = (id: string) => changes.get(id) ?? 0;
  const keyOf = (r: RunInfo) => r.pairId || r.id;
  /** The key's runs the driver acts on: every one but the held ones. */
  const under = (key: string) => deps.runs().filter((r) => keyOf(r) === key && held.get(r.id) !== seen(r.id));
  const find = (id: string) => deps.runs().find((r) => r.id === id);

  function state(key: string): KeyState {
    let k = keys.get(key);
    if (!k) keys.set(key, (k = { queue: Promise.resolve(), timerSpeed: 0, beating: false, preparing: false, stepping: false }));
    return k;
  }

  function enqueue(key: string, job: () => Promise<void>): void {
    const k = state(key);
    k.queue = k.queue
      .then(job)
      .catch((e) => console.error(`[run] ${key}: ${(e as Error)?.stack ?? e}`))
      .then(() => sync(key));
  }

  /** Brings the key's jobs and beat timer in line with its run rows. Called on every row change and after every job. */
  function sync(key: string): void {
    const k = state(key);
    const runs = under(key);
    if (runs.some((r) => r.status === "requested") && !k.preparing) {
      k.preparing = true;
      enqueue(key, () => {
        k.preparing = false;
        return prepare(key);
      });
    }
    if (runs.some((r) => r.status === "paused" && r.stepPending) && !k.stepping) {
      k.stepping = true;
      enqueue(key, () => {
        k.stepping = false;
        return advance(key, (r) => r.status === "paused" && r.stepPending);
      });
    }
    const running = runs.filter((r) => r.status === "running");
    const speed = running[0]?.speed ?? 0;
    if (k.timer !== undefined && (!running.length || speed !== k.timerSpeed)) {
      timers().clearTimeout(k.timer); // paused, reset or done; or a new speed, which restarts the beat
      k.timer = undefined;
    }
    if (running.length && k.timer === undefined && !k.beating) {
      k.timerSpeed = speed;
      k.timer = timers().setTimeout(() => {
        k.timer = undefined;
        k.beating = true;
        enqueue(key, async () => {
          try {
            await advance(key, (r) => r.status === "running");
          } finally {
            k.beating = false;
          }
        });
      }, TICK_MS / (speed > 0 ? speed : 1));
    }
  }

  /** Frame 0: computes every requested run under the key, then applies all their frame 0s in one call. */
  async function prepare(key: string): Promise<void> {
    const computed = new Map<string, AppSession>();
    const failed = new Set<string>();
    for (;;) {
      const todo = under(key).filter((r) => r.status === "requested" && !computed.has(r.id) && !failed.has(r.id));
      if (!todo.length) break;
      const replies = await Promise.all(todo.map(compute));
      for (const [i, r] of todo.entries()) {
        const reply = replies[i];
        if (reply.ok) computed.set(r.id, reply.session);
        else {
          failed.add(r.id);
          await fail(r.id, reply.detail);
        }
      }
    }
    const ready = under(key).filter((r) => r.status === "requested" && computed.has(r.id));
    for (const r of ready) sessions.set(r.id, computed.get(r.id)!);
    await apply(ready.map((r) => ({ run: r, frame: computed.get(r.id)!.frames[0] })));
  }

  /** The next frame for every run under the key that `want` picks (a beat: running; a step: paused with step_pending). */
  async function advance(key: string, want: (r: RunInfo) => boolean): Promise<void> {
    await Promise.all(under(key).filter((r) => want(r) && !sessions.has(r.id)).map(warm));
    const items: Item[] = [];
    for (const r of under(key).filter(want)) {
      const s = sessions.get(r.id);
      if (!s) continue; // its recompute failed and was reported
      const frame = s.frames[r.tick + 1];
      if (frame) items.push({ run: r, frame });
      else await fail(r.id, `The engine's frames for this run end at tick ${s.finalTick}, so there is no frame ${r.tick + 1}. Reset the run to recompute it.`);
    }
    await apply(items);
  }

  /** Recomputes a run that is already playing, e.g. after a restart. The engine is deterministic, so its frames match the rows. */
  async function warm(r: RunInfo): Promise<void> {
    const reply = await compute(r);
    const now = find(r.id);
    if (!now || !PLAYING.includes(now.status)) return; // reset or ended meanwhile; the rows say what's next
    if (!reply.ok) return fail(r.id, reply.detail);
    if (reply.session.finalTick !== now.finalTick) {
      return fail(r.id, `The engine now ends this run at tick ${reply.session.finalTick}, not ${now.finalTick}. Reset the run to recompute it.`);
    }
    sessions.set(r.id, reply.session);
  }

  async function compute(r: RunInfo): Promise<EngineReply> {
    const hospital = deps.hospital(r.sessionId);
    if (!hospital) return { ok: false, detail: `The watcher can't read the hospital of session "${r.sessionId}".` };
    const policy = r.policyJson ? jsonObject(r.policyJson) : null;
    if (policy === undefined) return { ok: false, detail: "The run's policy is not a JSON object." };
    // The plan's per-start evidence is for humans; the engine's policy schema forbids unknown fields.
    if (policy && "evidence" in policy) delete (policy as Record<string, unknown>).evidence;
    const challenges = stringList(r.challengesJson);
    if (!challenges) return { ok: false, detail: "The run's challenges are not a JSON list of ids." };
    let reply: EngineReply;
    try {
      reply = await deps.engine({ hospital, patient_zero: r.patientZero, policy, challenges });
    } catch (e) {
      reply = { ok: false, detail: `The engine call failed: ${(e as Error)?.message ?? e}` };
    }
    if (reply.ok) console.log(`[run] ${r.id}: the engine computed ${reply.session.frames.length} frames from ${r.patientZero}`);
    return reply;
  }

  /** One run_frames_apply call for the items, so a pair lands in one transaction. */
  async function apply(items: Item[]): Promise<void> {
    if (!items.length) return;
    try {
      await deps.reducers.runFramesApply({ framesJson: JSON.stringify(items.map(({ run, frame }) => ({ runId: run.id, frame }))) });
    } catch (e) {
      const message = (e as Error)?.message ?? String(e);
      // A pause, step or reset can commit just before the call, and a resume just after it, so the row may even
      // look unchanged. The first refusal of a frame is only logged: the next beat or step sends it again, or the
      // rows the presenter changed decide what happens next. The same frame refused again with no row change in
      // between ends the run. Frame 0 fails at once: no presenter reducer moves a requested run.
      for (const { run, frame } of items) {
        const last = refused.get(run.id);
        if (frame.tick === 0 || (last?.tick === frame.tick && last.at === seen(run.id))) {
          await fail(run.id, `SpacetimeDB refused engine frame ${frame.tick}: ${message}`);
        } else {
          refused.set(run.id, { tick: frame.tick, at: seen(run.id) });
          console.log(`[run] ${run.id}: frame ${frame.tick} not applied, it goes again on the next beat or step (${message})`);
        }
      }
      return;
    }
    for (const { run } of items) refused.delete(run.id);
    for (const { run, frame } of items) {
      if (frame.final) console.log(`[run] ${run.id}: done at tick ${frame.tick}`);
      else if (frame.tick === 0) console.log(`[run] ${run.id}: frame 0 in, final tick ${frame.run?.finalTick}`);
    }
  }

  /** Ends the run with the detail on every screen (rule 14), as run.detail. */
  async function fail(runId: string, detail: string): Promise<void> {
    sessions.delete(runId);
    refused.delete(runId);
    console.error(`[run] ${runId}: ${detail}`);
    const at = seen(runId);
    try {
      await deps.reducers.runFail({ runId, detail });
    } catch (e) {
      // Most likely the watcher isn't the module's server identity. The run would stay as it is, and recomputing
      // or resending it at once would loop, so it is left alone until its row changes or the watcher restarts.
      held.set(runId, at);
      console.error(`[run] could not record the failure on ${runId}, so it is left as it is until its row changes: ${(e as Error)?.message ?? e}`);
    }
  }

  return {
    /** A run row was inserted, updated or deleted. */
    changed(r: RunInfo): void {
      changes.set(r.id, seen(r.id) + 1);
      held.delete(r.id);
      const now = find(r.id);
      if (!now || now.status === "done" || now.status === "error") {
        sessions.delete(r.id);
        refused.delete(r.id);
      }
      if (!now) changes.delete(r.id);
      sync(keyOf(r));
    },
    /** After subscribe: recompute every run still in play, then let the rows drive it again. */
    recover(): void {
      const live = deps.runs().filter((r) => r.status === "requested" || PLAYING.includes(r.status));
      for (const key of new Set(live.map(keyOf))) {
        enqueue(key, async () => {
          await Promise.all(under(key).filter((r) => PLAYING.includes(r.status)).map(warm));
        });
      }
    },
  };
}

function jsonObject(text: string): object | undefined {
  try {
    const v: unknown = JSON.parse(text);
    return v !== null && typeof v === "object" && !Array.isArray(v) ? v : undefined;
  } catch {
    return undefined;
  }
}

function stringList(text: string): string[] | undefined {
  try {
    const v: unknown = JSON.parse(text);
    return Array.isArray(v) && v.every((x) => typeof x === "string") ? v : undefined;
  } catch {
    return undefined;
  }
}
