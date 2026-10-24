import { describe, expect, it } from "vitest";
import { NOT_CONNECTED, sessionMode, useRunRows, useSession } from "./use-session";

describe("sessionMode", () => {
  it("serves the mock only when asked for it", () => {
    expect(sessionMode({ mock: "1", uri: "ws://127.0.0.1:3000" })).toBe("mock");
    expect(sessionMode({ mock: "1" })).toBe("mock");
    expect(sessionMode({ mock: "0", uri: "ws://127.0.0.1:3000" })).toBe("live");
    expect(sessionMode({ uri: "ws://127.0.0.1:3000" })).toBe("live");
  });

  it("is an error, not a fallback, without a SpacetimeDB host", () => {
    expect(sessionMode({})).toBe("error");
    expect(sessionMode({ mock: "", uri: "" })).toBe("error");
  });
});

// This test process sets neither NEXT_PUBLIC_MOCK nor NEXT_PUBLIC_STDB_URI.
describe("without a host", () => {
  it("shows the error and refuses every control", async () => {
    const s = useSession("demo");
    expect(s).toMatchObject({ source: "error", error: NOT_CONNECTED, runs: [], activeRunId: "", devices: [] });
    expect(s.hospital.devices).toEqual([]);
    await expect(s.actions.startRun("mri_2")).rejects.toThrow(NOT_CONNECTED);
    const rows = useRunRows("run_x");
    expect(rows).toMatchObject({ source: "error", error: NOT_CONNECTED, devices: [] });
    expect(rows.run).toBeUndefined();
  });
});
