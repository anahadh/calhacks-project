import type { ArcData, DeviceCardData, ViewRole } from "../../../../spacetime/src/role_views";

// Shapes of the hospital file (HOSPITAL_SCHEMA.md) and of the subscribed
// SpacetimeDB rows as the UI renders them. snapshot.ts maps the generated
// bindings (module_bindings/) onto these; nothing here is computed.

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

/**
 * requested: waiting for the engine ("Computing…"). running/paused: the watcher
 * is feeding frames. done: the final frame landed. error: see `detail`.
 */
export type RunStatus = "requested" | "running" | "paused" | "done" | "error";
export type Speed = 0.5 | 1 | 2 | 4;

/** The engine's headline numbers for one run, copied from its latest frame (run row summary columns). */
export type RunTotals = {
  patientsAffected: number;
  devicesCompromised: number;
  servicesDown: number;
  delayedProcedures: number;
};

export type RunRow = RunTotals & {
  id: string;
  label: string;
  patientZero: string;
  /** Accepted and ignored: the engine has no RNG. */
  seed: number;
  tick: number;
  status: RunStatus;
  speed: Speed;
  /** "" for the session's own runs; the solution pair's id for both sides of a rerun. */
  pairId: string;
  /** "" for no segmentation, else the agents' Policy JSON. Opaque to the UI. */
  policyJson: string;
  /** The last step the engine computed. 0 until frame 0 lands. */
  finalTick: number;
  /** Why the engine or the watcher refused the run. Shown verbatim (rule 14). */
  detail: string;
  /** The presenter asked for one step while paused, and the watcher has not applied it yet. */
  stepPending: boolean;
  /** Flow ids the plan removed (cut connections). [] with no plan. */
  removedFlows: string[];
  /** Protected flow ids the plan removed. [] with no plan. */
  protectedBroken: string[];
  /** The engine's "[S]" notes on what it assumed. */
  assumptions: string[];
  /** Set on the plan side of a solution rerun. */
  recommendationId: string;
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
  role: "security" | "network" | "clinical_engineering" | "operations" | "observer";
  following: boolean;
};

/**
 * `focus`: a pin on a device (spec 7.8), context for the agents, never an order.
 * `note`: free text at a tick on a run's timeline (`tick` set, `targetId` "").
 */
export type AnnotationRow = {
  id: string; kind: "focus" | "note"; runId: string; targetId: string; tick?: number; note: string; authorName: string;
  role: PresenceRow["role"]; active: boolean; mine: boolean;
};

/**
 * Where the snapshot came from. "mock" only with NEXT_PUBLIC_MOCK=1, labeled
 * "Mock data". "error" carries `error`, e.g. when no SpacetimeDB host is set.
 */
export type SessionSource = "mock" | "connecting" | "live" | "missing" | "error";

/**
 * Playback, solution and pin controls. Each calls one reducer, and reducers
 * reject anyone who isn't allowed; the rejection's message is rethrown as-is.
 * Playback acts on `runId` when given (any run of a solution pair moves the
 * whole pair), else on the session's active run.
 */
export type SessionActions = {
  /** Start the attack: run_start with no policy. The watcher computes it through the engine. */
  startRun: (patientZero: string, speed?: Speed) => Promise<void>;
  play: (runId?: string) => Promise<void>;
  pause: (runId?: string) => Promise<void>;
  /** One step while paused. */
  step: (runId?: string) => Promise<void>;
  /** Back to requested with every row cleared; the watcher recomputes the same run. */
  reset: (runId?: string) => Promise<void>;
  setSpeed: (speed: Speed, runId?: string) => Promise<void>;
  join: (name: string, role: PresenceRow["role"]) => Promise<void>;
  addFocus: (deviceId: string, note?: string) => Promise<void>;
  /** Clears a focus pin or a timeline note (annotation_clear). */
  clearFocus: (annotationId: string) => Promise<void>;
  /** A note at a tick on the active run's timeline (annotation_add_note). */
  addNote: (tick: number, note: string) => Promise<void>;
  /** Create aggregate fix: writes defend_request. Refused while any session run is requested or running. */
  defend: () => Promise<void>;
  answerQuestion: (questionId: string, choice: string) => Promise<void>;
  /** Show the solution: solution_start reruns the attack as a pair, no segmentation vs the plan. Every tab follows. */
  /** patientZero: rerun both sides from that entry point instead of the attack on screen. */
  showSolution: (recommendationId: string, speed?: Speed, patientZero?: string) => Promise<void>;
  /** Back to the session: solution_close. The pair's runs are kept. */
  closeSolution: () => Promise<void>;
};

/** One run's rows, as subscribed by run id (the active run, or either side of a solution pair). */
export type RunView = {
  /** Undefined until the run row arrives, or when no such run exists. */
  run?: RunRow;
  devices: DeviceStateRow[];
  services: ServiceStateRow[];
  patients: PatientStateRow[];
  /** Only the last few ticks' attempts: the module prunes older ones. */
  attempts: SpreadAttemptRow[];
  events: SimEventRow[];
  snapshots: TickSnapshotRow[];
  chokePoints: ChokePoint[];
  /** The run row's summary columns, or zeros without a run. Never sum rows for these. */
  totals: RunTotals;
};

