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
      <header className="flex min-h-[72px] items-center border-b border-line px-6 md:px-8">
        <Brand />
      </header>

      <main className="mx-auto flex w-full max-w-[1100px] flex-col gap-16 px-4 pb-16 pt-20 md:px-6 md:pt-[104px]">
        <div className="flex items-center justify-center gap-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark.svg" alt="" aria-hidden width={96} height={120} />
          <h1 className="m-0 text-[40px] font-light leading-[48px] tracking-[-0.02em]">Run a simulation</h1>
        </div>

        <section aria-labelledby="mine" className="flex flex-col gap-4">
          <h2 id="mine" className="eyebrow m-0">My hospitals</h2>

          <ul className="m-0 flex list-none flex-col gap-4 p-0">
            <li className="flex flex-wrap items-center gap-x-6 gap-y-5 rounded-panel border border-line bg-panel p-5">
              <div className="flex h-36 w-[124px] flex-none items-center justify-center rounded-ctl border border-line bg-scene-ground">
                <BuildingThumb hospital={h} className="h-[120px] w-[96px]" />
              </div>
              <div className="flex min-w-0 flex-[999_1_240px] flex-col gap-2.5">
                <h3 className="m-0 text-[20px] font-normal leading-6">{h.name}</h3>
                <span className="num text-[14px] text-ink-muted">
                  {h.floors.length} floors · {h.rooms.length} rooms · {h.devices.length} devices
                </span>
              </div>
              <div className="flex flex-[0_1_auto] flex-wrap gap-3">
                <button type="button" disabled title="Editing a hospital isn't built yet." className="btn min-h-14 px-6 text-[15px]">
                  Edit hospital
                </button>
                <button type="button" onClick={start} disabled={busy} className="btn btn-primary min-h-14 px-6 text-[15px]">
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
            className="num flex min-h-[76px] w-full items-center justify-center gap-3 rounded-panel border border-dashed border-line2 bg-transparent text-[15px] text-ink enabled:hover:border-ink-faint disabled:cursor-not-allowed disabled:opacity-disabled"
          >
            <Plus />
            Add hospital
          </button>
        </section>
      </main>

      <footer className="num mt-auto border-t border-line px-6 py-5 text-[14px] text-ink-faint md:px-8">
        Illustrative simulation. Spread rates are not measured from real incidents.
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
