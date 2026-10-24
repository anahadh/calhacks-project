// The engine client against the real engine (INTEGRATION.md 5a "Transports").
// Skipped unless E2E_ENGINE_URL is set:
//
//   cd engine && uv run uvicorn sim_core.api:app --port 8150
//   E2E_ENGINE_URL=http://127.0.0.1:8150 npm test -w watcher -- test/engine.contract.test.ts
//
// It sends what a demo session sends: the demo hospital (data/hospitals/demo.json)
// from MRI 2, once with no policy and once with the agents' keep-scans candidate.
// Each reply must pass the watcher's strict parse with frames 0..finalTick. The
// last test checks the replies against the copies in test/fixtures; a mismatch
// means the engine changed, so copy engine/tests/fixtures/app_session.demo.mri_2*.json
// here again.

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { callEngine, callEntryPoints, type AppSession, type AppSessionRequest } from "../src/engine";

const ENGINE = process.env.E2E_ENGINE_URL?.replace(/\/+$/, "");

// Read at test time, so the default run never depends on another piece's files.
const path = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));
const readJson = (rel: string) => JSON.parse(readFileSync(path(rel), "utf8"));
type Hospital = { devices: { id: string }[]; services: { id: string }[]; patients: { id: string }[] };

async function session(body: AppSessionRequest): Promise<AppSession> {
  const reply = await callEngine(ENGINE!, body);
  if (!reply.ok) throw new Error(reply.detail);
  return reply.session;
}

/** What the run driver relies on beyond the parse: contiguous ticks and a full frame 0. */
function expectPlayable(s: AppSession, hospital: Hospital): void {
  expect(s.frames.map((f) => f.tick)).toEqual(Array.from({ length: s.finalTick + 1 }, (_, t) => t));
  expect(s.frames.map((f) => f.final)).toEqual(s.frames.map((_, t) => t === s.finalTick));
  const [first] = s.frames;
  expect(first.devices.map((d) => d.deviceId)).toEqual(hospital.devices.map((d) => d.id));
  expect(first.services.map((d) => d.serviceId).sort()).toEqual(hospital.services.map((d) => d.id).sort());
  expect(first.patients.map((d) => d.groupId).sort()).toEqual(hospital.patients.map((d) => d.id).sort());
  expect(first.run).toEqual({ finalTick: s.finalTick, removedFlows: s.removedFlows, protectedBroken: s.protectedBroken, assumptions: s.assumptions });
}

describe.skipIf(!ENGINE)("engine contract", () => {
  const hospital: Hospital = readJson("../../../data/hospitals/demo.json").hospital;
  const body: AppSessionRequest = { hospital, patient_zero: "mri_2", policy: null, challenges: [] };
  const keepScans = () => ({ ...body, policy: readJson("../../../agents/fixtures/candidates/cand_keep_scans.json").policy });

  it("lists the demo hospital's entry points in file order, MRI 2 among them", async () => {
    const reply = await callEntryPoints(ENGINE!, hospital);
    if (!reply.ok) throw new Error(reply.detail);
    const order = hospital.devices.map((d) => d.id);
    expect(reply.entryPoints).toContain("mri_2");
    expect(reply.entryPoints).toEqual(order.filter((id) => reply.entryPoints.includes(id)));
  });

  it("computes the baseline from MRI 2 as playable frames", async () => {
    const s = await session(body);
    expectPlayable(s, hospital);
    expect(s.removedFlows).toEqual([]);
  });

  it("computes the keep-scans plan run the same way, with its cuts on frame 0", async () => {
    const s = await session(keepScans());
    expectPlayable(s, hospital);
    expect(s.removedFlows.length).toBeGreaterThan(0);
  });

  it("answers bad inputs with the error envelope, which the client turns into run.detail", async () => {
    const pz = await callEngine(ENGINE!, { ...body, patient_zero: "no_such_device" });
    expect(!pz.ok && pz.detail).toMatch(/^Engine refused the run \(invalid_app_input\): /);
    const policy = {
      strategy: "max_containment", name: "n", rationale: "r", tradeoff: "t",
      rules: [{ id: "r1", from: { zone: "no_such_zone" }, to: {}, plain: "p" }],
    };
    const bad = await callEngine(ENGINE!, { ...body, policy });
    expect(!bad.ok && bad.detail).toMatch(/^Engine refused the run \(invalid_policy\): .*no_such_zone/);
  });

  it("sends exactly what the run tests play (test/fixtures/app_session.demo.mri_2*.json)", async () => {
    for (const [file, req] of [["app_session.demo.mri_2.json", body], ["app_session.demo.mri_2.keep_scans.json", keepScans()]] as const) {
      const rel = `./fixtures/${file}`;
      if (!existsSync(path(rel))) throw new Error(`test/fixtures/${file} is missing: copy it from engine/tests/fixtures`);
      expect(await session(req), file).toEqual(readJson(rel));
    }
  });
});
