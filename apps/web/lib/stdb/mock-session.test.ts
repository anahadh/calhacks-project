import { describe, expect, it } from "vitest";
import { mockRunRows, mockSession as s } from "./mock-session";

// The mock is written by hand, so these keep it a state the real rows could be in.
describe("mockSession", () => {
  const ids = (xs: { id: string }[]) => new Set(xs.map((x) => x.id));
  const devices = ids(s.hospital.devices);
  const flows = ids(s.hospital.flows);

  it("is labeled as the mock and refuses every control", async () => {
    expect(s.source).toBe("mock");
    await expect(s.actions.defend()).rejects.toThrow(/^Mock data/);
    await expect(s.actions.showSolution("mock:2")).rejects.toThrow(/^Mock data/);
  });

  it("has a finished baseline whose totals match its run row", () => {
    expect(s.activeRun).toBeDefined();
    expect(s.runs.find((r) => r.id === s.activeRunId)).toBe(s.activeRun);
    expect(s.activeRun).toMatchObject({ status: "done", pairId: "", policyJson: "", tick: s.activeRun!.finalTick });
    const { patientsAffected, devicesCompromised, servicesDown, delayedProcedures } = s.activeRun!;
    expect(s.totals).toEqual({ patientsAffected, devicesCompromised, servicesDown, delayedProcedures });
    expect(s.delayedProcedures).toBe(delayedProcedures);
    expect(s.devices.filter((d) => d.infected)).toHaveLength(devicesCompromised);
    expect(s.services.filter((x) => x.down)).toHaveLength(servicesDown);
    expect(s.snapshots).toHaveLength(s.activeRun!.finalTick + 1);
  });

  it("names only devices and flows the hospital has", () => {
    expect(s.entryPoints.every((id) => devices.has(id))).toBe(true);
    expect(s.attempts.every((a) => devices.has(a.from) && devices.has(a.to) && flows.has(a.flowId))).toBe(true);
    for (const r of s.recommendations) expect(r.verified.removedFlows.every((id) => flows.has(id))).toBe(true);
  });

  it("has no blocked attempts on a run without a plan", () => {
    expect(s.attempts.every((a) => a.success)).toBe(true);
  });

  it("serves the baseline through useRunRows, and nothing else", () => {
    expect(mockRunRows(s.activeRunId)).toMatchObject({ source: "mock", run: s.activeRun, totals: s.totals });
    const missing = mockRunRows("pair_x_none");
    expect(missing).toMatchObject({ source: "missing", devices: [] });
    expect(missing.run).toBeUndefined();
  });
});
