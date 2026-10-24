// Watcher settings. Read from the environment, plus the repo's .env.local
// (TEAM_BRIEF setup). The server token and relay token stay in this process
// (AGENTS.md rule 13).

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const envFile = fileURLToPath(new URL("../../../.env.local", import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

export class ConfigError extends Error {}

function need(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new ConfigError(`${name} is not set (see docs/.env.example).`);
  return v;
}

export function loadConfig() {
  const port = Number(process.env.RELAY_PORT?.trim() || 8010);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new ConfigError("RELAY_PORT must be a port number.");
  return {
    stdbUri: need("STDB_URI"),
    stdbModule: process.env.STDB_MODULE?.trim() || process.env.NEXT_PUBLIC_STDB_MODULE?.trim() || "hippocratech",
    serverToken: need("STDB_SERVER_TOKEN"),
    coordinatorUrl: (process.env.COORDINATOR_URL?.trim() || "http://127.0.0.1:8004").replace(/\/+$/, ""),
    engineUrl: (process.env.ENGINE_URL?.trim() || "http://127.0.0.1:8000").replace(/\/+$/, ""),
    relayPort: port,
    relayToken: need("RELAY_TOKEN"),
  };
}

export type Config = ReturnType<typeof loadConfig>;
