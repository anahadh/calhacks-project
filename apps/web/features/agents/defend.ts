// Why Create aggregate fix can't be pressed yet. Pure, so it is tested on its
// own; defend-button.tsx renders it.

import { defendRefusal } from "@/lib/stdb/run-status";
import type { SessionSnapshot } from "@/lib/stdb/types";

/** The explicit mock's controls all refuse (rule 14). Say so before anyone presses. */
export const MOCK_REFUSAL = "Mock data: set NEXT_PUBLIC_STDB_URI to use a live session.";

export type DefendInputs = Pick<SessionSnapshot, "source" | "me" | "activeRun" | "runs" | "roundState">;

/**
 * Why Create aggregate fix would be refused, or null when it can be pressed.
 * Mirrors defend_request (rule 5): no run, a run still computing, failed or
 * playing, any session run busy (solution pairs included), or a round open.
 */
export function defendBlocker(s: DefendInputs): string | null {
  if (s.source === "mock") return MOCK_REFUSAL;
  return defendRefusal(s);
}
