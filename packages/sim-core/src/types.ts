// Hospital file and policy shapes (docs/hippocratech/HOSPITAL_SCHEMA.md).
// All data is synthetic. Patient groups are counts.

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
  id: string; floorId: string; name: string; type: RoomType; zone: string; polygon: Point[];
};

export type Device = {
  id: string;
  roomId: string;
  type: DeviceType;
  role?: "pacs" | "ehr_engine" | "file_server" | "domain_controller" | "other";
  name: string;
  make?: string;
  model?: string;
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
  observed?: boolean;
  purpose?: string;
  active?: boolean;
};

export type Service = {
  id: string; name: string; dependsOnDevices: string[]; consequence: string; critical?: boolean;
};

export type PatientGroupType = "icu" | "er" | "surgical" | "outpatient_scan" | "waiting";

export type PatientGroup = {
  id: string; roomId: string; type: PatientGroupType; count: number; dependsOnServices: string[];
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

export type HospitalFile = { schemaVersion: 1; hospital: Hospital };

export type Selector = { zone?: string; deviceType?: DeviceType; role?: Device["role"]; vlan?: number };

export type PolicyRule = {
  id: string; from: Selector; to: Selector; protocol?: Protocol; port?: number; plain: string;
};

export type Policy = {
  strategy: "least_disruption" | "max_containment" | "protect_critical_care" | "fastest_deploy";
  name: string;
  rules: PolicyRule[];
  rationale?: string;
  tradeoff?: string;
};

export type PatientStateValue = "ok" | "delayed" | "disrupted" | "diverted";
