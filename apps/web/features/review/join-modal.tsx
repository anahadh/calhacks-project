"use client";

import { useEffect, useRef, useState } from "react";
import { ROLE_LABEL, ROLE_OPTIONS, type JoinRole } from "@/lib/role-views";
import type { SessionSnapshot } from "@/lib/stdb/types";
import { RoleBadge } from "./role-badge";
import { InviteLink } from "./invite";

// People join with a name and a role. The role picks their lens on the scene
// (role views) and decides which agent questions they can answer and which
// sign-offs are theirs: the three choices map to the module's role ids.

// Your name and role in this session, so a reload rejoins without asking again
// (presence rows go away on disconnect). Per-browser convenience only.
const key = (sessionId: string) => `hippo.join.${sessionId}`;
const isJoinRole = (r: unknown): r is JoinRole => ROLE_OPTIONS.some((o) => o.id === r);
function readSaved(sessionId: string): { name: string; role?: JoinRole } | null {
  try {
    const v = JSON.parse(localStorage.getItem(key(sessionId)) ?? "null");
    if (!v || typeof v.name !== "string" || !v.name.trim()) return null;
    return { name: v.name, role: isJoinRole(v.role) ? v.role : undefined };
  } catch {
    return null;
  }
}
function save(sessionId: string, name: string, role: JoinRole): void {
  try {
    localStorage.setItem(key(sessionId), JSON.stringify({ name, role }));
  } catch {
    // Private mode: you'll be asked again after a reload.
  }
}

// Join modal (UX: first visit to /s/[sessionId]), over the live session.
// The person who started the session enters their name and gets the link to
// send; people arriving by that link enter their name and join.
export function JoinModal({ session, sessionId }: { session: SessionSnapshot; sessionId: string }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState<JoinRole>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const tried = useRef(false);
  const live = session.source === "live";
  const creator = session.isPresenter;

  // Rejoin with the saved name and role after a reload or reconnect. A name
  // saved before roles existed is filled in, and the picker asks for the role.
  useEffect(() => {
    if (!live || session.me || tried.current) return;
    tried.current = true;
    const saved = readSaved(sessionId);
    if (!saved) return;
    setName(saved.name);
    if (!saved.role) return;
    setRole(saved.role);
    session.actions.join(saved.name, saved.role).catch((e: Error) => setError(e.message));
  }, [live, session.me, session.actions, sessionId]);

  if (!live || session.me) return null;

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!role) return;
    setError(undefined);
    setBusy(true);
    try {
      await session.actions.join(name, role);
      save(sessionId, name.trim(), role);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const here = session.presence;

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-bg/60 p-4 backdrop-blur-sm">
      <form onSubmit={join} className="panel w-full max-w-[380px] p-5 shadow-2xl">
        <h2 className="font-disp text-[17px]">{creator ? "Your session is ready" : `Join ${session.hospital.name}`}</h2>
        <p className="mt-1 text-[12px] text-ink-muted">
          {creator
            ? "Enter your name, and send the link below to the people you want to watch with you."
            : "Everyone in this session sees the same simulation, live."}
        </p>
        {here.length > 0 && (
          <p className="num mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-ink-muted">
            Here now:
            {here.map((p, i) => (
              <span key={`${p.name}-${i}`} className="inline-flex items-center gap-1 text-ink">
                {p.name} <RoleBadge role={p.role} />
              </span>
            ))}
          </p>
        )}

        <label htmlFor="join-name" className="eyebrow mt-4 block">Your name</label>
        <input
          id="join-name"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          className="num mt-1 w-full rounded-[2px] border border-line2 bg-panel2 px-2.5 py-2 text-[13px] text-ink outline-none focus:border-accent"
        />

        <fieldset className="mt-4">
          <legend className="eyebrow">Your role</legend>
          <div className="mt-1 flex flex-col gap-1.5">
            {ROLE_OPTIONS.map((o) => (
              <label
                key={o.id}
                className={`num flex cursor-pointer items-center gap-2.5 rounded-[2px] border px-2.5 py-2 text-[12.5px] ${
                  role === o.id ? "border-accent text-ink" : "border-line2 text-ink-muted hover:text-ink"
                }`}
              >
                <input
                  type="radio"
                  name="join-role"
                  value={o.id}
                  checked={role === o.id}
                  onChange={() => setRole(o.id)}
                  required
                  className="accent-[#E9ECEE]"
                />
                {ROLE_LABEL[o.id]}
              </label>
            ))}
          </div>
        </fieldset>

        {creator && (
          <div className="mt-4">
            <InviteLink sessionId={sessionId} />
          </div>
        )}

        {error && <p className="num mt-2 text-[11px] text-ink-muted">{error}</p>}
        <button
          disabled={busy || !name.trim() || !role}
          className="num mt-4 w-full rounded-[2px] border border-accent bg-accent px-3 py-2.5 text-[12px] font-semibold text-bg disabled:opacity-50"
        >
          {creator ? "Enter session" : "Join"}
        </button>
      </form>
    </div>
  );
}
