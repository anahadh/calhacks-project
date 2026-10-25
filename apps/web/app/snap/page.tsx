"use client";

/* /snap?start=mri_2&infected=a,b: the real 3D hospital scene in one state, nothing around it.
   For screenshots that ASI:One cards show (agents/scripts/snap_scenes.py). Render-only: no
   subscription, no ticks; the infected set comes from the URL, which the engine computed. */
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { HospitalScene } from "@/components/scene/hospital-scene";
import { mockSession } from "@/lib/stdb/mock-session";
import { useSessionIndex } from "@/lib/stdb/use-session";
import { useRoleView } from "@/lib/role-views";
import type { Hospital, SessionSnapshot } from "@/lib/stdb/types";
import demo from "../../../../data/hospitals/demo.json";

function Snap() {
  const q = useSearchParams();
  const start = q.get("start") ?? "";
  const infected = useMemo(() => new Set((q.get("infected") ?? "").split(",").filter(Boolean)), [q]);
  const session: SessionSnapshot = useMemo(() => {
    const hospital = (demo as unknown as { hospital: Hospital }).hospital;
    const run = { ...mockSession.activeRun!, patientZero: start || mockSession.activeRun!.patientZero };
    return {
      ...mockSession,
      hospital,
      runs: start ? [run] : [],
      activeRunId: start ? run.id : "",
      activeRun: start ? run : undefined,
      devices: hospital.devices.map((d) =>
        infected.has(d.id) || d.id === start ? { deviceId: d.id, infected: true, infectedAtTick: 0 } : { deviceId: d.id, infected: false }),
      // Only the infection comes from the URL (the engine's numbers); services and patients
      // are shown untouched rather than borrowed from the mock run (rule 16).
      services: mockSession.services.map((x) => ({ serviceId: x.serviceId, down: false })),
      patients: mockSession.patients.map((x) => ({ groupId: x.groupId, state: "ok" as const })),
      attempts: [],
      events: [],
    };
  }, [start, infected]);
  const index = useSessionIndex(session);
  const view = useRoleView(session);
  const [hovered, setHovered] = useState<string | null>(null);
  return (
    <div style={{ width: "100vw", height: "100vh", background: "#0b0d0d" }}>
      <HospitalScene session={session} index={index} hovered={hovered} onHover={setHovered} view={view} />
    </div>
  );
}

export default function SnapPage() {
  return (
    <Suspense>
      <Snap />
    </Suspense>
  );
}
