"use client";

// The live Agent Room for a round started from ASI:One chat. The orchestrator's
// chat reply links here. Read-only: the rows are the relayed agent messages,
// and humans still sign off in a session (rule 9).

import { useMemo } from "react";
import demo from "../../../../../data/hospitals/demo.json";
import { AgentRoomFrame, OptionCards } from "@/features/agents/agent-room";
import { SPEAKER_LABEL } from "@/features/agents/agents";
import { statusLine } from "@/features/agents/transcript";
import { ROLE_LABEL } from "@/lib/format";
import { STDB_URI } from "@/lib/stdb/connection";
import { useRoomRows } from "@/lib/stdb/room";
import type { RecommendationRow } from "@/lib/stdb/types";

type Named = { id: string; name: string };

const n = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

export function RoomView({ sessionId }: { sessionId: string }) {
  const names = useMemo(() => {
    const h = demo.hospital as unknown as { devices: Named[]; flows: { id: string; from: string; to: string; purpose?: string }[]; services: Named[] };
    return {
      device: new Map(h.devices.map((d) => [d.id, d])),
      flow: new Map(h.flows.map((f) => [f.id, f])),
      service: new Map(h.services.map((s) => [s.id, s])),
    } as const;
  }, []);
  if (!STDB_URI) return <Notice text="Not connected: set NEXT_PUBLIC_STDB_URI" />;
  return <Room sessionId={sessionId} names={names} />;
}

function Room({ sessionId, names }: { sessionId: string; names: Parameters<typeof AgentRoomFrame>[0]["names"] }) {
  const room = useRoomRows(sessionId);
  if (room.source === "error") return <Notice text={room.error ?? "Something went wrong."} />;
  const asked = room.messages.find((m) => m.type === "chat" && m.from === "asi1");
  return (
    <main className="min-h-screen bg-bg p-4">
      <AgentRoomFrame
        variant="page"
        title={asked ? `“${asked.reason}”` : "Agent round"}
        subtitle={
          <>
            Started on ASI:One · the orchestrator calls Inventory, Flow and Clinical Workflow · session {sessionId}
            {room.source === "connecting" && " · connecting…"}
          </>
        }
        messages={room.messages}
        agentStatus={room.agentStatus}
        roundState={room.roundState}
        status={statusLine(room.roundState, room.recommendations, room.messages.length > 0)}
        names={names}
        options={room.recommendations.length ? <OptionCards recs={room.recommendations} /> : undefined}
      />
    </main>
  );
}

function Notice({ text }: { text: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-bg p-6">
      <p className="num m-0 text-[15px] text-ink-muted">{text}</p>
    </main>
  );
}
