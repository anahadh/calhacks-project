import { describe, expect, it } from "vitest";
import { messagesOf, questionsOf, recommendationsOf, roundStateOf, statusOf } from "./agent-rows";
import { AGENT_MESSAGE, AGENT_STATUS, QUESTION, RECOMMENDATION, SESSION, session } from "./fixtures/rows";

const ofSession = <T extends { sessionId: string }>(rows: T[]) => rows.filter((r) => r.sessionId === SESSION);

describe("messagesOf", () => {
  const messages = messagesOf(ofSession(AGENT_MESSAGE));

  it("shows the sender's copy of each message, plus the humans' answers, in seq order", () => {
    expect(messages.map((m) => [m.seq, m.type])).toEqual([
      [1, "request"], [2, "proposal"], [3, "reject"], [5, "answer"], [6, "revision"], [7, "recommendation"],
    ]);
  });

  it("reads rules, test results, constraints and diffs from the relayed payloads", () => {
    const [request, proposal, reject, answer, revision, recommendation] = messages;
    expect(request).toMatchObject({ from: "coordinator", to: "flow", reason: "Propose a plan." });
    expect(proposal).toMatchObject({
      from: "flow", to: "coordinator", rules: ["No SMB out of Imaging."], tested: { patientsAffected: 3 }, source: "claude",
      fixture: false,
    });
    expect(reject).toMatchObject({ from: "clinical_workflow", constraint: { kind: "keep_flow", targetIds: ["fl_2"] } });
    expect(answer).toMatchObject({ from: "humans", reason: "Kai (operations): workstation" });
    expect(revision.diff).toEqual(["+ Scanners may reach PACS on DICOM.", "− rule r1"]);
    expect(recommendation).toMatchObject({ to: "all", reason: "Both guardians accept." });
  });
});

describe("recommendationsOf", () => {
  const recs = recommendationsOf(ofSession(RECOMMENDATION));

  it("reads verified numbers from the engine's RunResult, newest round first", () => {
    expect(recs.map((r) => r.id)).toEqual(["s1:2", "s1:1"]);
    expect(recs[0]).toMatchObject({
      name: "Keep scans", rules: ["Scanners may reach PACS on DICOM."], source: "claude", status: "draft",
      verified: { patientsAffected: 3, devicesCompromised: 1, protectedBroken: [], removedFlows: ["fl_1"] },
      verdicts: [{ agent: "clinical_workflow", decision: "accept", reason: "Scans still reach PACS." }],
      requiredRoles: ["security", "clinical_engineering"],
    });
  });

  it("never marks a plan ready on its own, and survives a broken result", () => {
    expect(recs[1]).toMatchObject({
      status: "draft", verified: { patientsAffected: 0, devicesCompromised: 0, protectedBroken: [], removedFlows: [] },
    });
  });
});

describe("questionsOf", () => {
  it("orders questions by creation and maps answers", () => {
    const qs = questionsOf(ofSession(QUESTION));
    expect(qs.map((q) => q.questionId)).toEqual(["q1", "q2"]);
    expect(qs[0]).toMatchObject({ choices: [], answer: { choice: "yes", author: "Ana", role: "security" }, source: "template" });
    expect(qs[1]).toMatchObject({ choices: ["yes", "no"], allowedRoles: ["clinical_engineering"], answer: undefined });
  });
});

describe("roundStateOf and statusOf", () => {
  it("reads the round from the session row", () => {
    expect(roundStateOf(session())).toEqual({ state: "done", round: 2, maxRounds: 4, detail: undefined });
    expect(roundStateOf(session({ roundState: "weird", roundDetail: "Coordinator unreachable" }))).toEqual({
      state: "idle", round: 2, maxRounds: 4, detail: "Coordinator unreachable",
    });
    expect(roundStateOf(undefined)).toEqual({ state: "idle", round: 0, maxRounds: 4, detail: undefined });
  });

  it("keeps only the four uAgents' statuses", () => {
    expect(statusOf(AGENT_STATUS)).toEqual([{ agent: "flow", status: "idle" }]);
  });
});
