// UX rule 5: agent messages reveal no faster than one every 1.2 seconds, so a
// judge can read each one. This paces display only: every bubble is still one
// agent_message row, shown in seq order, and nothing is invented, merged or
// dropped. Rows that were already there when this tab opened the thread show at
// once (a late joiner reads the history, not a replay). Pure, so it is tested on
// its own; agent-room.tsx drives it.

/** The shortest gap between two messages appearing. */
export const REVEAL_MS = 1200;

/**
 * Remembers when this tab shows each message. observe() is idempotent for the
 * same rows, which keeps it safe to call on every render (React may render twice).
 */
export class RevealClock {
  /** seq → when it shows. -Infinity for rows shown at once. */
  private at = new Map<number, number>();
  /** When the latest scheduled message shows. */
  private last = -Infinity;
  private started = false;

  /** Schedules every seq not seen before, in seq order, each at least REVEAL_MS after the one before. */
  observe(seqs: readonly number[], now: number): void {
    const fresh = [...new Set(seqs)].filter((s) => !this.at.has(s)).sort((a, b) => a - b);
    if (!this.started) {
      // The thread as this tab first saw it: history, shown at once.
      this.started = true;
      for (const s of fresh) this.at.set(s, -Infinity);
      return;
    }
    for (const s of fresh) {
      const t = Math.max(now, this.last + REVEAL_MS);
      this.at.set(s, t);
      this.last = t;
    }
  }

  /** Whether this message is on screen at `now`. A seq never observed is not. */
  shown(seq: number, now: number): boolean {
    const t = this.at.get(seq);
    return t !== undefined && t <= now;
  }

  /** When this tab showed (or will show) a message; -Infinity for history shown at once; undefined when never observed. */
  shownAt(seq: number): number | undefined {
    return this.at.get(seq);
  }

  /** How many observed messages are still waiting at `now`. */
  waiting(now: number): number {
    let n = 0;
    for (const t of this.at.values()) if (t > now) n++;
    return n;
  }

  /** When the next waiting message shows, or undefined when none is waiting. */
  nextAt(now: number): number | undefined {
    let next: number | undefined;
    for (const t of this.at.values()) if (t > now && (next === undefined || t < next)) next = t;
    return next;
  }

  /** Show everything observed now (the reader asked to skip ahead). Later rows are paced from here. */
  flush(now: number): void {
    for (const [s, t] of this.at) if (t > now) this.at.set(s, now);
    this.last = now;
  }
}
