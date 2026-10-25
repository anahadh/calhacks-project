// Message and status relay. The uAgents POST every message they send or
// receive here (agents/tools.py Relay), and each one becomes an agent_message
// row before the agent may send it (AGENTS.md rule 10). Sent messages to
// "humans" or "relay" also update the tables the UI reads: questions,
// round state and recommendations.

import { timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { z } from "zod";
import type { ServerReducers, SessionInfo } from "./stdb";

const BODY_MAX = 256 * 1024;

// "scorekeeper" (SCOREKEEPER=1) explains the ranking; it never asks a question (QuestionPayload below).
const Speaker = z.enum(["inventory", "flow", "clinical_workflow", "coordinator", "scorekeeper", "humans", "relay"]);
const TextSource = z.enum(["claude", "asi1", "template"]);

export const AgentMessageRow = z
  .object({
    sessionId: z.string().min(1),
    round: z.number().int().min(0),
    from: Speaker,
    to: Speaker,
    type: z.enum([
      "proposal_request", "proposal", "revision", "verdict", "question", "answer", "recommendation", "round_state", "chat",
      "score_input", "scorecard",
    ]),
    payload: z.record(z.string(), z.unknown()),
    reason: z.string().nullable(),
    reasonSource: TextSource.nullable(),
    createdAt: z.string(),
    direction: z.enum(["sent", "received"]),
    fixture: z.boolean(),
  })
  .strict();

export const AgentStatusRow = z
  .object({
    sessionId: z.string().min(1),
    agent: z.enum(["inventory", "flow", "clinical_workflow", "coordinator", "scorekeeper"]),
    status: z.enum(["idle", "thinking", "speaking", "waiting"]),
    updatedAt: z.string(),
    fixture: z.boolean(),
  })
  .strict();

// The payloads with side effects, as agents/protocol.py defines them.
const Role = z.enum(["security", "clinical_engineering", "operations"]);
const QuestionPayload = z
  .object({
    sessionId: z.string().min(1),
    id: z.string().min(1),
    round: z.number().int().min(1),
    agent: z.enum(["inventory", "flow", "clinical_workflow", "coordinator"]),
    targetId: z.string().min(1),
    text: z.string().min(1),
    choices: z.array(z.string().min(1)).min(2),
    allowedRoles: z.array(Role).min(1),
    textSource: TextSource.nullable().optional(),
  })
  .strict();
const RoundStatePayload = z
  .object({
    sessionId: z.string().min(1),
    round: z.number().int().min(0),
    state: z.enum(["idle", "running", "waiting_for_human", "done"]),
    detail: z.string().nullable().optional(),
  })
  .strict();
const RecommendationPayload = z
  .object({
    policy: z.record(z.string(), z.unknown()),
    testResult: z.record(z.string(), z.unknown()),
    verdicts: z.array(z.record(z.string(), z.unknown())),
    explanation: z.string(),
    requiredRoles: z.array(Role).min(1),
    explanationSource: TextSource.nullable().optional(),
    option: z.number().int().min(1).max(3).optional(), // 1 = the negotiated plan; 2-3 = accepted alternatives
  })
  .strict();

export type RelayDeps = {
  reducers: ServerReducers;
  /** The session as the watcher sees it, or undefined (e.g. an ASI:One chat session). */
  session: (sessionId: string) => SessionInfo | undefined;
  token: string;
};

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function relayMessage(deps: RelayDeps, body: unknown): Promise<void> {
  const row = parse(AgentMessageRow, body, "agent_message row");
  // The side-effect payload is checked first, so a bad one writes nothing and
  // the agent's 400 means the message was not stored (INTEGRATION.md risk 11).
  const effect = sideEffect(deps, row);
  await deps.reducers.agentMessageAdd({
    sessionId: row.sessionId, round: row.round, fromAgent: row.from, toAgent: row.to, type: row.type,
    payloadJson: JSON.stringify(row.payload), reason: row.reason ?? "", reasonSource: row.reasonSource ?? "",
    direction: row.direction, fixture: row.fixture,
  });
  await effect?.();
}

/** The table write a message implies, with its payload already checked; it runs after the agent_message row lands. */
function sideEffect(deps: RelayDeps, row: z.infer<typeof AgentMessageRow>): (() => Promise<void>) | undefined {
  // Side effects come from the sender's copy only, and only for sessions that
  // exist in SpacetimeDB (chat rounds from ASI:One have none).
  if (row.direction !== "sent" || !deps.session(row.sessionId)) return undefined;
  if (row.type === "question" && row.to === "humans") {
    const q = parse(QuestionPayload, row.payload, "question payload");
    return () => deps.reducers.questionAdd({
      sessionId: q.sessionId, questionId: q.id, round: q.round, agent: q.agent, targetId: q.targetId, text: q.text,
      textSource: q.textSource ?? "", choicesJson: JSON.stringify(q.choices), allowedRolesJson: JSON.stringify(q.allowedRoles),
    });
  }
  if (row.type === "round_state") {
    const s = parse(RoundStatePayload, row.payload, "round_state payload");
    return () => deps.reducers.roundStateSet({ sessionId: s.sessionId, round: s.round, state: s.state, detail: s.detail ?? "" });
  }
  if (row.type === "recommendation") {
    parse(RecommendationPayload, row.payload, "recommendation payload");
    return () => deps.reducers.recommendationUpsert({
      sessionId: row.sessionId, round: row.round, recommendationJson: JSON.stringify(row.payload), fixture: row.fixture,
    });
  }
  return undefined;
}

export async function relayStatus(deps: RelayDeps, body: unknown): Promise<void> {
  const row = parse(AgentStatusRow, body, "agent_status row");
  await deps.reducers.agentStatusSet({ sessionId: row.sessionId, agent: row.agent, status: row.status });
}

function parse<T extends z.ZodTypeAny>(schema: T, value: unknown, what: string): z.infer<T> {
  const r = schema.safeParse(value);
  if (!r.success) {
    const issues = r.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
    throw new HttpError(400, `Invalid ${what}: ${issues}`);
  }
  return r.data;
}

function authorized(req: IncomingMessage, token: string): boolean {
  const got = Buffer.from(req.headers.authorization ?? "");
  const want = Buffer.from(`Bearer ${token}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > BODY_MAX) reject(new HttpError(413, "Body too large."));
      else chunks.push(c);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new HttpError(400, "Body is not JSON."));
      }
    });
    req.on("error", reject);
  });
}

function send(res: ServerResponse, status: number, body: object): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

export function createRelayServer(deps: RelayDeps): Server {
  return createServer(async (req, res) => {
    try {
      if (req.method === "GET" && req.url === "/health") return send(res, 200, { ok: true });
      if (req.method !== "POST" || (req.url !== "/agent_message" && req.url !== "/agent_status")) {
        throw new HttpError(404, "Not found.");
      }
      if (!authorized(req, deps.token)) throw new HttpError(401, "Missing or wrong RELAY_TOKEN.");
      const body = await readBody(req);
      console.log(`[relay] ${req.url} ${JSON.stringify(body).slice(0, 160)}`);
      if (req.url === "/agent_message") await relayMessage(deps, body);
      else await relayStatus(deps, body);
      send(res, 200, { ok: true });
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 502; // anything else is a reducer refusing the row
      const message = (e as Error).message ?? String(e);
      if (status !== 404) console.error(`[relay] ${req.url} ${status}: ${message}`);
      send(res, status, { ok: false, error: message });
    }
  });
}
