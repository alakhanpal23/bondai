// Shared monotonic timeline. First call captures the start time; subsequent
// calls return seconds elapsed since then. resetTimeline() forces a re-capture
// (used on Hero remount / HMR).

let start: number | null = null

export function getT(elapsedTime: number): number {
  if (start === null) start = elapsedTime
  return elapsedTime - start
}

export function resetTimeline(): void {
  start = null
}

export const clamp01 = (x: number): number => Math.max(0, Math.min(1, x))
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t
export const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = clamp01((x - e0) / (e1 - e0))
  return t * t * (3 - 2 * t)
}
