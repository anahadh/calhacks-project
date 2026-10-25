import { describe, expect, it } from "vitest";
import type { Hospital, RunRow } from "@/lib/stdb/types";
import { diagramOf, dollars, moneyOf, savedBy, UNIT } from "./estimate";

const run = (over: Partial<RunRow>): RunRow => ({
  id: "r", label: "", patientZero: "mri_1", seed: 1, tick: 10, status: "done", speed: 1, pairId: "p", policyJson: "", finalTick: 10,
  detail: "", stepPending: false, removedFlows: [], protectedBroken: [], assumptions: [], recommendationId: "",
  patientsAffected: 0, devicesCompromised: 0, servicesDown: 0, delayedProcedures: 0, ...over,
});

const hospital: Hospital = {
  id: "h", name: "H", floors: [{ id: "f0", name: "Ground", level: 0 }],
  rooms: [
    { id: "r_img", floorId: "f0", name: "Imaging", type: "imaging", zone: "imaging", polygon: [] },
    { id: "r_srv", floorId: "f0", name: "Server", type: "server", zone: "it_core", polygon: [] },
    { id: "r_icu", floorId: "f0", name: "ICU", type: "icu", zone: "critical_care", polygon: [] },
  ],
  devices: [
    { id: "mri_1", roomId: "r_img", type: "mri", name: "MRI 1", os: "windows", vulnerable: true, criticality: "high", vlan: 10, position: [0, 0] },
    { id: "pacs", roomId: "r_srv", type: "server_rack", role: "pacs", name: "PACS", os: "linux", vulnerable: false, criticality: "high", vlan: 20, position: [0, 0] },
    { id: "ns_icu", roomId: "r_icu", type: "nurse_station", name: "ICU NS", os: "windows", vulnerable: false, criticality: "life_support", vlan: 30, position: [0, 0] },
  ],
  flows: [
    { id: "fl_scan", from: "mri_1", to: "pacs", protocol: "dicom", port: 104, protected: true, purpose: "Scans" },
    { id: "fl_smb", from: "mri_1", to: "ns_icu", protocol: "smb", port: 445, protected: false },
    { id: "fl_ehr", from: "ns_icu", to: "pacs", protocol: "hl7", port: 2575, protected: true },
  ],
  services: [], patients: [],
};

describe("savedBy", () => {
  const none = run({ devicesCompromised: 12, patientsAffected: 26, servicesDown: 3 });
  const plan = run({ devicesCompromised: 1, patientsAffected: 4, servicesDown: 0, removedFlows: ["fl_smb"] });

  it("is the difference of the two final rows", () => {
    expect(savedBy(hospital, none, plan)).toMatchObject({ machines: 11, patients: 22, services: 3, flowsIntact: 2, flowsTotal: 2 });
  });

  it("waits until both sides are done", () => {
    expect(savedBy(hospital, none, run({ ...plan, status: "running" }))).toBeUndefined();
    expect(savedBy(hospital, undefined, plan)).toBeUndefined();
  });
});

describe("moneyOf", () => {
  it("is unit costs times counts, line by line", () => {
    const saved = savedBy(hospital, run({ devicesCompromised: 12, patientsAffected: 26, servicesDown: 3 }), run({ devicesCompromised: 1, patientsAffected: 4 }))!;
    const m = moneyOf(8, 4, saved);
    expect(m.implement).toBe(8 * UNIT.rule + 4 * UNIT.segment + UNIT.project);
    expect(m.avoided).toBe(11 * UNIT.device + 22 * UNIT.patient + 3 * UNIT.service);
    expect(m.lines.filter((l) => l.side === "avoided").map((l) => l.count)).toEqual([11, 22, 3]);
  });

  it("formats dollars short", () => {
    expect([dollars(900), dollars(1_500), dollars(48_000), dollars(1_234_000)]).toEqual(["$900", "$1.5k", "$48k", "$1.2M"]);
  });
});

describe("diagramOf", () => {
  it("joins zones by their kept and cut connections", () => {
    const d = diagramOf(hospital, [{ deviceId: "mri_1", infected: true }], ["fl_smb"]);
    expect(d.nodes.map((n) => [n.zone, n.devices, n.infected])).toEqual([["imaging", 1, 1], ["critical_care", 1, 0], ["it_core", 1, 0]]);
    expect(d.edges).toEqual(
      expect.arrayContaining([
        { from: "imaging", to: "it_core", kept: 1, cut: 0, protectedKept: 1 },
        { from: "critical_care", to: "imaging", kept: 0, cut: 1, protectedKept: 0 },
        { from: "critical_care", to: "it_core", kept: 1, cut: 0, protectedKept: 1 },
      ]),
    );
    expect(d.nodes.every((n) => n.x >= 0 && n.x <= d.width && n.y >= 0 && n.y <= d.height)).toBe(true);
  });
});

