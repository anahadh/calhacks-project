// Shapes of the hospital file (HOSPITAL_SCHEMA.md) and the subscribed
// SpacetimeDB rows (spec: Data Model). These are placeholders until
// `packages/schema` and the generated bindings from `spacetime generate` exist.

export type Point = [number, number];

export type RoomType =
  | "imaging" | "er" | "icu" | "pharmacy" | "or" | "server"
  | "lab" | "admin" | "waiting" | "ward" | "other";

export type DeviceType =
  | "mri" | "ct" | "workstation" | "nurse_station" | "patient_monitor"
  | "infusion_pump" | "server_rack" | "pharmacy_cabinet" | "lab_analyzer"
  | "anesthesia_machine" | "badge_reader" | "hvac" | "unknown";

export type Protocol = "smb" | "rdp" | "http" | "https" | "dicom" | "hl7" | "other";

export type Floor = { id: string; name: string; level: number };

export type Room = {
  id: string;
  floorId: string;
  name: string;
  type: RoomType;
  zone: string;
  polygon: Point[];
};

export type Device = {
  id: string;
  roomId: string;
  type: DeviceType;
  role?: "pacs" | "ehr_engine" | "file_server" | "domain_controller" | "other";
  name: string;
  os: string;
  vulnerable: boolean;
  criticality: "low" | "medium" | "high" | "life_support";
  vlan: number;
  position: Point;
};

export type Flow = {
  id: string;
  from: string;
  to: string;
  protocol: Protocol;
  port: number;
  protected: boolean;
  purpose?: string;
  active?: boolean;
};

export type Service = {
  id: string;
  name: string;
  dependsOnDevices: string[];
  consequence: string;
  critical?: boolean;
};

export type PatientGroupType = "icu" | "er" | "surgical" | "outpatient_scan" | "waiting";

export type PatientGroup = {
  id: string;
  roomId: string;
  type: PatientGroupType;
  count: number;
  dependsOnServices: string[];
};

export type Hospital = {
  id: string;
  name: string;
  floors: Floor[];
  rooms: Room[];
  devices: Device[];
  flows: Flow[];
  services: Service[];
  patients: PatientGroup[];
};

// --- Subscribed rows ---

export type PatientStateValue = "ok" | "delayed" | "disrupted" | "diverted";

export type RunRow = {
  id: string;
  label: string;
  patientZero: string;
  seed: number;
  tick: number;
  status: "running" | "paused" | "done";
  speed: 0.5 | 1 | 2 | 4;
};

export type DeviceStateRow = { deviceId: string; infected: boolean; infectedAtTick?: number; infectedBy?: string };
export type ServiceStateRow = { serviceId: string; down: boolean; downSinceTick?: number };
export type PatientStateRow = { groupId: string; state: PatientStateValue };
export type SpreadAttemptRow = { tick: number; from: string; to: string; flowId: string; success: boolean };
export type SimEventRow = { tick: number; kind: string; targetId: string; text: string };
export type TickSnapshotRow = { tick: number; infectedCount: number };
export type ChokePoint = { deviceId: string; share: number };

export type PresenceRow = {
  name: string;
  role: "security" | "clinical_engineering" | "operations" | "observer";
  following: boolean;
};

/**
 * An annotation. `focus`: a pin on a device (context for the agents, never an
 * order). `note`: free text at a tick on a run's timeline.
 */
export type AnnotationRow = {
  id: string; kind: "focus" | "note"; runId: string; targetId: string; tick?: number; note: string; authorName: string;
  role: PresenceRow["role"]; active: boolean; mine: boolean;
};

/** Where the snapshot came from. "mock" only when no SpacetimeDB host is configured. */
export type SessionSource = "mock" | "connecting" | "live" | "missing" | "error";

