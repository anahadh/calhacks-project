// TypeScript mirror of the engine's ReplayResult contract
// (engine/sim_core/schema.py). These are deliberately SEPARATE from the live
// SpacetimeDB row shapes in ../stdb/types.ts: the five-level propagation state,
// paper/down services and dependency_outage devices must never be coerced into
// the existing infected/down booleans. This adapter only renders replay output.

export type Level = "clean" | "footholded" | "cred_holder" | "controlled" | "encrypted";
export type ServiceState = "up" | "paper" | "down";
export type DeviceState = "operational" | "dependency_outage";
export type TraceStatus = "applied" | "blocked" | "no_change" | "observation";
export type Provenance = "R" | "P" | "I" | "S";

export type Blocker = {
  code: string;
  detail: string;
  levers: string[];
};

export type TraceEntry = {
  t: string;
  rule: string;
  technique_label: string;
  node: string | null;
  from_level: string | null;
  to_level: string | null;
  reason: string;
  status: TraceStatus;
  blockers: Blocker[];
  source: string | null;
  account: string | null;
  event_index: number | null;
};

export type ServiceFrame = {
  t: string;
  phase: "pre_attack" | "post_step";
  services: Record<string, ServiceState>;
  devices: Record<string, DeviceState>;
  causes: Record<string, string[]>;
};

export type EventEffect = {
  event_index: number;
  t: string;
  rule: string;
  target: string | null;
  level_changes: Record<string, [string, string]>;
  creds_added: string[];
  creds_removed: string[];
  privileges_added: string[];
  domains_added: string[];
};

export type Assumption = {
  id: string;
  statement: string;
  provenance: Provenance;
};

export type OrgOutcome = {
  encrypted_hosts: number;
  eligible_hosts: number;
  encrypted_share: number | null;
};

export type ReplaySummary = {
  rules_version?: string;
  encrypted_hosts?: string[];
  targeted_orgs?: string[];
  services_down?: string[];
  services_on_paper?: string[];
  medical_devices_encrypted?: number;
  corrupted_backups?: string[];
  offline_backups?: string[];
  orgs?: Record<string, OrgOutcome>;
  blocked_steps?: unknown[];
  assumptions?: Assumption[];
  [key: string]: unknown;
};

export type ReplayResult = {
  cache_key: string;
  trace: TraceEntry[];
  services: ServiceFrame[];
  levels: Record<string, Level>;
  summary: ReplaySummary;
  event_effects: EventEffect[];
};
