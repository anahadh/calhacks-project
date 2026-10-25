import { beforeEach, describe, expect, it } from "vitest";
import { ConnectionId } from "spacetimedb";
import { createModuleTestHarness, TestAuth } from "spacetimedb/server/test-utils";
import type { Hospital } from "../src/hospital";
import demo from "../../data/hospitals/demo.json";
import spacetimedb, * as mod from "../src/index";
import { MAX_LINES } from "../src/role_views";
import { HANDWRITTEN } from "./oracle";

const h = (demo as unknown as { hospital: Hospital }).hospital;
const user = (sub: string) => TestAuth.fromJwtPayload(JSON.stringify({ iss: "hippo-test", sub, aud: ["spacetimedb"] }), ConnectionId.random());
const SERVER = user("server");
const CISO = user("ciso"); // presenter
const NET = user("net");
const CLIN = user("clin");
const MGMT = user("mgmt");
const STRANGER = user("stranger"); // never joins

type H = ReturnType<typeof createModuleTestHarness<any>>;
let t: H;
const call = (auth: any, fn: any, args: object = {}) => t.withReducerTx(auth, (ctx: any) => fn(ctx, args));
const rows = (table: string) => [...(t.db as any)[table].iter()] as any[];
const view = (auth: any, fn: any) => fn(t.viewContext(auth), {}) as any[];
const card = (auth: any, deviceId: string) => view(auth, mod.my_device_card).find((c) => c.device_id === deviceId);
/** A card's lines as label → value. */
const lines = (auth: any, deviceId: string) => new Map<string, string>(JSON.parse(card(auth, deviceId).lines_json));

beforeEach(() => {
  t = createModuleTestHarness(spacetimedb as any, mod as any);
  call(SERVER, mod.init);
  call(CISO, mod.session_create, { session_id: "demo", hospital_json: JSON.stringify(demo) });
  call(CISO, mod.presence_join, { session_id: "demo", name: "Ana", role: "security" });
  call(NET, mod.presence_join, { session_id: "demo", name: "Nik", role: "network" });
  call(CLIN, mod.presence_join, { session_id: "demo", name: "Dev", role: "clinical_engineering" });
  call(MGMT, mod.presence_join, { session_id: "demo", name: "Mo", role: "operations" });
});

describe("my_device_card", () => {
  it("keeps every card short: at most MAX_LINES lines, for every device and role", () => {
    for (const auth of [CISO, NET, CLIN, MGMT]) {
      const cards = view(auth, mod.my_device_card);
      expect(cards).toHaveLength(h.devices.length);
      for (const c of cards) expect(JSON.parse(c.lines_json).length).toBeLessThanOrEqual(MAX_LINES);
    }
  });

  it("gives each role its own lens on the same MRI", () => {
    expect([...lines(CISO, "mri_2").keys()]).toEqual(["Risk", "Exposure"]);
    expect(lines(CISO, "mri_2").get("Risk")).toBe("Vulnerable · Windows 7");
    expect(lines(CISO, "mri_2").get("Exposure")).toBe("1 SMB/RDP link");

    expect(lines(NET, "mri_2").get("VLAN")).toMatch(/^10 · /);
    expect(lines(NET, "mri_2").get("Ports")).toMatch(/^DICOM 104 → PACS \+1 more$/);

    expect(lines(CLIN, "mri_2").get("Clinical flow")).toBe("Scans to radiologists");
    expect(lines(CLIN, "mri_2").get("Supports")).toBe("MRI imaging (critical)");

    expect(lines(MGMT, "mri_2").get("Patients")).toMatch(/^\d+ depend on it$/);
    expect(lines(MGMT, "mri_2").get("If it fails")).toContain("Scheduled MRI scans can't run");
    // Management never sees the technical lines.
    for (const k of ["Risk", "VLAN", "Ports", "Criticality"]) expect(lines(MGMT, "mri_2").has(k)).toBe(false);
  });

  it("tells the CISO what infected a device in the active run", () => {
    // A run on the fixture hospital, fed frame by frame as the run watcher does.
    const fx = HANDWRITTEN.base;
    call(CISO, mod.session_create, { session_id: "fx", hospital_json: fx.hospitalJson });
    call(CISO, mod.presence_join, { session_id: "fx", name: "Ana", role: "security" });
    call(MGMT, mod.presence_join, { session_id: "fx", name: "Mo", role: "operations" });
    call(CISO, mod.run_start, {
      session_id: "fx", run_id: "run_1", label: "Baseline", patient_zero: fx.patientZero, seed: 1337, speed: 1, policy_json: "", pair_id: "", autoplay: true,
    });
    for (let k = 0; k <= fx.finalTick; k++) {
      call(SERVER, mod.run_frames_apply, { frames_json: JSON.stringify([{ runId: "run_1", frame: fx.frames[k] }]) });
    }
    const hit = rows("device_state").find((d) => d.run_id === "run_1" && d.infected && d.infected_by);
    expect(hit).toBeDefined();
    const fxHospital = JSON.parse(fx.hospitalJson).hospital as Hospital;
    expect(lines(CISO, hit.device_id).get("Infected by")).toBe(fxHospital.devices.find((d) => d.id === hit.infected_by)!.name);
    expect(lines(MGMT, hit.device_id).has("Infected by")).toBe(false);
  });

  it("follows a role change on the presence row, and returns nothing before joining", () => {
    call(MGMT, mod.presence_join, { session_id: "demo", name: "Mo", role: "network" });
    expect(card(MGMT, "mri_2").viewer_role).toBe("network");
    expect(lines(MGMT, "mri_2").has("VLAN")).toBe(true);
    expect(view(STRANGER, mod.my_device_card)).toEqual([]);
  });
});

describe("my_arcs", () => {
  const active = h.flows.filter((f) => f.active !== false);

  it("emphasizes lateral-movement links (SMB, RDP) for the CISO", () => {
    const arcs = view(CISO, mod.my_arcs);
    expect(arcs).toHaveLength(active.length);
    for (const a of arcs) {
      const f = active.find((x) => x.id === a.id)!;
      expect(a.emphasis).toBe(f.protocol === "smb" || f.protocol === "rdp" ? "strong" : "faint");
    }
  });

  it("labels every flow with protocol and port for the Network Engineer", () => {
    const arcs = view(NET, mod.my_arcs);
    expect(arcs).toHaveLength(active.length);
    expect(arcs.every((a) => a.kind === "flow" && /^[A-Za-z0-9]+ \d+$/.test(a.label))).toBe(true);
  });

  it("emphasizes protected, DICOM and HL7 flows for Clinical IT and fades the rest", () => {
    for (const a of view(CLIN, mod.my_arcs)) {
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
