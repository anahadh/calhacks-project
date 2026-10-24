import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EntryPointsReply } from "../src/engine";
import { watchEntryPoints } from "../src/entry";
import hospitalFile from "./fixtures/hospital.handwritten.json";

const hospital = hospitalFile.hospital;

type SessionRow = { id: string; entryPointsJson: string };
let sessions: SessionRow[];
let inserted: ((ctx: unknown, s: SessionRow) => void)[];
let calls: [string, any][];
let reply: EntryPointsReply;
let refuse: string | undefined;
let explode: Error | undefined;

const conn = {
  db: { session: { onInsert: (cb: (ctx: unknown, s: SessionRow) => void) => inserted.push(cb), iter: () => sessions.values() } },
} as any;

function start(): void {
  watchEntryPoints(conn, {
    reducers: {
      sessionEntryPointsSet: async (args) => {
        if (refuse) throw new Error(refuse);
        calls.push(["sessionEntryPointsSet", args]);
      },
    },
    entryPoints: async (h) => {
      calls.push(["entryPoints", h]);
      if (explode) throw explode; // a dep that breaks its never-throws contract
      return reply;
    },
    hospital: (id) => (sessions.some((s) => s.id === id) && id !== "broken" ? hospital : undefined),
    report: async (sessionId, detail) => {
      calls.push(["report", { sessionId, detail }]);
    },
  });
}

const settle = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  sessions = [];
  inserted = [];
  calls = [];
  reply = { ok: true, entryPoints: ["ws_admin", "ws_img", "ws_er"] };
  refuse = undefined;
  explode = undefined;
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("entry points", () => {
  it("asks the engine for each new session and stores the list", async () => {
    start();
    sessions.push({ id: "demo", entryPointsJson: "[]" });
    inserted.forEach((cb) => cb({}, sessions[0]));
    await settle();
    expect(calls).toEqual([
      ["entryPoints", hospital],
      ["sessionEntryPointsSet", { sessionId: "demo", entryPointsJson: '["ws_admin","ws_img","ws_er"]' }],
    ]);
  });

  it("after a restart, fills only the sessions still on the default []", async () => {
    sessions = [{ id: "demo", entryPointsJson: '["ws_admin"]' }, { id: "other", entryPointsJson: "[]" }];
    start();
    await settle();
    expect(calls).toEqual([
      ["entryPoints", hospital],
      ["sessionEntryPointsSet", { sessionId: "other", entryPointsJson: '["ws_admin","ws_img","ws_er"]' }],
    ]);
  });

  it("reports an engine failure, a refusal and an unreadable hospital on the session", async () => {
    sessions = [{ id: "demo", entryPointsJson: "[]" }];
    reply = { ok: false, detail: "Can't reach the engine at http://127.0.0.1:8000: fetch failed" };
    start();
    await settle();
    expect(calls).toEqual([
      ["entryPoints", hospital],
      ["report", { sessionId: "demo", detail: "Couldn't get the engine's patient-zero list: Can't reach the engine at http://127.0.0.1:8000: fetch failed" }],
    ]);

    calls = [];
    reply = { ok: true, entryPoints: ["ws_admin"] };
    refuse = 'Device "ws_admin" does not exist.';
    sessions.push({ id: "next", entryPointsJson: "[]" });
    inserted.forEach((cb) => cb({}, sessions[1]));
    await settle();
    expect(calls.at(-1)).toEqual(["report", { sessionId: "next", detail: 'SpacetimeDB refused the engine\'s patient-zero list: Device "ws_admin" does not exist.' }]);

    calls = [];
    sessions.push({ id: "broken", entryPointsJson: "[]" });
    inserted.forEach((cb) => cb({}, sessions[2]));
    await settle();
    expect(calls).toEqual([
      ["report", { sessionId: "broken", detail: "Couldn't ask the engine for patient zeros: the watcher can't read this session's hospital." }],
    ]);
  });

  it("reports a dep that throws instead of letting it end the watcher, and asks again next time", async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (e: unknown) => unhandled.push(e);
    process.on("unhandledRejection", onUnhandled);
    try {
      sessions = [{ id: "demo", entryPointsJson: "[]" }];
      explode = new TypeError("Cannot read properties of undefined (reading 'slice')");
      start();
      await settle();
      expect(calls).toEqual([
        ["entryPoints", hospital],
        ["report", { sessionId: "demo", detail: "Couldn't get the engine's patient-zero list: Cannot read properties of undefined (reading 'slice')" }],
      ]);

      calls = [];
      explode = undefined;
      inserted.forEach((cb) => cb({}, sessions[0])); // the same session again: no longer marked as being asked
      await settle();
      expect(calls.at(-1)).toEqual(["sessionEntryPointsSet", { sessionId: "demo", entryPointsJson: '["ws_admin","ws_img","ws_er"]' }]);
      expect(unhandled).toEqual([]);
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });
});
