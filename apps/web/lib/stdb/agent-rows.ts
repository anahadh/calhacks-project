// Turns the agent tables (agent_message, agent_status, question,
// recommendation) into the shapes the Agent Room renders. Reshaping only:
// verdicts, numbers and roles are read from the payloads the agents relayed
// (AGENTS.md rules 3, 8, 10).

import type {
  AgentMessage, AgentStatus, Question, Recommendation, Session,
} from "./module_bindings/types";
import type {
  AgentId, AgentMessageRow, AgentStatusRow, QuestionRow, RecommendationRow, ReviewRole, RoundState, Speaker, TextSource,
} from "./types";

const MAX_ROUNDS = 4; // agents/logic/coordinator.py MAX_ROUNDS
const AGENTS = new Set<string>(["inventory", "flow", "clinical_workflow", "coordinator"]);

type Counts = { ok: number; delayed: number; disrupted: number; diverted: number };
type RunResult = { infectedCount: number; patientCounts: Counts; protectedBroken: string[]; removedFlows: string[] };
type Rule = { id: string; plain: string };

/** The same "patients affected" sim-core reports: everyone not ok. */
const affected = (r: RunResult) => r.patientCounts.delayed + r.patientCounts.disrupted + r.patientCounts.diverted;

const source = (s: string): TextSource | undefined => (s === "claude" || s === "template" ? s : undefined);

function parse<T>(json: string): T | undefined {
  try {
    return JSON.parse(json) as T;
  } catch {
    return undefined;
  }
}

export function roundStateOf(s: Session | undefined): RoundState {
  const state = (["idle", "running", "waiting_for_human", "done"] as const).find((x) => x === s?.roundState) ?? "idle";
  return { state, round: s?.round ?? 0, maxRounds: MAX_ROUNDS, detail: s?.roundDetail || undefined };
}

/**
 * One bubble per message. Both ends relay each message (rule 10), so the
 * thread shows the sender's copy, plus the humans' answers, which only the
 * Coordinator relays. round_state rows drive the round header instead, and
 * chat rows belong to ASI:One.
 */
export function messagesOf(rows: Iterable<AgentMessage>): AgentMessageRow[] {
  const out: AgentMessageRow[] = [];
  for (const m of [...rows].sort((a, b) => a.seq - b.seq)) {
    if (m.direction !== "sent" && m.fromAgent !== "humans") continue;
    const p = parse<Record<string, any>>(m.payloadJson) ?? {};
    const base = {
      round: m.round, seq: m.seq, from: m.fromAgent as Speaker,
      to: (m.toAgent === "relay" ? "all" : m.toAgent) as AgentMessageRow["to"],
      reason: m.reason, source: source(m.reasonSource), fixture: m.fixture,
    };
    switch (m.type) {
      case "proposal_request":
        out.push({ ...base, type: "request", reason: p.revise ? `Revise ${p.revise}.` : "Propose a plan." });
        break;
      case "proposal":
        out.push({
          ...base, type: "proposal", rules: (p.rules as Rule[] | undefined)?.map((r) => r.plain),
          tested: p.testResult ? { patientsAffected: affected(p.testResult) } : undefined,
        });
        break;
      case "revision":
        out.push({
          ...base, type: "revision",
          diff: [
            ...((p.diff?.added as Rule[] | undefined) ?? []).map((r) => `+ ${r.plain}`),
            ...((p.diff?.removed as string[] | undefined) ?? []).map((id) => `− rule ${id}`),
          ],
          tested: p.testResult ? { patientsAffected: affected(p.testResult) } : undefined,
        });
        break;
      case "verdict":
        out.push({ ...base, type: p.decision === "reject" ? "reject" : "accept", constraint: p.constraint ?? undefined });
        break;
      case "question":
        out.push({ ...base, type: "question", reason: m.reason || p.text, source: source(m.reasonSource) ?? source(p.textSource ?? "") });
        break;
      case "answer":
        out.push({ ...base, type: "answer", reason: `${p.author} (${p.role}): ${p.choice}` });
        break;
      case "recommendation":
        out.push({ ...base, type: "recommendation", reason: m.reason || p.explanation });
        break;
    }
  }
  return out;
}

export function statusOf(rows: Iterable<AgentStatus>): AgentStatusRow[] {
  return [...rows]
    .filter((s) => AGENTS.has(s.agent))
    .map((s) => ({ agent: s.agent as AgentId, status: s.status as AgentStatusRow["status"] }));
}

export function questionsOf(rows: Iterable<Question>): QuestionRow[] {
  return [...rows]
    .sort((a, b) => (a.createdAt.microsSinceUnixEpoch < b.createdAt.microsSinceUnixEpoch ? -1 : 1))
    .map((q) => ({
      questionId: q.questionId, round: q.round, agent: q.agent as AgentId, targetId: q.targetId, text: q.text,
      source: source(q.textSource), choices: parse<string[]>(q.choicesJson) ?? [],
      allowedRoles: parse<ReviewRole[]>(q.allowedRolesJson) ?? [],
      answer: q.answered ? { choice: q.answerChoice, author: q.answerAuthor, role: q.answerRole as ReviewRole } : undefined,
    }));
}

export function recommendationsOf(rows: Iterable<Recommendation>): RecommendationRow[] {
  return [...rows]
    .sort((a, b) => b.round - a.round)
    .map((r) => {
      const policy = parse<{ rules?: Rule[] }>(r.policyJson) ?? {};
      const result = parse<RunResult>(r.verifiedJson);
      const verdicts = parse<{ agent: AgentId; decision: "accept" | "reject"; reason: string }[]>(r.verdictsJson) ?? [];
      return {
        id: r.id, round: r.round, name: r.name, rules: (policy.rules ?? []).map((x) => x.plain),
        explanation: r.explanation, source: source(r.explanationSource),
        verified: {
          patientsAffected: result ? affected(result) : 0, devicesCompromised: result?.infectedCount ?? 0,
          protectedBroken: result?.protectedBroken ?? [], removedFlows: result?.removedFlows ?? [],
        },
        verdicts: verdicts.map((v) => ({ agent: v.agent, decision: v.decision, reason: v.reason })),
        requiredRoles: parse<ReviewRole[]>(r.requiredRolesJson) ?? [],
        status: r.status === "ready" ? "ready" : "draft",
        fixture: r.fixture,
      };
    });
}
