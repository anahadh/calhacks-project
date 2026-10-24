// A fixed mid-run snapshot of the demo hospital, shaped like the rows the
// session subscribes to. It stands in for SpacetimeDB until the module and
// bindings exist. Nothing here is computed: every value is written out by hand.
// All data is synthetic.

import type {
  Device, DeviceType, Flow, Hospital, Point, Room, SessionSnapshot,
} from "./types";

const rect = (x: number, y: number, w: number, d: number): Point[] => [
  [x, y], [x + w, y], [x + w, y + d], [x, y + d],
];

const rooms: Room[] = [
  // Ground floor
  { id: "rm_er", floorId: "fl_0", name: "Emergency", type: "er", zone: "critical_care", polygon: rect(0, 0, 14, 10) },
  { id: "rm_waiting", floorId: "fl_0", name: "ER waiting", type: "waiting", zone: "public", polygon: rect(14, 0, 8, 10) },
  { id: "rm_imaging", floorId: "fl_0", name: "Imaging", type: "imaging", zone: "imaging", polygon: rect(22, 0, 18, 12) },
  { id: "rm_lab", floorId: "fl_0", name: "Lab", type: "lab", zone: "clinical_support", polygon: rect(0, 10, 12, 14) },
  { id: "rm_pharmacy", floorId: "fl_0", name: "Pharmacy", type: "pharmacy", zone: "clinical_support", polygon: rect(12, 10, 10, 14) },
  { id: "rm_admin", floorId: "fl_0", name: "Admin", type: "admin", zone: "business", polygon: rect(22, 12, 18, 12) },
  // Level 1
  { id: "rm_icu", floorId: "fl_1", name: "ICU", type: "icu", zone: "critical_care", polygon: rect(0, 0, 16, 12) },
  { id: "rm_or", floorId: "fl_1", name: "Operating rooms", type: "or", zone: "critical_care", polygon: rect(16, 0, 14, 12) },
  { id: "rm_server", floorId: "fl_1", name: "Server room", type: "server", zone: "it_core", polygon: rect(30, 0, 10, 12) },
  { id: "rm_ward", floorId: "fl_1", name: "Ward 3B", type: "ward", zone: "inpatient", polygon: rect(0, 12, 24, 12) },
  { id: "rm_reading", floorId: "fl_1", name: "Radiology reading", type: "imaging", zone: "imaging", polygon: rect(24, 12, 16, 12) },
];

type DeviceSeed = [id: string, type: DeviceType, name: string, extra?: Partial<Device>];

