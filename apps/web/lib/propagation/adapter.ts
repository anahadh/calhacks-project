// Render-only mapping from a ReplayResult to a view model. Pure functions, no
// React, no network, no ticks. Colors follow the handoff contract: controlled =
// amber, encrypted = red, device dependency_outage = violet; paper/up/down are
// preserved with their own labels. Nothing here collapses the richer state into
// a boolean, and nothing invents an event that has no row behind it.

import { C } from "@/lib/colors";
import type {
  Assumption,
  DeviceState,
  Level,
  ReplayResult,
  ServiceState,
  TraceEntry,
} from "./types";

export type Swatch = { label: string; color: string };

// clean/foothold/creds are not spelled out by the contract; they keep distinct
// labels and the app's existing healthy/infected tones. The three the contract
// names are exact: controlled -> amber (delayed), encrypted -> red (disrupted),
// dependency_outage -> violet (zone).
export const LEVEL_VIEW: Record<Level, Swatch> = {
  clean: { label: "Clean", color: C.healthy },
  footholded: { label: "Foothold", color: C.infected },
  cred_holder: { label: "Credentials taken", color: C.infected },
  controlled: { label: "Controlled", color: C.delayed },
  encrypted: { label: "Encrypted", color: C.disrupted },
};

export const SERVICE_VIEW: Record<ServiceState, Swatch> = {
  up: { label: "Up", color: C.healthy },
  paper: { label: "On paper", color: C.delayed },
  down: { label: "Down", color: C.disrupted },
};

export const DEVICE_VIEW: Record<DeviceState, Swatch> = {
  operational: { label: "Operational", color: C.healthy },
  dependency_outage: { label: "Dependency outage", color: C.zone },
};

export type HostView = { id: string; level: Level } & Swatch;
export type ServiceView = { name: string; state: ServiceState; causes: string[] } & Swatch;
export type DeviceView = { id: string; state: DeviceState } & Swatch;
export type BlockedView = {
  t: string;
  rule: string;
  node: string | null;
  reason: string;
  blockers: { code: string; detail: string; levers: string[] }[];
};

export type ReplayView = {
  cacheKey: string;
  rulesVersion: string;
  cached: boolean;
  disclosed: boolean;
  hosts: HostView[];
  services: ServiceView[];
  devices: DeviceView[];
  // Service loss caused by the plan itself, before any attack step.
  planInducedServiceLoss: ServiceView[];
  // Actual blocked preconditions from the trace (status === "blocked").
  blockedPreconditions: BlockedView[];
  assumptions: Assumption[];
  totals: {
    encryptedHosts: number;
    targetedOrgs: string[];
    servicesDown: string[];
    servicesOnPaper: string[];
    medicalDevicesEncrypted: number;
  };
};

function swatchForService(state: ServiceState): Swatch {
  return SERVICE_VIEW[state];
}

/** Adapt a replay result into a render-ready view. `cached`/`disclosed` are
 *  presentation flags supplied by the caller, not fabricated from the trace. */
export function replayView(result: ReplayResult, options: { cached?: boolean; disclosed?: boolean } = {}): ReplayView {
  const frames = result.services;
  const finalFrame = frames[frames.length - 1];
  const preAttack = frames.find((frame) => frame.phase === "pre_attack");

  const hosts: HostView[] = Object.entries(result.levels)
    .map(([id, level]) => ({ id, level, ...LEVEL_VIEW[level] }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const services: ServiceView[] = Object.entries(finalFrame?.services ?? {})
    .map(([name, state]) => ({ name, state, causes: finalFrame?.causes?.[name] ?? [], ...swatchForService(state) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const devices: DeviceView[] = Object.entries(finalFrame?.devices ?? {})
    .map(([id, state]) => ({ id, state, ...DEVICE_VIEW[state] }))
    .sort((a, b) => a.id.localeCompare(b.id));

  // Pre-attack loss: a service already not "up" before any step is plan-induced.
  const planInducedServiceLoss: ServiceView[] = preAttack
    ? Object.entries(preAttack.services)
        .filter(([, state]) => state !== "up")
        .map(([name, state]) => ({ name, state, causes: preAttack.causes?.[name] ?? [], ...swatchForService(state) }))
        .sort((a, b) => a.name.localeCompare(b.name))
    : [];

  const blockedPreconditions: BlockedView[] = result.trace
    .filter((entry: TraceEntry) => entry.status === "blocked")
    .map((entry) => ({ t: entry.t, rule: entry.rule, node: entry.node, reason: entry.reason, blockers: entry.blockers }));

  return {
    cacheKey: result.cache_key,
    rulesVersion: String(result.summary.rules_version ?? ""),
    cached: options.cached ?? false,
    disclosed: options.disclosed ?? true,
    hosts,
    services,
    devices,
    planInducedServiceLoss,
    blockedPreconditions,
    assumptions: result.summary.assumptions ?? [],
    totals: {
      encryptedHosts: result.summary.encrypted_hosts?.length ?? 0,
      targetedOrgs: result.summary.targeted_orgs ?? [],
      servicesDown: result.summary.services_down ?? [],
      servicesOnPaper: result.summary.services_on_paper ?? [],
      medicalDevicesEncrypted: result.summary.medical_devices_encrypted ?? 0,
    },
  };
}
