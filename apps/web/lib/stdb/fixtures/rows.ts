// Hand-written rows in the generated bindings' row types, for the data-layer
// tests. They follow the module's row contract (INTEGRATION.md 5b): one session
// with a finished baseline and a running solution pair, plus rows from another
// session that must be filtered out. Nothing here is engine output, and some
// summary columns deliberately disagree with the state rows, to prove the UI
// copies columns instead of recomputing them. All data is synthetic.

import { Identity, Timestamp } from "spacetimedb";
import type {
  AgentMessage, AgentStatus, Annotation, DeviceState, PatientState, Presence, Question, Recommendation, Run,
  ServiceState, Session, SimEvent, SpreadAttempt, TickSnapshot,
} from "../module_bindings/types";
import type { SessionTables } from "../snapshot";

export const PRESENTER = new Identity(1n);
export const VIEWER = new Identity(2n);
export const STRANGER = new Identity(3n);

export const SESSION = "s1";
export const BASE = "run_base";
export const PAIR = "pair_s1_2_1";
export const NONE = `${PAIR}_none`;
export const PLAN = `${PAIR}_plan`;

const at = (micros: number) => new Timestamp(BigInt(micros));

export const HOSPITAL = {
  schemaVersion: 1,
  hospital: {
    id: "fixture_web", name: "Web fixture hospital (synthetic)",
    floors: [{ id: "fl_0", name: "Ground", level: 0 }],
    rooms: [
      { id: "rm_er", floorId: "fl_0", name: "Emergency", type: "er", zone: "critical_care", polygon: [[0, 0], [8, 0], [8, 6], [0, 6]] },
      { id: "rm_imaging", floorId: "fl_0", name: "Imaging", type: "imaging", zone: "imaging", polygon: [[8, 0], [16, 0], [16, 6], [8, 6]] },
      { id: "rm_server", floorId: "fl_0", name: "Server room", type: "server", zone: "it_core", polygon: [[0, 6], [16, 6], [16, 10], [0, 10]] },
    ],
    devices: [
      { id: "ws_img", roomId: "rm_imaging", type: "workstation", name: "Imaging WS", os: "windows_10", vulnerable: true, criticality: "medium", vlan: 30, position: [10, 3] },
      { id: "mri_1", roomId: "rm_imaging", type: "mri", name: "MRI 1", os: "windows_7", vulnerable: true, criticality: "high", vlan: 30, position: [14, 3] },
      { id: "srv_file", roomId: "rm_server", type: "server_rack", role: "file_server", name: "File server", os: "windows_server_2016", vulnerable: true, criticality: "high", vlan: 10, position: [4, 8] },
      { id: "ws_er", roomId: "rm_er", type: "workstation", name: "ER WS", os: "windows_10", vulnerable: true, criticality: "medium", vlan: 20, position: [4, 3] },
    ],
    flows: [
      { id: "fl_1", from: "ws_img", to: "srv_file", protocol: "smb", port: 445, protected: false },
      { id: "fl_2", from: "mri_1", to: "ws_img", protocol: "dicom", port: 104, protected: true },
      { id: "fl_3", from: "ws_er", to: "srv_file", protocol: "smb", port: 445, protected: false },
    ],
    services: [
      { id: "svc_imaging", name: "Imaging", dependsOnDevices: ["mri_1", "ws_img"], consequence: "Scans are rescheduled" },
      { id: "svc_files", name: "File services", dependsOnDevices: ["srv_file"], consequence: "Shared drives offline", critical: true },
    ],
    patients: [
      { id: "pg_scan", roomId: "rm_imaging", type: "outpatient_scan", count: 7, dependsOnServices: ["svc_imaging"] },
      { id: "pg_er", roomId: "rm_er", type: "er", count: 5, dependsOnServices: ["svc_files"] },
    ],
  },
};

