// Role views on the web side: role names for people, and useRoleView(), which
// hands components the caller's device cards and connections. Which card lines
// and connections each role gets is decided in one
// place, spacetime/src/role_views.ts: live sessions read it through the
// my_device_card and my_arcs views; without SpacetimeDB the same functions run here.

import { useMemo } from "react";
import {
  deviceCards, roleArcs, viewRole, type ArcData, type CardLine, type DeviceCardData, type ViewRole,
} from "../../../spacetime/src/role_views";
import type { PresenceRow, SessionSnapshot } from "./stdb/types";

export type { ArcData, CardLine, DeviceCardData, ViewRole };

/** The roles people pick on the join card, mapped to the module's role ids (agents' allowed and required roles). */
export const ROLE_OPTIONS = [
  { id: "security", label: "Chief Information Security Officer", short: "CISO" },
  { id: "network", label: "Network Engineer", short: "Network" },
  { id: "clinical_engineering", label: "Clinical IT Team", short: "Clinical IT" },
  { id: "operations", label: "Hospital Management", short: "Management" },
] as const satisfies readonly { id: PresenceRow["role"]; label: string; short: string }[];

export type JoinRole = (typeof ROLE_OPTIONS)[number]["id"];

export const ROLE_LABEL: Record<PresenceRow["role"], string> = {
  security: "Chief Information Security Officer",
  network: "Network Engineer",
  clinical_engineering: "Clinical IT Team",
  operations: "Hospital Management",
  observer: "Observer",
};

export const ROLE_SHORT: Record<PresenceRow["role"], string> = {
  security: "CISO",
  network: "Network",
  clinical_engineering: "Clinical IT",
  operations: "Management",
  observer: "Observer",
};

export type RoleView = { role: ViewRole; cards: Map<string, DeviceCardData>; arcs: ArcData[] };

/**
 * The caller's role view. Live: the rows of the my_device_card and my_arcs
 * views. Without SpacetimeDB nobody joins, so the offline demo shows the CISO lens.
 */
export function useRoleView(session: SessionSnapshot): RoleView {
  const live = session.source === "live";
  return useMemo(() => {
    if (live) {
      const v = session.roleView;
      return { role: v?.role ?? viewRole(session.me?.role), cards: new Map((v?.cards ?? []).map((c) => [c.device_id, c])), arcs: v?.arcs ?? [] };
    }
    const role: ViewRole = session.me ? viewRole(session.me.role) : "security";
    const name = new Map(session.hospital.devices.map((d) => [d.id, d.name]));
    const state = new Map(session.devices.map((d) => [d.deviceId, d]));
    const by = (id: string) => {
      const st = state.get(id);
      return st?.infected && st.infectedBy ? name.get(st.infectedBy) ?? st.infectedBy : undefined;
    };
    const cards = deviceCards(session.hospital, role, by);
    return { role, cards: new Map(cards.map((c) => [c.device_id, c])), arcs: roleArcs(session.hospital, role) };
  }, [live, session.roleView, session.me, session.hospital, session.devices]);
}
