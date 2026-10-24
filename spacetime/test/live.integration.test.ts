// Live check against a running SpacetimeDB (AGENTS.md: "show it working on two
// tabs subscribed to the same session"). Skipped unless STDB_URI is set:
//
//   STDB_URI=ws://127.0.0.1:3000 npm run test -w hippocratech-module
//
// It first publishes this module with --delete-data, as the spacetime CLI's
// identity, to its own database (STDB_MODULE, default "hippocratech-it", so
// the demo database is never wiped). init makes the publisher the server
// identity, so a third connection holding the CLI's token plays the run
// watcher and feeds the fixture's frames through run_frames_apply. Two
// anonymous clients, subscribed to the session the way two tabs are, must hold
// identical rows after every tick, and those rows must equal the frames
// (oracle.ts). Every argument goes over the wire as real BSATN, including a
// frames_json at the 256 KiB cap.
//
// The flow is the demo's: start the attack, watch it (with a pause and a step),
// create an aggregate fix, show the solution as a lockstep pair, reset.
// Frames are the engine's real ones when copied into test/fixtures, the
// hand-written ones otherwise.
//
// Env: STDB_URI (required); STDB_MODULE; STDB_SERVER (the CLI's --server,
// default the URI's http twin); STDB_SERVER_TOKEN (default: read from
// `spacetime login show --token`, never printed); SPACETIME_BIN (default
// "spacetime", with ~/.local/bin on PATH); STDB_PUBLISH=0 skips the publish.

import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FRAMES_MAX } from "../src/constants";
import { DbConnection } from "../../apps/web/lib/stdb/module_bindings";
import { ENGINE, HANDWRITTEN, actualRows, expectedRows, rowCount, type Fixture } from "./oracle";

const URI = process.env.STDB_URI;
const MODULE = process.env.STDB_MODULE ?? "hippocratech-it";
const SERVER = process.env.STDB_SERVER ?? URI?.replace(/^ws/, "http");
const PAIR = ENGINE ?? HANDWRITTEN;

// ---------------------------------------------------------------- the CLI

/** Runs the spacetime CLI in the module's folder. A failure names the command, never its output (it may hold a token). */
function cli(args: string[]): string {
  const res = spawnSync(process.env.SPACETIME_BIN ?? "spacetime", args, {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    encoding: "utf8",
    env: { ...process.env, PATH: `${homedir()}/.local/bin:${process.env.PATH ?? ""}` },
  });
  if (res.status !== 0) throw new Error(`\`spacetime ${args[0]} ${args[1] ?? ""}\` failed (exit ${res.status ?? res.error?.message}).`);
  return `${res.stdout}\n${res.stderr}`;
}

/** The CLI identity's token. It published the module, so init made it the server identity. */
function serverToken(): string {
  if (process.env.STDB_SERVER_TOKEN) return process.env.STDB_SERVER_TOKEN;
  const m = /auth token \(don't share this!\) is (\S+)/.exec(cli(["login", "show", "--token"]));
  if (!m) throw new Error("Could not read a token from `spacetime login show --token`. Log in, or set STDB_SERVER_TOKEN.");
  return m[1];
}

// ---------------------------------------------------------------- clients

function connect(token?: string): Promise<DbConnection> {
  return new Promise((resolve, reject) => {
    let b = DbConnection.builder().withUri(URI!).withDatabaseName(MODULE);
    if (token) b = b.withToken(token);
    b.onConnect((conn) => resolve(conn)).onConnectError((_ctx, err) => reject(err)).build();
  });
}

function subscribe(conn: DbConnection, queries: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    conn.subscriptionBuilder().onApplied(() => resolve()).onError((ctx) => reject(ctx.event)).subscribe(queries);
  });
}

const ROW_TABLES = ["device_state", "service_state", "patient_state", "spread_attempt", "sim_event", "tick_snapshot"];
/** A tab's queries: its session and runs, then each run's rows (as the web's live session subscribes). */
const sessionQueries = (sessionId: string) => [
  `SELECT * FROM session WHERE id = '${sessionId}'`, `SELECT * FROM run WHERE session_id = '${sessionId}'`,
];
const runQueries = (runId: string) => ROW_TABLES.map((tbl) => `SELECT * FROM ${tbl} WHERE run_id = '${runId}'`);

