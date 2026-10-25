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

/** "Patients affected" as the run row carries it: everyone the engine's RunResult counts as not ok. */
const affected = (r: RunResult) => r.patientCounts.delayed + r.patientCounts.disrupted + r.patientCounts.diverted;

const tested = (r: RunResult) => ({ patientsAffected: affected(r), devicesCompromised: r.infectedCount });

const source = (s: string): TextSource | undefined => (s === "claude" || s === "asi1" || s === "template" ? s : undefined);

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
 * Coordinator relays. round_state rows drive the round header instead. ASI:One
 * chat rows show as messages between the ASI:One user and the Coordinator.
 */
export function messagesOf(rows: Iterable<AgentMessage>): AgentMessageRow[] {
  const out: AgentMessageRow[] = [];
  for (const m of [...rows].sort((a, b) => a.seq - b.seq)) {
    if (m.direction !== "sent" && m.fromAgent !== "humans") continue;
    const p = parse<Record<string, any>>(m.payloadJson) ?? {};
    if (m.type === "chat") {
      // The user's message is the received copy; the Coordinator's reply the sent one.
      out.push({
        round: m.round, seq: m.seq, from: m.fromAgent === "humans" ? "asi1" : (m.fromAgent as Speaker),
        to: m.toAgent === "humans" ? "asi1" : (m.toAgent as Speaker), type: "chat", reason: String(p.text ?? ""),
        card: !!p.card, fixture: m.fixture, createdAt: Number(m.createdAt.microsSinceUnixEpoch),
      });
      continue;
    }
    const base = {
      round: m.round, seq: m.seq, from: m.fromAgent as Speaker, policyId: p.policyId ?? undefined,
      to: (m.toAgent === "relay" ? "all" : m.toAgent) as AgentMessageRow["to"],
      reason: m.reason, source: source(m.reasonSource), fixture: m.fixture,
      createdAt: Number(m.createdAt.microsSinceUnixEpoch),
    };
    switch (m.type) {
      case "proposal_request":
        out.push({ ...base, type: "request", reason: p.revise ? `Revise ${p.revise}.` : "Propose a plan." });
        break;
      case "proposal":
        out.push({
          ...base, type: "proposal", rules: (p.rules as Rule[] | undefined)?.map((r) => r.plain), name: p.name ?? undefined,
          tested: p.testResult ? tested(p.testResult) : undefined,
        });
        break;
      case "revision":
        out.push({
          ...base, type: "revision",
          diff: [
            ...((p.diff?.added as Rule[] | undefined) ?? []).map((r) => `+ ${r.plain}`),
            ...((p.diff?.removed as string[] | undefined) ?? []).map((id) => `− rule ${id}`),
          ],
          name: p.name ?? undefined,
          tested: p.testResult ? tested(p.testResult) : undefined,
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
        out.push({ ...base, type: "recommendation", reason: m.reason || p.explanation, option: p.option ?? 1, name: p.policy?.name });
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

/** "s1:2" is option 1 of round 2; "s1:2:3" is option 3. */
const optionOf = (id: string) => Number(id.split(":")[2] ?? 1) || 1;

export function recommendationsOf(rows: Iterable<Recommendation>): RecommendationRow[] {
  return [...rows]
    .sort((a, b) => b.round - a.round || optionOf(a.id) - optionOf(b.id))
    .map((r) => {
      const policy = parse<{ rules?: Rule[]; rationale?: string; tradeoff?: string }>(r.policyJson) ?? {};
      const result = parse<RunResult>(r.verifiedJson);
      const verdicts = parse<{ agent: AgentId; decision: "accept" | "reject"; reason: string }[]>(r.verdictsJson) ?? [];
      return {
        id: r.id, round: r.round, option: optionOf(r.id), name: r.name, rules: (policy.rules ?? []).map((x) => x.plain),
        rationale: policy.rationale, tradeoff: policy.tradeoff,
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

/**
 * For a session with no session row (a round started from ASI:One chat): the round
 * state from the newest relayed round_state row, which the Coordinator sends for
 * every session alike.
 */
export function roundStateFromMessages(rows: Iterable<AgentMessage>): RoundState {
  let last: { state?: string; round?: number; detail?: string | null } | undefined;
  let seq = -1;
  for (const m of rows) {
    if (m.type !== "round_state" || m.direction !== "sent" || m.seq < seq) continue;
    seq = m.seq;
    last = parse(m.payloadJson);
  }
  const state = (["idle", "running", "waiting_for_human", "done"] as const).find((x) => x === last?.state) ?? "idle";
  return { state, round: last?.round ?? 0, maxRounds: MAX_ROUNDS, detail: last?.detail || undefined };
}

/** Likewise, the newest round's recommendations from their relayed messages (the payloads recommendation_upsert would store), option 1 first. */
export function recommendationsFromMessages(rows: Iterable<AgentMessage>): RecommendationRow[] {
  const sent = [...rows].filter((r) => r.type === "recommendation" && r.direction === "sent");
  const round = Math.max(...sent.map((m) => m.round), -1);
  const out: RecommendationRow[] = [];
  for (const m of sent.filter((r) => r.round === round)) {
    const p = parse<{ policy?: { name?: string; rules?: Rule[]; rationale?: string; tradeoff?: string }; testResult?: RunResult; verdicts?: { agent: AgentId; decision: "accept" | "reject"; reason: string }[];
      explanation?: string; explanationSource?: string; requiredRoles?: ReviewRole[]; option?: number }>(m.payloadJson);
    if (!p) continue;
    const r = p.testResult;
    const option = p.option ?? 1;
    out.push({
      id: option === 1 ? `${m.sessionId}:${m.round}` : `${m.sessionId}:${m.round}:${option}`, round: m.round, option,
      name: p.policy?.name ?? "", rules: (p.policy?.rules ?? []).map((x) => x.plain),
      rationale: p.policy?.rationale, tradeoff: p.policy?.tradeoff,
      explanation: p.explanation ?? "", source: source(p.explanationSource ?? ""),
      verified: {
        patientsAffected: r ? affected(r) : 0, devicesCompromised: r?.infectedCount ?? 0,
        protectedBroken: r?.protectedBroken ?? [], removedFlows: r?.removedFlows ?? [],
      },
      verdicts: (p.verdicts ?? []).map((v) => ({ agent: v.agent, decision: v.decision, reason: v.reason })),
      requiredRoles: p.requiredRoles ?? [], status: "draft", fixture: m.fixture,
    });
  }
  return out.sort((a, b) => a.option - b.option);
}