const devicesByRoom: Record<string, DeviceSeed[]> = {
  rm_imaging: [
    ["mri_1", "mri", "MRI 1"], ["mri_2", "mri", "MRI 2", { vulnerable: true, os: "windows_7" }],
    ["mri_3", "mri", "MRI 3"], ["ct_1", "ct", "CT 1"],
    ["ws_img_1", "workstation", "Imaging WS 1", { vulnerable: true, os: "windows_7" }],
    ["ws_img_2", "workstation", "Imaging WS 2"],
  ],
  rm_reading: [["ws_rad_1", "workstation", "Reading WS 1"], ["ws_rad_2", "workstation", "Reading WS 2"], ["ws_rad_3", "workstation", "Reading WS 3"]],
  rm_server: [
    ["srv_pacs", "server_rack", "PACS", { role: "pacs", criticality: "high" }],
    ["srv_ehr", "server_rack", "EHR engine", { role: "ehr_engine", criticality: "high" }],
    ["srv_file", "server_rack", "File server", { role: "file_server", vulnerable: true }],
    ["srv_dc", "server_rack", "Domain controller", { role: "domain_controller", criticality: "high" }],
  ],
  rm_er: [
    ["ns_er", "nurse_station", "ER nurse station"], ["pm_er_1", "patient_monitor", "ER monitor 1"],
    ["pm_er_2", "patient_monitor", "ER monitor 2"], ["pm_er_3", "patient_monitor", "ER monitor 3"],
    ["ws_er_1", "workstation", "ER WS 1"], ["ip_er_1", "infusion_pump", "ER pump 1"],
  ],
  rm_waiting: [["ws_reg", "workstation", "Registration WS"], ["badge_er", "badge_reader", "ER badge reader"]],
  rm_icu: [
    ["ns_icu", "nurse_station", "ICU nurse station", { criticality: "life_support" }],
    ["pm_icu_1", "patient_monitor", "ICU monitor 1"], ["pm_icu_2", "patient_monitor", "ICU monitor 2"],
    ["pm_icu_3", "patient_monitor", "ICU monitor 3"], ["pm_icu_4", "patient_monitor", "ICU monitor 4"],
    ["ip_icu_1", "infusion_pump", "ICU pump 1"], ["ip_icu_2", "infusion_pump", "ICU pump 2"],
  ],
  rm_or: [
    ["am_or_1", "anesthesia_machine", "Anesthesia 1"], ["am_or_2", "anesthesia_machine", "Anesthesia 2"],
    ["pm_or_1", "patient_monitor", "OR monitor 1"], ["pm_or_2", "patient_monitor", "OR monitor 2"],
    ["ws_or", "workstation", "OR WS"],
  ],
  rm_ward: [
    ["ns_ward", "nurse_station", "Ward nurse station"], ["pm_ward_1", "patient_monitor", "Ward monitor 1"],
    ["pm_ward_2", "patient_monitor", "Ward monitor 2"], ["ip_ward_1", "infusion_pump", "Ward pump 1"],
    ["ws_ward", "workstation", "Ward WS"],
  ],
  rm_lab: [["la_1", "lab_analyzer", "Analyzer 1"], ["la_2", "lab_analyzer", "Analyzer 2"], ["ws_lab", "workstation", "Lab WS"]],
  rm_pharmacy: [["pc_1", "pharmacy_cabinet", "Dispensing cabinet"], ["ws_pharm", "workstation", "Pharmacy WS"]],
  rm_admin: [
    ["ws_admin_1", "workstation", "Admin WS 1"], ["ws_admin_2", "workstation", "Admin WS 2"],
    ["ws_admin_3", "workstation", "Admin WS 3"], ["hvac_1", "hvac", "HVAC controller"],
    ["badge_admin", "badge_reader", "Admin badge reader"],
  ],
};

// Lays devices out on a grid inside their room, so the fixture stays short.
function layout(room: Room, seeds: DeviceSeed[]): Device[] {
  const [x0, y0] = room.polygon[0];
  const [x1, y1] = room.polygon[2];
  const cols = Math.ceil(Math.sqrt(seeds.length * ((x1 - x0) / (y1 - y0))));
  const rows = Math.ceil(seeds.length / cols);
  return seeds.map(([id, type, name, extra], i) => ({
    id, roomId: room.id, type, name,
    os: "linux", vulnerable: false, criticality: "medium", vlan: 10,
    position: [
      x0 + ((x1 - x0) * ((i % cols) + 0.5)) / cols,
      y0 + 1.5 + ((y1 - y0 - 3) * (Math.floor(i / cols) + 0.5)) / rows,
    ],
    ...extra,
  }));
}

const devices = rooms.flatMap((r) => layout(r, devicesByRoom[r.id] ?? []));

let flowN = 0;
const f = (from: string, to: string, protocol: Flow["protocol"], port: number, extra?: Partial<Flow>): Flow => ({
  id: `fl_${++flowN}`, from, to, protocol, port, protected: false, ...extra,
});

