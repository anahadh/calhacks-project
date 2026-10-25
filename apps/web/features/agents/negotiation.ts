// The negotiation table and the constraint rail, reshaped from agent_message
// rows. One column per round's plan (a proposal or a revision), one row per
// reviewing agent. Nothing here decides: every stamp is a verdict row the
// agents relayed (AGENTS.md rules 8, 16).

import type { AgentId, AgentMessageRow, RoomAgent } from "@/lib/stdb/types";

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
  /** The rules (a proposal) or the diff lines (a revision), in the agents' plain words. */
  lines: string[];
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
        lines: (m.type === "proposal" ? m.rules : m.diff) ?? [],
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
        size: `${m.rules?.length ?? 0} rules`, lines: m.rules ?? [], verdicts: {}, seq: m.seq,
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

// --- The agents as lanes: what each did this round, as counts, from the same rows ---

export type Lane = {
  agent: RoomAgent;
  /** agent_status row, or idle when there is none. */
  status: "idle" | "thinking" | "speaking" | "waiting";
  /** Badges, in order: what the agent did, counted from its messages. */
  badges: { label: string; tone: "info" | "ok" | "warn" }[];
};

/**
 * One lane per agent. The Coordinator counts rounds and messages routed; Flow
 * counts plans tested and revisions; each reviewer counts accepts, rejects and
 * questions. A thinking or speaking agent gets a live badge. Nothing is inferred
 * beyond counting rows. The Scorekeeper (SCOREKEEPER=1) gets a fifth lane only once
 * it has a row (a message or a status), so without it the room shows the four.
 */
export function lanesOf(
  messages: readonly AgentMessageRow[],
  agentStatus: readonly { agent: RoomAgent; status: Lane["status"] }[],
  round: { state: string; round: number },
): Lane[] {
  const status = new Map(agentStatus.map((s) => [s.agent, s.status]));
  const live = round.state === "running" || round.state === "waiting_for_human";
  const liveBadge = (agent: RoomAgent): Lane["badges"] => {
    const s = status.get(agent);
    if (s === "thinking") return [{ label: "thinking", tone: "ok" }];
    if (s === "speaking") return [{ label: "speaking", tone: "ok" }];
    if (s === "waiting" && live) return [{ label: "waiting for a human", tone: "warn" }];
    return [];
  };
  const agentRows = messages.filter((m) => m.type !== "chat");
  const routed = agentRows.filter((m) => m.from === "coordinator").length;
  const plans = agentRows.filter((m) => (m.type === "proposal" || m.type === "revision") && m.from === "flow").length;
  const revisions = agentRows.filter((m) => m.type === "revision" && m.from === "flow").length;
  const published = agentRows.filter((m) => m.type === "recommendation").length;
  const lanes: Lane[] = [
    {
      agent: "coordinator",
      status: status.get("coordinator") ?? "idle",
      badges: [
        ...(round.round ? [{ label: `round ${round.round}`, tone: "info" as const }] : []),
        ...(routed ? [{ label: `${routed} ${routed === 1 ? "message" : "messages"} routed`, tone: "info" as const }] : []),
        ...(published ? [{ label: `${published} ${published === 1 ? "option" : "options"} published`, tone: "ok" as const }] : []),
        ...liveBadge("coordinator"),
      ],
    },
    {
      agent: "flow",
      status: status.get("flow") ?? "idle",
      badges: [
        ...(plans ? [{ label: `${plans} ${plans === 1 ? "plan" : "plans"} tested`, tone: "info" as const }] : []),
        ...(revisions ? [{ label: `revised ${revisions}×`, tone: "info" as const }] : []),
        ...liveBadge("flow"),
      ],
    },
  ];
  for (const agent of REVIEWERS) {
    const mine = agentRows.filter((m) => m.from === agent);
    const ok = mine.filter((m) => m.type === "accept").length;
    const no = mine.filter((m) => m.type === "reject").length;
    const asked = mine.filter((m) => m.type === "question").length;
    lanes.push({
      agent,
      status: status.get(agent) ?? "idle",
      badges: [
        ...(ok ? [{ label: `● accepted ${ok}`, tone: "ok" as const }] : []),
        ...(no ? [{ label: `✕ rejected ${no}`, tone: "warn" as const }] : []),
        ...(asked ? [{ label: `? asked a human${asked > 1 ? ` ${asked}×` : ""}`, tone: "warn" as const }] : []),
        ...liveBadge(agent),
      ],
    });
  }
  if (hasScorekeeper(messages, agentStatus)) {
    const cards = agentRows.filter((m) => m.type === "scorecard").length;
    lanes.push({
      agent: "scorekeeper",
      status: status.get("scorekeeper") ?? "idle",
      badges: [
        ...(cards ? [{ label: `≡ ranked ${cards}×`, tone: "info" as const }] : []),
        { label: "does not vote", tone: "info" as const },
        ...liveBadge("scorekeeper"),
      ],
    });
  }
  return lanes;
}

/** True once the Scorekeeper has any row: a message to or from it, or a status. */
export function hasScorekeeper(messages: readonly AgentMessageRow[], agentStatus: readonly { agent: RoomAgent }[] = []): boolean {
  return messages.some((m) => m.from === "scorekeeper" || m.to === "scorekeeper") || agentStatus.some((s) => s.agent === "scorekeeper");
}

/** The newest Scorecard among the rows, or undefined. */
export function latestScorecard(messages: readonly AgentMessageRow[]): AgentMessageRow | undefined {
  for (let i = messages.length - 1; i >= 0; i--) if (messages[i].type === "scorecard") return messages[i];
  return undefined;
}

/** What the Coordinator did with each plan: routed it to the reviewers, and later published it as an option. */
export function coordinatorStamp(messages: readonly AgentMessageRow[], plan: PlanColumn): { routed: number; option?: number } {
  const routed = messages.filter(
    (m) => m.from === "coordinator" && (m.type === "proposal" || m.type === "revision") && m.round === plan.round
      && (plan.policyId ? m.policyId === plan.policyId || !m.policyId : true),
  ).length;
  const rec = messages.find((m) => m.type === "recommendation" && m.round === plan.round && m.name === plan.name);
  return { routed, option: rec?.option ?? (rec ? 1 : undefined) };
}
