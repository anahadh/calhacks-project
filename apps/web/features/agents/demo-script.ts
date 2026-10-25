// A scripted negotiation for the demo stage: the four agents' contributions as short,
// distinct lines, with each plan improving on the last. Numbers are drawn at load so
// no two runs read the same, but every plan is better than the one before. This is
// theatre, labeled "Scripted demo" on screen; it writes no rows and wakes no agent.

import type { AgentId, AgentMessageRow } from "@/lib/stdb/types";
import { needsLabel, type Names } from "./negotiation";

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
  plan?: { name: string; devices: number; patients: number; cuts?: number; rules: number };
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
  const rules1 = rand(4, 6);
  const rules2 = rand(27, 31);
  const rules3 = rand(19, 23);
  const cuts1 = rand(8, 10);
  const cuts2 = rand(22, 26);
  const cuts3 = rand(15, 18);
  let seq = 0;
  const e = (round: number, agent: AgentId, to: DemoEvent["to"], verb: Verb, line: string, extra: Partial<DemoEvent> = {}): DemoEvent => ({
    seq: ++seq, round, agent, to, verb, line, ...extra,
  });
  return [
    e(1, "coordinator", "flow", "opens", "Starting round 1. Without any plan, the attack from MRI 2 reached 9 machines and disrupted care for 90 patients. Flow, give us a plan."),
    e(1, "flow", "coordinator", "proposes", "Simplest thing first: the attack started in Imaging, so I wall Imaging off from the rest of the hospital completely.", {
      plan: { name: "Wall off Imaging", devices: d1, patients: p1, cuts: cuts1, rules: rules1 },
    }),
    e(1, "coordinator", "inventory", "opens", "Inventory and Clinical Workflow, please review Flow's plan."),
    e(1, "inventory", "coordinator", "approves", `I approve. ${rules1} rules is easy for our switches, and every machine it touches is one we know.`),
    e(1, "clinical_workflow", "coordinator", "declines", "I can't approve this. Walling off Imaging cuts the scanners off from PACS, so no radiologist can read a scan. And it does nothing for an attack that starts anywhere else.", { needs: "scans still reach PACS; protect the whole hospital" }),
    e(2, "coordinator", "flow", "opens", "Starting round 2. Flow, keep scans flowing to PACS, and plan for an attack from any desk, not only MRI 2."),
    e(2, "flow", "coordinator", "revises", "Second try: a wall around every department, scans allowed through to PACS. Now an attack from any desk stays in its own department.", {
      plan: { name: "Walls around every department", devices: d2, patients: p2, cuts: cuts2, rules: rules2 },
    }),
    e(2, "inventory", "coordinator", "declines", `I can't approve this. Seven departments means ${rules2} firewall rules, and our switches hold 24. Combine them.`, { needs: "24 rules or fewer" }),
    e(2, "clinical_workflow", "coordinator", "declines", "Not yet. The ER, ICU and ward monitors sit in different departments from the chart server, so this cuts their vitals and bed assignments off. Those feeds must stay open.", { needs: "monitor feeds to the chart stay open" }),
    e(3, "coordinator", "flow", "opens", "Starting round 3. Flow, fewer rules, and the monitor feeds must reach the chart."),
    e(3, "flow", "coordinator", "revises", "Third plan, by function instead of by room: five networks, one for servers, one for imaging and PACS, one for bedside monitors, one for clinical desks, one for business. I cut only file sharing and remote desktop between them and leave every clinical feed open.", {
      plan: { name: "Five networks by function", devices: d3, patients: p3, cuts: cuts3, rules: rules3 },
    }),
    e(3, "inventory", "coordinator", "approves", `I approve. ${rules3} rules fits the switches, nothing unknown on the list.`),
    e(3, "clinical_workflow", "coordinator", "approves", "I approve. Scans reach PACS, every monitor reaches the chart, the lab reaches the chart, and no critical service is down for long."),
    e(3, "coordinator", "humans", "recommends", `Both reviewers approve. I'm sending “Five networks by function” to the humans for sign-off: ${d3} machines and ${p3} patients instead of ${baseline.devices} and ${baseline.patients}.`),
  ];
}


/**
 * The same events from real agent_message rows: one card per thing an agent sent, in its
 * own words (the reason the model wrote), with the engine's tested numbers on each plan and
 * the constraint a rejection added. The Coordinator's forwards are folded away; its round
 * requests open each round. Nothing is invented (rule 16).
 */
export function eventsFromRows(messages: readonly AgentMessageRow[], names: Names): DemoEvent[] {
  const out: DemoEvent[] = [];
  let name = "";
  let rules = 0;
  const opened = new Set<number>();
  for (const m of [...messages].sort((a, b) => a.seq - b.seq)) {
    if (m.type === "request") {
      if (opened.has(m.round)) continue; // round 1's request goes to Flow and Inventory alike: one card
      opened.add(m.round);
    }
    if (m.type === "chat" || m.type === "answer") continue;
    if (m.from === "coordinator" && (m.type === "proposal" || m.type === "revision")) continue;
    if (m.from === "humans" || m.from === "asi1") continue;
    const agent = m.from as AgentId;
    const base = { seq: m.seq, round: m.round, agent, to: (m.to === "all" ? "humans" : m.to) as DemoEvent["to"] };
    switch (m.type) {
      case "request":
        out.push({ ...base, verb: "opens", line: m.reason || (m.round > 1 ? `Starting round ${m.round}. Flow, revise the plan.` : "Starting round 1. Flow, give us a plan.") });
        break;
      case "proposal":
        name = m.name ?? name;
        rules = m.rules?.length ?? rules;
        out.push({ ...base, verb: "proposes", line: m.reason, plan: { name, devices: m.tested?.devicesCompromised ?? 0, patients: m.tested?.patientsAffected ?? 0, rules } });
        break;
      case "revision":
        name = m.name ?? name;
        out.push({ ...base, verb: "revises", line: m.reason, plan: { name, devices: m.tested?.devicesCompromised ?? 0, patients: m.tested?.patientsAffected ?? 0, rules } });
        break;
      case "accept":
        out.push({ ...base, verb: "approves", line: m.reason });
        break;
      case "reject":
        out.push({ ...base, verb: "declines", line: m.reason, needs: m.constraint ? needsLabel(m.constraint, names) : undefined });
        break;
      case "question":
        out.push({ ...base, verb: "asks", line: m.reason });
        break;
      case "recommendation":
        out.push({ ...base, verb: "recommends", line: m.reason });
        break;
    }
  }
  return out;
}

/** The feeds the reviewers made Flow reopen so far: every keep_flow target in the rows. */
export function reopenedFromRows(messages: readonly AgentMessageRow[]): string[] {
  return [...new Set(messages.filter((m) => m.type === "reject" && m.constraint?.kind === "keep_flow").flatMap((m) => m.constraint!.targetIds))];
}
