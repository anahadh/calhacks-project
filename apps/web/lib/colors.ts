// Scene colors from the Hippocra.tech design system (graphite theme).
// The building is matte graphite clay; infection is the only light in it.
export const C = {
  bg: "#111315", // scene-ground: canvas background and fog
  slab: "#1D2023",
  slabEdge: "#3C4247",
  wall: "#2A2E32",
  healthy: "#4DB0FF",
  infected: "#FF6A2E",
  zero: "#FF3B3B", // patient zero
  ok: "#DDE4EA",
  delayed: "#FFC53D",
  disrupted: "#FF4778",
  zone: "#B08CFF",
  cut: "#6B7378",
  muted: "#7D858B",
  // Scene design (isometric floating slabs, icon chips, dotted infection paths).
  slabTop: "#15181B", // the flat top of a floating floor slab
  slabSide: "#1A1D20", // its thin side face
  slabRim: "#4A5157", // the thin light outline around a slab
  roomLine: "#3A4046", // room outlines drawn on the slab
  roomTint: "#FF6A2E", // infected rooms: warm translucent orange over the slab
  stem: "#2F363B", // a device chip's stem and base ellipse
  chipBg: "rgba(17,19,21,0.94)", // dark chip fill behind the glyph
  pill: "rgba(21,24,27,0.95)", // room-name slab pills on the floor
  // The clinic itself (building.tsx, furniture.tsx): a cutaway floor plan in graphite clay.
  corridor: "#22272B", // the ground slab, which shows as the corridor between rooms
  corridorLine: "#2E343A", // the faint tile grid on the corridor
  roomFloor: "#1B1F22", // a room's floor plate
  roomFloorEdge: "#2A3036", // the skirting line where a room floor meets its walls
  wallFace: "#30363C", // wall sides
  wallCap: "#596169", // the lighter top of each wall, so the plan reads from above
  entranceMat: "#2C3238", // the mat outside the main entrance
  furniture: "#2B3137", // desks, counters, cabinets, housings
  furnitureLight: "#3A4148", // tops, mattresses, screens
  linen: "#8A949C", // pillows and sheets, the lightest clay in the room
  metal: "#4F5860", // poles, lamp arms, rack frames
  // People (patients.tsx): one figure per patient counted, colored by the group's patient_state row.
  personOk: "#6FCF97",
  personDelayed: "#FFC53D",
  personDisrupted: "#FF4778",
} as const;

// Motion (ms), from the design system's duration tokens. Timing only: never add an animation.
export const MOTION = {
  heartbeat: 1000, // one infected-device pulse (60 bpm), sine in-out
  flash: 600, // white -> infected on infection
  fade: 400, // room tint, service down, toast in/out
  messageMin: 1200, // UX rule 5
  toastMin: 2000,
  roomTintMax: 0.22,
  zoneFill: 0.1,
} as const;
