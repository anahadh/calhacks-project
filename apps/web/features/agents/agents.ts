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
  asi1: "ASI:One",
  all: "all",
};

/** Full names, as the Agent Room transcript and the "now talking" pill print them. */
export const SPEAKER_LABEL: Record<Speaker | "all", string> = {
  inventory: "Inventory Agent",
  flow: "Flow Agent",
  clinical_workflow: "Clinical Workflow Agent",
  coordinator: "Sign-off Coordinator",
  humans: "Humans",
  asi1: "ASI:One user",
  all: "everyone",
};

/**
 * Each speaker's hue in the Agent Room: the ring on its node, its name in the
 * transcript and the highlighted line while it talks. Humans stay ink.
 */
export const SPEAKER_COLOR: Record<Speaker | "all", string> = {
  coordinator: "#3DD68C",
  flow: "#4DB0FF",
  inventory: "#F2C14E",
  clinical_workflow: "#FF5C5C",
  humans: "#E9ECEE",
  asi1: "#B79CFF",
  all: "#A1A8AE",
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
  chat: { glyph: "✦", label: "ASI:One chat" },
};
