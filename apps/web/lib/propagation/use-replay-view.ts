"use client";

import type { ReplayResult } from "./types";

// Two data sources for the view, both render-only (no browser ticks):
//  - OFFLINE: deterministic runs pre-generated into /public/propagation-runs/ by
//    engine/scripts/build_runs.py. Needs no server; demo-proof.
//  - LIVE: POST the chosen levers to a running `uvicorn sim_core.api:app`, which
//    replays server-side against the registered CUH scenario/campaign and returns
//    the same ReplayResult shape. The browser never simulates.

export type RunMeta = {
  key: string;
  label: string;
  description: string;
  group: "plan" | "single-lever" | "sensitivity";
  file: string;
  cache_key: string;
  encrypted_hosts: number;
  services_down: string[];
  services_on_paper: string[];
  blocked_steps: number;
};

export type RunIndex = { rules_version: string; runs: RunMeta[] };

const OFFLINE_BASE = "/propagation-runs";

export async function loadRunIndex(): Promise<RunIndex> {
  const response = await fetch(`${OFFLINE_BASE}/index.json`);
  if (!response.ok) throw new Error(`run index ${response.status}`);
  return (await response.json()) as RunIndex;
}

export async function loadRun(file: string): Promise<ReplayResult> {
  const response = await fetch(`${OFFLINE_BASE}/${file}`);
  if (!response.ok) throw new Error(`run ${file} ${response.status}`);
  return (await response.json()) as ReplayResult;
}

// The seven plan levers, as toggles for live mode.
export const LEVERS: { id: LeverId; label: string }[] = [
  { id: "segment_departments", label: "Segmentation" },
  { id: "patch_gateway", label: "Patch gateway" },
  { id: "cut_hse_trust", label: "Cut HSE trust" },
  { id: "tier_admin_accounts", label: "Tier admin accounts" },
  { id: "mfa_remote", label: "MFA on remote access" },
  { id: "edr_servers", label: "EDR on servers" },
  { id: "offline_backup", label: "Offline backup" },
];

export type LeverId =
  | "segment_departments"
  | "patch_gateway"
  | "cut_hse_trust"
  | "tier_admin_accounts"
  | "mfa_remote"
  | "edr_servers"
  | "offline_backup";

// Segmentation needs its zones + clinical allow-flows to have any effect; this is
// the illustrative plan's segment lever (engine/examples/cuh_plan.json). The other
// six levers carry no parameters.
const SEGMENT_LEVER = {
  id: "segment_departments",
  zones: { edge: ["edge"], vendor: ["vendor"], dc: ["dc"], rad: ["rad"], rt: ["rt"], lab: ["lab"], ed: ["ed"], theatre: ["theatre"], wards: ["wards"], opd: ["opd"], pharm: ["pharm"] },
  allow: [
    ["rad", "dc", "imaging"], ["rad", "dc", "directory"], ["rad", "edge", "imaging"],
    ["rt", "dc", "oncology"], ["rt", "dc", "directory"],
    ["lab", "dc", "app"], ["lab", "dc", "directory"],
    ["ed", "dc", "app"], ["ed", "dc", "directory"],
    ["theatre", "dc", "app"], ["theatre", "dc", "directory"],
    ["wards", "dc", "app"], ["wards", "dc", "directory"],
    ["opd", "dc", "app"], ["opd", "dc", "directory"], ["opd", "edge", "app"],
    ["pharm", "dc", "app"], ["pharm", "dc", "directory"], ["dc", "edge", "app"],
  ],
};

export function buildPlan(active: ReadonlySet<LeverId>) {
  return {
    plan_id: "ui-live",
    levers: LEVERS.filter((lever) => active.has(lever.id)).map((lever) =>
      lever.id === "segment_departments" ? SEGMENT_LEVER : { id: lever.id },
    ),
  };
}

export async function liveReplay(apiBase: string, active: ReadonlySet<LeverId>): Promise<ReplayResult> {
  const response = await fetch(`${apiBase.replace(/\/$/, "")}/replay`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ scenario_id: "cuh", campaign_id: "cuh-campaign", plan: buildPlan(active) }),
  });
  if (!response.ok) throw new Error(`server responded ${response.status}`);
  return (await response.json()) as ReplayResult;
}
