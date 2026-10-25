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
  plan?: { name: string; devices: number; patients: number; cuts?: number; rules: number; /** Live: machines infected on average over every attack start, without and with the plan. */ avg?: { baseline: number; plan: number; starts: number } };
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
  const B = baseline;
  return [
    e(1, "coordinator", "flow", "opens", `Round 1 open. Baseline from MRI 2 with no plan: ${B.devices} devices infected, ${B.patients} patients with care delayed or disrupted, 4 services down. Flow, propose.`),
    e(1, "flow", "coordinator", "proposes", `I propose walling off imaging, where the attack started: ${cuts1} connections cut at its boundary and nothing else touched. In the test it holds this attack to ${d1} infected devices against ${B.devices} without it, and ${p1} patients against ${B.patients}. It is the fastest plan to deploy, ${rules1} rules.`, {
      plan: { name: "Wall off imaging", devices: d1, patients: p1, cuts: cuts1, rules: rules1 },
    }),
    e(1, "coordinator", "inventory", "opens", "Forwarding the proposal to Inventory and Clinical Workflow for review."),
    e(1, "inventory", "coordinator", "approves", `I accept this: ${rules1} rules fits the switches, and every device the plan touches is one the inventory can name.`),
    e(1, "clinical_workflow", "coordinator", "declines", `I can't accept this: walling off imaging breaks 4 protected flows, the DICOM links from MRI 1, MRI 2, MRI 3 and CT 1 to PACS, so no scan reaches a radiologist. It also protects nothing outside imaging. I need those scan links kept and a plan that holds an attack from any start.`, { needs: "keep MRI 1 → PACS, MRI 2 → PACS, MRI 3 → PACS, CT 1 → PACS" }),
    e(2, "coordinator", "flow", "opens", "Round 2 open. Constraint learned: keep 4 scan links. Flow, revise for the whole hospital, not this one start."),
    e(2, "flow", "coordinator", "revises", `Revised: a wall around every department, with the 4 scan links to PACS kept. ${cuts2} connections cut, ${rules2} rules. Tested from every start, not only MRI 2: this attack is held to ${d2} devices and ${p2} patients, and an attack from any other desk now stays in its own department.`, {
      plan: { name: "Walls around every department", devices: d2, patients: p2, cuts: cuts2, rules: rules2 },
    }),
    e(2, "inventory", "coordinator", "declines", `I can't accept this: the plan needs ${rules2} allow rules and the switches carry at most 24 as ACLs. I need the rules folded to 24 or fewer.`, { needs: "at most 24 rules" }),
    e(2, "clinical_workflow", "coordinator", "declines", `I can't accept this: it breaks 4 protected flows, the HL7 vitals from the ER and ICU nurse stations to the EHR engine and the ADT feeds back to them. Nurses would lose live vitals and bed assignments. I need those four kept.`, { needs: "keep ER nurse station ↔ EHR engine, ICU nurse station ↔ EHR engine (HL7)" }),
    e(3, "coordinator", "flow", "opens", "Round 3 open. Two constraints learned: 24 rules or fewer, and the ER and ICU HL7 feeds kept. Flow, revise."),
    e(3, "flow", "coordinator", "revises", `Revised by function instead of by room: five networks, core servers, imaging and PACS, bedside monitoring, clinical workstations and business. I cut only file sharing and remote desktop between them, ${cuts3} connections, and keep every clinical feed: scans to PACS, vitals and ADT, lab results, common time. Rules folded department to department: ${rules3}. Tested from all 16 starts, this attack is held to ${d3} devices and ${p3} patients.`, {
      plan: { name: "Five networks by function", devices: d3, patients: p3, cuts: cuts3, rules: rules3 },
    }),
    e(3, "inventory", "coordinator", "approves", `I accept this: ${rules3} rules is under the 24 the switches carry, and every device it touches is in the inventory.`),
    e(3, "clinical_workflow", "coordinator", "approves", `I accept this: the plan breaks 0 protected flows, scans reach PACS, every monitor reaches the chart, lab results reach the chart, and no critical service is down for more than 2 steps. It leaves ${p3} patients with care delayed or disrupted against ${B.patients} without it.`),
    e(3, "coordinator", "humans", "recommends", `Both reviewing agents accept “Five networks by function”: ${d3} devices infected against ${B.devices} without it, ${p3} patients against ${B.patients}, ${cuts3} connections cut, 0 protected flows broken. Security, Clinical engineering and Operations must sign off. Agent agreement is not approval.`),
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
      case "revision": {
        name = m.name ?? name;
        if (m.type === "proposal") rules = m.rules?.length ?? rules;
        const ev = m.evidence;
        const avg = ev && ev.length
          ? { baseline: ev.reduce((a, e) => a + e.baseline, 0) / ev.length, plan: ev.reduce((a, e) => a + e.plan, 0) / ev.length, starts: ev.length }
          : undefined;
        out.push({ ...base, verb: m.type === "proposal" ? "proposes" : "revises", line: m.reason,
          plan: { name, devices: m.tested?.devicesCompromised ?? 0, patients: m.tested?.patientsAffected ?? 0, rules, avg } });
        break;
      }
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
