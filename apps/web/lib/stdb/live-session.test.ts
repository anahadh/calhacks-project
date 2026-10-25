import { describe, expect, it } from "vitest";
import { runQueries, sessionQueries } from "./live-session";

describe("subscription queries", () => {
  it("subscribes the session row and every session-scoped table", () => {
    expect(sessionQueries("demo")).toEqual([
      "SELECT * FROM session WHERE id = 'demo'",
      "SELECT * FROM run WHERE session_id = 'demo'",
      "SELECT * FROM presence WHERE session_id = 'demo'",
      "SELECT * FROM annotation WHERE session_id = 'demo'",
      "SELECT * FROM agent_message WHERE session_id = 'demo'",
      "SELECT * FROM agent_status WHERE session_id = 'demo'",
      "SELECT * FROM question WHERE session_id = 'demo'",
      "SELECT * FROM recommendation WHERE session_id = 'demo'",
      "SELECT * FROM my_device_card",
      "SELECT * FROM my_arcs",
    ]);
  });

  it("subscribes one run's row and its six row sets, solution pair ids included", () => {
    expect(runQueries("pair_demo_2_1_plan")).toEqual([
      "SELECT * FROM run WHERE id = 'pair_demo_2_1_plan'",
      ...["device_state", "service_state", "patient_state", "spread_attempt", "sim_event", "tick_snapshot"].map(
        (t) => `SELECT * FROM ${t} WHERE run_id = 'pair_demo_2_1_plan'`,
      ),
    ]);
  });

  it("builds no SQL from an unsafe id", () => {
    for (const id of ["", "x' OR '1'='1", "Demo", "a"]) expect(sessionQueries(id)).toEqual([]);
    for (const id of ["", "r' OR '1'='1", "run id", "x".repeat(129)]) expect(runQueries(id)).toEqual([]);
  });
});
