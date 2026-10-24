"use client";

// Keeps the demo alive when WebGL isn't available (a projector, a locked-down
// browser, a headless QA run): if the 3D scene throws, the rest of the page stays
// up and a 2D plan renders from the SAME subscribed rows (AGENTS.md rule 16 — the
// fallback computes nothing, it reads device/service state the watcher wrote).

import { Component, type ReactNode } from "react";
import type { SessionSnapshot } from "@/lib/stdb/types";

type Props = { session: SessionSnapshot; children: ReactNode };
type State = { failed: boolean };

export class SceneBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  render() {
    if (this.state.failed) return <Plan2D session={this.props.session} />;
    return this.props.children;
  }
}

/** A flat, dependency-free floor plan: rooms with their devices, colored by the
 *  live infected/down rows. Shown only when the 3D canvas can't start. */
function Plan2D({ session }: { session: SessionSnapshot }) {
  const { hospital } = session;
  const infected = new Set(session.devices.filter((d) => d.infected).map((d) => d.deviceId));
  const infectedAt = new Map(session.devices.map((d) => [d.deviceId, d.infectedAtTick ?? -1]));
  const down = new Set(session.services.filter((s) => s.down).map((s) => s.serviceId));
  const byRoom = new Map<string, typeof hospital.devices>();
  for (const dev of hospital.devices) byRoom.set(dev.roomId, [...(byRoom.get(dev.roomId) ?? []), dev]);

  return (
    <div className="absolute inset-0 overflow-auto p-4">
      <p className="mb-3 text-[11px] text-ink-muted">
        2D plan (3D view needs WebGL). Live rows: {infected.size} infected, {down.size} services down.
      </p>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {hospital.rooms.map((room) => {
          const devices = byRoom.get(room.id) ?? [];
          const hit = devices.filter((d) => infected.has(d.id)).length;
          return (
            <div
              key={room.id}
              className={`rounded-md border p-2 ${hit ? "border-state-infected/60" : "border-line"}`}
            >
              <div className="mb-1 flex items-baseline justify-between">
                <span className="text-[11px] font-medium text-ink">{room.name}</span>
                <span className="num text-[9.5px] uppercase tracking-wide text-ink-muted">{room.zone}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {devices.map((d) => {
                  const on = infected.has(d.id);
                  return (
                    <span
                      key={d.id}
                      title={`${d.name}${on ? ` — compromised at step ${infectedAt.get(d.id)}` : ""}`}
                      className={`num rounded px-1.5 py-0.5 text-[9.5px] ${
                        on ? "bg-state-infected text-white" : "bg-surface-raised text-ink-muted"
                      }`}
                    >
                      {d.name}
                    </span>
                  );
                })}
                {!devices.length && <span className="text-[9.5px] text-ink-muted">—</span>}
              </div>
            </div>
          );
        })}
      </div>
      {down.size > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-[10.5px] uppercase tracking-wide text-ink-muted">Services down</p>
          <div className="flex flex-wrap gap-1.5">
            {hospital.services
              .filter((s) => down.has(s.id))
              .map((s) => (
                <span key={s.id} className="num rounded bg-state-infected/15 px-2 py-0.5 text-[10.5px] text-state-infected">
                  {s.name}
                </span>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
