import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppSession, callEngine, callEntryPoints, type AppSessionRequest } from "../src/engine";
import hospitalFile from "./fixtures/hospital.handwritten.json";
import base from "./fixtures/session.handwritten.json";
import plan from "./fixtures/session.handwritten.plan.json";

// A stand-in for the engine's HTTP edge (INTEGRATION.md 5a "Transports"): it
// records each request and answers with whatever the test sets.
type Answer = { status: number; body: unknown } | "hang";
let answer: Answer;
let seen: { path: string; contentType: string; body: unknown }[];
let server: Server;
let url: string;

const request: AppSessionRequest = { hospital: hospitalFile.hospital, patient_zero: "ws_admin", policy: null, challenges: [] };
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

beforeEach(async () => {
  seen = [];
  answer = { status: 200, body: base };
  server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      seen.push({ path: req.url ?? "", contentType: req.headers["content-type"] ?? "", body: JSON.parse(Buffer.concat(chunks).toString("utf8")) });
      if (answer === "hang") return;
      res.writeHead(answer.status, { "content-type": "application/json" });
      res.end(typeof answer.body === "string" ? answer.body : JSON.stringify(answer.body));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterEach(() => {
  server.closeAllConnections();
  return new Promise<void>((r) => server.close(() => r()));
});

describe("fixtures", () => {
  it("follow the AppSession contract, so the run tests feed real-shaped frames", () => {
    expect(AppSession.safeParse(base).success).toBe(true);
    expect(AppSession.safeParse(plan).success).toBe(true);
  });
});

describe("callEngine", () => {
  it("POSTs the run's inputs to /app/session and returns the parsed session", async () => {
    const reply = await callEngine(url, request);
    expect(seen).toEqual([{ path: "/app/session", contentType: "application/json", body: request }]);
    expect(reply).toEqual({ ok: true, session: base });
  });

  it("sends a plan run's policy and challenges as they are", async () => {
    const policy = { strategy: "isolate", name: "Isolate admin", rules: [], rationale: "r", tradeoff: "t" };
    answer = { status: 200, body: plan };
    const reply = await callEngine(url, { ...request, policy, challenges: ["unknown_device_imaging"] });
    expect(seen[0].body).toEqual({ ...request, policy, challenges: ["unknown_device_imaging"] });
    expect(reply.ok && reply.session.removedFlows).toEqual(["fl_1"]);
  });

  it("turns the engine's error envelope into a readable detail", async () => {
    answer = { status: 422, body: { error: { type: "invalid_app_input", detail: "patient zero 'mri_1' must be an executing Windows non-medical node" } } };
    expect(await callEngine(url, request)).toEqual({
      ok: false, detail: "Engine refused the run (invalid_app_input): patient zero 'mri_1' must be an executing Windows non-medical node",
    });
    answer = { status: 422, body: { error: { type: "invalid_request", detail: [{ loc: ["policy"], msg: "Extra inputs are not permitted", type: "extra_forbidden" }] } } };
    expect(await callEngine(url, request)).toEqual({
      ok: false, detail: 'Engine refused the run (invalid_request): [{"loc":["policy"],"msg":"Extra inputs are not permitted","type":"extra_forbidden"}]',
    });
  });

  it("refuses frames the module would refuse, naming the path", async () => {
    const extra = clone(base) as any;
    extra.frames[1].attempts[0].via = "ws_admin";
    answer = { status: 200, body: extra };
    const r1 = await callEngine(url, request);
    expect(r1.ok).toBe(false);
    expect(!r1.ok && r1.detail).toMatch(/^Engine \/app\/session sent frames the watcher can't play: frames\.1\.attempts\.0: Unrecognized key\(s\) in object: 'via'/);

    const blankFlow = clone(base) as any;
    blankFlow.frames[2].attempts[1].flowId = "";
    answer = { status: 200, body: blankFlow };
    const r2 = await callEngine(url, request);
    expect(!r2.ok && r2.detail).toContain("frames.2.attempts.1.flowId");

    const badKind = clone(base) as any;
    badKind.frames[3].events[0].kind = "device_destroyed";
    answer = { status: 200, body: badKind };
    const r3 = await callEngine(url, request);
    expect(!r3.ok && r3.detail).toContain("frames.3.events.0.kind");
  });

  it("refuses frames out of order, a missing frame, or run facts off frame 0", async () => {
    const swapped = clone(base) as any;
    [swapped.frames[1], swapped.frames[2]] = [swapped.frames[2], swapped.frames[1]];
    answer = { status: 200, body: swapped };
    const r1 = await callEngine(url, request);
    expect(!r1.ok && r1.detail).toContain("frames.1.tick: is 2, but frames must be ticks 0..finalTick in order");

    const short = clone(base) as any;
    short.frames.pop();
    answer = { status: 200, body: short };
    const r2 = await callEngine(url, request);
    expect(!r2.ok && r2.detail).toContain("frames: holds 3 frames, but finalTick 3 needs 4");

    const noRun = clone(base) as any;
    delete noRun.frames[0].run;
    answer = { status: 200, body: noRun };
    const r3 = await callEngine(url, request);
    expect(!r3.ok && r3.detail).toContain("frames.0.run: is required on frame 0");

    const unknownTop = { ...clone(base), plan: null };
    answer = { status: 200, body: unknownTop };
    const r4 = await callEngine(url, request);
    expect(!r4.ok && r4.detail).toContain("Unrecognized key(s) in object: 'plan'");
  });

  it("reports other HTTP failures, bad JSON, an unreachable engine and a timeout", async () => {
    answer = { status: 500, body: "Internal Server Error" };
    expect(await callEngine(url, request)).toEqual({ ok: false, detail: "Engine /app/session answered HTTP 500: Internal Server Error" });

    // An envelope without detail isn't the engine's envelope: it is shown as it came, and nothing throws.
    answer = { status: 500, body: { error: { type: "internal" } } };
    expect(await callEngine(url, request)).toEqual({ ok: false, detail: 'Engine /app/session answered HTTP 500: {"error":{"type":"internal"}}' });
    expect(await callEntryPoints(url, hospitalFile.hospital)).toEqual({
      ok: false, detail: 'Engine /app/entry_points answered HTTP 500: {"error":{"type":"internal"}}',
    });

    answer = { status: 200, body: "{" };
    expect(await callEngine(url, request)).toEqual({ ok: false, detail: "Engine /app/session sent a reply that is not JSON: {" });

    answer = "hang";
    const slow = await callEngine(url, request, 50);
    expect(!slow.ok && slow.detail).toMatch(new RegExp(`^Can't reach the engine at ${url}: `));

    const closed = await new Promise<string>((resolve) => {
      const s = createServer().listen(0, "127.0.0.1", () => {
        const port = (s.address() as AddressInfo).port;
        s.close(() => resolve(`http://127.0.0.1:${port}`));
      });
    });
    const down = await callEngine(closed, request);
    expect(!down.ok && down.detail).toMatch(new RegExp(`^Can't reach the engine at ${closed}: `));
  });
});

describe("callEntryPoints", () => {
  it("POSTs the hospital to /app/entry_points and returns the ids in order", async () => {
    answer = { status: 200, body: { entryPoints: ["ws_admin", "ws_img", "ws_er"] } };
    expect(await callEntryPoints(url, hospitalFile.hospital)).toEqual({ ok: true, entryPoints: ["ws_admin", "ws_img", "ws_er"] });
    expect(seen).toEqual([{ path: "/app/entry_points", contentType: "application/json", body: { hospital: hospitalFile.hospital } }]);
  });

  it("refuses an unexpected reply and maps the error envelope", async () => {
    answer = { status: 200, body: { entryPoints: ["ws_admin"], count: 1 } };
    const r1 = await callEntryPoints(url, hospitalFile.hospital);
    expect(!r1.ok && r1.detail).toMatch(/^Engine \/app\/entry_points sent an unexpected reply: \(root\): Unrecognized key\(s\) in object: 'count'/);

    answer = { status: 422, body: { error: { type: "invalid_hospital", detail: "hospital must have a non-empty devices list" } } };
    expect(await callEntryPoints(url, {})).toEqual({
      ok: false, detail: "Engine refused the patient-zero check (invalid_hospital): hospital must have a non-empty devices list",
    });
  });
});
