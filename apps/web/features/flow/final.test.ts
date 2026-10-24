import { describe, expect, it } from "vitest";
import { runRow } from "@/features/fixtures";
import { finalOf, notFinalYet, numbersCaption } from "./final";

// The engine's demo baseline holds patients affected at 0 until its final step
// (frames 0..14 read 0 x14 then 112), so a paused baseline's column is not its result.
const paused = runRow({ status: "paused", tick: 5, finalTick: 14, patientsAffected: 0 });
const done = runRow({ status: "done", tick: 14, finalTick: 14, patientsAffected: 112 });

describe("finalOf", () => {
  it("is the run only once it is done", () => {
    expect(finalOf(done)?.patientsAffected).toBe(112);
    expect(finalOf(paused)).toBeUndefined();
    expect(finalOf(runRow({ status: "running", tick: 13, finalTick: 14 }))).toBeUndefined();
    expect(finalOf(runRow({ status: "requested" }))).toBeUndefined();
    expect(finalOf(runRow({ status: "error", detail: "x" }))).toBeUndefined();
    expect(finalOf(undefined)).toBeUndefined();
  });
});

describe("notFinalYet", () => {
  it("says where the run is instead of a number", () => {
    expect(notFinalYet(paused)).toBe("paused at step 5 of 14");
    expect(notFinalYet(runRow({ status: "running", tick: 3, finalTick: 14 }))).toBe("playing, step 3 of 14");
    expect(notFinalYet(runRow({ status: "requested" }))).toBe("computing…");
    expect(notFinalYet(undefined)).toBe("computing…");
    expect(notFinalYet(runRow({ status: "error", detail: "x" }))).toBe("the run failed");
    expect(notFinalYet(done)).toBeNull();
  });
});

describe("numbersCaption", () => {
  it("labels live numbers by the step on screen until the run is done", () => {
    expect(numbersCaption(paused)).toBe("Numbers at step 5 of 14");
    expect(numbersCaption(done)).toBe("Final numbers");
    expect(numbersCaption(runRow({ status: "requested" }))).toBeUndefined();
    expect(numbersCaption(undefined)).toBeUndefined();
  });
});
