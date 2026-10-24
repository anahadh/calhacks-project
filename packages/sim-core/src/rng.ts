// mulberry32. The whole generator state is one u32, stored on the run row,
// so a run can be resumed tick by tick and replayed exactly.

export function seedState(seed: number): number {
  return seed >>> 0;
}

/** Returns a float in [0, 1) and the next state. */
export function nextFloat(state: number): [value: number, next: number] {
  const next = (state + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, next];
}
