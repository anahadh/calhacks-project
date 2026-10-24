"use client";

import { useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { C } from "@/lib/colors";
import type { SessionIndex } from "@/lib/stdb/use-session";
import type { SessionSnapshot } from "@/lib/stdb/types";
import { NetworkArc, type Arc } from "./arcs";
import { FloorSlab, RoomShell } from "./building";
import { DeviceBox } from "./devices";
import { RoomChip, ServiceMarker } from "./labels";
import { PatientFigures } from "./patients";
import { bounds, centroid, to3 } from "./space";

export function HospitalScene({ session, index }: { session: SessionSnapshot; index: SessionIndex }) {
  const { hospital } = session;
  const [hovered, setHovered] = useState<string | null>(null);

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

  // Infection path from infected_by, plus the hovered device's own flows.
  const arcs = useMemo<Arc[]>(() => {
    const out: Arc[] = session.devices
      .filter((s) => s.infected && s.infectedBy)
      .map((s) => ({ key: `inf_${s.deviceId}`, from: devicePoint(s.infectedBy!), to: devicePoint(s.deviceId), kind: "infection" }));
    if (hovered) {
      for (const fl of hospital.flows) {
        if (fl.active === false || (fl.from !== hovered && fl.to !== hovered)) continue;
        if (out.some((a) => a.key === `inf_${fl.to}` || a.key === `inf_${fl.from}`)) continue;
        out.push({ key: fl.id, from: devicePoint(fl.from), to: devicePoint(fl.to), kind: fl.protected ? "protected" : "flow" });
      }
    }
    return out;
    // devicePoint only reads from index and floorLevel.
  }, [session.devices, hospital.flows, hovered, index, floorLevel]);

  // Each service floats over the room of its first device, stacked if several share a room.
  const serviceMarkers = useMemo(() => {
    const perRoom = new Map<string, number>();
    return hospital.services.map((svc) => {
      const room = index.room.get(index.device.get(svc.dependsOnDevices[0])!.roomId)!;
      const n = perRoom.get(room.id) ?? 0;
      perRoom.set(room.id, n + 1);
      return { svc, position: to3(centroid(room.polygon), floorLevel.get(room.floorId) ?? 0, 3.4 + n * 1.6) };
    });
  }, [hospital.services, index, floorLevel]);

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [10, 22, 50], fov: 36, near: 0.5, far: 400 }}
      onPointerMissed={() => setHovered(null)}
    >
      <color attach="background" args={[C.bg]} />
      <fog attach="fog" args={[C.bg, 70, 140]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[20, 40, 25]} intensity={0.9} castShadow />
      <OrbitControls target={[0, 4, 0]} enableDamping maxPolarAngle={Math.PI / 2.1} minDistance={20} maxDistance={110} />

      {hospital.floors.map((f) => (
        <FloorSlab key={f.id} floor={f} />
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
            />
          </group>
        );
      })}

      {hospital.devices.map((d) => {
        const st = index.deviceState.get(d.id);
        return (
          <DeviceBox
            key={d.id}
            device={d}
            level={levelOfDevice(d.id)}
            state={st}
            infectedByName={st?.infectedBy ? index.device.get(st.infectedBy)?.name : undefined}
            hovered={hovered === d.id}
            onHover={setHovered}
          />
        );
      })}

      {arcs.map((a) => (
        <NetworkArc key={a.key} arc={a} />
      ))}

      {serviceMarkers.map(({ svc, position }) => (
        <ServiceMarker key={svc.id} position={position} service={svc} state={index.serviceState.get(svc.id)} />
      ))}
    </Canvas>
  );
}
