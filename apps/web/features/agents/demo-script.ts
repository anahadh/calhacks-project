// A scripted negotiation for the demo stage: the four agents' contributions as short,
// distinct lines, with each plan improving on the last. Numbers are drawn at load so
// no two runs read the same, but every plan is better than the one before. This is
// theatre, labeled "Scripted demo" on screen; it writes no rows and wakes no agent.

import type { AgentId } from "@/lib/stdb/types";

export type Verb = "opens" | "proposes" | "declines" | "approves" | "revises" | "asks" | "recommends";

export type DemoEvent = {
  seq: number;
  round: number;
  agent: AgentId;
  /** Who the message goes to; the web draws a particle along that edge. */
  to: AgentId | "humans";
  verb: Verb;
  /** The one-line contribution. */
  line: string;
  /** The plan's numbers, on proposals and revisions. */
  plan?: { name: string; devices: number; patients: number; cuts: number; rules: number };
  /** On a decline: what the agent needs, in a few words. */
  needs?: string;
};

const rand = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));

/** One script per load: a strict first plan, two rounds of holes being reopened, a rule-budget fold, agreement. */
export function demoScript(baseline = { devices: 9, patients: 90 }): DemoEvent[] {
  // Each plan is strictly better than the last, by a random margin.
  const d1 = rand(6, 7);
  const d2 = rand(4, 5);
  const d3 = rand(2, 3);
  const p1 = rand(44, 56);
  const p2 = rand(28, 36);
  const p3 = rand(14, 22);
  const rules1 = rand(26, 29);
  const rules2 = rand(19, 22);
  const rules3 = rand(20, 23);
  const cuts1 = rand(24, 27);
  const cuts2 = cuts1 - rand(3, 4);
  const cuts3 = cuts2 - rand(2, 3);
  let seq = 0;
  const e = (round: number, agent: AgentId, to: DemoEvent["to"], verb: Verb, line: string, extra: Partial<DemoEvent> = {}): DemoEvent => ({
    seq: ++seq, round, agent, to, verb, line, ...extra,
  });
  return [
    e(1, "coordinator", "flow", "opens", "Round 1. Attack from MRI 2 reached 9 machines and 90 patients. Flow, propose a plan."),
    e(1, "flow", "coordinator", "proposes", `Strict first: wall off the five networks, close every feed between them, keep only charts and time.`, {
      plan: { name: "Strict walls", devices: d1, patients: p1, cuts: cuts1, rules: rules1 },
    }),
    e(1, "coordinator", "inventory", "opens", "Sent to Inventory and Clinical Workflow for review."),
    e(1, "inventory", "coordinator", "declines", `${rules1} allow rules. The switches carry 24. Fold them.`, { needs: "at most 24 rules" }),
    e(1, "clinical_workflow", "coordinator", "declines", "The ER and ICU stations lost vitals and ADT to the chart. Those stay open.", { needs: "keep ER and ICU HL7 feeds" }),
    e(2, "coordinator", "flow", "opens", "Round 2. Two constraints learned. Flow, revise."),
    e(2, "flow", "coordinator", "revises", `Reopened the ER and ICU feeds, folded the rules department to department.`, {
      plan: { name: "Critical care holes", devices: d2, patients: p2, cuts: cuts2, rules: rules2 },
    }),
    e(2, "inventory", "coordinator", "approves", `${rules2} rules, every machine it touches is in the inventory.`),
    e(2, "clinical_workflow", "coordinator", "declines", "Lab results no longer reach the chart. The lab feed stays open.", { needs: "keep lab HL7 feed" }),
    e(3, "coordinator", "flow", "opens", "Round 3. One constraint added. Flow, revise."),
    e(3, "flow", "coordinator", "revises", `Reopened the lab feed. Walls, cuts and the rule budget all hold.`, {
      plan: { name: "Critical care and lab holes", devices: d3, patients: p3, cuts: cuts3, rules: rules3 },
    }),
    e(3, "inventory", "coordinator", "approves", `${rules3} rules, under budget. Nothing unidentified.`),
    e(3, "clinical_workflow", "coordinator", "approves", "Every protected clinical feed is open. No critical service down past two steps."),
    e(3, "coordinator", "humans", "recommends", `Both reviewers accept. Recommending “Critical care and lab holes” for sign-off: ${d3} machines, ${p3} patients, down from ${baseline.devices} and ${baseline.patients}.`),
  ];
}
