// What the Agent Room prints for each agent_message row, the status sentence
// under the graph, and the round clock. Pure reshaping of rows: nothing here
// invents a message, a verdict or a number (AGENTS.md rules 8, 9, 16).

import { ROLE_LABEL } from "@/lib/format";
import type { SessionIndex } from "@/lib/stdb/use-session";
import type { AgentMessageRow, RecommendationRow, RoundState, Speaker } from "@/lib/stdb/types";
import { MESSAGE_SHAPE } from "./agents";

/** A message row; `createdAt` is microseconds since the epoch when the snapshot passes it through. */
export type TimedMessage = AgentMessageRow;

/** created_at in milliseconds, or undefined when the row doesn't carry it. */
export function createdMs(m: TimedMessage): number | undefined {
  return m.createdAt === undefined ? undefined : m.createdAt / 1000;
}

/** "00:08.8": minutes, seconds and tenths since the round started. Negative or unknown reads 00:00.0. */
export function elapsedLabel(ms: number | undefined): string {
  const t = Math.max(0, ms ?? 0);
  const minutes = Math.floor(t / 60_000);
  const seconds = (t % 60_000) / 1000;
  return `${String(minutes).padStart(2, "0")}:${seconds.toFixed(1).padStart(4, "0")}`;
}

export type Entry = {
  /** Mono, ink: what this message is. */
  subject: string;
  /** Mono, muted: the constraint, rules or test numbers it carries. */
  detail?: string;
  /** Proportional, ink, in quotes: the agent's own sentence. */
  quote?: string;
  /** The reason came from a template, not a model (rule 14). */
  template: boolean;
  /** The reason was written by ASI:One's model (asi1-mini). */
  asi1?: boolean;
};

const joinDetail = (parts: (string | undefined)[]) => parts.filter(Boolean).join(" · ") || undefined;

/** One transcript entry per row. Requests carry template text, so it is the subject, not a quote. */
export function entryOf(m: AgentMessageRow, index: { device: Map<string, { name: string }> }): Entry {
  const shape = MESSAGE_SHAPE[m.type];
  const name = (id: string) => index.device.get(id)?.name ?? id;
  const tested = m.tested ? `test run: ${m.tested.patientsAffected} patients affected` : undefined;
  const template = m.source === "template";
  const asi1 = m.source === "asi1";

  switch (m.type) {
    case "request":
      return { subject: `Round ${m.round} · ${m.reason}`, template };
    case "proposal":
      return {
        subject: m.rules?.length ? `Proposal · ${m.rules.length} rules` : shape.label,
        detail: joinDetail([...(m.rules ?? []).map((r) => `+ ${r}`), tested]),
        quote: m.reason,
        template,
        asi1,
      };
    case "revision":
      return {
        subject: m.diff?.length ? `Revision · ${m.diff.length} changes` : shape.label,
        detail: joinDetail([...(m.diff ?? []), tested]),
        quote: m.reason,
        template,
        asi1,
      };
    case "reject":
      return {
        subject: "Rejects",
        detail: m.constraint ? `Constraint: ${m.constraint.kind} · ${m.constraint.targetIds.map(name).join(" → ")}` : undefined,
        quote: m.reason,
        template,
        asi1,
      };
    case "accept":
      return { subject: "Accepts", quote: m.reason, template, asi1 };
    case "question":
      return { subject: "Question for a human", quote: m.reason, template, asi1 };
    case "answer":
      return { subject: "Answer", detail: m.reason, template: false };
    case "recommendation":
      return { subject: "Recommendation, for human review", quote: m.reason, template, asi1 };
    case "chat":
      return { subject: m.from === "asi1" ? "Asked on ASI:One" : m.card ? "Reply on ASI:One · card" : "Reply on ASI:One", quote: m.reason, template: false };
  }
}

/** The edge the newest message lights up: from → to, or every edge for a broadcast. */
export function talking(m: AgentMessageRow | undefined): { from: Speaker; to: Speaker | "all" } | undefined {
  return m ? { from: m.from, to: m.to } : undefined;
}

/** "Security and Clinical engineering" */
const roles = (r: readonly (keyof typeof ROLE_LABEL)[]) => {
  const labels = r.map((x) => ROLE_LABEL[x]);
  if (labels.length <= 1) return labels.join("");
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
};

/**
 * The sentence under the graph. Verdicts and roles are read from the newest
 * recommendation row; agent acceptance is never called approval (UX rule 8).
 */
export function statusLine(round: RoundState, recommendations: readonly RecommendationRow[], hasMessages: boolean): string {
  const rec = recommendations[0];
  switch (round.state) {
    case "waiting_for_human":
      return "An agent asked a question. Waiting for a human to answer.";
    case "running":
      return round.detail ?? "Agents are negotiating…";
    case "idle":
      return hasMessages ? "The agents are idle." : "The agents are idle. Create a segmentation plan to start a round.";
    case "done": {
      if (!rec) return round.detail ?? "The round ended without a recommendation.";
      const options = recommendations.filter((r) => r.round === rec.round).length;
      if (options > 1 && rec.status !== "ready") {
        return `Both reviewing agents accepted ${options} options. Humans choose one; ${roles(rec.requiredRoles)} must sign off.`;
      }
      const accepted = rec.verdicts.filter((v) => v.decision === "accept").length;
      const total = rec.verdicts.length;
      const who = accepted === total && total === 2 ? "Both reviewing agents accepted." : `${accepted} of ${total} reviewing agents accepted.`;
      if (rec.status === "ready") return `${who} ${roles(rec.requiredRoles)} reviewed it.`;
      return rec.requiredRoles.length ? `${who} ${roles(rec.requiredRoles)} still have to sign off.` : who;
    }
  }
}
