// The hospital file the module stores on each session: its shape
// (docs/hippocratech/HOSPITAL_SCHEMA.md) and the server-side checks. Types and
// validation only. The module never simulates: spread, impact and patient
// states come from the Python engine as frames (ingest.ts).
//
// Not re-exported from index.ts, so it may export helpers.
//
// All data is synthetic. Patient groups are counts.

import { fail, getSession } from "./schema";

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

/** Every id a frame may name, by kind. */
export type HospitalIndex = {
  devices: Set<string>;
  services: Set<string>;
  groups: Set<string>;
  rooms: Set<string>;
  flows: Set<string>;
};

export function validateHospital(json: string): HospitalFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    fail("The hospital file is not valid JSON.");
  }
  const f = parsed as Partial<HospitalFile>;
  // Full validation (every path, every rule) lives in packages/schema and runs
  // in the browser first. This is the server-side backstop for the essentials.
  if (f?.schemaVersion !== 1 || !f.hospital) fail("Expected { schemaVersion: 1, hospital: {...} }.");
  const h = f.hospital;
  for (const k of ["floors", "rooms", "devices", "flows", "services", "patients"] as const) {
    if (!Array.isArray(h[k])) fail(`hospital.${k} must be a list.`);
  }
  const ids = new Set(h.devices.map((d) => d.id));
  for (const fl of h.flows) if (!ids.has(fl.from) || !ids.has(fl.to)) fail(`Flow "${fl.id}" refers to a missing device.`);
  for (const g of h.patients as any[]) {
    for (const banned of ["name", "age", "birthDate", "mrn", "diagnosis"]) {
      if (banned in g) fail(`Patient group "${g.id}" has "${banned}". Patient groups hold counts only.`);
    }
  }
  if (json.length > 2 * 1024 * 1024) fail("The hospital file is larger than 2 MB.");
  return f as HospitalFile;
}

/** The session's hospital. session_create validated it. */
export function hospitalOf(ctx: any, sessionId: string): Hospital {
  return (JSON.parse(getSession(ctx, sessionId).hospital_json) as HospitalFile).hospital;
}

export function hospitalIndex(h: Hospital): HospitalIndex {
  return {
    devices: new Set(h.devices.map((d) => d.id)),
    services: new Set(h.services.map((s) => s.id)),
    groups: new Set(h.patients.map((g) => g.id)),
    rooms: new Set(h.rooms.map((r) => r.id)),
    flows: new Set(h.flows.map((f) => f.id)),
  };
}
