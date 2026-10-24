// REST calls to the Python engine (engine/sim_core/api.py): POST /app/session
// computes a whole visible run as TickFrames, and POST /app/entry_points lists
// the devices it accepts as patient zero (INTEGRATION.md 5a). Never throws.
// Replies are parsed strictly, so a frame the module would refuse fails here,
// with a readable detail, before the run starts. The watcher computes nothing:
// it only checks the shape and order the contract promises.

import { z } from "zod";

const Id = z.string().min(1);
const Tick = z.number().int().min(0);
const Count = z.number().int().min(0);
const PatientStateName = z.enum(["ok", "delayed", "disrupted", "diverted"]);

// TickFrame (HOSPITAL_SCHEMA.md "Run frames"), the one shape the engine, watcher and module share.
const DeviceChange = z
  .object({ deviceId: Id, infected: z.boolean(), infectedAtTick: z.number().int().min(-1), infectedBy: z.string() })
  .strict()
  .refine((d) => (d.infected ? d.infectedAtTick >= 0 : d.infectedAtTick === -1 && d.infectedBy === ""), {
    message: "an infected device needs infectedAtTick >= 0; a clean one has infectedAtTick -1 and infectedBy \"\"",
  });
const ServiceChange = z
  .object({ serviceId: Id, down: z.boolean(), downSinceTick: z.number().int().min(-1) })
  .strict()
  .refine((s) => s.down === s.downSinceTick >= 0, { message: "downSinceTick must be -1 exactly when the service is up" });
const PatientChange = z.object({ groupId: Id, state: PatientStateName }).strict();
const Attempt = z.object({ from: Id, to: Id, flowId: Id, success: z.boolean() }).strict();
const FrameEvent = z
  .object({ kind: z.enum(["patient_zero", "device_infected", "service_down", "diversion"]), targetId: Id, text: z.string() })
  .strict();
const Snapshot = z
  .object({
    infectedCount: Count, patientsAffected: Count, infectedIds: z.array(Id), servicesDown: z.array(Id),
    patients: z.record(z.string(), PatientStateName),
  })
  .strict();
const Summary = z
  .object({
    patientsAffected: Count, devicesCompromised: Count, servicesDown: Count, delayedProcedures: Count,
    chokePoints: z.array(z.object({ deviceId: Id, share: z.number().min(0).max(1) }).strict()),
  })
  .strict();
const RunFacts = z
  .object({ finalTick: Tick, removedFlows: z.array(Id), protectedBroken: z.array(Id), assumptions: z.array(z.string()) })
  .strict();

export const TickFrame = z
  .object({
    tick: Tick, final: z.boolean(),
    devices: z.array(DeviceChange), services: z.array(ServiceChange), patients: z.array(PatientChange),
    attempts: z.array(Attempt), events: z.array(FrameEvent), snapshot: Snapshot, summary: Summary,
    run: RunFacts.optional(), // frame 0 only
  })
  .strict();
export type TickFrame = z.infer<typeof TickFrame>;

/** One whole-run row the watcher doesn't forward (run_session's keys from before frames existed). */
const Row = z.record(z.string(), z.unknown());

export const AppSession = z
  .object({
    patientZero: Id, finalTick: Tick, removedFlows: z.array(Id), protectedBroken: z.array(Id), assumptions: z.array(z.string()),
    frames: z.array(TickFrame).min(1),
    devices: z.array(Row), services: z.array(Row), patients: z.array(Row), attempts: z.array(Row), events: z.array(Row),
    snapshots: z.array(Row), chokePoints: z.array(Row), delayedProcedures: Count, encryptedHosts: Count,
    medicalDevicesEncrypted: Count,
  })
  .strict()
  .superRefine((s, ctx) => {
    // Frames run 0..finalTick in order, only the last is final, and only frame 0 carries run.
    const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
    if (s.frames.length !== s.finalTick + 1) issue(["frames"], `holds ${s.frames.length} frames, but finalTick ${s.finalTick} needs ${s.finalTick + 1}`);
    s.frames.forEach((f, i) => {
      if (f.tick !== i) issue(["frames", i, "tick"], `is ${f.tick}, but frames must be ticks 0..finalTick in order`);
      if (f.final !== (i === s.finalTick)) issue(["frames", i, "final"], `must be true only on tick ${s.finalTick}`);
      if ((i === 0) !== (f.run !== undefined)) issue(["frames", i, "run"], i === 0 ? "is required on frame 0" : "belongs on frame 0 only");
    });
    const run = s.frames[0]?.run;
    if (run && run.finalTick !== s.finalTick) issue(["frames", 0, "run", "finalTick"], `is ${run.finalTick}, not finalTick ${s.finalTick}`);
  });
