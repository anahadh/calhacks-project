/* The hospital floor as a PNG, for ASI:One cards (the agents put this URL in a card's image).
   GET /api/floor?start=mri_2&infected=a,b,c[&after=a,b][&title=...]
   With `after`, two floors side by side: without the plan and with it. Drawn from
   data/hospitals/demo.json and the device ids in the URL only (rule 16); no state, no secrets. */
import { ImageResponse } from "next/og";
import demo from "../../../../../data/hospitals/demo.json";

export const runtime = "edge";

type Room = { id: string; name: string; zone: string; polygon: number[][] };
type Device = { id: string; roomId: string; position?: number[] };
const H = (demo as { hospital: { rooms: Room[]; devices: Device[] } }).hospital;

const W = 1200;
const HGT = 675;
const ZONE: Record<string, string> = {
  critical_care: "#3b2a33", imaging: "#26344a", it_core: "#3a3424", clinical_support: "#24392f",
  inpatient: "#2c333d", business: "#303030", public: "#2b2d2d",
};
const xs = H.rooms.flatMap((r) => r.polygon.map((p) => p[0]));
const ys = H.rooms.flatMap((r) => r.polygon.map((p) => p[1]));
const X0 = Math.min(...xs), X1 = Math.max(...xs), Y0 = Math.min(...ys), Y1 = Math.max(...ys);

function ids(v: string | null): Set<string> {
  return new Set((v ?? "").split(",").map((s) => s.trim()).filter(Boolean));
}

function Floor({ w, h, infected, start, label, labels }: { w: number; h: number; infected: Set<string>; start: string; label?: string; labels: boolean }) {
  const pad = 16;
  const s = Math.min((w - 2 * pad) / (X1 - X0), (h - 2 * pad - (label ? 44 : 0)) / (Y1 - Y0));
  const ox = pad + (w - 2 * pad - s * (X1 - X0)) / 2;
  const oy = pad + (label ? 44 : 0);
  const hitRooms = new Set(H.devices.filter((d) => infected.has(d.id)).map((d) => d.roomId));
  const r = Math.max(5, s * 0.42);
  return (
    <div style={{ width: w, height: h, position: "relative", display: "flex" }}>
      {label ? (
        <div style={{ position: "absolute", left: pad + 4, top: 10, fontSize: 26, color: "#eef2ee", display: "flex" }}>{label}</div>
      ) : null}
      {H.rooms.map((room) => {
        const rx = Math.min(...room.polygon.map((p) => p[0])), ry = Math.min(...room.polygon.map((p) => p[1]));
        const rw = Math.max(...room.polygon.map((p) => p[0])) - rx, rh = Math.max(...room.polygon.map((p) => p[1])) - ry;
        const hit = hitRooms.has(room.id);
        return (
          <div key={room.id} style={{
            position: "absolute", left: ox + (rx - X0) * s, top: oy + (ry - Y0) * s, width: rw * s, height: rh * s,
            background: hit ? "#5a2a26" : ZONE[room.zone] ?? "#2b2d2d", border: `2px solid ${hit ? "#b0493f" : "#4f5a56"}`,
            borderRadius: 8, display: "flex", justifyContent: "center", paddingTop: 6,
          }}>
            {labels ? <div style={{ fontSize: 15, color: "#9aa59f", display: "flex" }}>{room.name}</div> : null}
          </div>
        );
      })}
      {H.devices.filter((d) => d.position).map((d) => {
        const x = ox + ((d.position as number[])[0] - X0) * s, y = oy + ((d.position as number[])[1] - Y0) * s;
        const isStart = d.id === start, hit = infected.has(d.id);
        const rr = isStart ? r + 5 : hit ? r + 2 : r;
        const fill = isStart ? "#ffc240" : hit ? "#e8544a" : "#8f9b95";
        return (
          <div key={d.id} style={{
            position: "absolute", left: x - rr, top: y - rr, width: rr * 2, height: rr * 2, borderRadius: rr, background: fill,
            boxShadow: isStart || hit ? `0 0 ${rr * 1.6}px ${fill}` : "none", display: "flex",
          }} />
        );
      })}
    </div>
  );
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const start = q.get("start") ?? "";
  const infected = ids(q.get("infected"));
  const after = q.has("after") ? ids(q.get("after")) : null;
  const title = q.get("title") ?? (after ? "Ransomware: without and with the agents' plan" : infected.size ? "Where the ransomware spreads" : "Your hospital");
  const sub = after
    ? `${infected.size} devices infected with no segmentation · ${after.size} with the plan`
    : infected.size ? `${infected.size} devices infected · gold = where it started` : `${H.rooms.length} rooms · ${H.devices.length} devices · synthetic`;
  return new ImageResponse(
    (
      <div style={{ width: W, height: HGT, background: "#181c1b", display: "flex", flexDirection: "column", padding: "28px 32px 20px" }}>
        <div style={{ fontSize: 40, color: "#eef2ee", display: "flex" }}>{title}</div>
        <div style={{ fontSize: 22, color: "#96a29b", marginTop: 6, display: "flex" }}>{sub}</div>
        <div style={{ display: "flex", marginTop: 18, gap: 16 }}>
          {after ? (
            <>
              <Floor w={560} h={500} infected={infected} start={start} label={`No segmentation · ${infected.size}`} labels={false} />
              <Floor w={560} h={500} infected={after} start={start} label={`With the plan · ${after.size}`} labels={false} />
            </>
          ) : (
            <Floor w={W - 64} h={520} infected={infected} start={start} labels />
          )}
        </div>
      </div>
    ),
    { width: W, height: HGT, headers: { "cache-control": "public, max-age=86400, immutable" } },
  );
}
