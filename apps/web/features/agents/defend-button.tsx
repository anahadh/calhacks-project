"use client";

import { useState } from "react";
import type { SessionSnapshot } from "@/lib/stdb/types";

/** Why Create aggregate fix can't be pressed right now, or null when it can (spec 7.4). */
export function defendBlocker(session: SessionSnapshot): string | null {
  const run = session.runs.find((r) => r.id === session.activeRunId);
  if (session.source === "mock") return "Connect to SpacetimeDB to create an aggregate fix.";
  if (!session.me) return "Join the session first.";
  if (!run) return "Run the attack first.";
  if (run.status === "running") return "Agents wait until the run finishes or is paused.";
  const { state } = session.roundState;
  if (state === "running" || state === "waiting_for_human") return "An aggregate fix is being negotiated.";
  return null;
}

// Create aggregate fix: writes defend_request, and the round watcher wakes the
// Sign-off Coordinator. Disabled while a visible run is running (rule 5).
export function DefendButton({ session, onDone }: { session: SessionSnapshot; onDone?: () => void }) {
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const blocker = defendBlocker(session);

  const press = async () => {
    setError(undefined);
    setBusy(true);
    try {
      await session.actions.defend();
      onDone?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <button
        onClick={press}
        disabled={!!blocker || busy}
        title={blocker ?? undefined}
        className="num w-full rounded-[7px] border border-accent bg-accent px-3 py-2.5 text-[11.5px] font-semibold text-bg transition hover:brightness-110 disabled:cursor-not-allowed disabled:border-line2 disabled:bg-transparent disabled:text-ink-faint"
      >
        Create aggregate fix
      </button>
      {(error || blocker) && <p className="num mt-1.5 text-[10.5px] leading-snug text-ink-faint">{error ?? blocker}</p>}
    </div>
  );
}
