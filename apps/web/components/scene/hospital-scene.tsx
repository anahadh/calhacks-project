"use client";

import { useMemo, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import { SpreadFx } from "@/features/scene/spread-fx";
import { SpreadTracker, stoppedAt, type Toast } from "@/features/scene/spread-timing";
import type { SessionIndex } from "@/lib/stdb/use-session";
import type { SessionSnapshot } from "@/lib/stdb/types";
import { C } from "@/lib/colors";
import { arcPoint, NetworkArc, type Arc, type Vec3 } from "./arcs";
import { FloorSlab, RoomShell } from "./building";
import { DeviceBox } from "./devices";
import { RoomChip } from "./labels";
import { PatientFigures } from "./patients";
import { bounds, centroid, to3 } from "./space";

/** Step 1: the presenter picks patient zero among the devices the engine accepts (session.entry_points_json). */
export type ScenePick = { eligible: ReadonlySet<string>; selected?: string; onPick?: (deviceId: string) => void };

// The live building for one run: session.activeRun and its rows (the solution
// view passes each side of the pair the same way). Renders rows only.
export function HospitalScene({
  session,
  index,
  hovered,
  onHover,
  pick,
  compact,
}: {
  session: SessionSnapshot;
  index: SessionIndex;
  hovered: string | null;
  onHover: (id: string | null) => void;
  pick?: ScenePick;
  /** Half-width (the solution view): the camera stands further back. */
  compact?: boolean;
}) {
  const { hospital } = session;
  const run = session.activeRun;

  const floorLevel = useMemo(() => new Map(hospital.floors.map((f) => [f.id, f.level])), [hospital.floors]);
  const levelOfDevice = (id: string) => {
    const d = index.device.get(id);
    const r = d && index.room.get(d.roomId);
    return r ? floorLevel.get(r.floorId) ?? 0 : 0;
  };
  const devicePoint = (id: string, lift = 1): Vec3 | undefined => {
    const d = index.device.get(id);
    return d ? to3(d.position, levelOfDevice(id), lift) : undefined;
  };

  // When this tab saw each row land, so every pulse, flash, pop and toast plays once.
  const tracker = useRef<SpreadTracker>();
  if (!tracker.current) tracker.current = new SpreadTracker();
  const fx = tracker.current.observe(
    {
      runId: run?.id ?? "", tick: run?.tick ?? 0, speed: run?.speed ?? 1,
      devices: session.devices, services: session.services, attempts: session.attempts, events: session.events,
    },
    performance.now(),
  );

  const roomCounts = useMemo(() => {
    const m = new Map<string, { infected: number; total: number }>();
    for (const d of hospital.devices) {
      const c = m.get(d.roomId) ?? { infected: 0, total: 0 };
      c.total += 1;
      if (index.deviceState.get(d.id)?.infected) c.infected += 1;
      m.set(d.roomId, c);
    }
    return m;
  }, [hospital.devices, index.deviceState]);

  // The run row's list is parsed afresh on every snapshot; key it by content.
  const removedKey = (run?.removedFlows ?? []).join(",");
  const removed = useMemo(() => new Set(removedKey ? removedKey.split(",") : []), [removedKey]);
  const onPlan = !!run?.recommendationId;

  // The infection path from infected_by; a plan's cut connections (dashed) and,
  // on the plan side, its kept protected connections; plus the hovered device's flows.
  const arcs = useMemo<Arc[]>(() => {
    const out: Arc[] = [];
    const add = (key: string, from: string, to: string, kind: Arc["kind"], lift?: number) => {
      const a = devicePoint(from, lift);
      const b = devicePoint(to, lift);
      if (a && b) out.push({ key, from: a, to: b, kind });
    };
    for (const s of session.devices) if (s.infected && s.infectedBy) add(`inf_${s.deviceId}`, s.infectedBy, s.deviceId, "infection");
    for (const fl of hospital.flows) {
      if (removed.has(fl.id)) add(`cut_${fl.id}`, fl.from, fl.to, "cut");
      else if (onPlan && fl.protected && fl.active !== false) add(`kept_${fl.id}`, fl.from, fl.to, "kept");
    }
    if (hovered) {
      for (const fl of hospital.flows) {
        if (fl.active === false || removed.has(fl.id) || (fl.from !== hovered && fl.to !== hovered)) continue;
        if (onPlan && fl.protected) continue;
        if (out.some((a) => a.key === `inf_${fl.to}` || a.key === `inf_${fl.from}`)) continue;
        add(fl.id, fl.from, fl.to, fl.protected ? "protected" : "flow");
      }
    }
    return out;
    // devicePoint only reads from index and floorLevel.
  }, [session.devices, hospital.flows, hovered, index, floorLevel, removed, onPlan]);

  // Where the infection reached a cut and stopped (UX: solution view, "✕ where the infection stopped").
  const stops = useMemo(() => {
    const out: { key: string; from: Vec3; to: Vec3 }[] = [];
    for (const id of stoppedAt([...removed], index.flow, index.deviceState)) {
      const fl = index.flow.get(id)!;
      const a = devicePoint(fl.from);
      const b = devicePoint(fl.to);
      if (a && b) out.push({ key: id, from: a, to: b });
    }
    return out;
  }, [removed, index, floorLevel]);

  // One label per purpose on the plan side's kept protected connections.
  const keptLabels = useMemo(() => {
    if (!onPlan) return [];
    const seen = new Set<string>();
    const out: { key: string; at: Vec3; text: string }[] = [];
    for (const fl of hospital.flows) {
      if (!fl.protected || !fl.purpose || removed.has(fl.id) || fl.active === false || seen.has(fl.purpose)) continue;
      const a = devicePoint(fl.from);
      const b = devicePoint(fl.to);
      if (!a || !b) continue;
      seen.add(fl.purpose);
      out.push({ key: fl.id, at: arcPoint(a, b, 0.5), text: fl.purpose });
    }
    return out;
  }, [onPlan, hospital.flows, removed, index, floorLevel]);

  // Down services, keyed by the room of their first device.
  const downByRoom = useMemo(() => {
    const m = new Map<string, typeof hospital.services>();
    for (const svc of hospital.services) {
      if (!index.serviceState.get(svc.id)?.down) continue;
      const roomId = index.device.get(svc.dependsOnDevices[0])?.roomId;
      if (!roomId) continue;
      m.set(roomId, [...(m.get(roomId) ?? []), svc]);
    }
    return m;
  }, [hospital.services, index]);

  // A toast sits over the device it names, or over the room for an ER diversion.
  const anchor = (t: Toast): Vec3 | undefined => {
    if (t.kind !== "diversion") return devicePoint(t.targetId, 3.4);
    const room = index.room.get(t.targetId);
    return room ? to3(centroid(room.polygon), floorLevel.get(room.floorId) ?? 0, 2.6) : undefined;
  };

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: compact ? [4, 46, 98] : [4, 36, 76], fov: 34, near: 0.5, far: 400 }}
      onPointerMissed={() => onHover(null)}
    >
      <color attach="background" args={[C.bg]} />
      <fog attach="fog" args={[C.bg, compact ? 100 : 80, compact ? 180 : 150]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[20, 40, 25]} intensity={0.9} castShadow />
      <OrbitControls target={[0, 1, 0]} enableDamping maxPolarAngle={Math.PI / 2.1} minDistance={20} maxDistance={130} />

      {hospital.floors.map((f) => (
        <FloorSlab
          key={f.id}
          floor={f}
          subtitle={hospital.rooms
            .filter((r) => r.floorId === f.id)
            .map((r) => r.name.toLowerCase())
            .join(", ")}
        />
      ))}

      {hospital.rooms.map((room) => {
        const level = floorLevel.get(room.floorId) ?? 0;
        const c = roomCounts.get(room.id) ?? { infected: 0, total: 0 };
        const group = hospital.patients.find((g) => g.roomId === room.id);
        const groupState = group ? index.patientState.get(group.id) ?? "ok" : undefined;
        const b = bounds(room.polygon);
        return (
          <group key={room.id}>
            <RoomShell room={room} level={level} infectedShare={c.total ? c.infected / c.total : 0} />
            {group && groupState && <PatientFigures room={room} level={level} count={group.count} state={groupState} />}
            <RoomChip
              position={to3([(b.minX + b.maxX) / 2, b.maxY], level, 0.3)}
              name={room.name}
              infected={c.infected}
              total={c.total}
              patients={group && groupState ? { count: group.count, state: groupState } : undefined}
              servicesDown={downByRoom.get(room.id) ?? []}
              downAt={fx.downAt}
            />
          </group>
        );
      })}

      {hospital.devices.map((d) => (
        <DeviceBox
          key={d.id}
          device={d}
          level={levelOfDevice(d.id)}
          state={index.deviceState.get(d.id)}
          hovered={hovered === d.id}
          onHover={onHover}
          flashAt={fx.flashAt.get(d.id)}
          pick={
            pick && {
              eligible: pick.eligible.has(d.id),
              selected: pick.selected === d.id,
              onPick: pick.onPick && (() => pick.onPick!(d.id)),
            }
          }
        />
      ))}

      {arcs.map((a) => (
        <NetworkArc key={a.key} arc={a} />
      ))}

      {keptLabels.map((l) => (
        <Html key={l.key} position={l.at} center zIndexRange={[15, 5]} style={{ pointerEvents: "none" }}>
          <span className="num flex items-center gap-1 whitespace-nowrap rounded-ctl bg-bg/80 px-1.5 py-px text-[9.5px] text-ink-muted">
            <i className="h-[6px] w-[6px] rounded-full bg-state-healthy" aria-hidden />
            keep · {l.text}
          </span>
        </Html>
      ))}

      <SpreadFx pulses={fx.pulses} toasts={fx.toasts} stops={stops} point={(id) => devicePoint(id)} anchor={anchor} />
    </Canvas>
  );
}
