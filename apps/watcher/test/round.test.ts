import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { watchRounds } from "../src/round";

// The round watcher against a fake connection: one defend_request_log row in,
// one Coordinator call (or one error on the session) out.
let inserted: ((ctx: unknown, req: any) => Promise<void>)[];
let calls: [string, any][];

const conn = {
  db: {
    defendRequestLog: { onInsert: (cb: (ctx: unknown, req: any) => Promise<void>) => inserted.push(cb) },
    session: { id: { find: (id: string) => (id === "demo" ? { roundState: "idle", round: 0 } : undefined) } },
  },
  reducers: { roundStateSet: async (args: any) => void calls.push(["roundStateSet", args]) },
} as any;

const request = (challengesJson: string) => ({
  sessionId: "demo", runId: "run_1", patientZero: "ws_admin", seed: 1337, challengesJson, requesterName: "Ana",
});

beforeEach(() => {
  inserted = [];
  calls = [];
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
    calls.push(["fetch", { url, body: JSON.parse(String(init?.body)) }]);
    return new Response(JSON.stringify({ ok: true, detail: "round 1 started" }), { status: 200 });
  });
});
afterEach(() => vi.restoreAllMocks());

describe("round watcher", () => {
  it("wakes the Coordinator with the request's challenges", async () => {
    watchRounds(conn, "http://coordinator.test");
    await inserted[0]({}, request('["unknown_device_imaging"]'));
    expect(calls).toEqual([["fetch", {
      url: "http://coordinator.test/start_round",
      body: { sessionId: "demo", runId: "run_1", patientZero: "ws_admin", seed: 1337, challenges: ["unknown_device_imaging"] },
    }]]);
  });

  it("reports unreadable challenges on the session instead of throwing", async () => {
    watchRounds(conn, "http://coordinator.test");
    await inserted[0]({}, request("{not json"));
    await inserted[0]({}, request('[1, "x"]'));
    const detail = "Couldn't start the aggregate fix: the request's challenges are not a JSON list of ids.";
    expect(calls).toEqual([
      ["roundStateSet", { sessionId: "demo", round: 0, state: "idle", detail }],
      ["roundStateSet", { sessionId: "demo", round: 0, state: "idle", detail }],
    ]);
  });
});
