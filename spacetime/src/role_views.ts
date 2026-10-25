// Role views (F3): what each role sees on a device card and which connections
// the scene draws. Same truth, different lens: every role sees the infection
// (device state, spread, the infection path); only the extra fields and the
// network arcs differ. Tune a role here and nowhere else.
//
// Pure functions over the hospital file. The views in views.ts call them for
// the caller's role, and the web app calls them when it runs without
// SpacetimeDB. Lookup and wording only: no spread, no patient states (AGENTS.md
// rule 3). Kept out of index.ts because every export there must be a table,
// reducer or view.

import type { Hospital } from "@hippo/sim-core";

import type { ROLES } from "./constants";

export type ViewRole = (typeof ROLES)[number];

/** The role-specific fields a device card can show. Everyone also sees name, type, room, state and services. */
export type CardField =
  | "os" | "vulnerability" | "vlan" | "ports" | "infected_by"
  | "criticality" | "clinical_flows" | "clinical_services"
  | "patients" | "service_impact";

/** Which extra fields each role sees, in display order. */
export const CARD_FIELDS: Record<ViewRole, readonly CardField[]> = {
  security: ["os", "vulnerability", "vlan", "ports", "infected_by"],
  clinical_engineering: ["criticality", "clinical_flows", "clinical_services"],
  operations: ["patients", "service_impact"],
  observer: [],
};

/**
 * Which connections the scene draws for each role. The infection path is drawn
 * for everyone on top of these.
 * - network: every active flow, labeled with protocol and port.
 * - clinical: protected, DICOM and HL7 flows strong; every other flow faint.
 * - dependencies: no device-to-device flows; a line from each device to the services that rely on it.
 * - none: only the hovered device's flows (the pre-role behavior).
 */
export type ArcMode = "network" | "clinical" | "dependencies" | "none";
export const ARC_MODE: Record<ViewRole, ArcMode> = {
  security: "network",
  clinical_engineering: "clinical",
  operations: "dependencies",
  observer: "none",
};

const CLINICAL_PROTOCOLS = new Set(["dicom", "hl7"]);
const PROTOCOL: Record<string, string> = {
  smb: "SMB", rdp: "RDP", http: "HTTP", https: "HTTPS", dicom: "DICOM", hl7: "HL7", other: "Other",
};
const OS: Record<string, string> = { windows_7: "Windows 7", windows_10: "Windows 10", windows_11: "Windows 11", linux: "Linux", rtos: "RTOS" };
const CRITICALITY: Record<string, string> = { low: "Low", medium: "Medium", high: "High", life_support: "Life support" };

/** One device card for one role. Every field is a display string; "" means this role doesn't see it. */
export type DeviceCardData = { device_id: string; services: string } & Record<CardField, string>;

export function viewRole(role: string | undefined): ViewRole {
  return role && role in CARD_FIELDS ? (role as ViewRole) : "observer";
}

/** `infectedBy` gives the name of the device that infected each one in the active run, if any. */
export function deviceCards(h: Hospital, role: ViewRole, infectedBy: (deviceId: string) => string | undefined): DeviceCardData[] {
  const name = new Map(h.devices.map((d) => [d.id, d.name]));
  const room = new Map(h.rooms.map((r) => [r.id, r.name]));
  const show = new Set(CARD_FIELDS[role]);
  const lines = (xs: string[]) => xs.join("\n");
  const list = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

  return h.devices.map((d) => {
    const flows = h.flows.filter((f) => f.active !== false && (f.from === d.id || f.to === d.id));
    const other = (f: (typeof flows)[number]) => (f.from === d.id ? `→ ${name.get(f.to) ?? f.to}` : `← ${name.get(f.from) ?? f.from}`);
    const services = h.services.filter((s) => s.dependsOnDevices.includes(d.id));
    const groups = h.patients.filter((g) => g.dependsOnServices.some((s) => services.some((x) => x.id === s)));
    const people = groups.reduce((n, g) => n + g.count, 0);
    const where = [...new Set(groups.map((g) => room.get(g.roomId) ?? g.roomId))];
    const clinical = flows.filter((f) => f.protected || CLINICAL_PROTOCOLS.has(f.protocol));

    const all: Record<CardField, string> = {
      os: OS[d.os] ?? d.os,
      vulnerability: d.vulnerable ? "Yes: unpatched or end-of-life" : "None known",
      vlan: String(d.vlan),
      ports: lines(flows.map((f) => `${PROTOCOL[f.protocol] ?? f.protocol} ${f.port} ${other(f)}`)) || "No active flows",
      infected_by: infectedBy(d.id) ?? "",
      criticality: CRITICALITY[d.criticality] ?? d.criticality,
      clinical_flows:
        lines(clinical.map((f) => `${f.purpose ?? PROTOCOL[f.protocol]} (${PROTOCOL[f.protocol] ?? f.protocol}) ${other(f)}${f.protected ? " · protected" : ""}`))
        || "None",
      clinical_services:
        lines(services.map((s) => `${s.name}${s.critical ? " (critical)" : ""}: ${s.consequence}`)) || "None",
      patients: people ? `${people} patients${where.length ? ` in ${list(where)}` : ""} depend on it` : "No patients depend on it",
      service_impact:
        lines([
          ...services.map((s) => `${s.consequence}.`),
          ...(groups.some((g) => g.type === "er") ? ["If it stays down, the ER diverts arriving ambulances."] : []),
        ]) || "Nothing stops if it goes down",
    };
    const card = { device_id: d.id, services: services.map((s) => s.name).join(", ") } as DeviceCardData;
    for (const f of Object.keys(all) as CardField[]) card[f] = show.has(f) ? all[f] : "";
    return card;
  });
}

/** A connection to draw. `to` is a device id for flows and a service id for dependencies. */
export type ArcData = {
  id: string;
  kind: "flow" | "dependency";
  from: string;
  to: string;
  emphasis: "normal" | "strong" | "faint";
  label: string;
};

export function roleArcs(h: Hospital, role: ViewRole): ArcData[] {
  const mode = ARC_MODE[role];
  const flows = h.flows.filter((f) => f.active !== false);
  if (mode === "network") {
    return flows.map((f) => ({
      id: f.id, kind: "flow", from: f.from, to: f.to, emphasis: "normal", label: `${PROTOCOL[f.protocol] ?? f.protocol} ${f.port}`,
    }));
  }
  if (mode === "clinical") {
    return flows.map((f) => {
      const strong = f.protected || CLINICAL_PROTOCOLS.has(f.protocol);
      return {
        id: f.id, kind: "flow", from: f.from, to: f.to, emphasis: strong ? "strong" : "faint",
        label: strong ? `${f.purpose ?? PROTOCOL[f.protocol]} (${PROTOCOL[f.protocol] ?? f.protocol})` : "",
      };
    });
  }
  if (mode === "dependencies") {
    return h.services.flatMap((s) =>
      s.dependsOnDevices.map((dev) => ({
        id: `${s.id}:${dev}`, kind: "dependency" as const, from: dev, to: s.id, emphasis: s.critical ? "strong" as const : "normal" as const, label: s.name,
      })),
    );
  }
  return [];
}
