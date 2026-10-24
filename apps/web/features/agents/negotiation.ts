// The negotiation table and the constraint rail, reshaped from agent_message
// rows. One column per round's plan (a proposal or a revision), one row per
// reviewing agent. Nothing here decides: every stamp is a verdict row the
// agents relayed (AGENTS.md rules 8, 16).

import type { AgentId, AgentMessageRow } from "@/lib/stdb/types";

export type Stamp = {
  decision: "accept" | "reject" | "question";
  reason: string;
  /** The constraint a rejection added, already in words. */
  needs?: string;
  seq: number;
};

export type PlanColumn = {
  round: number;
  policyId?: string;
  kind: "proposal" | "revision" | "alternative";
  /** The plan's name, carried forward from the proposal when a revision keeps it. */
  name: string;
  /** "3 rules" or "2 changes". */
  size: string;
  patientsAffected?: number;
  devicesCompromised?: number;
  verdicts: Partial<Record<AgentId, Stamp>>;
  seq: number;
};

export type ConstraintChip = {
  agent: AgentId;
  round: number;
  label: string;
  /** The first later round whose plan the same agent accepted. */
  metIn?: number;
  seq: number;
};

/** The two agents that review every plan, top to bottom in the table. */
export const REVIEWERS = ["inventory", "clinical_workflow"] as const;

export type Names = { device: Map<string, { name: string }>; flow: Map<string, { from: string; to: string; purpose?: string }>; service?: Map<string, { name: string }> };

export function needsLabel(c: NonNullable<AgentMessageRow["constraint"]>, names: Names): string {
  const device = (id: string) => names.device.get(id)?.name ?? id;
  switch (c.kind) {
    case "keep_flow":
      return `Keep ${c.targetIds
        .map((id) => {
          const f = names.flow.get(id);
          return f ? `${device(f.from)} → ${device(f.to)}` : id;
        })
        .join(", ")}`;
    case "keep_service":
      return `Keep up ${c.targetIds.map((id) => names.service?.get(id)?.name ?? id).join(", ")}`;
    case "confirm_device":
      return `A human names ${c.targetIds.map(device).join(", ")}`;
    case "max_rules":
      return "Fewer rules";
  }
}

export function negotiationOf(messages: readonly AgentMessageRow[], names: Names): { plans: PlanColumn[]; constraints: ConstraintChip[] } {
  const plans: PlanColumn[] = [];
  const constraints: ConstraintChip[] = [];
  const byRound = new Map<number, PlanColumn>(); // the lead plan of each round
  const byPolicy = new Map<string, PlanColumn>(); // `${round}:${policyId}`, lead and alternatives
  let name = "";
  for (const m of messages) {
    // The Flow Agent's own copy; the Coordinator forwards the same plan to each reviewer.
    if ((m.type === "proposal" || m.type === "revision") && m.from === "flow") {
      name = m.name ?? (m.type === "proposal" ? `Plan ${m.round}` : name);
      const size = m.type === "proposal" ? `${m.rules?.length ?? 0} rules` : `${m.diff?.length ?? 0} changes`;
      const col: PlanColumn = {
        round: m.round, kind: m.type, name, size, verdicts: {}, seq: m.seq,
        patientsAffected: m.tested?.patientsAffected, devicesCompromised: m.tested?.devicesCompromised,
      };
      col.policyId = m.policyId;
      plans.push(col);
      byRound.set(m.round, col);
      if (m.policyId) byPolicy.set(`${m.round}:${m.policyId}`, col);
    } else if (m.type === "proposal" && m.from === "coordinator" && m.policyId && byRound.has(m.round)
        && byRound.get(m.round)!.policyId !== m.policyId && !byPolicy.has(`${m.round}:${m.policyId}`)) {
      // The orchestrator puts one of Flow's alternatives on the table once the lead plan is accepted.
      const col: PlanColumn = {
        round: m.round, policyId: m.policyId, kind: "alternative", name: m.name ?? m.policyId,
        size: `${m.rules?.length ?? 0} rules`, verdicts: {}, seq: m.seq,
        patientsAffected: m.tested?.patientsAffected, devicesCompromised: m.tested?.devicesCompromised,
      };
      plans.push(col);
      byPolicy.set(`${m.round}:${m.policyId}`, col);
    } else if ((m.type === "accept" || m.type === "reject") && (m.from === "inventory" || m.from === "clinical_workflow")) {
      const col = (m.policyId && byPolicy.get(`${m.round}:${m.policyId}`)) || byRound.get(m.round);
      const needs = m.type === "reject" && m.constraint ? needsLabel(m.constraint, names) : undefined;
      if (col) col.verdicts[m.from] = { decision: m.type, reason: m.reason, needs, seq: m.seq };
      if (needs) constraints.push({ agent: m.from, round: m.round, label: needs, seq: m.seq });
      if (m.type === "accept") {
        for (const c of constraints) if (c.agent === m.from && c.round < m.round && c.metIn === undefined) c.metIn = m.round;
      }
    } else if (m.type === "question" && m.from === "inventory") {
      const col = byRound.get(m.round);
      if (col && !col.verdicts.inventory) col.verdicts.inventory = { decision: "question", reason: m.reason, seq: m.seq };
    }
  }
  return { plans, constraints };
}
