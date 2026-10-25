// Role views (F3). Per-caller SpacetimeDB views: each reads the caller's
// presence row (ctx.sender) and returns the device cards and connections for
// their role, using the mapping in role_views.ts. A caller who hasn't joined a
// session gets no rows. No tables or reducers: the role on the presence row is
// the only input, and SpacetimeDB re-evaluates the view when it changes.
//
// The full hospital file stays public on `session`, so this shapes what each
// role sees; it is not access control.

import { t } from "spacetimedb/server";
import type { HospitalFile } from "@hippo/sim-core";

import { deviceCards, roleArcs, viewRole } from "./role_views";
import spacetimedb from "./schema";

const DeviceCardRow = t.row("DeviceCardRow", {
  device_id: t.string().primaryKey(),
  session_id: t.string(),
  viewer_role: t.string(),
  services: t.string(),
  os: t.string(),
  vulnerability: t.string(),
  vlan: t.string(),
  ports: t.string(),
  infected_by: t.string(),
  criticality: t.string(),
  clinical_flows: t.string(),
  clinical_services: t.string(),
  patients: t.string(),
  service_impact: t.string(),
});

const ArcRow = t.row("ArcRow", {
  id: t.string().primaryKey(),
  session_id: t.string(),
  viewer_role: t.string(),
  kind: t.string(), // flow | dependency
  from_device: t.string(),
  to_id: t.string(), // a device id for flows, a service id for dependencies
  emphasis: t.string(), // normal | strong | faint
  label: t.string(),
});

/** The caller's session, hospital and role, or undefined before they join. */
function viewer(ctx: any) {
  const p = ctx.db.presence.identity.find(ctx.sender);
  const s = p && ctx.db.session.id.find(p.session_id);
  if (!s) return undefined;
  return { session: s, role: viewRole(p.role), hospital: (JSON.parse(s.hospital_json) as HospitalFile).hospital };
}

/** One card per device, with only the fields the caller's role sees. Infected-by comes from the active run. */
export const my_device_card = spacetimedb.view({ name: "my_device_card", public: true }, t.array(DeviceCardRow), (ctx) => {
  const v = viewer(ctx);
  if (!v) return [];
  const name = new Map(v.hospital.devices.map((d) => [d.id, d.name]));
  const runId = v.session.active_run_id;
  const infectedBy = (id: string) => {
    const st = runId ? ctx.db.device_state.id.find(`${runId}:${id}`) : undefined;
    return st?.infected && st.infected_by ? name.get(st.infected_by) ?? st.infected_by : undefined;
  };
  return deviceCards(v.hospital, v.role, infectedBy).map((c) => ({ ...c, session_id: v.session.id, viewer_role: v.role }));
});

/** The connections the caller's role draws. The infection path is drawn from device_state for everyone. */
export const my_arcs = spacetimedb.view({ name: "my_arcs", public: true }, t.array(ArcRow), (ctx) => {
  const v = viewer(ctx);
  if (!v) return [];
  return roleArcs(v.hospital, v.role).map((a) => ({
    id: a.id, session_id: v.session.id, viewer_role: v.role, kind: a.kind, from_device: a.from, to_id: a.to,
    emphasis: a.emphasis, label: a.label,
  }));
});
