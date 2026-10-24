import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createRelayServer, type RelayDeps } from "../src/relay";

// The rows agents/tools.py Relay posts (AGENT_NOTES.md "Relay rows").
const message = (over: object = {}) => ({
  sessionId: "demo", round: 1, from: "flow", to: "coordinator", type: "proposal",
  payload: { policyId: "cand_keep_scans" }, reason: "Cut SMB between zones.", reasonSource: "template",
  createdAt: "2026-10-24T04:03:12.101+00:00", direction: "sent", fixture: true, ...over,
});
const question = {
  sessionId: "demo", id: "q-r1-dev_unknown_7", round: 1, agent: "inventory", targetId: "dev_unknown_7",
  text: "Is it a workstation or a scanner?", choices: ["workstation", "scanner"], allowedRoles: ["clinical_engineering"],
  textSource: "template",
};

let calls: [string, any][];
let server: ReturnType<typeof createRelayServer>;
let url: string;

function deps(): RelayDeps {
  const record = (name: string) => async (args: any) => {
    if (args?.sessionId === "refuse") throw new Error("Only the server identity can call this reducer.");
    calls.push([name, args]);
  };
  return {
    reducers: {
      agentMessageAdd: record("agentMessageAdd"), agentStatusSet: record("agentStatusSet"), questionAdd: record("questionAdd"),
      recommendationUpsert: record("recommendationUpsert"), roundStateSet: record("roundStateSet"),
    } as any,
    session: (id) => (id === "demo" ? { roundState: "running", round: 1 } : undefined),
    token: "secret",
  };
}

const post = (path: string, body: unknown, token = "secret") =>
  fetch(`${url}${path}`, {
    method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify(body),
  });

beforeEach(async () => {
  calls = [];
  server = createRelayServer(deps());
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterEach(() => new Promise<void>((r) => server.close(() => r())));

describe("relay", () => {
  it("writes every message to agent_message", async () => {
    expect((await post("/agent_message", message())).status).toBe(200);
    expect(calls).toEqual([["agentMessageAdd", expect.objectContaining({
      sessionId: "demo", fromAgent: "flow", toAgent: "coordinator", type: "proposal",
      payloadJson: '{"policyId":"cand_keep_scans"}', reasonSource: "template", direction: "sent", fixture: true,
    })]]);
  });

  it("rejects a wrong token, extra fields and unknown speakers", async () => {
    expect((await post("/agent_message", message(), "nope")).status).toBe(401);
    expect((await post("/agent_message", { ...message(), seq: 3 })).status).toBe(400);
    expect((await post("/agent_message", message({ from: "attacker" }))).status).toBe(400);
    expect(calls).toEqual([]);
  });

  it("passes a reducer's refusal back, so the agent doesn't send (rule 10)", async () => {
    const r = await post("/agent_message", message({ sessionId: "refuse" }));
    expect(r.status).toBe(502);
    expect(await r.json()).toEqual({ ok: false, error: "Only the server identity can call this reducer." });
    const bad = await fetch(`${url}/agent_message`, { method: "POST", headers: { authorization: "Bearer secret" }, body: "{" });
    expect(bad.status).toBe(400);
  });

  it("adds a question for humans, from the sender's copy only", async () => {
    await post("/agent_message", message({ from: "coordinator", to: "humans", type: "question", payload: question, reason: question.text }));
    await post("/agent_message", message({ from: "inventory", to: "coordinator", type: "question", payload: question, direction: "received" }));
    expect(calls.map((c) => c[0])).toEqual(["agentMessageAdd", "questionAdd", "agentMessageAdd"]);
    expect(calls[1][1]).toMatchObject({
      questionId: "q-r1-dev_unknown_7", targetId: "dev_unknown_7",
      choicesJson: '["workstation","scanner"]', allowedRolesJson: '["clinical_engineering"]',
    });
  });

  it("sets the round state and upserts recommendations", async () => {
    await post("/agent_message", message({
      from: "coordinator", to: "relay", type: "round_state", payload: { sessionId: "demo", round: 2, state: "done", detail: null },
    }));
    const rec = { policy: { name: "Keep scans" }, testResult: { ticks: 48 }, verdicts: [], explanation: "Why.", requiredRoles: ["security"], explanationSource: "template" };
    await post("/agent_message", message({ from: "coordinator", to: "relay", type: "recommendation", round: 2, payload: rec }));
    expect(calls.filter((c) => c[0] !== "agentMessageAdd")).toEqual([
      ["roundStateSet", { sessionId: "demo", round: 2, state: "done", detail: "" }],
      ["recommendationUpsert", { sessionId: "demo", round: 2, recommendationJson: JSON.stringify(rec), fixture: true }],
    ]);
  });

  it("checks a side-effect payload before storing the message, so a 400 stores nothing", async () => {
    const r = await post("/agent_message", message({
      from: "coordinator", to: "relay", type: "round_state", payload: { sessionId: "demo", round: 2, state: "finished" },
    }));
    expect(r.status).toBe(400);
    expect((await r.json()).error).toMatch(/^Invalid round_state payload: state: /);
    const q = await post("/agent_message", message({ from: "coordinator", to: "humans", type: "question", payload: { ...question, choices: ["only one"] } }));
    expect(q.status).toBe(400);
    expect(calls).toEqual([]);
  });

  it("keeps chat sessions in agent_message but writes nothing else for them", async () => {
    await post("/agent_message", message({
      sessionId: "chat-1a2b3c4d", from: "coordinator", to: "relay", type: "round_state",
      payload: { sessionId: "chat-1a2b3c4d", round: 1, state: "running" },
    }));
    expect(calls.map((c) => c[0])).toEqual(["agentMessageAdd"]);
  });

  it("writes agent status", async () => {
    const r = await post("/agent_status", { sessionId: "demo", agent: "flow", status: "thinking", updatedAt: "now", fixture: true });
    expect(r.status).toBe(200);
    expect(calls).toEqual([["agentStatusSet", { sessionId: "demo", agent: "flow", status: "thinking" }]]);
  });
});