const flows: Flow[] = [
  ...["mri_1", "mri_2", "mri_3", "ct_1"].map((d) => f(d, "srv_pacs", "dicom", 104, { protected: true, purpose: "Scans to radiologists" })),
  ...["ws_rad_1", "ws_rad_2", "ws_rad_3"].map((d) => f(d, "srv_pacs", "https", 443, { protected: true, purpose: "Radiologists view images" })),
  f("ws_img_1", "mri_2", "smb", 445),
  f("ws_img_1", "srv_file", "smb", 445),
  f("ws_img_2", "srv_file", "smb", 445),
  f("srv_file", "srv_dc", "smb", 445),
  f("srv_ehr", "srv_file", "smb", 445),
  ...["ws_er_1", "ws_reg", "ws_ward", "ws_or", "ws_lab", "ws_pharm", "ws_admin_1", "ws_admin_2"].map((d) => f(d, "srv_ehr", "https", 443)),
  ...["ws_er_1", "ws_reg", "ws_ward", "ws_lab", "ws_pharm", "ws_admin_2", "ws_admin_3"].map((d) => f(d, "srv_file", "smb", 445)),
  ...["ns_er", "ns_icu", "ns_ward"].map((d) => f(d, "srv_ehr", "hl7", 2575, { protected: true, purpose: "Vitals to charts" })),
  ...["pm_er_1", "pm_er_2", "pm_er_3", "ip_er_1"].map((d) => f(d, "ns_er", "hl7", 2575)),
  ...["pm_icu_1", "pm_icu_2", "pm_icu_3", "pm_icu_4", "ip_icu_1", "ip_icu_2"].map((d) => f(d, "ns_icu", "hl7", 2575)),
  ...["pm_ward_1", "pm_ward_2", "ip_ward_1"].map((d) => f(d, "ns_ward", "hl7", 2575)),
  ...["am_or_1", "am_or_2", "pm_or_1", "pm_or_2"].map((d) => f(d, "ws_or", "other", 5000)),
  ...["la_1", "la_2"].map((d) => f(d, "ws_lab", "hl7", 2575)),
  f("ws_lab", "srv_ehr", "hl7", 2575, { protected: true, purpose: "Lab results to charts" }),
  f("pc_1", "ws_pharm", "smb", 445),
  f("ws_admin_1", "srv_dc", "rdp", 3389),
  f("hvac_1", "ws_admin_3", "http", 80),
  f("badge_er", "srv_dc", "http", 80),
  f("badge_admin", "srv_dc", "http", 80),
];

const hospital: Hospital = {
  id: "demo_general",
  name: "Bayview General (demo)",
  floors: [
    { id: "fl_0", name: "Ground", level: 0 },
    { id: "fl_1", name: "Level 1", level: 1 },
  ],
  rooms,
  devices,
  flows,
  services: [
    { id: "svc_mri", name: "MRI imaging", dependsOnDevices: ["mri_1", "mri_2", "mri_3"], consequence: "Scheduled MRI scans can't run", critical: true },
    { id: "svc_reading", name: "Radiology reading", dependsOnDevices: ["srv_pacs"], consequence: "Radiologists can't view images", critical: true },
    { id: "svc_ehr", name: "Health records", dependsOnDevices: ["srv_ehr"], consequence: "Clinicians can't open charts", critical: true },
    { id: "svc_er", name: "ER intake", dependsOnDevices: ["ws_reg", "ws_er_1"], consequence: "New arrivals can't be registered", critical: true },
    { id: "svc_icu", name: "ICU monitoring", dependsOnDevices: ["ns_icu"], consequence: "Central ICU monitoring offline", critical: true },
    { id: "svc_pharm", name: "Pharmacy dispensing", dependsOnDevices: ["pc_1", "ws_pharm"], consequence: "Medication orders go to paper" },
    { id: "svc_lab", name: "Lab results", dependsOnDevices: ["la_1", "la_2", "ws_lab"], consequence: "Results are phoned through" },
  ],
  patients: [
    { id: "pg_er", roomId: "rm_er", type: "er", count: 14, dependsOnServices: ["svc_er", "svc_ehr"] },
    { id: "pg_waiting", roomId: "rm_waiting", type: "waiting", count: 22, dependsOnServices: ["svc_er"] },
    { id: "pg_scan", roomId: "rm_imaging", type: "outpatient_scan", count: 26, dependsOnServices: ["svc_mri", "svc_reading"] },
    { id: "pg_icu", roomId: "rm_icu", type: "icu", count: 12, dependsOnServices: ["svc_icu", "svc_ehr", "svc_lab"] },
    { id: "pg_or", roomId: "rm_or", type: "surgical", count: 8, dependsOnServices: ["svc_ehr", "svc_reading"] },
    { id: "pg_ward", roomId: "rm_ward", type: "surgical", count: 30, dependsOnServices: ["svc_ehr", "svc_pharm"] },
  ],
};

