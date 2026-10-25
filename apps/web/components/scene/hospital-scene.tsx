"use client";

import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { ARC_MODE } from "../../../../spacetime/src/role_views";
import type { RoleView } from "@/lib/role-views";
import type { SessionIndex } from "@/lib/stdb/use-session";
import type { SessionSnapshot } from "@/lib/stdb/types";
import { C } from "@/lib/colors";
import { NetworkArc, ServiceAnchor, type Arc } from "./arcs";
import { FloorSlab, RoomShell } from "./building";
import { DeviceBox } from "./devices";
import { RoomChip } from "./labels";
import { PatientFigures } from "./patients";
import { bounds, FLOOR_GAP, to3 } from "./space";

export function HospitalScene({
  session,
  index,
  hovered,
  onHover,
  floorId,
  view,
}: {
  session: SessionSnapshot;
  index: SessionIndex;
  /** The caller's role view: which connections to draw (spacetime/src/role_views.ts). */
  view: RoleView;
  hovered: string | null;
  onHover: (id: string | null) => void;
  /** Show one floor, brought down to ground height; all floors when unset. */
  floorId?: string;
}) {
  const { hospital } = session;
  const patientZero = session.runs.find((r) => r.id === session.activeRunId)?.patientZero;
  const onFloor = (fid: string) => !floorId || fid === floorId;
  const shownRoom = (roomId: string) => onFloor(index.room.get(roomId)?.floorId ?? "");
  const drop = floorId ? (hospital.floors.find((f) => f.id === floorId)?.level ?? 0) * FLOOR_GAP : 0;

  const floorLevel = useMemo(() => new Map(hospital.floors.map((f) => [f.id, f.level])), [hospital.floors]);
  const levelOfDevice = (id: string) => {
    const d = index.device.get(id);
    const r = d && index.room.get(d.roomId);
    return r ? floorLevel.get(r.floorId) ?? 0 : 0;
  };
  const devicePoint = (id: string, lift = 1) => {
    const d = index.device.get(id)!;
    return to3(d.position, levelOfDevice(id), lift);
  };

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

  const mode = ARC_MODE[view.role];

  // Where each service's dependency lines meet: above the middle of its devices.
  const serviceAnchor = useMemo(() => {
    const m = new Map<string, [number, number, number]>();
    if (mode !== "dependencies") return m;
    for (const svc of hospital.services) {
      const pts = svc.dependsOnDevices.filter((id) => index.device.has(id)).map((id) => devicePoint(id));
      if (!pts.length) continue;
      const avg = (k: 0 | 1 | 2) => pts.reduce((n, p) => n + p[k], 0) / pts.length;
      m.set(svc.id, [avg(0), Math.max(...pts.map((p) => p[1])) + 5, avg(2)]);
    }
    return m;
    // devicePoint only reads from index and floorLevel.
  }, [mode, hospital.services, index, floorLevel]);

  // The infection path from infected_by for every role, then the role's connections.
  // Labels show on the hovered device's connections.
  const arcs = useMemo<Arc[]>(() => {
    const shown = (id: string) => shownRoom(index.device.get(id)?.roomId ?? "");
    const out: Arc[] = session.devices
      .filter((s) => s.infected && s.infectedBy && shown(s.deviceId) && shown(s.infectedBy))
      .map((s) => ({ key: `inf_${s.deviceId}`, from: devicePoint(s.infectedBy!), to: devicePoint(s.deviceId), kind: "infection" }));
    const onPath = (a: string, b: string) => out.some((x) => x.key === `inf_${a}` || x.key === `inf_${b}`);

    if (mode === "none") {
      // No role yet: only the hovered device's flows, as before roles.
      if (hovered) {
        for (const fl of hospital.flows) {
          if (fl.active === false || (fl.from !== hovered && fl.to !== hovered)) continue;
          if (!shown(fl.from) || !shown(fl.to) || onPath(fl.from, fl.to)) continue;
          out.push({ key: fl.id, from: devicePoint(fl.from), to: devicePoint(fl.to), kind: fl.protected ? "protected" : "flow" });
        }
      }
      return out;
    }

    for (const a of view.arcs) {
      const touches = !!hovered && (a.from === hovered || a.to === hovered);
      if (a.kind === "dependency") {
        const anchor = serviceAnchor.get(a.to);
        if (!anchor || !shown(a.from)) continue;
        out.push({
          key: a.id, from: devicePoint(a.from), to: anchor, kind: "dependency",
          emphasis: touches ? "strong" : a.emphasis, label: touches ? a.label : undefined,
        });
        continue;
      }
      if (!index.device.has(a.from) || !index.device.has(a.to) || !shown(a.from) || !shown(a.to)) continue;
      if (onPath(a.from, a.to) && !touches) continue;
      const fl = index.flow.get(a.id);
      out.push({
        key: a.id, from: devicePoint(a.from), to: devicePoint(a.to), kind: fl?.protected ? "protected" : "flow",
        emphasis: touches ? "strong" : hovered ? (a.emphasis === "strong" ? "normal" : "faint") : a.emphasis,
        label: touches && a.label ? a.label : undefined,
      });
    }
    return out;
    // devicePoint only reads from index and floorLevel.
  }, [session.devices, hospital.flows, hovered, index, floorLevel, floorId, mode, view.arcs, serviceAnchor]);

  // Down services, keyed by the room of their first device.
  const downByRoom = useMemo(() => {
    const m = new Map<string, typeof hospital.services>();
    for (const svc of hospital.services) {
      if (!index.serviceState.get(svc.id)?.down) continue;
      const roomId = index.device.get(svc.dependsOnDevices[0])!.roomId;
      m.set(roomId, [...(m.get(roomId) ?? []), svc]);
    }
    return m;
  }, [hospital.services, index]);

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [4, 36, 76], fov: 34, near: 0.5, far: 400 }}
      onPointerMissed={() => onHover(null)}
    >
      <color attach="background" args={[C.bg]} />
      <fog attach="fog" args={[C.bg, 80, 150]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[20, 40, 25]} intensity={0.9} castShadow />
      <OrbitControls target={[0, 1, 0]} enableDamping maxPolarAngle={Math.PI / 2.1} minDistance={20} maxDistance={110} />

      <group position={[0, -drop, 0]}>
        {hospital.floors.filter((f) => onFloor(f.id)).map((f) => (
          <FloorSlab
            key={f.id}
            floor={f}
            subtitle={hospital.rooms
              .filter((r) => r.floorId === f.id)
              .map((r) => r.name.toLowerCase())
              .join(", ")}
          />
        ))}

        {hospital.rooms.filter((room) => onFloor(room.floorId)).map((room) => {
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
              />
            </group>
          );
        })}

        {hospital.devices.filter((d) => shownRoom(d.roomId)).map((d) => {
          const st = index.deviceState.get(d.id);
          return (
            <DeviceBox
              key={d.id}
              device={d}
              level={levelOfDevice(d.id)}
              state={st}
              hovered={hovered === d.id}
              zero={d.id === patientZero && !!st?.infected}
              onHover={onHover}
            />
          );
        })}

        {arcs.map((a) => (
          <NetworkArc key={a.key} arc={a} />
        ))}

        {[...serviceAnchor].map(([id, pos]) => (
          <ServiceAnchor key={id} position={pos} name={index.service.get(id)?.name ?? id} down={!!index.serviceState.get(id)?.down} />
        ))}
      </group>

    </Canvas>
  );
}
