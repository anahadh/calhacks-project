"use client";

import { useMemo, useRef, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { ARC_MODE } from "../../../../spacetime/src/role_views";
import type { RoleView } from "@/lib/role-views";
import type { SessionIndex } from "@/lib/stdb/use-session";
import type { SessionSnapshot } from "@/lib/stdb/types";
import { C } from "@/lib/colors";
import { SpreadFx } from "@/features/scene/spread-fx";
import { SpreadTracker, stoppedAt, type Toast } from "@/features/scene/spread-timing";
import { NetworkArc, ServiceAnchor, type Arc, type Vec3 } from "./arcs";
import { FloorSlab, RoomShell } from "./building";
import { CHIP_LIFT, DeviceBox } from "./devices";
import { Furniture } from "./furniture";
import { RoomChip } from "./labels";
import { PatientFigures } from "./patients";
import { floorPlan } from "./plan";
import { centroid, FLOOR_GAP, roomsBounds, to3, WALL_H } from "./space";

// The camera looks at the clinic from the front and above, a little to the
// right, so the corridor runs across the screen and every room's doorway faces
// the viewer. Its distance scales with the floor so the whole plan fits.
const CAM_DIR: Vec3 = [0.3, 0.86, 0.72];
const CAM_FOV = 30;
/** Camera distance per meter of the floor's longest side, at the default view. */
const CAM_DIST_PER_M = 1.32;
/** Infection hops this recent (in ticks) are drawn bright: the spread happening now. Older hops fade to a trail. */
const RECENT_TICKS = 2;

export function HospitalScene({
  session,
  index,
  hovered,
  onHover,
  floorId,
  onPick,
  pickable,
  view,
  quiet = false,
  children,
}: {
  session: SessionSnapshot;
  index: SessionIndex;
  hovered: string | null;
  onHover: (id: string | null) => void;
  /** Show one floor, brought down to ground height; all floors when unset. */
  floorId?: string;
  /** Picking patient zero: clicking a device starts the attack from it. */
  onPick?: (id: string) => void;
  /** While picking, which devices the engine accepts as patient zero (others dim). */
  pickable?: (id: string) => boolean;
  /** The caller's role view: how the hovered device's connections look (spacetime/src/role_views.ts). */
  view: RoleView;
  /** Quiet: room chips only where the infection is, or where the hovered device stands (the solution page). */
  quiet?: boolean;
  /** Extra layers drawn in the building's frame (the solution view's segment walls). */
  children?: ReactNode;
}) {
  const { hospital } = session;
  const run = session.activeRun ?? session.runs.find((r) => r.id === session.activeRunId);
  const patientZero = run?.patientZero;
  const onFloor = (fid: string) => !floorId || fid === floorId;
  const shownRoom = (roomId: string) => onFloor(index.room.get(roomId)?.floorId ?? "");
  const drop = floorId ? (hospital.floors.find((f) => f.id === floorId)?.level ?? 0) * FLOOR_GAP : 0;

  const floorLevel = useMemo(() => new Map(hospital.floors.map((f) => [f.id, f.level])), [hospital.floors]);
  const levelOfDevice = (id: string) => {
    const d = index.device.get(id);
    const r = d && index.room.get(d.roomId);
    return r ? floorLevel.get(r.floorId) ?? 0 : 0;
  };
  /** Where a device's chip floats, or undefined for an id the hospital does not have. */
  const devicePoint = (id: string, lift = CHIP_LIFT): Vec3 | undefined => {
    const d = index.device.get(id);
    return d ? to3(d.position, levelOfDevice(id), lift) : undefined;
  };

  // When this tab saw each row land (spread-timing.ts), so paths draw in and
  // chips pop exactly as their row arrives. Idempotent for the same rows.
  const tracker = useRef<SpreadTracker>();
  if (!tracker.current) tracker.current = new SpreadTracker();
  const timing = tracker.current.observe(
    {
      runId: run?.id ?? "",
      tick: run?.tick ?? 0,
      speed: run?.speed ?? 1,
      devices: session.devices,
      services: session.services,
      attempts: session.attempts,
      events: session.events,
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

  const mode = ARC_MODE[view.role];
  const tick = run?.tick ?? 0;

  // What the hovered device touches: its flows' other ends. Everything else dims.
  const neighbors = useMemo(() => {
    if (!hovered) return null;
    const m = new Set([hovered]);
    for (const fl of hospital.flows) {
      if (fl.active === false) continue;
      if (fl.from === hovered) m.add(fl.to);
      if (fl.to === hovered) m.add(fl.from);
    }
    return m;
  }, [hovered, hospital.flows]);

  // Where each service's dependency lines meet (Hospital Management): above the middle of its devices.
  const serviceAnchor = useMemo(() => {
    const m = new Map<string, Vec3>();
    if (mode !== "dependencies") return m;
    for (const svc of hospital.services) {
      const pts = svc.dependsOnDevices.map((id) => devicePoint(id)).filter((p): p is Vec3 => !!p);
      if (!pts.length) continue;
      const avg = (k: 0 | 1 | 2) => pts.reduce((n, p) => n + p[k], 0) / pts.length;
      m.set(svc.id, [avg(0), Math.max(...pts.map((p) => p[1])) + 5, avg(2)]);
    }
    return m;
    // devicePoint only reads from index and floorLevel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, hospital.services, index, floorLevel]);

  // Only two kinds of line, so the building stays readable:
  // 1. Infection paths from infected_by, for every role. Hops from the last
  //    RECENT_TICKS ticks are bright (the spread happening now); older ones fade.
  // 2. The hovered device's connections, styled by the role view: the CISO's
  //    protocol and port, Clinical IT's clinical flows, Management's services.
  const arcs = useMemo<Arc[]>(() => {
    const shown = (id: string) => shownRoom(index.device.get(id)?.roomId ?? "");
    const out: Arc[] = [];
    for (const s of session.devices) {
      if (!s.infected || !s.infectedBy || s.infectedBy === s.deviceId) continue;
      if (!shown(s.deviceId) || !shown(s.infectedBy)) continue;
      const from = devicePoint(s.infectedBy);
      const to = devicePoint(s.deviceId);
      if (!from || !to) continue;
      out.push({
        key: `inf_${s.deviceId}`, from, to, kind: "infection", since: timing.flashAt.get(s.deviceId),
        emphasis: tick - (s.infectedAtTick ?? 0) < RECENT_TICKS ? "strong" : "faint",
      });
    }
    if (!hovered) return out;

    if (mode === "none") {
      // No role yet: the hovered device's flows, plain.
      for (const fl of hospital.flows) {
        if (fl.active === false || (fl.from !== hovered && fl.to !== hovered)) continue;
        if (!shown(fl.from) || !shown(fl.to)) continue;
        const from = devicePoint(fl.from);
        const to = devicePoint(fl.to);
        if (from && to) out.push({ key: fl.id, from, to, kind: fl.protected ? "protected" : "flow" });
      }
      return out;
    }

    for (const a of view.arcs) {
      if (a.from !== hovered && a.to !== hovered) continue;
      const from = devicePoint(a.from);
      if (!from || !shown(a.from)) continue;
      if (a.kind === "dependency") {
        const anchor = serviceAnchor.get(a.to);
        if (anchor) out.push({ key: a.id, from, to: anchor, kind: "dependency", emphasis: "strong" });
        continue;
      }
      const to = devicePoint(a.to);
      if (!to || !shown(a.to)) continue;
      out.push({
        key: a.id, from, to, kind: index.flow.get(a.id)?.protected ? "protected" : "flow",
        // Clinical IT's non-clinical flows stay thin; everything else on hover is clear.
        emphasis: a.emphasis === "faint" ? "normal" : "strong",
        label: a.label || undefined,
      });
    }
    return out;
    // devicePoint only reads from index and floorLevel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.devices, hospital.flows, hovered, index, floorLevel, floorId, timing.flashAt, mode, view.arcs, serviceAnchor, tick]);

  // Management's service labels: only the hovered device's services.
  const anchorsShown = useMemo(
    () => (hovered ? [...serviceAnchor].filter(([id]) => index.service.get(id)?.dependsOnDevices.includes(hovered)) : []),
    [hovered, serviceAnchor, index],
  );

  // Cut connections the infection reached but did not cross (run.removed_flows_json).
  const stops = useMemo(() => {
    const ids = stoppedAt(run?.removedFlows ?? [], index.flow, index.deviceState);
    const out: { key: string; from: Vec3; to: Vec3 }[] = [];
    for (const id of ids) {
      const f = index.flow.get(id);
      if (!f || !shownRoom(index.device.get(f.from)?.roomId ?? "") || !shownRoom(index.device.get(f.to)?.roomId ?? "")) continue;
      const from = devicePoint(f.from);
      const to = devicePoint(f.to);
      if (from && to) out.push({ key: id, from, to });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?.removedFlows, index, floorLevel, floorId]);

  // Down services, keyed by the room of their first device.
  const downByRoom = useMemo(() => {
    const m = new Map<string, typeof hospital.services>();
    for (const svc of hospital.services) {
      if (!index.serviceState.get(svc.id)?.down) continue;
      const roomId = index.device.get(svc.dependsOnDevices[0] ?? "")?.roomId;
      if (!roomId) continue;
      m.set(roomId, [...(m.get(roomId) ?? []), svc]);
    }
    return m;
  }, [hospital.services, index]);

  // Where a sim_event toast sits: over its device, else over its room.
  const anchor = (t: Toast): Vec3 | undefined => {
    const d = devicePoint(t.targetId, CHIP_LIFT + 1.3);
    if (d) return d;
    const room = index.room.get(t.targetId);
    return room && onFloor(room.floorId) ? to3(centroid(room.polygon), floorLevel.get(room.floorId) ?? 0, 1.2) : undefined;
  };

  // The camera looks at the middle of what is shown.
  const shownRooms = hospital.rooms.filter((r) => onFloor(r.floorId));
  const b = roomsBounds(shownRooms);
  const topLevel = floorId ? 0 : Math.max(0, ...hospital.floors.map((f) => f.level));
  const [cx, , cz] = to3([(b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2], 0);
  const target: Vec3 = [cx, (topLevel * FLOOR_GAP) / 2 + 0.5, cz];
  const camDist = Math.max(40, Math.max(b.maxX - b.minX, (b.maxY - b.minY) * 1.5) * CAM_DIST_PER_M);
  const camera: Vec3 = [target[0] + CAM_DIR[0] * camDist, target[1] + CAM_DIR[1] * camDist, target[2] + CAM_DIR[2] * camDist];
  /** drei Html scale so a 30px chip is 30px at the default camera distance: tan(fov/2) × distance. */
  const htmlFactor = Math.tan((CAM_FOV / 2) * (Math.PI / 180)) * camDist;

  // Each floor's doorways (plan.ts), for the people who walk out of them.
  const plans = useMemo(
    () => new Map(hospital.floors.map((f) => [f.id, floorPlan(hospital.rooms.filter((r) => r.floorId === f.id))])),
    [hospital.floors, hospital.rooms],
  );
  const devicesByRoom = useMemo(() => {
    const m = new Map<string, typeof hospital.devices>();
    for (const d of hospital.devices) m.set(d.roomId, [...(m.get(d.roomId) ?? []), d]);
    return m;
  }, [hospital.devices]);

  return (
    <Canvas
      dpr={[1, 2]}
      shadows
      camera={{ position: camera, fov: CAM_FOV, near: 0.5, far: 600 }}
      onPointerMissed={() => onHover(null)}
      gl={{ antialias: true }}
    >
      <color attach="background" args={[C.bg]} />
      <fog attach="fog" args={[C.bg, camDist * 1.6, camDist * 3.2]} />
      {/* soft daylight from the upper left, so walls and beds have a lit face and a shaded one */}
      <hemisphereLight args={["#AEB8C2", "#0D0F10", 0.55]} />
      <directionalLight
        position={[target[0] - 30, 60, target[2] + 25]}
        intensity={1.15}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-camera-left={-45}
        shadow-camera-right={45}
        shadow-camera-top={45}
        shadow-camera-bottom={-45}
        shadow-camera-near={10}
        shadow-camera-far={160}
      />
      <OrbitControls
        target={target}
        enableDamping
        maxPolarAngle={Math.PI / 2.05}
        minDistance={20}
        maxDistance={200}
      />

      <group position={[0, -drop, 0]}>
        {hospital.floors.filter((f) => onFloor(f.id)).map((f) => (
          <FloorSlab key={f.id} floor={f} rooms={hospital.rooms.filter((r) => r.floorId === f.id)} />
        ))}

        {shownRooms.map((room) => {
          const level = floorLevel.get(room.floorId) ?? 0;
          const c = roomCounts.get(room.id) ?? { infected: 0, total: 0 };
          const group = hospital.patients.find((g) => g.roomId === room.id);
          const groupState = group ? index.patientState.get(group.id) ?? "ok" : undefined;
          const plan = plans.get(room.floorId);
          const door = plan?.doors.get(room.id);
          return (
            <group key={room.id}>
              <RoomShell room={room} level={level} infectedShare={c.total ? c.infected / c.total : 0} />
              {plan && <Furniture room={room} devices={devicesByRoom.get(room.id) ?? []} level={level} floorCenter={plan.center} />}
              {group && groupState && door && (
                <PatientFigures room={room} door={door} level={level} count={group.count} state={groupState} />
              )}
              {(!quiet || c.infected > 0 || index.device.get(hovered ?? "")?.roomId === room.id) && (
              <RoomChip
                position={to3(centroid(room.polygon), level, WALL_H + 1.2)}
                name={room.name}
                infected={c.infected}
                total={c.total}
                patients={group && groupState ? { count: group.count, state: groupState } : undefined}
                servicesDown={downByRoom.get(room.id) ?? []}
                downAt={timing.downAt}
              />
              )}
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
              dimmed={!!neighbors && !neighbors.has(d.id)}
              zero={d.id === patientZero && !!st?.infected}
              onHover={onHover}
              flashAt={timing.flashAt.get(d.id)}
              distanceFactor={htmlFactor}
              onPick={onPick}
              pickable={pickable ? pickable(d.id) : undefined}
            />
          );
        })}

        {arcs.map((a) => (
          <NetworkArc key={a.key} arc={a} />
        ))}

        {anchorsShown.map(([id, pos]) => (
          <ServiceAnchor key={id} position={pos} name={index.service.get(id)?.name ?? id} down={!!index.serviceState.get(id)?.down} />
        ))}

        <SpreadFx
          pulses={timing.pulses}
          toasts={timing.toasts}
          stops={stops}
          point={(id) => devicePoint(id)}
          anchor={anchor}
        />
        {children}
      </group>
    </Canvas>
  );
}
