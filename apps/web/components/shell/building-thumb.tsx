import type { Hospital, Point } from "@/lib/stdb/types";

// A small isometric drawing of a hospital file: floors stacked top to bottom,
// low room walls, one dot per device. Drawn from the file, nothing simulated.
const S = 4.4; // px per metre
const K = 0.5 * S; // vertical squash
const COS = 0.866 * S;
const SLAB = 4; // slab thickness
const WALL = 5; // wall height
const GAP = 40; // space between floors

export function BuildingThumb({ hospital, className }: { hospital: Hospital; className?: string }) {
  const xs = hospital.rooms.flatMap((r) => r.polygon.map((p) => p[0]));
  const ys = hospital.rooms.flatMap((r) => r.polygon.map((p) => p[1]));
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const floors = [...hospital.floors].sort((a, b) => b.level - a.level);
  const floorH = (x1 - x0 + y1 - y0) * K + SLAB;
  const ox = (y1 - y0) * COS + 8;
  const w = ox + (x1 - x0) * COS + 8;
  const h = floors.length * floorH + (floors.length - 1) * GAP + WALL + 10;

  const P = (x: number, y: number, fi: number, z = 0): Point => [
    ox + (x - x0 - (y - y0)) * COS,
    WALL + 5 + fi * (floorH + GAP) + (x - x0 + (y - y0)) * K - z,
  ];
  const pts = (a: Point[]) => a.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const roomFloor = new Map(hospital.rooms.map((r) => [r.id, r.floorId]));

  return (
    <svg
      viewBox={`0 0 ${w.toFixed(0)} ${h.toFixed(0)}`}
      className={className}
      role="img"
      aria-label={`Model of ${hospital.name}: ${hospital.floors.length} floors with every device shown.`}
    >
      {floors.map((f, fi) => {
        const a = P(x0, y1, fi), b = P(x1, y1, fi), c = P(x1, y0, fi), t = P(x0, y0, fi);
        return (
          <g key={f.id}>
            <polygon points={pts([a, b, [b[0], b[1] + SLAB], [a[0], a[1] + SLAB]])} fill="#16191B" stroke="#3C4247" strokeWidth={0.75} />
            <polygon points={pts([b, c, [c[0], c[1] + SLAB], [b[0], b[1] + SLAB]])} fill="#1A1D20" stroke="#3C4247" strokeWidth={0.75} />
            <polygon points={pts([t, c, b, a])} fill="#1D2023" stroke="#3C4247" strokeWidth={0.75} />
            {hospital.rooms
              .filter((r) => r.floorId === f.id)
              .flatMap((r) =>
                r.polygon.map((p, i) => {
                  const q = r.polygon[(i + 1) % r.polygon.length];
                  return (
                    <polygon
                      key={`${r.id}-${i}`}
                      points={pts([P(p[0], p[1], fi), P(q[0], q[1], fi), P(q[0], q[1], fi, WALL), P(p[0], p[1], fi, WALL)])}
                      fill="#2A2E32"
                      fillOpacity={0.5}
                      stroke="#3C4247"
                      strokeWidth={0.5}
                    />
                  );
                }),
              )}
            {hospital.devices
              .filter((d) => roomFloor.get(d.roomId) === f.id)
              .map((d) => {
                const [cx, cy] = P(d.position[0], d.position[1], fi, 2);
                return <circle key={d.id} cx={cx} cy={cy} r={1.5} fill="#4DB0FF" fillOpacity={0.9} />;
              })}
          </g>
        );
      })}
    </svg>
  );
}
