"use client";

import { useEffect, useRef, useState } from "react";
import { ROLE_LABEL, tickClock } from "@/lib/format";
import type { AnnotationRow, SessionSnapshot } from "@/lib/stdb/types";

const NOTE_MAX = 280; // spacetime/src/constants.ts TIMELINE_NOTE_MAX

/** Add note, on the timeline's control row. While on, a click on the track writes a note there. */
export function AddNoteButton({
  on, onChange, session,
}: { on: boolean; onChange: (on: boolean) => void; session: SessionSnapshot }) {
  const blocker =
    session.source !== "live" ? "Connect to SpacetimeDB to add notes."
    : !session.me ? "Join the session to add notes."
    : !session.activeRunId ? "Run the attack first. Notes mark a moment in a run."
    : null;
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={!!blocker}
      title={blocker ?? (on ? "Click anywhere on the timeline to add a note. Esc to stop." : "Add a note to the timeline")}
      onClick={() => onChange(!on)}
      className="ctl ctl-lg num px-4 text-[13px]"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
        <path d="M3 3h10v7H8l-3 3v-3H3z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      </svg>
      {on ? "Click the timeline" : "Add note"}
    </button>
  );
}

/**
 * Notes on the selected run, as ▼ markers in the 14px row above the scrubber
 * (live for everyone, from annotation rows). Hover shows the note; a click
 * opens it. In add-note mode a click anywhere on the track writes one there.
 */
export function TimelineNotes({
  session, span, annotating, onStop,
}: { session: SessionSnapshot; span: number; annotating: boolean; onStop: () => void }) {
  const layer = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<{ tick: number; text: string } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const pct = (tick: number) => `${(Math.min(tick, span) / span) * 100}%`;

  const notes = session.annotations
    .filter((a) => a.kind === "note" && a.runId === session.activeRunId && a.tick !== undefined)
    .sort((a, b) => a.tick! - b.tick!);

  // Esc closes the pop-up, then leaves add-note mode.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (draft || openId) {
        setDraft(null);
        setOpenId(null);
      } else if (annotating) onStop();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [draft, openId, annotating, onStop]);

  useEffect(() => {
    if (!annotating) setDraft(null);
  }, [annotating]);

  const place = (e: React.MouseEvent) => {
    const box = layer.current!.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (e.clientX - box.left) / box.width));
    setOpenId(null);
    setError(undefined);
    setDraft({ tick: Math.round(frac * span), text: "" });
  };

  const save = async () => {
    if (!draft || !draft.text.trim()) return;
    setBusy(true);
    setError(undefined);
    try {
      await session.actions.addNote(draft.tick, draft.text);
      setDraft(null);
      onStop();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (a: AnnotationRow) => {
    try {
      await session.actions.clearFocus(a.id);
      setOpenId(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const open = notes.find((n) => n.id === openId);
  const hover = !open && !draft ? notes.find((n) => n.id === hoverId) : undefined;

  return (
    <div ref={layer} className="pointer-events-none absolute inset-0 [&>*]:pointer-events-auto">
      {annotating && (
        <button
          type="button"
          aria-label="Click to add a note at this point"
          onClick={place}
          className="absolute -inset-y-1 inset-x-0 cursor-crosshair rounded-ctl bg-select-wash outline-dashed outline-1 outline-line2"
        />
      )}

      {notes.map((n) => (
        <button
          key={n.id}
          type="button"
          onClick={() => {
            setDraft(null);
            setOpenId(openId === n.id ? null : n.id);
          }}
          onMouseEnter={() => setHoverId(n.id)}
          onMouseLeave={() => setHoverId(null)}
          onFocus={() => setHoverId(n.id)}
          onBlur={() => setHoverId(null)}
          aria-label={`Note at ${tickClock(n.tick!)} by ${n.authorName}: ${n.note}`}
          className="absolute -top-1.5 z-10 flex h-[22px] w-5 -translate-x-1/2 items-end justify-center"
          style={{ left: pct(n.tick!) }}
        >
          <svg width="10" height="8" viewBox="0 0 10 8" aria-hidden>
            <path d="M0 0h10L5 8z" fill={openId === n.id ? "#E9ECEE" : "#A1A8AE"} />
          </svg>
        </button>
      ))}

      {hover && (
        <div
          role="tooltip"
          className="pointer-events-none absolute bottom-5 z-30 flex w-[260px] -translate-x-1/2 flex-col gap-1.5 rounded-ctl border border-line2 bg-panel2 p-3"
          style={{ left: `clamp(130px, ${pct(hover.tick!)}, calc(100% - 130px))` }}
        >
          <NoteByline note={hover} />
          <span className="text-sm leading-[21px] text-ink">{hover.note}</span>
        </div>
      )}

      {draft && (
        <Popover tick={draft.tick} pct={pct}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <label htmlFor="note-draft" className="num block text-xs text-ink-muted">
              Note at {tickClock(draft.tick)}
            </label>
            <textarea
              id="note-draft"
              autoFocus
              rows={3}
              maxLength={NOTE_MAX}
              value={draft.text}
              onChange={(e) => setDraft({ ...draft, text: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  save();
                }
              }}
              placeholder="What should everyone notice here?"
              className="mt-1.5 w-full resize-none rounded-ctl border border-line2 bg-panel2 px-2.5 py-2 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-ink"
            />
            <div className="mt-2 flex items-center gap-2">
              <span className="num text-[11px] text-ink-faint">{draft.text.length}/{NOTE_MAX} · Enter saves</span>
              <button type="button" onClick={() => setDraft(null)} className="num ml-auto min-h-9 px-2 text-xs text-ink-muted hover:text-ink">
                Cancel
              </button>
              <button disabled={busy || !draft.text.trim()} className="btn btn-primary min-h-9 px-3 text-xs">
                Add note
              </button>
            </div>
            {error && <p role="alert" className="num mt-1.5 text-[11px] text-ink-muted">{error}</p>}
          </form>
        </Popover>
      )}

      {open && (
        <Popover tick={open.tick!} pct={pct}>
          <NoteByline note={open} />
          <p className="mt-1.5 whitespace-pre-wrap text-sm leading-[21px] text-ink">{open.note}</p>
          <div className="mt-2 flex items-center">
            {(open.mine || session.isPresenter) && (
              <button type="button" onClick={() => remove(open)} className="num min-h-9 text-xs text-ink-faint hover:text-ink">
                Delete note
              </button>
            )}
            <button type="button" onClick={() => setOpenId(null)} className="num ml-auto min-h-9 text-xs text-ink-muted hover:text-ink">
              Close
            </button>
          </div>
          {error && <p role="alert" className="num mt-1.5 text-[11px] text-ink-muted">{error}</p>}
        </Popover>
      )}
    </div>
  );
}

function NoteByline({ note }: { note: AnnotationRow }) {
  return (
    <span className="num text-xs text-ink-muted">
      <span className="text-ink">▼</span> {note.authorName} · {ROLE_LABEL[note.role]} · {tickClock(note.tick!)}
    </span>
  );
}

/** A small panel under the track, anchored at a tick and kept inside the rail. */
function Popover({ tick, pct, children }: { tick: number; pct: (t: number) => string; children: React.ReactNode }) {
  return (
    <div
      className="absolute top-[78px] z-30 w-[300px] rounded-panel border border-line2 bg-panel2 p-3 shadow-overlay"
      style={{ left: `clamp(0px, calc(${pct(tick)} - 150px), calc(100% - 300px))` }}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}
