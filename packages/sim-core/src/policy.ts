import type { Device, Flow, Hospital, Policy, Selector } from "./types";

function matches(sel: Selector, device: Device, zoneOf: (d: Device) => string): boolean {
  if (sel.zone !== undefined && zoneOf(device) !== sel.zone) return false;
  if (sel.deviceType !== undefined && device.type !== sel.deviceType) return false;
  if (sel.role !== undefined && device.role !== sel.role) return false;
  if (sel.vlan !== undefined && device.vlan !== sel.vlan) return false;
  return true;
}

/**
 * Flow ids a policy keeps. A flow is kept if at least one rule matches its
 * source, destination, protocol and port; every other flow is removed.
 * No policy keeps every flow.
 */
export function keptFlowIds(h: Hospital, flows: Flow[], policy?: Policy | null): Set<string> {
  if (!policy) return new Set(flows.map((f) => f.id));
  const device = new Map(h.devices.map((d) => [d.id, d]));
  const roomZone = new Map(h.rooms.map((r) => [r.id, r.zone]));
  const zoneOf = (d: Device) => roomZone.get(d.roomId) ?? "";
  const kept = new Set<string>();
  for (const f of flows) {
    const from = device.get(f.from);
    const to = device.get(f.to);
    if (!from || !to) continue;
    const ok = policy.rules.some(
      (r) =>
        (r.protocol === undefined || r.protocol === f.protocol) &&
        (r.port === undefined || r.port === f.port) &&
        matches(r.from, from, zoneOf) &&
        matches(r.to, to, zoneOf),
    );
    if (ok) kept.add(f.id);
  }
  return kept;
}

/** Protected flows the policy removes. */
export function protectedBroken(h: Hospital, policy?: Policy | null): Flow[] {
  const active = h.flows.filter((f) => f.active !== false);
  const kept = keptFlowIds(h, active, policy);
  return active.filter((f) => f.protected && !kept.has(f.id));
}