/** Playback and pin controls. Reducers reject anyone who isn't allowed. */
export type SessionActions = {
  startRun: (patientZero: string, speed?: 0.5 | 1 | 2 | 4) => Promise<void>;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  step: () => Promise<void>;
  reset: () => Promise<void>;
  setSpeed: (speed: 0.5 | 1 | 2 | 4) => Promise<void>;
  join: (name: string, role: PresenceRow["role"]) => Promise<void>;
  addFocus: (deviceId: string, note?: string) => Promise<void>;
  /** A note at a tick on the active run's timeline. */
  addNote: (tick: number, note: string) => Promise<void>;
  clearFocus: (annotationId: string) => Promise<void>;
  /** Create aggregate fix: writes defend_request. Refused while the active run is running. */
  defend: () => Promise<void>;
  answerQuestion: (questionId: string, choice: string) => Promise<void>;
};

export type SessionSnapshot = {
  hospital: Hospital;
  runs: RunRow[];
  activeRunId: string;
  presenterName: string;
  devices: DeviceStateRow[];
  services: ServiceStateRow[];
  patients: PatientStateRow[];
  attempts: SpreadAttemptRow[];
  events: SimEventRow[];
  snapshots: TickSnapshotRow[];
  chokePoints: ChokePoint[];
  delayedProcedures: number;
  presence: PresenceRow[];
  roundState: RoundState;
  agentStatus: AgentStatusRow[];
  messages: AgentMessageRow[];
  annotations: AnnotationRow[];
  questions: QuestionRow[];
  recommendations: RecommendationRow[];
  /** This browser's presence row, once it has joined. */
  me?: PresenceRow;
  source: SessionSource;
  /** Set when source is "error". Shown as-is (AGENTS.md rule 14). */
  error?: string;
  /** True when this browser is the presenter and may control playback. */
  isPresenter: boolean;
  actions: SessionActions;
};

// --- Agent rows (agent_message, agent_status, session.roundState) ---

export type AgentId = "inventory" | "flow" | "clinical_workflow" | "coordinator";
export type Speaker = AgentId | "humans";
export type MessageType = "request" | "proposal" | "accept" | "reject" | "revision" | "question" | "answer" | "recommendation";
/** Who wrote a message's text (rule 14: a template is never passed off as Claude's). */
export type TextSource = "claude" | "template";
export type ReviewRole = "security" | "clinical_engineering" | "operations";

export type AgentMessageRow = {
  round: number;
  seq: number;
  from: Speaker;
  to: Speaker | "all";
  type: MessageType;
  reason: string;
  // Rejections carry the constraint they add; proposals and revisions carry
  // rules or a diff, plus the hippo-sim test result.
  constraint?: { kind: "keep_flow" | "keep_service" | "confirm_device" | "max_rules"; targetIds: string[] };
  rules?: string[];
  diff?: string[];
  tested?: { patientsAffected: number };
  source?: TextSource;
  /** The numbers came from fixture files, not hippo-sim. */
  fixture?: boolean;
};

export type AgentStatusRow = { agent: AgentId; status: "idle" | "thinking" | "speaking" | "waiting" };

export type RoundState = {
  state: "idle" | "running" | "waiting_for_human" | "done";
  round: number;
  maxRounds: number;
  /** The Coordinator's detail, or an error from the watcher. Shown as-is. */
  detail?: string;
};

export type QuestionRow = {
  questionId: string;
  round: number;
  agent: AgentId;
  targetId: string;
  text: string;
  source?: TextSource;
  choices: string[];
  allowedRoles: ReviewRole[];
  answer?: { choice: string; author: string; role: ReviewRole };
};

/** A published plan. `status` changes only through human review (rule 9). */
export type RecommendationRow = {
  id: string;
  round: number;
  name: string;
  rules: string[];
  explanation: string;
  source?: TextSource;
  /** From hippo-sim's RunResult for this plan, on the same attack. */
  verified: { patientsAffected: number; devicesCompromised: number; protectedBroken: string[]; removedFlows: string[] };
  verdicts: { agent: AgentId; decision: "accept" | "reject"; reason: string }[];
  requiredRoles: ReviewRole[];
  status: "draft" | "ready";
  fixture: boolean;
};
