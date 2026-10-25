import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Piece-local tests for the web piece: the data layer (lib/) and the UI's pure
// helpers (features/), each over fixture rows, with no server, no browser and
// no other package's internals.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: { include: ["lib/*.test.ts", "lib/stdb/**/*.test.ts", "features/**/*.test.ts", "components/**/*.test.ts"], environment: "node" },
});
