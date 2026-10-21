/** Small numeric helpers. All hot-path math stays finite and bounded. */

export function clamp(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return (lo + hi) / 2
  if (v < lo) return lo
  if (v > hi) return hi
  return v
}

export function finite(v: number, fallback = 0): number {
  return Number.isFinite(v) ? v : fallback
}

/** Wrap to (−π, π]. */
export function wrapAngle(a: number): number {
  if (!Number.isFinite(a)) return 0
  let x = a
  const tau = Math.PI * 2
  x = x % tau
  if (x > Math.PI) x -= tau
  if (x <= -Math.PI) x += tau
  return x
}

export function damp(current: number, target: number, lambda: number, dt: number): number {
  if (!Number.isFinite(current)) return target
  const a = 1 - Math.exp(-lambda * Math.max(0, dt))
  return current + (target - current) * a
}

export function dampAngle(current: number, target: number, lambda: number, dt: number): number {
  return wrapAngle(current + wrapAngle(target - current) * (1 - Math.exp(-lambda * Math.max(0, dt))))
}
