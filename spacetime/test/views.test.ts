import { beforeEach, describe, expect, it } from "vitest";
import { ConnectionId } from "spacetimedb";
import { createModuleTestHarness, TestAuth } from "spacetimedb/server/test-utils";
import type { Hospital } from "@hippo/sim-core";
import demo from "../../data/hospitals/demo.json";
import spacetimedb, * as mod from "../src/index";
import { CARD_FIELDS, type CardField } from "../src/role_views";

const h = (demo as unknown as { hospital: Hospital }).hospital;
const user = (sub: string) => TestAuth.fromJwtPayload(JSON.stringify({ iss: "hippo-test", sub, aud: ["spacetimedb"] }), ConnectionId.random());
const SERVER = user("server");
const CISO = user("ciso"); // presenter
const CLIN = user("clin");
const MGMT = user("mgmt");
const STRANGER = user("stranger"); // never joins
const SCHED = TestAuth.internal();

type H = ReturnType<typeof createModuleTestHarness<any>>;
let t: H;
const call = (auth: any, fn: any, args: object = {}) => t.withReducerTx(auth, (ctx: any) => fn(ctx, args));
const rows = (table: string) => [...(t.db as any)[table].iter()] as any[];
const view = (auth: any, fn: any) => fn(t.viewContext(auth), {}) as any[];
const card = (auth: any, deviceId: string) => view(auth, mod.my_device_card).find((c) => c.device_id === deviceId);

const ALL_FIELDS: CardField[] = [
  "os", "vulnerability", "vlan", "ports", "infected_by", "criticality", "clinical_flows", "clinical_services", "patients", "service_impact",
];

beforeEach(() => {
  t = createModuleTestHarness(spacetimedb as any, mod as any);
  call(SERVER, mod.init);
  call(CISO, mod.session_create, { session_id: "demo", hospital_json: JSON.stringify(demo) });
  call(CISO, mod.presence_join, { session_id: "demo", name: "Ana", role: "security" });
  call(CLIN, mod.presence_join, { session_id: "demo", name: "Dev", role: "clinical_engineering" });
  call(MGMT, mod.presence_join, { session_id: "demo", name: "Mo", role: "operations" });
});

describe("my_device_card", () => {
  it("gives each role only its own fields, plus the services everyone sees", () => {
    for (const [auth, role] of [[CISO, "security"], [CLIN, "clinical_engineering"], [MGMT, "operations"]] as const) {
      const c = card(auth, "mri_2");
      expect(c.viewer_role).toBe(role);
      expect(c.services).toContain("MRI imaging");
      // infected_by is empty until something infects mri_2, so skip it here.
      for (const f of CARD_FIELDS[role].filter((f) => f !== "infected_by")) expect(c[f], `${role}.${f}`).not.toBe("");
      for (const f of ALL_FIELDS.filter((f) => !CARD_FIELDS[role].includes(f))) expect(c[f], `${role}.${f}`).toBe("");
    }
  });

  it("shows ports and VLAN to the CISO, protected flows to Clinical IT, plain-language impact to Management", () => {
    expect(card(CISO, "mri_2").ports).toMatch(/DICOM 104 → PACS/);
    expect(card(CISO, "mri_2").vlan).toBe(String(h.devices.find((d) => d.id === "mri_2")!.vlan));
    expect(card(CLIN, "mri_2").clinical_flows).toMatch(/Scans to radiologists \(DICOM\).*protected/);
    expect(card(MGMT, "mri_2").patients).toMatch(/^\d+ patients/);
    expect(card(MGMT, "mri_2").service_impact).toContain("Scheduled MRI scans can't run");
    expect(card(MGMT, "mri_2").os).toBe("");
  });

  it("tells the CISO what infected a device in the active run", () => {
    call(CISO, mod.run_start, {
      session_id: "demo", run_id: "run_1", label: "Baseline", patient_zero: "mri_2", seed: 1337, speed: 1, policy_json: "", pair_id: "", autoplay: true,
    });
    for (let i = 0; i < 48; i++) for (const timer of rows("tick_timer")) call(SCHED, mod.run_tick, { arg: timer });
    const hit = rows("device_state").find((d) => d.run_id === "run_1" && d.infected && d.infected_by);
    expect(hit).toBeDefined();
    const by = h.devices.find((d) => d.id === hit.infected_by)!.name;
    expect(card(CISO, hit.device_id).infected_by).toBe(by);
    expect(card(MGMT, hit.device_id).infected_by).toBe("");
  });

  it("follows a role change on the presence row, and returns nothing before joining", () => {
    call(MGMT, mod.presence_join, { session_id: "demo", name: "Mo", role: "security" });
    expect(card(MGMT, "mri_2").vlan).not.toBe("");
    expect(view(STRANGER, mod.my_device_card)).toEqual([]);
  });
});

describe("my_arcs", () => {
  const active = h.flows.filter((f) => f.active !== false);

  it("draws every flow with protocol and port for the CISO", () => {
    const arcs = view(CISO, mod.my_arcs);
    expect(arcs).toHaveLength(active.length);
    expect(arcs.every((a) => a.kind === "flow" && a.emphasis === "normal" && /^[A-Za-z0-9]+ \d+$/.test(a.label))).toBe(true);
  });

  it("emphasizes protected, DICOM and HL7 flows for Clinical IT and fades the rest", () => {
    const arcs = view(CLIN, mod.my_arcs);
    expect(arcs).toHaveLength(active.length);
    for (const a of arcs) {
      const f = active.find((x) => x.id === a.id)!;
      expect(a.emphasis).toBe(f.protected || f.protocol === "dicom" || f.protocol === "hl7" ? "strong" : "faint");
    }
  });

  it("replaces device-to-device flows with service dependencies for Management", () => {
    const arcs = view(MGMT, mod.my_arcs);
    expect(arcs.some((a) => a.kind === "flow")).toBe(false);
    expect(arcs).toHaveLength(h.services.reduce((n, s) => n + s.dependsOnDevices.length, 0));
    expect(arcs.find((a) => a.id === "svc_mri:mri_2")).toMatchObject({ kind: "dependency", from_device: "mri_2", to_id: "svc_mri" });
  });
});
