"use client";

import { useEffect, useRef, useState } from "react";
import { ROLE_LABEL } from "@/lib/format";
import type { PresenceRow, SessionSnapshot } from "@/lib/stdb/types";
import { InviteLink } from "./invite";

const ROLES = Object.keys(ROLE_LABEL) as PresenceRow["role"][];
type Saved = { name: string; role: PresenceRow["role"] };

// Who you said you were in this session, so a reload rejoins without asking
// again (presence rows go away on disconnect). Per-browser convenience only.
const key = (sessionId: string) => `hippo.join.${sessionId}`;
function readSaved(sessionId: string): Saved | null {
  try {
    const v = JSON.parse(localStorage.getItem(key(sessionId)) ?? "null");
    return v && typeof v.name === "string" && (ROLES as string[]).includes(v.role) ? v : null;
  } catch {
    return null;
  }
}
function save(sessionId: string, v: Saved): void {
  try {
    localStorage.setItem(key(sessionId), JSON.stringify(v));
  } catch {
    // Private mode: you'll be asked again after a reload.
  }
}

// Join modal (UX: first visit to /s/[sessionId]): a name and a role, over the
// live session, plus the link to send to others. Writes presence_join; the
// role decides who may answer an agent's question and, later, who reviews.
export function JoinModal({ session, sessionId }: { session: SessionSnapshot; sessionId: string }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState<PresenceRow["role"] | null>(null);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const tried = useRef(false);
  const live = session.source === "live";

  // Rejoin with the saved name after a reload or reconnect.
  useEffect(() => {
    if (!live || session.me || tried.current) return;
    tried.current = true;
    const saved = readSaved(sessionId);
    if (!saved) return;
    setName(saved.name);
    setRole(saved.role);
    session.actions.join(saved.name, saved.role).catch((e: Error) => setError(e.message));
  }, [live, session.me, session.actions, sessionId]);

  if (!live || session.me) return null;
  // The presenter (whoever started the session) defaults to Security; people joining by link to Observer.
  const chosen = role ?? (session.isPresenter ? "security" : "observer");

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    setBusy(true);
    try {
      await session.actions.join(name, chosen);
      save(sessionId, { name: name.trim(), role: chosen });
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
        <p className="mt-1 text-[12px] text-ink-muted">
          Everyone in this session sees the same simulation and agent round, live.
          {session.presence.length > 0 && ` Here now: ${session.presence.map((p) => p.name).join(", ")}.`}
        </p>
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
              aria-pressed={chosen === r}
              onClick={() => setRole(r)}
              className={`num rounded-[2px] border px-2 py-1.5 text-[11.5px] ${
                chosen === r ? "border-accent bg-accent text-bg" : "border-line2 text-ink-muted hover:text-ink"
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
        {session.isPresenter && (
          <div className="mt-4 border-t border-line pt-4">
            <InviteLink sessionId={sessionId} />
          </div>
        )}
      </form>
    </div>
  );
}