/** useRunRows(runId): one run's rows, and where they came from ("missing" once subscribed with no such run). */
export type RunSubscription = RunView & { source: SessionSource; error?: string };

export type SessionSnapshot = {
  hospital: Hospital;
  /** Every run in the session, oldest first, including solution pair runs (pairId !== ""). */
  runs: RunRow[];
  /** "" until the presenter starts an attack. */
  activeRunId: string;
  /** The session's baseline run (session.active_run_id), when one exists. */
  activeRun?: RunRow;
  presenterName: string;
  // The active run's rows (RunView, flattened for the session view).
  devices: DeviceStateRow[];
  services: ServiceStateRow[];
  patients: PatientStateRow[];
  attempts: SpreadAttemptRow[];
  events: SimEventRow[];
  snapshots: TickSnapshotRow[];
  chokePoints: ChokePoint[];
  /** The active run's summary columns. Read these instead of summing rows in the browser. */
  totals: RunTotals;
  /** Same as totals.delayedProcedures. */
  delayedProcedures: number;
  /** Devices the engine accepts as patient zero, in hospital order. [] until the watcher writes them. */
  entryPoints: string[];
  /** The solution pair every tab is showing, or "" for the session view. */
  solutionPairId: string;
  presence: PresenceRow[];
  roundState: RoundState;
  agentStatus: AgentStatusRow[];
  messages: AgentMessageRow[];
  annotations: AnnotationRow[];
  questions: QuestionRow[];
  recommendations: RecommendationRow[];
  /** This browser's presence row, once it has joined. */
  me?: PresenceRow;
  /** Live only: this browser's rows from the my_device_card and my_arcs views (role views). */
  roleView?: { role: ViewRole; cards: DeviceCardData[]; arcs: ArcData[] };
  source: SessionSource;
  /** Set when source is "error". Shown as-is (AGENTS.md rule 14). */
  error?: string;
  /** True when this browser is the presenter and may control playback. */
  isPresenter: boolean;
  actions: SessionActions;
};

// --- Agent rows (agent_message, agent_status, session.roundState) ---

export type AgentId = "inventory" | "flow" | "clinical_workflow" | "coordinator";
/** "asi1": a person chatting with the orchestrator on ASI:One (chat rows relayed by the Coordinator). */
export type Speaker = AgentId | "humans" | "asi1";
export type MessageType = "request" | "proposal" | "accept" | "reject" | "revision" | "question" | "answer" | "recommendation" | "chat";
/** Who wrote a message's text (rule 14: a template is never passed off as Claude's). */
export type TextSource = "claude" | "asi1" | "template";
export type ReviewRole = "security" | "clinical_engineering" | "operations";

export type AgentMessageRow = {
  round: number;
  seq: number;
  from: Speaker;
  to: Speaker | "all";
  type: MessageType;
  reason: string;
  // Rejections carry the constraint they add; proposals and revisions carry
  // rules or a diff, plus the engine's test result.
  constraint?: { kind: "keep_flow" | "keep_service" | "confirm_device" | "max_rules"; targetIds: string[] };
  rules?: string[];
  diff?: string[];
  /** The plan's name, on proposals (and revisions that rename it). */
  name?: string;
  tested?: { patientsAffected: number; devicesCompromised?: number };
  /** Proposals and revisions: the engine's count from every attack start, without and with the plan (Policy.evidence). */
  evidence?: { start: string; name: string; baseline: number; plan: number }[];
  /** An ASI:One chat message carried an interactive card. */
  card?: boolean;
  /** The plan a proposal, revision or verdict is about. */
  policyId?: string;
  /** Recommendations: 1 = the negotiated plan, 2-3 = alternatives both guardians accepted. */
  option?: number;
  source?: TextSource;
  /** When the row was written (microseconds since the epoch), for the transcript clock. */
  createdAt?: number;
  /** The numbers came from fixture files, not the engine. */
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
  /** 1 = the plan negotiated in the rounds; 2-3 = alternatives both reviewing agents also accepted. */
  option: number;
  /** The plan's own why and cost, from the Flow Agent (includes how many other attack starts it also holds). */
  rationale?: string;
  /** The proof: the engine's count from every place an attack could start, without and with the plan. */
  evidence?: { start: string; name: string; baseline: number; plan: number }[];
  tradeoff?: string;
  name: string;
  rules: string[];
  explanation: string;
  source?: TextSource;
  /** From the engine's RunResult for this plan (hippo-sim), on the same attack. */
  verified: { patientsAffected: number; devicesCompromised: number; protectedBroken: string[]; removedFlows: string[] };
  verdicts: { agent: AgentId; decision: "accept" | "reject"; reason: string }[];
  requiredRoles: ReviewRole[];
  status: "draft" | "ready";
  fixture: boolean;
};
