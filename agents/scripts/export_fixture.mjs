// Exports the hospital from apps/web/lib/stdb/mock-session.ts to
// agents/fixtures/hospital.json, in the upload file format (HOSPITAL_SCHEMA.md).
// Stand-in until data/hospitals/demo.json exists. Run from the repo root:
//
//   node agents/scripts/export_fixture.mjs
//
// Needs Node 22.18+ (built-in TypeScript type stripping).
//
// Adds one device the mock lacks, for the Inventory Agent: an unidentified
// device in Imaging with one SMB flow to an imaging workstation. All synthetic.

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const { mockSession } = await import(join(root, "apps/web/lib/stdb/mock-session.ts"));

const hospital = structuredClone(mockSession.hospital);

const imaging = hospital.rooms.find((r) => r.id === "rm_imaging");
if (!imaging || !hospital.devices.some((d) => d.id === "ws_img_1")) {
  throw new Error("mock-session.ts changed: rm_imaging or ws_img_1 is missing");
}

hospital.devices.push({
  id: "dev_unknown_7",
  roomId: imaging.id,
  type: "unknown",
  name: "Unidentified device",
  os: "unknown",
  vulnerable: true,
  criticality: "medium",
  vlan: 10,
  position: [38.5, 10.8], // inside rm_imaging (x 22–40, y 0–12), clear of the grid
});
hospital.flows.push({
  id: "fl_unknown_7_smb",
  from: "dev_unknown_7",
  to: "ws_img_1",
  protocol: "smb",
  port: 445,
  protected: false,
});

const out = join(root, "agents/fixtures/hospital.json");
writeFileSync(out, JSON.stringify({ schemaVersion: 1, hospital }, null, 2) + "\n");
console.log(`wrote ${out}: ${hospital.devices.length} devices, ${hospital.flows.length} flows`);