export type AppSession = z.infer<typeof AppSession>;

const EntryPoints = z.object({ entryPoints: z.array(Id) }).strict();

/** The body of POST /app/session (engine AppSessionRequest, which rejects any extra field). */
export type AppSessionRequest = { hospital: object; patient_zero: string; policy: object | null; challenges: string[] };
export type EngineReply = { ok: true; session: AppSession } | { ok: false; detail: string };
export type EntryPointsReply = { ok: true; entryPoints: string[] } | { ok: false; detail: string };

// detail is any JSON value, but it must be there: a body without one isn't the envelope, and is shown as it came.
const ErrorEnvelope = z
  .object({ error: z.object({ type: z.string(), detail: z.unknown().refine((d) => d !== undefined, "is missing") }).strict() })
  .strict();

const TIMEOUT_MS = 30_000; // the demo hospital computes in well under a second

export async function callEngine(baseUrl: string, body: AppSessionRequest, timeoutMs = TIMEOUT_MS): Promise<EngineReply> {
  const reply = await post(baseUrl, "/app/session", body, "the run", timeoutMs);
  if (!reply.ok) return reply;
  const parsed = AppSession.safeParse(reply.json);
  if (!parsed.success) return { ok: false, detail: `Engine /app/session sent frames the watcher can't play: ${issues(parsed.error)}` };
  return { ok: true, session: parsed.data };
}

export async function callEntryPoints(baseUrl: string, hospital: object, timeoutMs = TIMEOUT_MS): Promise<EntryPointsReply> {
  const reply = await post(baseUrl, "/app/entry_points", { hospital }, "the patient-zero check", timeoutMs);
  if (!reply.ok) return reply;
  const parsed = EntryPoints.safeParse(reply.json);
  if (!parsed.success) return { ok: false, detail: `Engine /app/entry_points sent an unexpected reply: ${issues(parsed.error)}` };
  return { ok: true, entryPoints: parsed.data.entryPoints };
}

async function post(
  baseUrl: string, path: string, body: object, what: string, timeoutMs: number,
): Promise<{ ok: true; json: unknown } | { ok: false; detail: string }> {
  let resp: Response;
  let text: string;
  try {
    resp = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    text = await resp.text();
  } catch (e) {
    return { ok: false, detail: `Can't reach the engine at ${baseUrl}: ${(e as Error).message}` };
  }
  const json = safeJson(text);
  if (!resp.ok) {
    // The engine's one error envelope: {error: {type, detail}} (detail may be a list of field errors).
    const env = ErrorEnvelope.safeParse(json);
    if (env.success) {
      const d = env.data.error.detail;
      return { ok: false, detail: `Engine refused ${what} (${env.data.error.type}): ${(typeof d === "string" ? d : JSON.stringify(d)).slice(0, 300)}` };
    }
    return { ok: false, detail: `Engine ${path} answered HTTP ${resp.status}: ${text.slice(0, 300)}` };
  }
  if (json === undefined) return { ok: false, detail: `Engine ${path} sent a reply that is not JSON: ${text.slice(0, 300)}` };
  return { ok: true, json };
}

function issues(error: z.ZodError): string {
  const all = error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
  return all.slice(0, 3).join("; ") + (all.length > 3 ? ` (and ${all.length - 3} more)` : "");
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
