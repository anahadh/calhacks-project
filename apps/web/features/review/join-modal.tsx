"use client";

import { useEffect, useRef, useState } from "react";
import type { PresenceRow, SessionSnapshot } from "@/lib/stdb/types";
import { InviteLink } from "./invite";

// People join with a name only. Everyone gets the same role, so anyone in the
// session can answer an agent's question and create a segmentation plan.
// presence_join still takes a role, and it must be one question_answer allows.
const JOIN_ROLE: PresenceRow["role"] = "security";

// Your name in this session, so a reload rejoins without asking again
// (presence rows go away on disconnect). Per-browser convenience only.
const key = (sessionId: string) => `hippo.join.${sessionId}`;
function readSavedName(sessionId: string): string | null {
  try {
    const v = JSON.parse(localStorage.getItem(key(sessionId)) ?? "null");
    return v && typeof v.name === "string" && v.name.trim() ? v.name : null;
  } catch {
    return null;
  }
}
function saveName(sessionId: string, name: string): void {
  try {
    localStorage.setItem(key(sessionId), JSON.stringify({ name }));
  } catch {
    // Private mode: you'll be asked again after a reload.
  }
}

// Join modal (UX: first visit to /s/[sessionId]), over the live session.
// The person who started the session enters their name and gets the link to
// send; people arriving by that link enter their name and join.
export function JoinModal({ session, sessionId }: { session: SessionSnapshot; sessionId: string }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const tried = useRef(false);
  const live = session.source === "live";
  const creator = session.isPresenter;

  // Rejoin with the saved name after a reload or reconnect.
  useEffect(() => {
    if (!live || session.me || tried.current) return;
    tried.current = true;
    const saved = readSavedName(sessionId);
    if (!saved) return;
    setName(saved);
    session.actions.join(saved, JOIN_ROLE).catch((e: Error) => setError(e.message));
  }, [live, session.me, session.actions, sessionId]);

  if (!live || session.me) return null;

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    setBusy(true);
    try {
      await session.actions.join(name, JOIN_ROLE);
      saveName(sessionId, name.trim());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const here = session.presence.map((p) => p.name);

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-bg/60 p-4 backdrop-blur-sm">
      <form onSubmit={join} className="panel w-full max-w-[380px] p-5 shadow-2xl">
        <h2 className="font-disp text-[17px]">{creator ? "Your session is ready" : `Join ${session.hospital.name}`}</h2>
        <p className="mt-1 text-[12px] text-ink-muted">
          {creator
            ? "Enter your name, and send the link below to the people you want to watch with you."
            : "Everyone in this session sees the same simulation, live."}
          {here.length > 0 && ` Here now: ${here.join(", ")}.`}
        </p>

        <label htmlFor="join-name" className="eyebrow mt-4 block">Your name</label>
        <input
          id="join-name"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          className="num mt-1 w-full rounded-[2px] border border-line2 bg-panel2 px-2.5 py-2 text-[13px] text-ink outline-none focus:border-accent"
        />

        {creator && (
          <div className="mt-4">
            <InviteLink sessionId={sessionId} />
          </div>
        )}

        {error && <p className="num mt-2 text-[11px] text-ink-muted">{error}</p>}
        <button
          disabled={busy || !name.trim()}
          className="num mt-4 w-full rounded-[2px] border border-accent bg-accent px-3 py-2.5 text-[12px] font-semibold text-bg disabled:opacity-50"
        >
          {creator ? "Enter session" : "Join"}
        </button>
      </form>
    </div>
  );
}
