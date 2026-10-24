import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Piece-local tests for the web data layer: pure functions over fixture rows,
// with no server, no browser and no other package's internals.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: { include: ["lib/*.test.ts", "lib/stdb/**/*.test.ts"], environment: "node" },
});
