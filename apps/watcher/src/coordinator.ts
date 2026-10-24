// REST calls to the Sign-off Coordinator uAgent: start_round, resume, reassess
// (agents/coordinator.py). Bodies match agents/protocol.py, which rejects any
// extra field.

import { z } from "zod";

const RestAck = z.object({ ok: z.boolean(), detail: z.string().nullable().optional() }).strict();
export type RestAck = z.infer<typeof RestAck>;

export type StartRound = { sessionId: string; runId: string; patientZero: string; seed: number; challenges: string[] };
export type Resume = { sessionId: string; questionId: string; choice: string; author: string; role: string };

export async function callCoordinator(baseUrl: string, path: "/start_round" | "/resume" | "/reassess", body: object): Promise<RestAck> {
  let resp: Response;
  try {
    resp = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000), // a round's first step runs a baseline test
    });
  } catch (e) {
    return { ok: false, detail: `Can't reach the Sign-off Coordinator at ${baseUrl}: ${(e as Error).message}` };
  }
  const text = await resp.text();
  if (!resp.ok) return { ok: false, detail: `Sign-off Coordinator ${path} answered HTTP ${resp.status}: ${text.slice(0, 300)}` };
  const parsed = RestAck.safeParse(safeJson(text));
  if (!parsed.success) return { ok: false, detail: `Sign-off Coordinator ${path} sent an unexpected reply: ${text.slice(0, 300)}` };
  return parsed.data;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
