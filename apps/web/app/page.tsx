"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import demo from "../../../data/hospitals/demo.json";
import { STDB_URI } from "@/lib/stdb/connection";
import { createSession } from "@/lib/stdb/create-session";

// Load screen (UX: "/"). Starting a session creates it in SpacetimeDB and
// opens it; the session page then offers the link to send to others.
// Upload JSON comes with packages/schema's validator.
export default function Home() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const h = demo.hospital;

  const start = async () => {
    setError(undefined);
    if (!STDB_URI) return router.push("/s/demo"); // the labeled mock, no server configured
    setBusy(true);
    try {
      router.push(`/s/${await createSession(JSON.stringify(demo))}`);
    } catch (e) {
      setError(`Couldn't start a session: ${(e as Error).message ?? e}`);
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-[720px] flex-col justify-center px-4 py-12">
      <div className="eyebrow">Hippocra.tech</div>
      <h1 className="mt-1 font-disp text-[28px] font-light">Load a hospital</h1>
      <p className="mt-1 text-[13px] text-ink-muted">
        Start a session, then send its link to your team. Everyone who joins watches the same simulation, live.
      </p>

      <div className="panel mt-6 p-5">
        <div className="eyebrow">Demo hospital</div>
        <b className="mt-1 block font-disp text-[17px]">{h.name}</b>
        <p className="num mt-1 text-[11px] text-ink-faint">
          {h.floors.length} floors · {h.rooms.length} rooms · {h.devices.length} devices · {h.services.length} services · synthetic
        </p>
        <button
          onClick={start}
          disabled={busy}
          className="num mt-4 rounded-[2px] border border-accent bg-accent px-4 py-2.5 text-[12px] font-semibold text-bg transition hover:brightness-110 disabled:opacity-50"
        >
          {busy ? "Starting…" : "Start session"}
        </button>
        {error && <p role="alert" className="num mt-2 text-[11px] text-ink-muted">{error}</p>}
      </div>

      <p className="num mt-6 text-[10.5px] text-ink-faint">
        All hospital data is synthetic. No field identifies a person; patient groups are counts.
      </p>
    </main>
  );
}
