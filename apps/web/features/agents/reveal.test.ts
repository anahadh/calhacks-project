import { describe, expect, it } from "vitest";
import { REVEAL_MS, RevealClock } from "./reveal";

describe("RevealClock", () => {
  it("shows the thread this tab opened on at once", () => {
    const c = new RevealClock();
    c.observe([1, 2, 3], 1000);
    expect([1, 2, 3].every((s) => c.shown(s, 1000))).toBe(true);
    expect(c.waiting(1000)).toBe(0);
    expect(c.nextAt(1000)).toBeUndefined();
  });

  it("reveals rows that land later no faster than one per 1.2 s, in seq order", () => {
    const c = new RevealClock();
    c.observe([], 0); // the thread was empty when this tab opened it
    c.observe([5, 4, 6], 10_000); // three rows land together, out of order
    expect(c.shown(4, 10_000)).toBe(true);
    expect(c.shown(5, 10_000)).toBe(false);
    expect(c.nextAt(10_000)).toBe(10_000 + REVEAL_MS);
    expect(c.shown(5, 10_000 + REVEAL_MS)).toBe(true);
    expect(c.shown(6, 10_000 + REVEAL_MS)).toBe(false);
    expect(c.shown(6, 10_000 + 2 * REVEAL_MS)).toBe(true);
    expect(c.waiting(10_000)).toBe(2);
  });

  it("a row after a quiet spell shows as soon as it lands", () => {
    const c = new RevealClock();
    c.observe([1], 0);
    c.observe([1, 2], 5_000);
    expect(c.shown(2, 5_000)).toBe(true);
    c.observe([1, 2, 3], 5_100);
    expect(c.shown(3, 5_100)).toBe(false);
    expect(c.nextAt(5_100)).toBe(5_000 + REVEAL_MS);
  });

  it("is idempotent for the same rows, so a second render changes nothing", () => {
    const c = new RevealClock();
    c.observe([], 0);
    c.observe([1, 2], 100);
    c.observe([1, 2], 150);
    expect(c.nextAt(100)).toBe(100 + REVEAL_MS);
    expect(c.waiting(100)).toBe(1);
  });

  it("never shows a row it has not seen, and skip-ahead shows the backlog", () => {
    const c = new RevealClock();
    c.observe([], 0);
    expect(c.shown(9, 0)).toBe(false);
    c.observe([1, 2, 3], 100);
    c.flush(200);
    expect([1, 2, 3].every((s) => c.shown(s, 200))).toBe(true);
    c.observe([1, 2, 3, 4], 300);
    expect(c.shown(4, 300)).toBe(false);
    expect(c.shown(4, 200 + REVEAL_MS)).toBe(true);
  });
});
