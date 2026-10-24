"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import demo from "../../../data/hospitals/demo.json";
import { Brand } from "@/components/shell/brand";
import { BuildingThumb } from "@/components/shell/building-thumb";
import { STDB_URI } from "@/lib/stdb/connection";
import { createSession } from "@/lib/stdb/create-session";
import type { Hospital } from "@/lib/stdb/types";

// Load screen (UX: "/"). Simulate attacks creates a session in SpacetimeDB and
// opens it; the session page then offers the link to send to others.
// Add hospital (Upload JSON) and Edit hospital wait for packages/schema's validator.
export default function Home() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const h = demo.hospital as unknown as Hospital;

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
    <div className="flex min-h-screen flex-col">
      <header className="flex min-h-14 items-center border-b border-line px-4 md:px-6">
        <Brand />
      </header>

      <main className="mx-auto flex w-full max-w-[880px] flex-col gap-12 px-4 pb-12 pt-12 md:px-6 md:pt-[72px]">
        <h1 className="m-0 text-center text-[32px] font-light leading-[38px] tracking-[-0.02em]">Run a simulation</h1>

        <section aria-labelledby="mine" className="flex flex-col gap-3">
          <h2 id="mine" className="eyebrow m-0">My hospitals</h2>

          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            <li className="flex flex-wrap items-center gap-x-5 gap-y-4 rounded-panel border border-line bg-panel py-3 pl-3 pr-4">
              <div className="flex h-28 w-24 flex-none items-center justify-center rounded-ctl border border-line bg-scene-ground">
                <BuildingThumb hospital={h} className="h-[98px] w-[76px]" />
              </div>
              <div className="flex min-w-0 flex-[999_1_220px] flex-col gap-1.5">
                <h3 className="m-0 text-[17px] font-normal leading-[22px]">{h.name}</h3>
                <span className="num text-xs text-ink-muted">
                  {h.floors.length} floors · {h.rooms.length} rooms · {h.devices.length} devices
                </span>
              </div>
              <div className="flex flex-[0_1_auto] flex-wrap gap-2">
                <button type="button" disabled title="Editing a hospital isn't built yet." className="btn">
                  Edit hospital
                </button>
                <button type="button" onClick={start} disabled={busy} className="btn btn-primary">
                  {busy ? "Starting…" : "Simulate attacks"}
                  <ArrowRight />
                </button>
              </div>
            </li>
          </ul>
          {error && <p role="alert" className="num m-0 text-xs text-ink-muted">{error}</p>}

          <button
            type="button"
            disabled
            title="Uploading a hospital JSON file comes with the schema validator."
            className="num flex min-h-14 w-full items-center justify-center gap-2.5 rounded-panel border border-dashed border-line2 bg-transparent text-[13px] text-ink enabled:hover:border-ink-faint disabled:cursor-not-allowed disabled:opacity-disabled"
          >
            <Plus />
            Add hospital
          </button>
        </section>
      </main>

      <footer className="num mt-auto flex flex-wrap gap-x-6 gap-y-2 border-t border-line px-4 py-4 text-xs text-ink-faint md:px-6">
        <span>Illustrative simulation. Spread rates are not measured from real incidents.</span>
        <span>All hospital data is synthetic. Patient groups are counts.</span>
      </footer>
    </div>
  );
}

function ArrowRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <path d="M3 8h10M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Plus() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
