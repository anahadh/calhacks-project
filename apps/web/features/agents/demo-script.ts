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
    e(1, "coordinator", "flow", "opens", "Starting round 1. Without any plan, the attack from MRI 2 reached 9 machines and disrupted care for 90 patients. Flow, give us a plan."),
    e(1, "flow", "coordinator", "proposes", "My first plan is strict on purpose. I split the hospital into five networks and block every connection between them except the chart and the clock. Clinical can tell me which feeds they need back.", {
      plan: { name: "Strict walls", devices: d1, patients: p1, cuts: cuts1, rules: rules1 },
    }),
    e(1, "coordinator", "inventory", "opens", "Inventory and Clinical Workflow, please review Flow's plan."),
    e(1, "inventory", "coordinator", "declines", `I can't approve this. It needs ${rules1} firewall rules and our switches can only hold 24. Flow has to combine rules.`, { needs: "24 rules or fewer" }),
    e(1, "clinical_workflow", "coordinator", "declines", "I can't approve this either. It cuts the ER and ICU monitors off from the patient chart, so nurses would lose live vitals and bed assignments. Those two feeds must stay open.", { needs: "ER and ICU monitor feeds stay open" }),
    e(2, "coordinator", "flow", "opens", "Starting round 2. Flow, both reviewers said no. Keep the ER and ICU feeds open and get under 24 rules."),
    e(2, "flow", "coordinator", "revises", "Done. I reopened the ER and ICU monitor feeds and merged rules by department, which brought the count down. The attack still can't leave its own network.", {
      plan: { name: "ER and ICU feeds open", devices: d2, patients: p2, cuts: cuts2, rules: rules2 },
    }),
    e(2, "inventory", "coordinator", "approves", `I approve. ${rules2} rules fits our switches, and every machine this plan touches is one we know.`),
    e(2, "clinical_workflow", "coordinator", "declines", "Closer, but still no. The lab can't send results to the chart anymore, so doctors would wait on paper. That feed must stay open too.", { needs: "lab results feed stays open" }),
    e(3, "coordinator", "flow", "opens", "Starting round 3. Flow, one more fix: keep the lab results feed open."),
    e(3, "flow", "coordinator", "revises", "Reopened the lab feed. Everything else holds: the walls, the cuts and the rule budget.", {
      plan: { name: "ER, ICU and lab feeds open", devices: d3, patients: p3, cuts: cuts3, rules: rules3 },
    }),
    e(3, "inventory", "coordinator", "approves", `I approve. ${rules3} rules, still under budget, nothing unknown on the list.`),
    e(3, "clinical_workflow", "coordinator", "approves", "I approve. Every feed that care depends on is open, and no critical service is down for long."),
    e(3, "coordinator", "humans", "recommends", `Both reviewers approve. I'm sending “ER, ICU and lab feeds open” to the humans for sign-off: ${d3} machines and ${p3} patients instead of ${baseline.devices} and ${baseline.patients}.`),
  ];
}