export function session(over: Partial<Session> = {}): Session {
  return {
    id: SESSION, hospitalJson: JSON.stringify(HOSPITAL), hospitalName: HOSPITAL.hospital.name, presenter: PRESENTER,
    activeRunId: BASE, createdAt: at(500), roundState: "done", round: 2, roundDetail: "",
    entryPointsJson: '["ws_img","ws_er"]', solutionPairId: PAIR, ...over,
  };
}

/** A run row with the module's defaults before frame 0 (BEFORE_FRAME_0), then `over`. */
export function run(over: Partial<Run> & { id: string }): Run {
  return {
    sessionId: SESSION, pairId: "", label: "Baseline", seed: 1337, patientZero: "ws_img", policyJson: "", tick: 0,
    status: "requested", speed: 1, patientsAffected: 0, devicesCompromised: 0, servicesDown: 0, delayedProcedures: 0,
    chokePointsJson: "[]", protectedBrokenJson: "[]", startedAt: at(1000), finalTick: 0, detail: "", autoplay: true,
    stepPending: false, challengesJson: "[]", removedFlowsJson: "[]", assumptionsJson: "[]", recommendationId: "",
    ...over,
  };
}

export const RUNS: Run[] = [
  // Listed out of start order: the pair started after the baseline.
  run({
    id: PLAN, pairId: PAIR, label: "With plan: Keep scans", policyJson: '{"strategy":"keep_scans"}', status: "running",
    tick: 1, finalTick: 1, startedAt: at(2000), recommendationId: "s1:2", removedFlowsJson: '["fl_1"]',
    devicesCompromised: 1, assumptionsJson: '["[S] A blocked attempt marks a connection the plan removed."]',
  }),
  run({
    id: BASE, status: "done", tick: 2, finalTick: 2,
    // The columns, not the state rows: summing patient_state below would give 7 patients, not 12.
    patientsAffected: 12, devicesCompromised: 3, servicesDown: 2, delayedProcedures: 7,
    chokePointsJson: '[{"deviceId":"srv_file","share":0.5},{"bad":true}]', assumptionsJson: '["[S] Lateral reach uses smb."]',
  }),
  run({ id: NONE, pairId: PAIR, label: "No segmentation", status: "running", tick: 1, finalTick: 2, startedAt: at(2000) }),
  run({ id: "run_elsewhere", sessionId: "s2", status: "running", tick: 4, finalTick: 9, startedAt: at(10) }),
];

const device = (runId: string, deviceId: string, infectedAtTick = -1, infectedBy = ""): DeviceState => ({
  id: `${runId}:${deviceId}`, runId, deviceId, infected: infectedAtTick >= 0, infectedAtTick, infectedBy,
});

export const DEVICE_STATE: DeviceState[] = [
  device(BASE, "ws_img", 0), device(BASE, "mri_1"), device(BASE, "srv_file", 1, "ws_img"), device(BASE, "ws_er", 2, "srv_file"),
  device(PLAN, "ws_img", 0), device(PLAN, "mri_1"), device(PLAN, "srv_file"), device(PLAN, "ws_er"),
  device("run_elsewhere", "ws_img", 0),
];

export const SERVICE_STATE: ServiceState[] = [
  { id: `${BASE}:svc_imaging`, runId: BASE, serviceId: "svc_imaging", down: true, downSinceTick: 2 },
  { id: `${BASE}:svc_files`, runId: BASE, serviceId: "svc_files", down: false, downSinceTick: -1 },
  { id: `${PLAN}:svc_imaging`, runId: PLAN, serviceId: "svc_imaging", down: false, downSinceTick: -1 },
];

export const PATIENT_STATE: PatientState[] = [
  { id: `${BASE}:pg_scan`, runId: BASE, groupId: "pg_scan", state: "disrupted" },
  { id: `${BASE}:pg_er`, runId: BASE, groupId: "pg_er", state: "ok" },
  { id: `${PLAN}:pg_scan`, runId: PLAN, groupId: "pg_scan", state: "ok" },
];

