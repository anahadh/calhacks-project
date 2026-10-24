import { describe, expect, it } from "vitest";
import { lostReason, onConnectionLost } from "./connection";

describe("a dropped connection", () => {
  it("says so plainly, with the socket's reason when there is one", () => {
    expect(lostReason()).toBe("Lost the connection to SpacetimeDB. Reload the page to reconnect.");
    expect(lostReason(new Error("socket closed (1006)"))).toBe(
      "Lost the connection to SpacetimeDB: socket closed (1006). Reload the page to reconnect.",
    );
    expect(lostReason(new Error("Server went away."))).toBe(
      "Lost the connection to SpacetimeDB: Server went away. Reload the page to reconnect.",
    );
  });

  it("listeners can unsubscribe", () => {
    const off = onConnectionLost(() => {});
    expect(typeof off).toBe("function");
    off();
  });
});
