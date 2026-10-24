"use client";

import { useState } from "react";
import { ROLE_LABEL } from "@/lib/format";
import type { PresenceRow, SessionSnapshot } from "@/lib/stdb/types";

const ROLES = Object.keys(ROLE_LABEL) as PresenceRow["role"][];

// Join modal (UX: first visit to /s/[sessionId]): a name and a role, over the
// live session. Writes presence_join; the role decides who may answer an
// agent's question and, later, who reviews.
export function JoinModal({ session }: { session: SessionSnapshot }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState<PresenceRow["role"]>("security");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  if (session.source !== "live" || session.me) return null;

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    setBusy(true);
    try {
      await session.actions.join(name, role);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-bg/60 p-4 backdrop-blur-sm">
      <form onSubmit={join} className="panel w-full max-w-[360px] p-5 shadow-2xl">
        <h2 className="font-disp text-[17px]">Join {session.hospital.name}</h2>
        <p className="mt-1 text-[12px] text-ink-muted">Everyone in the session sees the same simulation and agent round.</p>
        <label className="eyebrow mt-4 block">Name</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          className="num mt-1 w-full rounded-[2px] border border-line2 bg-panel2 px-2.5 py-2 text-[13px] text-ink outline-none focus:border-accent"
        />
        <label className="eyebrow mt-3 block">Role</label>
        <div className="mt-1 grid grid-cols-2 gap-1.5">
          {ROLES.map((r) => (
            <button
              type="button"
              key={r}
              aria-pressed={role === r}
              onClick={() => setRole(r)}
              className={`num rounded-[2px] border px-2 py-1.5 text-[11.5px] ${
                role === r ? "border-accent bg-accent text-bg" : "border-line2 text-ink-muted hover:text-ink"
              }`}
            >
              {ROLE_LABEL[r]}
            </button>
          ))}
        </div>
        {error && <p className="num mt-2 text-[11px] text-ink-muted">{error}</p>}
        <button
          disabled={busy || !name.trim()}
          className="num mt-4 w-full rounded-[2px] border border-accent bg-accent px-3 py-2.5 text-[12px] font-semibold text-bg disabled:opacity-50"
        >
          Join
        </button>
      </form>
    </div>
  );
}
