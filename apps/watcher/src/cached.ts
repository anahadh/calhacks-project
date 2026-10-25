// The cached demo round (AGENTS.md rule 14's one exception, docs/hippocratech/CACHED_RUN.md).
// With CACHED_ROUND=1, Create aggregate fix replays agents/cache/demo_round.json into the
// session instead of waking the Sign-off Coordinator. The replay runs the agents' own
// scripts/replay_cached.py, so every row still goes through this relay (rule 10) and
// every message carries the "Cached run" label. Nothing here invents a row.

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const PYTHON = `${ROOT}agents/.venv/bin/python`;
const SCRIPT = `${ROOT}agents/scripts/replay_cached.py`;
const CACHE = `${ROOT}agents/cache/demo_round.json`;

export type CachedRound = { speed: number };

/** CACHED_ROUND=1 (or a speed, e.g. CACHED_ROUND=4) turns the cached round on; unset or 0 leaves the live agents in charge. */
export function cachedRoundConfig(): CachedRound | undefined {
  const raw = process.env.CACHED_ROUND?.trim();
  if (!raw || raw === "0" || raw.toLowerCase() === "false") return undefined;
  const n = Number(raw);
  return { speed: Number.isFinite(n) && n > 1 ? n : Number(process.env.CACHED_ROUND_SPEED?.trim() || 4) };
}

/** Why the cache can't be replayed, or null when it can. */
export function cachedRoundProblem(): string | null {
  if (!existsSync(CACHE)) return `no cached round at ${CACHE} (docs/hippocratech/CACHED_RUN.md)`;
  if (!existsSync(PYTHON)) return `no agents virtualenv at ${PYTHON}`;
  return null;
}

/** Replays the cache into a session; resolves when the last row is in, rejects with the script's error. */
export function replayCachedRound(sessionId: string, speed: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(PYTHON, [SCRIPT, "--session", sessionId, "--speed", String(speed)], { cwd: `${ROOT}agents`, env: process.env });
    let err = "";
    child.stdout.on("data", (c: Buffer) => process.stdout.write(`[cached] ${c.toString().trimEnd().split("\n").join("\n[cached] ")}\n`));
    child.stderr.on("data", (c: Buffer) => (err += c.toString()));
    child.on("error", (e) => reject(new Error(`couldn't start the replay: ${e.message}`)));
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(err.trim() || `replay exited with ${code}`))));
  });
}
