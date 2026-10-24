"use client";

import { useEffect, useRef, useState } from "react";
import { tickClock } from "@/lib/format";
import type { AnnotationRow, SessionSnapshot } from "@/lib/stdb/types";

const NOTE_MAX = 280; // spacetime/src/constants.ts TIMELINE_NOTE_MAX

/** Annotate mode toggle for the timeline's control row. */
export function AnnotateToggle({
  on, onChange, session,
}: { on: boolean; onChange: (on: boolean) => void; session: SessionSnapshot }) {
  const blocker =
    session.source !== "live" ? "Connect to SpacetimeDB to add notes."
    : !session.me ? "Join the session to add notes."
    : !session.activeRunId ? "Run the attack first. Notes mark a moment in a run."
    : null;
  return (
    <button
      aria-pressed={on}
      disabled={!!blocker}
      title={blocker ?? (on ? "Click anywhere on the timeline to add a note. Esc to stop." : "Add notes to the timeline")}
      onClick={() => onChange(!on)}
      className={`num rounded-md border px-2.5 py-1 text-[10.5px] disabled:cursor-not-allowed disabled:opacity-40 ${
        on ? "border-accent bg-accent font-semibold text-bg" : "border-line2 bg-panel2 text-ink-muted hover:text-ink"
      }`}
    >
      {on ? "Annotating · click the timeline" : "Annotate"}
    </button>
  );
}

/**
 * The notes layer over the timeline track: every note on the active run as a
 * marker (live for everyone, from annotation rows), and in annotate mode a
 * click anywhere on the track opens a pop-up to write one at that tick.
 */
export function TimelineNotes({
  session, span, annotating, onStop,
}: { session: SessionSnapshot; span: number; annotating: boolean; onStop: () => void }) {
  const layer = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<{ tick: number; text: string } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const pct = (tick: number) => `${(Math.min(tick, span) / span) * 100}%`;

  const notes = session.annotations
    .filter((a) => a.kind === "note" && a.runId === session.activeRunId && a.tick !== undefined)
    .sort((a, b) => a.tick! - b.tick!);

  // Esc closes the pop-up, then leaves annotate mode.
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

  return (
    <div ref={layer} className="pointer-events-none absolute inset-0 [&>*]:pointer-events-auto">
      {annotating && (
        <div
          role="button"
          aria-label="Click to add a note at this point"
          onClick={place}
          className="absolute inset-0 cursor-crosshair rounded bg-[var(--select-wash)] outline-dashed outline-1 outline-line2"
        />
      )}

      {notes.map((n) => (
        <button
          key={n.id}
          onClick={() => {
            setDraft(null);
            setOpenId(openId === n.id ? null : n.id);
          }}
          title={`${tickClock(n.tick!)} · ${n.authorName}: ${n.note}`}
          aria-label={`Note at ${tickClock(n.tick!)} by ${n.authorName}`}
          className="absolute top-[44px] z-10 -translate-x-1/2"
          style={{ left: pct(n.tick!) }}
        >
          <span className="block h-[7px] w-px translate-x-[6.5px] bg-ink-muted" />
          <span
            className={`num block max-w-[120px] truncate rounded-[2px] border px-1.5 py-px text-[9.5px] leading-[14px] ${
              openId === n.id ? "border-accent bg-accent text-bg" : "border-line2 bg-panel2 text-ink-muted hover:text-ink"
            }`}
          >
            ✎ {n.note}
          </span>
        </button>
      ))}

      {draft && (
        <Popover tick={draft.tick} pct={pct}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <div className="eyebrow">Note at {tickClock(draft.tick)} · tick {draft.tick}</div>
            <textarea
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
              placeholder="Write what you want everyone to see here"
              className="mt-1.5 w-full resize-none rounded-[2px] border border-line2 bg-panel2 px-2 py-1.5 text-[12.5px] text-ink outline-none focus:border-accent"
            />
            <div className="mt-1.5 flex items-center gap-2">
              <span className="num text-[10px] text-ink-faint">{draft.text.length}/{NOTE_MAX} · Enter saves</span>
              <button type="button" onClick={() => setDraft(null)} className="num ml-auto px-2 py-1 text-[11px] text-ink-muted hover:text-ink">
                Cancel
              </button>
              <button
                disabled={busy || !draft.text.trim()}
                className="num rounded-[2px] border border-accent bg-accent px-3 py-1 text-[11px] font-semibold text-bg disabled:opacity-50"
              >
                Add note
              </button>
            </div>
            {error && <p role="alert" className="num mt-1.5 text-[10.5px] text-ink-muted">{error}</p>}
          </form>
        </Popover>
      )}

      {open && (
        <Popover tick={open.tick!} pct={pct}>
          <div className="eyebrow">{tickClock(open.tick!)} · {open.authorName}</div>
          <p className="mt-1 whitespace-pre-wrap text-[12.5px] leading-snug text-ink">{open.note}</p>
          <div className="mt-2 flex items-center">
            {(open.mine || session.isPresenter) && (
              <button onClick={() => remove(open)} className="num text-[10.5px] text-ink-faint hover:text-ink">
                Delete note
              </button>
            )}
            <button onClick={() => setOpenId(null)} className="num ml-auto text-[10.5px] text-ink-muted hover:text-ink">
              Close
            </button>
          </div>
          {error && <p role="alert" className="num mt-1.5 text-[10.5px] text-ink-muted">{error}</p>}
        </Popover>
      )}
    </div>
  );
}

/** A small panel under the track, anchored at a tick and kept inside the rail. */
function Popover({ tick, pct, children }: { tick: number; pct: (t: number) => string; children: React.ReactNode }) {
  return (
    <div
      className="panel absolute top-[70px] z-30 w-[280px] p-3 shadow-2xl"
      style={{ left: `clamp(0px, calc(${pct(tick)} - 140px), calc(100% - 280px))` }}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}
