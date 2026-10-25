"use client";

import { useMemo, useState } from "react";
import demo from "../../../../data/hospitals/demo.json";
import { HospitalScene } from "@/components/scene/hospital-scene";
import { SceneBoundary } from "@/components/scene/scene-boundary";
import { HoleLines } from "@/features/solution/hole-lines";
import { SegmentBarriers } from "@/features/solution/segment-barriers";
import { functionalSegmentsOf, segmentOf } from "@/features/solution/segments";
import { useRoleView } from "@/lib/role-views";
import { mockSession } from "@/lib/stdb/mock-session";
import { useSessionIndex } from "@/lib/stdb/use-session";
import type { DeviceStateRow, Flow, Hospital, SessionSnapshot } from "@/lib/stdb/types";

// The hospital beside the scripted negotiation: the plan on the table, drawn the way the
// solution page draws it. Each new plan re-raises the barriers around the five networks,
// draws the feeds that plan reopened as lines on the floor, and shows fewer infected
// machines in Imaging. Scripted (demo-script.ts): the cuts are computed from the
// hospital file by the same partition the optimizer uses, not from a run.

const HOSPITAL = (demo as { hospital: Hospital }).hospital;
/** Where the attack from MRI 2 goes with no plan, and which machines a plan still lets it take, in order. */
const BASELINE_INFECTED = ["mri_2", "ws_img_1", "ws_img_2", "ws_rad_1", "ws_rad_2", "srv_file", "srv_ehr", "srv_dc", "ws_lab"];

export function DemoScene({ plan, infected }: { plan: number; infected: number }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const zones = useMemo(() => new Map(HOSPITAL.rooms.map((r) => [r.id, r.zone])), []);
  const seg = useMemo(() => new Map(HOSPITAL.devices.map((d) => [d.id, segmentOf(d, zones.get(d.roomId) ?? "")])), [zones]);

  // The plan's kept feeds: strict closes every HL7 and vendor feed between networks; plan 2 reopens
  // the ER and ICU stations' feeds; plan 3 the lab's. Lateral links stay cut in every plan.
  const kept = useMemo<Flow[]>(() => {
    const reopened = (f: Flow) => {
      const ends = [f.from, f.to];
      if (plan >= 2 && ends.some((d) => d === "ns_er" || d === "ns_icu")) return true;
      if (plan >= 3 && ends.some((d) => d === "ws_lab")) return true;
      return false;
    };
    return HOSPITAL.flows.filter((f) => {
      if (f.active === false) return false;
      if (seg.get(f.from) === seg.get(f.to)) return true;
      if (f.protocol === "smb" || f.protocol === "rdp") return false;
      if (f.protocol === "hl7" || (f.protocol === "other" && f.port !== 123)) return plan >= 1 ? reopened(f) : true;
      return true;
    });
  }, [plan, seg]);

  const rows = useMemo<DeviceStateRow[]>(
    () => BASELINE_INFECTED.slice(0, plan === 0 ? BASELINE_INFECTED.length : Math.min(infected, 5)).map((id, i) => ({ deviceId: id, infected: true, infectedAtTick: i })),
    [plan, infected],
  );
  const session = useMemo<SessionSnapshot>(
    () => ({ ...mockSession, hospital: HOSPITAL, source: "mock", devices: rows, services: [], patients: [], attempts: [], events: [], snapshots: [], activeRun: undefined, activeRunId: "" }),
    [rows],
  );
  const index = useSessionIndex(session);
  const view = useRoleView(session);
  const segments = useMemo(() => (plan >= 1 ? functionalSegmentsOf(HOSPITAL, rows) : []), [plan, rows]);
  const hl7 = useMemo(() => kept.filter((f) => f.protocol === "hl7" && seg.get(f.from) !== seg.get(f.to)), [kept, seg]);

  return (
    <div className="relative h-full w-full bg-scene-ground">
      <SceneBoundary session={session}>
        <HospitalScene session={session} index={index} hovered={hovered} onHover={setHovered} view={view} quiet>
          {plan >= 1 && (
            <group key={plan}>
              <SegmentBarriers hospital={HOSPITAL} segments={segments} litZone={null} />
              {segments.map((s) => (
                <HoleLines key={s.zone} hospital={HOSPITAL} kept={hl7} segmentOf={seg} litZone={s.zone} />
              ))}
            </group>
          )}
        </HospitalScene>
      </SceneBoundary>
      <span className="num pointer-events-none absolute bottom-3 left-4 text-[11px] text-ink-faint">
        {plan === 0 ? "No plan yet: where the attack from MRI 2 reaches" : `Plan ${plan} on the table · barriers between the five networks · teal lines are feeds reopened for care`}
      </span>
    </div>
  );
}