export const SPREAD_ATTEMPT: SpreadAttempt[] = [
  { id: 5n, runId: BASE, tick: 2, fromDevice: "srv_file", toDevice: "ws_er", flowId: "fl_3", success: true },
  { id: 3n, runId: BASE, tick: 1, fromDevice: "ws_img", toDevice: "srv_file", flowId: "fl_1", success: true },
  { id: 7n, runId: PLAN, tick: 1, fromDevice: "ws_img", toDevice: "srv_file", flowId: "fl_1", success: false },
];

export const SIM_EVENT: SimEvent[] = [
  { id: 4n, runId: BASE, tick: 2, kind: "service_down", targetId: "svc_imaging", text: "Imaging offline" },
  { id: 2n, runId: BASE, tick: 1, kind: "device_infected", targetId: "srv_file", text: "File server compromised" },
  { id: 1n, runId: BASE, tick: 0, kind: "patient_zero", targetId: "ws_img", text: "Imaging WS infected (patient zero)" },
  { id: 3n, runId: BASE, tick: 2, kind: "device_infected", targetId: "ws_er", text: "ER WS compromised" },
  { id: 6n, runId: PLAN, tick: 0, kind: "patient_zero", targetId: "ws_img", text: "Imaging WS infected (patient zero)" },
];

const snap = (runId: string, tick: number, infectedCount: number): TickSnapshot => ({
  id: `${runId}:${tick}`, runId, tick, infectedCount, patientsAffected: 0, infectedIdsJson: "[]", servicesDownJson: "[]",
  patientsJson: "{}",
});

export const TICK_SNAPSHOT: TickSnapshot[] = [snap(BASE, 2, 3), snap(BASE, 0, 1), snap(BASE, 1, 2), snap(PLAN, 0, 1)];

const presence = (identity: Identity, name: string, role: string, sessionId = SESSION): Presence => ({
  identity, sessionId, name, role, following: true, lastSeen: at(3000),
});

export const PRESENCE: Presence[] = [
  presence(PRESENTER, "Ana", "security"), presence(VIEWER, "Kai", "operations"), presence(STRANGER, "Zed", "security", "s2"),
];

const annotation = (id: bigint, author: Identity, active: boolean): Annotation => ({
  id, sessionId: SESSION, runId: BASE, kind: "focus", targetId: "srv_file", note: "Feeds the ER", author,
  authorName: author.isEqual(PRESENTER) ? "Ana" : "Kai", role: "operations", active, createdAt: at(3000), clearedBy: "",
});

export const ANNOTATION: Annotation[] = [annotation(9n, VIEWER, true), annotation(8n, PRESENTER, false)];

export const AGENT_STATUS: AgentStatus[] = [
  { id: `${SESSION}:flow`, sessionId: SESSION, agent: "flow", status: "idle", updatedAt: at(4000) },
  { id: `${SESSION}:relay`, sessionId: SESSION, agent: "relay", status: "idle", updatedAt: at(4000) },
];

/** A message row; both ends relay each message (rule 10), so most come in sent/received pairs. */
export function message(over: Partial<AgentMessage> & { seq: number; type: string }): AgentMessage {
  return {
    id: BigInt(over.seq), sessionId: SESSION, round: 1, fromAgent: "flow", toAgent: "coordinator", payloadJson: "{}",
    reason: "", reasonSource: "template", direction: "sent", fixture: false, createdAt: at(5000 + over.seq), ...over,
  };
}

const RESULT = {
  ticks: 1, infectedCount: 1, infectedDevices: [{ id: "ws_img", tick: 0 }], servicesDown: [],
  patientCounts: { ok: 9, delayed: 1, disrupted: 2, diverted: 0 }, protectedBroken: [], removedFlows: ["fl_1"],
};

