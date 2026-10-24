"use client";

import { useState } from "react";
import type { SessionSnapshot } from "@/lib/stdb/types";
import { defendBlocker } from "./defend";

export { defendBlocker } from "./defend";

// Create aggregate fix: writes defend_request, and the round watcher wakes the
// Sign-off Coordinator. Disabled with the reducer's reason while it would be
// refused, e.g. while any session run is computing or playing (rule 5).
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