const camel = (s: string) => s.replace(/_([a-z])/g, (_m, c: string) => c.toUpperCase());
const snake = (s: string) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
/** A client's cached rows of one table, with the module's snake_case column names. */
const tableOf = (c: DbConnection) => (name: string) =>
  [...(c.db as any)[camel(name)].iter()].map((r: object) => Object.fromEntries(Object.entries(r).map(([k, v]) => [snake(k), v])));
const runOf = (c: DbConnection, id: string) => [...c.db.run.iter()].find((r) => r.id === id);
const sessionOf = (c: DbConnection) => [...c.db.session.iter()][0];

const until = async (check: () => boolean, what: string, ms = 20000) => {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > ms) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 25));
  }
};

const framesJson = (items: [string, unknown][]) => JSON.stringify(items.map(([runId, frame]) => ({ runId, frame })));

// ---------------------------------------------------------------- the test

describe.skipIf(!URI)(`live SpacetimeDB (${PAIR.name} frames)`, () => {
  let a: DbConnection; // the presenter's tab
  let b: DbConnection; // a second laptop
  let srv: DbConnection; // the run watcher (server identity)

  beforeAll(async () => {
    if (process.env.STDB_PUBLISH !== "0") cli(["publish", "--server", SERVER!, "-y", "--delete-data=always", MODULE]);
    [a, b, srv] = await Promise.all([connect(), connect(), connect(serverToken())]);
  }, 180000);

  afterAll(() => {
    for (const c of [a, b, srv]) c?.disconnect();
  });

  it("shows two tabs the same watcher-fed rows at every tick, equal to the frames", async () => {
    const sessionId = `it_${Date.now().toString(36)}`;
    const baseId = `${sessionId}_base`;
    const tabs = [a, b];
    await Promise.all(tabs.map((c) => subscribe(c, [...sessionQueries(sessionId), ...runQueries(baseId)])));

    /** Waits until both tabs show each run at the frame's tick and status, then checks every row against the frames. */
    async function seeOnBothTabs(runs: [string, Fixture, number, string?][]) {
      const want = runs.map(([id, fx, k, status]) => expectedRows(id, fx, k, status));
      await until(() => tabs.every((c) => want.every((w) => {
        const r = runOf(c, w.run.id as string);
        return r?.tick === w.run.tick && r?.status === w.run.status;
      })), `tick ${runs.map(([id, , k]) => `${id}@${k}`).join(", ")}`);
      runs.forEach(([id], i) => {
        expect(actualRows(id, tableOf(a))).toEqual(want[i]);
        expect(actualRows(id, tableOf(b))).toEqual(want[i]);
      });
    }

    // Start the attack: a creates the session (and presents), both join.
    await a.reducers.sessionCreate({ sessionId, hospitalJson: PAIR.base.hospitalJson });
    await a.reducers.presenceJoin({ sessionId, name: "Ana", role: "security" });
    await b.reducers.presenceJoin({ sessionId, name: "Dev", role: "clinical_engineering" });
    const fx = PAIR.base;
    await srv.reducers.sessionEntryPointsSet({ sessionId, entryPointsJson: JSON.stringify([fx.patientZero]) });
    await until(() => tabs.every((c) => sessionOf(c)?.entryPointsJson === JSON.stringify([fx.patientZero])), "entry points");
    await a.reducers.runStart({
      sessionId, runId: baseId, label: "Baseline", patientZero: fx.patientZero, seed: 1337, speed: 4,
      policyJson: "", pairId: "", autoplay: true,
    });
    await until(() => tabs.every((c) => runOf(c, baseId)?.status === "requested"), "requested");

    // Only the server identity feeds frames (rule 11).
    await expect(a.reducers.runFramesApply({ framesJson: framesJson([[baseId, fx.frames[0]]]) })).rejects.toThrow(/server identity/);
    await expect(b.reducers.runFail({ runId: baseId, detail: "x" })).rejects.toThrow(/server identity/);

    // Watch the spread, one frame per call. At tick 2 the presenter pauses and steps once.
    const stepAt = fx.finalTick >= 3 ? 2 : -1;
    for (let k = 0; k <= fx.finalTick; k++) {
      const frame = framesJson([[baseId, fx.frames[k]]]);
      if (k === stepAt) {
        await a.reducers.runPause({ runId: baseId });
        await expect(srv.reducers.runFramesApply({ framesJson: frame })).rejects.toThrow(/paused and no step was asked for/);
        await a.reducers.runStep({ runId: baseId });
        await srv.reducers.runFramesApply({ framesJson: frame });
        await seeOnBothTabs([[baseId, fx, k, "paused"]]);
        await a.reducers.runResume({ runId: baseId });
        continue;
      }
      await srv.reducers.runFramesApply({ framesJson: frame });
      await seeOnBothTabs([[baseId, fx, k]]);
      if (k === 1 && k < fx.finalTick) await expect(b.reducers.defendRequest({ sessionId })).rejects.toThrow(/finish, or pause/); // rule 5
    }
    expect(runOf(a, baseId)?.status).toBe("done");

    // Create aggregate fix, then the Coordinator's plan arrives (the relay writes it as the server).
    await b.reducers.defendRequest({ sessionId });
    await srv.reducers.recommendationUpsert({
      sessionId, round: 1, fixture: false,
      recommendationJson: JSON.stringify({
        policy: { strategy: "protect_critical_care", name: "Keep scans", rules: [], rationale: "", tradeoff: "" },
        testResult: { ticks: PAIR.plan.finalTick }, verdicts: [], explanation: "Why.", explanationSource: "template", requiredRoles: ["security"],
      }),
    });

    // Show the solution: every tab follows session.solution_pair_id into the pair.
    await a.reducers.solutionStart({ sessionId, recommendationId: `${sessionId}:1`, speed: 4 });
    await until(() => tabs.every((c) => !!sessionOf(c)?.solutionPairId), "solution pair");
    const pairId = sessionOf(a)!.solutionPairId;
    expect(sessionOf(b)!.solutionPairId).toBe(pairId);
    await until(() => tabs.every((c) => [...c.db.run.iter()].filter((r) => r.pairId === pairId).length === 2), "pair runs");
    const pairRuns = [...a.db.run.iter()].filter((r) => r.pairId === pairId);
    const none = pairRuns.find((r) => r.policyJson === "")!;
    const plan = pairRuns.find((r) => r.policyJson !== "")!;
    expect([none.status, plan.status, plan.recommendationId]).toEqual(["requested", "requested", `${sessionId}:1`]);
    await Promise.all(tabs.map((c) => subscribe(c, [...runQueries(none.id), ...runQueries(plan.id)])));

    // The watcher feeds both sides in one call per beat; the shorter side ends first and the other continues.
    const sides: [string, Fixture][] = [[none.id, PAIR.base], [plan.id, PAIR.plan]];
    const last = Math.max(PAIR.base.finalTick, PAIR.plan.finalTick);
    for (let beat = 0; beat <= last; beat++) {
      const live = sides.filter(([, f]) => beat <= f.finalTick);
      await srv.reducers.runFramesApply({ framesJson: framesJson(live.map(([id, f]) => [id, f.frames[beat]])) });
      await seeOnBothTabs(sides.map(([id, f]) => [id, f, Math.min(beat, f.finalTick)]));
    }
    expect(tabs.map((c) => sessionOf(c)!.activeRunId)).toEqual([baseId, baseId]); // the baseline stays the session's run

    // The size cap holds over the wire: exactly 256 KiB lands, one more character is refused.
    const capId = `${sessionId}_cap`;
    await a.reducers.runStart({
      sessionId, runId: capId, label: "Cap", patientZero: fx.patientZero, seed: 1337, speed: 1, policyJson: "", pairId: "cap", autoplay: false,
    });
    const items = framesJson([[capId, fx.frames[0]]]);
    const padded = (n: number) => items.slice(0, -1) + " ".repeat(n - items.length) + "]";
    await expect(srv.reducers.runFramesApply({ framesJson: padded(FRAMES_MAX + 1) })).rejects.toThrow(/larger than 256 KiB/);
    await srv.reducers.runFramesApply({ framesJson: padded(FRAMES_MAX) });
    await until(() => tabs.every((c) => runOf(c, capId)?.status === "paused"), "cap run paused");

    // Only the presenter controls playback; a reset clears the baseline's rows on both tabs.
    await expect(b.reducers.runReset({ runId: baseId })).rejects.toThrow(/presenter/);
    await a.reducers.runReset({ runId: baseId });
    await until(() => tabs.every((c) => runOf(c, baseId)?.status === "requested" && rowCount(baseId, tableOf(c)) === 0), "reset");

    // Back to the session on every tab; the pair's runs stay.
    await a.reducers.solutionClose({ sessionId });
    await until(() => tabs.every((c) => sessionOf(c)?.solutionPairId === ""), "solution closed");
    expect([...b.db.run.iter()].filter((r) => r.pairId === pairId)).toHaveLength(2);
  }, 120000);
});