export const AGENT_MESSAGE: AgentMessage[] = [
  message({ seq: 3, type: "verdict", fromAgent: "clinical_workflow", toAgent: "flow", reason: "This cuts scans to PACS.",
    payloadJson: JSON.stringify({ decision: "reject", constraint: { kind: "keep_flow", targetIds: ["fl_2"] } }) }),
  message({ seq: 2, type: "proposal", reason: "Cut SMB out of Imaging.", reasonSource: "claude",
    payloadJson: JSON.stringify({ rules: [{ id: "r1", plain: "No SMB out of Imaging." }], testResult: RESULT }) }),
  message({ seq: 2, type: "proposal", direction: "received", reason: "Cut SMB out of Imaging." }),
  message({ seq: 1, type: "proposal_request", fromAgent: "coordinator", toAgent: "flow", payloadJson: "{}" }),
  message({ seq: 4, type: "round_state", fromAgent: "coordinator", toAgent: "relay", payloadJson: '{"state":"running"}' }),
  message({ seq: 5, type: "answer", fromAgent: "humans", toAgent: "coordinator", direction: "received",
    payloadJson: JSON.stringify({ author: "Kai", role: "operations", choice: "workstation" }) }),
  message({ seq: 6, type: "revision", reason: "Kept scans to PACS.",
    payloadJson: JSON.stringify({ diff: { added: [{ id: "r2", plain: "Scanners may reach PACS on DICOM." }], removed: ["r1"] }, testResult: RESULT }) }),
  message({ seq: 7, type: "recommendation", fromAgent: "coordinator", toAgent: "relay", reason: "",
    payloadJson: JSON.stringify({ explanation: "Both guardians accept." }) }),
  message({ seq: 8, type: "chat", fromAgent: "coordinator", toAgent: "humans" }),
  message({ seq: 1, type: "proposal_request", sessionId: "s2" }),
];

export const QUESTION: Question[] = [
  {
    id: `${SESSION}:q2`, sessionId: SESSION, questionId: "q2", round: 1, agent: "inventory", targetId: "ws_img",
    text: "Is it a workstation?", textSource: "claude", choicesJson: '["yes","no"]', allowedRolesJson: '["clinical_engineering"]',
    answered: false, answerChoice: "", answerAuthor: "", answerRole: "", createdAt: at(6200),
  },
  {
    id: `${SESSION}:q1`, sessionId: SESSION, questionId: "q1", round: 1, agent: "inventory", targetId: "mri_1",
    text: "Is it a scanner?", textSource: "template", choicesJson: "not json", allowedRolesJson: '["security"]',
    answered: true, answerChoice: "yes", answerAuthor: "Ana", answerRole: "security", createdAt: at(6100),
  },
];

const recommendation = (over: Partial<Recommendation> & { id: string; round: number }): Recommendation => ({
  sessionId: SESSION, name: "Keep scans", policyJson: JSON.stringify({ rules: [{ id: "r2", plain: "Scanners may reach PACS on DICOM." }] }),
  explanation: "Cutting SMB keeps the file server out of reach.", explanationSource: "claude", verifiedJson: JSON.stringify(RESULT),
  verdictsJson: JSON.stringify([{ agent: "clinical_workflow", decision: "accept", reason: "Scans still reach PACS." }]),
  requiredRolesJson: '["security","clinical_engineering"]', fixture: false, status: "draft", updatedAt: at(7000), ...over,
});

export const RECOMMENDATION: Recommendation[] = [
  recommendation({ id: "s1:1", round: 1, verifiedJson: "not json", status: "something" }),
  recommendation({ id: "s1:2", round: 2 }),
];

/** The whole cache as the live session sees it. */
export function tables(over: Partial<SessionTables> = {}): SessionTables {
  return {
    session: [session(), session({ id: "s2", activeRunId: "run_elsewhere", presenter: STRANGER })], run: RUNS,
    presence: PRESENCE, annotation: ANNOTATION, agentMessage: AGENT_MESSAGE, agentStatus: AGENT_STATUS, question: QUESTION,
    recommendation: RECOMMENDATION, deviceState: DEVICE_STATE, serviceState: SERVICE_STATE, patientState: PATIENT_STATE,
    spreadAttempt: SPREAD_ATTEMPT, simEvent: SIM_EVENT, tickSnapshot: TICK_SNAPSHOT, ...over,
  };
}
