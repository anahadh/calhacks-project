import { describe, expect, it } from "vitest";
import demo from "../../../data/hospitals/demo.json";
import { initialState, protectedBroken, runToEnd, step, type Hospital, type Policy } from "../src";

const h = (demo as unknown as { hospital: Hospital }).hospital;

describe("determinism", () => {
  it("gives identical runs for the same inputs", () => {
    expect(runToEnd(h, "mri_2", 1337)).toEqual(runToEnd(h, "mri_2", 1337));
  });

  it("matches tick by tick when stepped one at a time (the module's path)", () => {
    const whole = runToEnd(h, "mri_2", 1337);
    let { state } = initialState(h, "mri_2", 1337);
    for (let i = 1; i < whole.ticks.length; i++) {
      state = step(h, JSON.parse(JSON.stringify(state))).state; // state survives a JSON round trip, as in the database
      expect(Object.keys(state.infected).length).toBe(whole.ticks[i].devicesCompromised);
    }
  });

  it("changes with the seed", () => {
    const a = runToEnd(h, "mri_2", 1).ticks.map((t) => t.devicesCompromised);
    const b = runToEnd(h, "mri_2", 2).ticks.map((t) => t.devicesCompromised);
    expect(a).not.toEqual(b);
  });
});

describe("spread and impact", () => {
  it("starts with patient zero and its services down", () => {
    const { state, events } = initialState(h, "mri_2", 7);
    expect(Object.keys(state.infected)).toEqual(["mri_2"]);
    expect(state.serviceDownSince.svc_mri).toBe(0);
    expect(events[0].kind).toBe("patient_zero");
  });

  it("rejects an unknown patient zero", () => {
    expect(() => initialState(h, "nope", 1)).toThrow();
  });

  it("spreads beyond patient zero without a policy", () => {
    const r = runToEnd(h, "mri_2", 1337);
    expect(r.final.devicesCompromised).toBeGreaterThan(5);
    expect(r.final.patientsAffected).toBeGreaterThan(0);
  });
});

describe("policies", () => {
  const scansOnly: Policy = {
    strategy: "protect_critical_care",
    name: "Scans only",
    rules: [
      { id: "r1", from: { zone: "imaging", deviceType: "mri" }, to: { role: "pacs" }, protocol: "dicom", plain: "MRIs send scans to PACS." },
      { id: "r2", from: { zone: "imaging", deviceType: "ct" }, to: { role: "pacs" }, protocol: "dicom", plain: "CT sends scans to PACS." },
    ],
  };

  it("contains the attack compared with no segmentation", () => {
    const none = runToEnd(h, "mri_2", 1337);
    const plan = runToEnd(h, "mri_2", 1337, { policy: scansOnly });
    expect(plan.final.devicesCompromised).toBeLessThan(none.final.devicesCompromised);
  });

  it("reports protected flows the policy breaks", () => {
    const broken = protectedBroken(h, scansOnly).map((f) => f.purpose);
    expect(broken).toContain("Vitals to charts");
    expect(broken).not.toContain("Scans to radiologists");
  });
});
