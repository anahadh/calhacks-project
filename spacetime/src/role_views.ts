// Role views (F3): what each role sees on a device card and how the scene
// styles a hovered device's connections. Same truth, different lens: every role
// sees the infection (device state, spread, the infection path); only the card
// lines and the hovered connections differ. Tune a role here and nowhere else.
//
// Built for the demo: a card is the device's name, state, type and room, plus
// at most MAX_LINES short lines for the viewer's role. Lists are cut to the
// first item and "+N more", so a card never turns into a wall of fields.
//
// Pure functions over the hospital file. The views in views.ts call them for
// the caller's role, and the web app calls them when it runs without
// SpacetimeDB. Lookup and wording only: no spread, no patient states (AGENTS.md
// rule 3). Kept out of index.ts because every export there must be a table,
// reducer or view.

import type { Hospital } from "./hospital";

import type { ROLES } from "./constants";

export type ViewRole = (typeof ROLES)[number];

/** The most role lines a card shows. */
export const MAX_LINES = 3;

/**
 * How the scene styles a hovered device's connections for each role. Only the
 * infection path is drawn all the time (for everyone); a device's connections
 * appear when it is hovered, so the building stays readable.
 * - risk: lateral-movement protocols (SMB, RDP) strong and labeled; the rest faint.
 * - network: every active flow, labeled with protocol and port.
 * - clinical: protected, DICOM and HL7 flows strong and labeled with their purpose; the rest faint.
 * - dependencies: no device-to-device flows; a line from the device to each service that relies on it.
 * - none: the hovered device's flows, plain (no role yet).
 */
export type ArcMode = "risk" | "network" | "clinical" | "dependencies" | "none";
export const ARC_MODE: Record<ViewRole, ArcMode> = {
  security: "risk",
  network: "network",
  clinical_engineering: "clinical",
  operations: "dependencies",
  observer: "none",
};

const LATERAL = new Set(["smb", "rdp"]);
const CLINICAL_PROTOCOLS = new Set(["dicom", "hl7"]);
const PROTOCOL: Record<string, string> = {
  smb: "SMB", rdp: "RDP", http: "HTTP", https: "HTTPS", dicom: "DICOM", hl7: "HL7", other: "Other",
};
const OS: Record<string, string> = { windows_7: "Windows 7", windows_10: "Windows 10", windows_11: "Windows 11", linux: "Linux", rtos: "RTOS" };
const CRITICALITY: Record<string, string> = { low: "Low", medium: "Medium", high: "High", life_support: "Life support" };

/** One card line: a short label and a one-line value. */
export type CardLine = [label: string, value: string];

/** One device card for one role: up to MAX_LINES lines. */
export type DeviceCardData = { device_id: string; lines: CardLine[] };

export function viewRole(role: string | undefined): ViewRole {
  return role && role in ARC_MODE ? (role as ViewRole) : "observer";
}

/** The first item, then "+N more". */
function firstOf(xs: string[], none: string): string {
  if (!xs.length) return none;
  return xs.length === 1 ? xs[0] : `${xs[0]} +${xs.length - 1} more`;
}

/** `infectedBy` gives the name of the device that infected each one in the active run, if any. */
export function deviceCards(h: Hospital, role: ViewRole, infectedBy: (deviceId: string) => string | undefined): DeviceCardData[] {
  const name = new Map(h.devices.map((d) => [d.id, d.name]));
  const room = new Map(h.rooms.map((r) => [r.id, r]));

  return h.devices.map((d) => {
    const flows = h.flows.filter((f) => f.active !== false && (f.from === d.id || f.to === d.id));
    const peer = (f: (typeof flows)[number]) => name.get(f.from === d.id ? f.to : f.from) ?? "";
    const arrow = (f: (typeof flows)[number]) => (f.from === d.id ? "→" : "←");
    const services = h.services.filter((s) => s.dependsOnDevices.includes(d.id));
    const groups = h.patients.filter((g) => g.dependsOnServices.some((s) => services.some((x) => x.id === s)));
    const people = groups.reduce((n, g) => n + g.count, 0);
    const by = infectedBy(d.id);

    let lines: CardLine[] = [];
    if (role === "security") {
      const lateral = flows.filter((f) => LATERAL.has(f.protocol));
      lines = [
        ["Risk", `${d.vulnerable ? "Vulnerable" : "Patched"} · ${OS[d.os] ?? d.os}`],
        ...(by ? [["Infected by", by] as CardLine] : []),
        ["Exposure", lateral.length ? `${lateral.length} SMB/RDP link${lateral.length > 1 ? "s" : ""}` : `${flows.length} links, none SMB/RDP`],
      ];
    } else if (role === "network") {
      lines = [
        ["VLAN", `${d.vlan} · ${room.get(d.roomId)?.zone ?? "no zone"}`],
        ["Ports", firstOf(flows.map((f) => `${PROTOCOL[f.protocol] ?? f.protocol} ${f.port} ${arrow(f)} ${peer(f)}`), "No active flows")],
      ];
    } else if (role === "clinical_engineering") {
      const clinical = flows.filter((f) => f.protected || CLINICAL_PROTOCOLS.has(f.protocol));
      lines = [
        ["Criticality", CRITICALITY[d.criticality] ?? d.criticality],
        ["Clinical flow", firstOf(clinical.map((f) => f.purpose ?? `${PROTOCOL[f.protocol]} ${arrow(f)} ${peer(f)}`), "None")],
        ["Supports", firstOf(services.map((s) => `${s.name}${s.critical ? " (critical)" : ""}`), "No services")],
      ];
    } else if (role === "operations") {
      const er = groups.some((g) => g.type === "er");
      lines = [
        ["Patients", people ? `${people} depend on it` : "None depend on it"],
        ["If it fails", services.length ? `${services[0].consequence}${er ? " · ER diverts ambulances" : ""}` : "Nothing stops"],
      ];
    }
    return { device_id: d.id, lines: lines.slice(0, MAX_LINES) };
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
  const proto = (p: string) => PROTOCOL[p] ?? p;
  if (mode === "risk") {
    return flows.map((f) => {
      const lateral = LATERAL.has(f.protocol);
      return { id: f.id, kind: "flow", from: f.from, to: f.to, emphasis: lateral ? "strong" : "faint", label: lateral ? proto(f.protocol) : "" };
    });
  }
  if (mode === "network") {
    return flows.map((f) => ({ id: f.id, kind: "flow", from: f.from, to: f.to, emphasis: "normal", label: `${proto(f.protocol)} ${f.port}` }));
  }
  if (mode === "clinical") {
    return flows.map((f) => {
      const strong = f.protected || CLINICAL_PROTOCOLS.has(f.protocol);
      return { id: f.id, kind: "flow", from: f.from, to: f.to, emphasis: strong ? "strong" : "faint", label: strong ? f.purpose ?? proto(f.protocol) : "" };
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
