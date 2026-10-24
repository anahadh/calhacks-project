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
};