const infected: [deviceId: string, atTick: number, by?: string][] = [
  ["mri_2", 0],
  ["ws_img_1", 2, "mri_2"],
  ["srv_file", 3, "ws_img_1"],
  ["ws_img_2", 4, "srv_file"],
  ["srv_dc", 5, "srv_file"],
  ["srv_pacs", 6, "mri_2"],
  ["ws_admin_1", 7, "srv_dc"],
  ["ws_er_1", 8, "srv_file"],
  ["ws_lab", 8, "srv_file"],
  ["ws_reg", 9, "srv_file"],
  ["ws_ward", 9, "srv_file"],
];
const infectedMap = new Map(infected.map(([id, at, by]) => [id, { at, by }]));

const flowId = (from: string, to: string) =>
  flows.find((x) => (x.from === from && x.to === to) || (x.from === to && x.to === from))?.id ?? "";

export const mockSession: SessionSnapshot = {
  hospital,
  runs: [{ id: "run_baseline", label: "Baseline", patientZero: "mri_2", seed: 1337, tick: 9, status: "running", speed: 1 }],
  activeRunId: "run_baseline",
  presenterName: "Ana",
  devices: devices.map((d) => {
    const hit = infectedMap.get(d.id);
    return hit ? { deviceId: d.id, infected: true, infectedAtTick: hit.at, infectedBy: hit.by } : { deviceId: d.id, infected: false };
  }),
  services: [
    { serviceId: "svc_mri", down: true, downSinceTick: 0 },
    { serviceId: "svc_reading", down: true, downSinceTick: 6 },
    { serviceId: "svc_ehr", down: false },
    { serviceId: "svc_er", down: true, downSinceTick: 8 },
    { serviceId: "svc_icu", down: false },
    { serviceId: "svc_pharm", down: false },
    { serviceId: "svc_lab", down: true, downSinceTick: 8 },
  ],
  patients: [
    { groupId: "pg_er", state: "diverted" },
    { groupId: "pg_waiting", state: "delayed" },
    { groupId: "pg_scan", state: "disrupted" },
    { groupId: "pg_icu", state: "delayed" },
    { groupId: "pg_or", state: "delayed" },
    { groupId: "pg_ward", state: "ok" },
  ],
  attempts: [
    { tick: 9, from: "srv_file", to: "ws_reg", flowId: flowId("srv_file", "ws_reg"), success: true },
    { tick: 9, from: "srv_file", to: "ws_ward", flowId: flowId("srv_file", "ws_ward"), success: true },
    { tick: 9, from: "srv_file", to: "ws_pharm", flowId: flowId("srv_file", "ws_pharm"), success: false },
    { tick: 9, from: "srv_dc", to: "badge_admin", flowId: flowId("srv_dc", "badge_admin"), success: false },
  ],
  events: [
    { tick: 0, kind: "patient_zero", targetId: "mri_2", text: "MRI 2 infected (patient zero)" },
    { tick: 0, kind: "service_down", targetId: "svc_mri", text: "MRI imaging offline" },
    { tick: 2, kind: "device_infected", targetId: "ws_img_1", text: "Imaging WS 1 compromised" },
    { tick: 3, kind: "device_infected", targetId: "srv_file", text: "File server compromised" },
    { tick: 5, kind: "device_infected", targetId: "srv_dc", text: "Domain controller compromised" },
    { tick: 6, kind: "device_infected", targetId: "srv_pacs", text: "PACS compromised" },
    { tick: 6, kind: "service_down", targetId: "svc_reading", text: "Radiology reading offline" },
    { tick: 8, kind: "service_down", targetId: "svc_er", text: "ER intake offline" },
    { tick: 8, kind: "service_down", targetId: "svc_lab", text: "Lab results offline" },
    { tick: 8, kind: "diversion", targetId: "rm_er", text: "ER diverting ambulances" },
  ],
  snapshots: [1, 1, 2, 3, 4, 5, 6, 7, 9, 11].map((infectedCount, tick) => ({ tick, infectedCount })),
  chokePoints: [
    { deviceId: "srv_file", share: 0.64 },
    { deviceId: "srv_dc", share: 0.18 },
    { deviceId: "ws_img_1", share: 0.09 },
  ],
  delayedProcedures: 31,
  presence: [
    { name: "Ana", role: "security", following: false },
    { name: "Dev", role: "clinical_engineering", following: true },
    { name: "Kai", role: "operations", following: true },
  ],
};
