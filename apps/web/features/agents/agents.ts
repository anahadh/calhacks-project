import type { AgentId, MessageType, Speaker } from "@/lib/stdb/types";

export const AGENTS: { id: AgentId; name: string; objective: string }[] = [
  { id: "inventory", name: "Inventory", objective: "Never act on a device nobody can name. Asks a human when unsure." },
  { id: "flow", name: "Flow", objective: "Minimize spread. Proposes cuts and tests each one with the engine." },
  { id: "clinical_workflow", name: "Clinical Workflow", objective: "Keep care running. Rejects anything that breaks a protected flow." },
  { id: "coordinator", name: "Sign-off Coordinator", objective: "Runs rounds and routes the plan to the right humans. Cannot approve." },
];

export const SPEAKER_NAME: Record<Speaker | "all", string> = {
  inventory: "Inventory",
  flow: "Flow",
  clinical_workflow: "Clinical Workflow",
  coordinator: "Coordinator",
  humans: "Humans",
  all: "all",
};

// Message type never depends on color alone (UX rule 3).
export const MESSAGE_SHAPE: Record<MessageType, { glyph: string; label: string }> = {
  request: { glyph: "▷", label: "Request" },
  proposal: { glyph: "◆", label: "Proposal" },
  accept: { glyph: "●", label: "Accept" },
  reject: { glyph: "✕", label: "Reject" },
  revision: { glyph: "↻", label: "Revision" },
  question: { glyph: "?", label: "Question" },
  answer: { glyph: "→", label: "Answer" },
  recommendation: { glyph: "■", label: "Recommendation" },
};
