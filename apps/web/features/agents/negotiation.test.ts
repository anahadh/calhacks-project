import { describe, expect, it } from "vitest";
import type { AgentMessageRow } from "@/lib/stdb/types";
import { lanesOf, negotiationOf } from "./negotiation";

const names = {
  device: new Map([["mri_1", { name: "MRI 1" }], ["srv_pacs", { name: "PACS" }], ["ws_x", { name: "WS X" }]]),
  flow: new Map([["fl_1", { from: "mri_1", to: "srv_pacs", purpose: "Scans to radiologists" }]]),
  service: new Map([["svc_mri", { name: "MRI imaging" }]]),
};

let seq = 0;
const m = (over: Partial<AgentMessageRow>): AgentMessageRow => ({ round: 1, seq: ++seq, from: "flow", to: "coordinator", type: "proposal", reason: "", ...over });

describe("negotiationOf", () => {
  const rows = [
    m({ type: "request", from: "coordinator", to: "flow" }),
    m({ type: "proposal", name: "Isolate imaging", rules: ["a", "b"], tested: { patientsAffected: 3, devicesCompromised: 1 } }),
    m({ type: "proposal", from: "coordinator", to: "clinical_workflow", name: "Isolate imaging", rules: ["a", "b"] }),
    m({ type: "question", from: "inventory", to: "humans", reason: "What is WS X?" }),
    m({ type: "reject", from: "clinical_workflow", reason: "Cuts scans.", constraint: { kind: "keep_flow", targetIds: ["fl_1"] } }),
    m({ type: "accept", from: "inventory", reason: "All named." }),
    m({ type: "revision", round: 2, diff: ["+ x"], tested: { patientsAffected: 2 } }),
    m({ type: "accept", round: 2, from: "inventory", reason: "Fine." }),
    m({ type: "accept", round: 2, from: "clinical_workflow", reason: "Scans flow." }),
    m({ type: "recommendation", round: 2, from: "coordinator", to: "all" }),
  ];
  const { plans, constraints } = negotiationOf(rows, names);

  it("makes one column per plan, carrying the name into revisions", () => {
    expect(plans.map((p) => [p.round, p.kind, p.name, p.size, p.patientsAffected])).toEqual([
      [1, "proposal", "Isolate imaging", "2 rules", 3],
      [2, "revision", "Isolate imaging", "1 changes", 2],
    ]);
  });

  it("stamps each reviewer's verdict; a later verdict replaces a question", () => {
    expect(plans[0].verdicts.inventory?.decision).toBe("accept");
    expect(plans[0].verdicts.clinical_workflow).toMatchObject({ decision: "reject", needs: "Keep MRI 1 → PACS" });
    expect(plans[1].verdicts.clinical_workflow?.decision).toBe("accept");
  });

  it("lists each rejection's constraint, met when the same agent accepts a later plan", () => {
    expect(constraints).toEqual([expect.objectContaining({ agent: "clinical_workflow", round: 1, label: "Keep MRI 1 → PACS", metIn: 2 })]);
  });

  it("shows an open question until the agent decides", () => {
    const { plans: p } = negotiationOf(rows.slice(0, 4), names);
    expect(p[0].verdicts.inventory).toMatchObject({ decision: "question", reason: "What is WS X?" });
  });
});

describe("alternatives on the table", () => {
  const rows = [
    m({ type: "proposal", round: 1, policyId: "wall_public", name: "Wall off public areas", rules: ["a"], tested: { patientsAffected: 36 } }),
    m({ type: "accept", round: 1, from: "inventory", policyId: "wall_public" }),
    m({ type: "accept", round: 1, from: "clinical_workflow", policyId: "wall_public" }),
    m({ type: "proposal", round: 1, from: "coordinator", to: "inventory", policyId: "no_lateral", name: "Block file sharing", rules: ["a", "b"], tested: { patientsAffected: 36 } }),
    m({ type: "proposal", round: 1, from: "coordinator", to: "clinical_workflow", policyId: "no_lateral", name: "Block file sharing", rules: ["a", "b"] }),
    m({ type: "reject", round: 1, from: "clinical_workflow", policyId: "no_lateral", constraint: { kind: "keep_flow", targetIds: ["fl_1"] } }),
    m({ type: "accept", round: 1, from: "inventory", policyId: "no_lateral" }),
  ];
  const { plans, constraints } = negotiationOf(rows, names);

  it("adds one column per alternative the orchestrator forwards, with its own stamps", () => {
    expect(plans.map((p) => [p.kind, p.name])).toEqual([["proposal", "Wall off public areas"], ["alternative", "Block file sharing"]]);
    expect(plans[0].verdicts.clinical_workflow?.decision).toBe("accept");
    expect(plans[1].verdicts.clinical_workflow?.decision).toBe("reject");
  });

  it("lists an alternative's rejection as a constraint learned too: the next round repairs every plan", () => {
    expect(constraints).toEqual([expect.objectContaining({ agent: "clinical_workflow", label: "Keep MRI 1 → PACS" })]);
  });
});

describe("lanesOf", () => {
  it("counts each agent's work as badges and marks who is live", () => {
    const rows: AgentMessageRow[] = [
      m({ type: "request", from: "coordinator", to: "flow" }),
      m({ type: "proposal", name: "A", rules: ["a"] }),
      m({ type: "proposal", from: "coordinator", to: "inventory", name: "A" }),
      m({ type: "proposal", from: "coordinator", to: "clinical_workflow", name: "A" }),
      m({ type: "reject", from: "clinical_workflow", constraint: { kind: "keep_flow", targetIds: ["fl_1"] } }),
      m({ type: "accept", from: "inventory" }),
      m({ type: "revision", round: 2 }),
    ];
    const lanes = lanesOf(rows, [{ agent: "flow", status: "thinking" }], { state: "running", round: 2 });
    expect(lanes.map((l) => l.agent)).toEqual(["coordinator", "flow", "inventory", "clinical_workflow"]);
    expect(lanes[0].badges.map((b) => b.label)).toEqual(["round 2", "3 messages routed"]);
    expect(lanes[1].badges.map((b) => b.label)).toEqual(["2 plans tested", "revised 1×", "thinking"]);
    expect(lanes[2].badges.map((b) => b.label)).toEqual(["● accepted 1"]);
    expect(lanes[3].badges.map((b) => b.label)).toEqual(["✕ rejected 1"]);
  });
});
