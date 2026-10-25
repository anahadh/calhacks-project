import { describe, expect, it } from "vitest";
import { messagesOf, statusOf } from "@/lib/stdb/agent-rows";
import { message, SESSION } from "@/lib/stdb/fixtures/rows";
import type { AgentMessageRow } from "@/lib/stdb/types";
import { MESSAGE_SHAPE, SCOREKEEPER_LABEL, SPEAKER_LABEL } from "./agents";
import { hasScorekeeper, lanesOf, latestScorecard } from "./negotiation";
import { entryOf } from "./transcript";

// The Scorekeeper (SCOREKEEPER=1): its Scorecard rows render as a ranked table; without
// any of its rows the room is exactly the four agents it was.

const ROW = {
  rank: 1, policyId: "p_alt", name: "Keep scans", round: 1, devicesInfected: 4, servicesDownTooLong: 0, patientsAffected: 3,
  ruleCount: 2, inventory: "accept", clinicalWorkflow: "accept", broken: [],
};
const REJECTED = {
  ...ROW, rank: 2, policyId: "p_lead", name: "Wall imaging", patientsAffected: 5, clinicalWorkflow: "reject",
  broken: [{ agent: "clinical_workflow", kind: "keep_flow", targetIds: ["fl_1"], targetNames: ["MRI 1 → PACS"] }],
};
const CARD = {
  sessionId: SESSION, round: 1, rankedBy: ["accepted by both guardians"], rows: [ROW, REJECTED],
  why: "Keep scans leads: accepted by both, 3 patients affected vs 5 for Wall imaging.", whySource: "template",
};

const rows = [
  message({ seq: 1, type: "verdict", fromAgent: "clinical_workflow", payloadJson: JSON.stringify({ decision: "accept" }) }),
  message({ seq: 2, type: "score_input", fromAgent: "coordinator", toAgent: "scorekeeper", payloadJson: JSON.stringify({ candidates: [] }) }),
  message({ seq: 2, type: "score_input", fromAgent: "coordinator", toAgent: "scorekeeper", direction: "received", payloadJson: "{}" }),
  message({ seq: 3, type: "scorecard", fromAgent: "scorekeeper", toAgent: "coordinator", reason: CARD.why, payloadJson: JSON.stringify(CARD) }),
  message({ seq: 3, type: "scorecard", fromAgent: "scorekeeper", toAgent: "coordinator", direction: "received", reason: CARD.why, payloadJson: JSON.stringify(CARD) }),
];

describe("Scorekeeper rows", () => {
  const messages = messagesOf(rows);

  it("shows the sent Scorecard with its ranked rows, and not the Coordinator's copies", () => {
    expect(messages.map((m) => [m.seq, m.type, m.from])).toEqual([[1, "accept", "clinical_workflow"], [3, "scorecard", "scorekeeper"]]);
    const card = latestScorecard(messages)!;
    expect(card).toMatchObject({ to: "coordinator", reason: CARD.why, source: "template" });
    expect(card.scorecard?.map((r) => [r.rank, r.name, r.patientsAffected])).toEqual([[1, "Keep scans", 3], [2, "Wall imaging", 5]]);
    expect(card.scorecard?.[1].broken[0].targetNames).toEqual(["MRI 1 → PACS"]);
  });

  it("keeps the Scorekeeper's status row", () => {
    const status = statusOf([{ id: `${SESSION}:scorekeeper`, sessionId: SESSION, agent: "scorekeeper", status: "thinking", updatedAt: rows[0].createdAt }]);
    expect(status).toEqual([{ agent: "scorekeeper", status: "thinking" }]);
  });

  it("says it explains and does not vote, with a shape, not color alone", () => {
    expect(SCOREKEEPER_LABEL).toBe("Scorekeeper: explains the ranking, does not vote.");
    expect(SPEAKER_LABEL.scorekeeper).toBe("Scorekeeper");
    expect(MESSAGE_SHAPE.scorecard.glyph).toBe("≡");
    const entry = entryOf(latestScorecard(messages)!, { device: new Map() });
    expect(entry).toMatchObject({ subject: "Scorecard · 2 plans ranked · does not vote", quote: CARD.why, template: true });
    expect(entry.detail).toBe("1. Keep scans (round 1): 3 patients affected, 4 devices infected · 2. Wall imaging (round 1): 5 patients affected, 4 devices infected");
  });
});

describe("lanes with and without the Scorekeeper", () => {
  const four: AgentMessageRow[] = [{ round: 1, seq: 1, from: "flow", to: "coordinator", type: "proposal", reason: "" }];

  it("shows exactly the four agents when the Scorekeeper has no rows", () => {
    expect(hasScorekeeper(four, [{ agent: "flow" }])).toBe(false);
    expect(lanesOf(four, [], { state: "running", round: 1 }).map((l) => l.agent)).toEqual(["coordinator", "flow", "inventory", "clinical_workflow"]);
  });

  it("adds a fifth lane, last, once it has a message or a status", () => {
    const withCard = [...four, ...messagesOf(rows)];
    const lanes = lanesOf(withCard, [], { state: "running", round: 1 });
    expect(lanes.map((l) => l.agent)).toEqual(["coordinator", "flow", "inventory", "clinical_workflow", "scorekeeper"]);
    expect(lanes[4].badges.map((b) => b.label)).toEqual(["≡ ranked 1×", "does not vote"]);
    const byStatus = lanesOf(four, [{ agent: "scorekeeper", status: "thinking" }], { state: "running", round: 1 });
    expect(byStatus[4]).toMatchObject({ agent: "scorekeeper", status: "thinking" });
    expect(byStatus[4].badges.map((b) => b.label)).toEqual(["does not vote", "thinking"]);
  });
});
