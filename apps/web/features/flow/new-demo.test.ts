import { describe, expect, it } from "vitest";
import { isNextDemo, newDemoId, presenterQuery, sessionPath, type SessionStamp } from "./new-demo";

const HEX = "c2000c060e92855a7e628bc2a4b510db167f9fd5bb7352b4dc77d3d0398e1099";

describe("newDemoId", () => {
  it("passes the module's session id rule", () => {
    const id = newDemoId(Date.UTC(2026, 9, 24, 21, 0));
    expect(id).toMatch(/^demo-[a-z0-9]+$/);
    expect(id).toMatch(/^[a-z0-9_-]{2,40}$/);
    expect(newDemoId(1)).not.toBe(newDemoId(2));
  });
  it("opens at /s/<id>", () => {
    expect(sessionPath("demo-abc")).toBe("/s/demo-abc");
  });
});

describe("presenterQuery", () => {
  it("subscribes to the presenter's sessions by identity", () => {
    expect(presenterQuery(HEX)).toBe(`SELECT * FROM session WHERE presenter = 0x${HEX}`);
    expect(presenterQuery(`0x${HEX}`)).toBe(`SELECT * FROM session WHERE presenter = 0x${HEX}`);
  });
  it("puts nothing but 64 hex digits into the SQL", () => {
    expect(presenterQuery("")).toBeNull();
    expect(presenterQuery(`${HEX.slice(2)}' OR 1=1 --`)).toBeNull();
    expect(presenterQuery(HEX.slice(1))).toBeNull();
  });
});

describe("isNextDemo", () => {
  const here: SessionStamp = { id: "demo", presenterHex: HEX, createdMicros: 1_000n };
  const next: SessionStamp = { id: "demo-mh5k2x9a", presenterHex: HEX, createdMicros: 2_000n };

  it("follows a newer session by the same presenter", () => {
    expect(isNextDemo(next, here, new Set(["demo"]))).toBe(true);
  });
  it("never follows this session, an older one, another presenter's, or one already known", () => {
    expect(isNextDemo(here, here, new Set())).toBe(false);
    expect(isNextDemo({ ...next, createdMicros: 500n }, here, new Set())).toBe(false);
    expect(isNextDemo({ ...next, presenterHex: "ab".repeat(32) }, here, new Set())).toBe(false);
    expect(isNextDemo(next, here, new Set(["demo", "demo-mh5k2x9a"]))).toBe(false);
  });
});
