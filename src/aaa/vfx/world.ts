/** World spots the presentation reads. Positions match the current oval props. */

export const ITEM_BOXES = [0.35, 1.05, 1.75, 2.45].map((t) => {
  const r = 18
  return {
    x: Math.sin(t) * r * 1.15,
    y: 1.15,
    z: Math.cos(t) * r,
  }
})

export const POND = { x: 0, z: 0, radius: 4.2 }

export const SAND = [
  { x: -26, z: 8, radius: 5.5 },
  { x: 24, z: -14, radius: 4.2 },
]

/** Oval radius used by the asphalt ribbon (x stretched 1.15). */
export function ovalRadius(x: number, z: number): number {
  return Math.hypot(x / 1.15, z)
}

export function onAsphalt(x: number, z: number): boolean {
  const r = ovalRadius(x, z)
  return r > 14.15 && r < 21.85
}

export function onSand(x: number, z: number): boolean {
  for (const s of SAND) {
    const dx = x - s.x
    const dz = z - s.z
    if (dx * dx + dz * dz < s.radius * s.radius) return true
  }
  return false
}

export function inPond(x: number, z: number): boolean {
  const dx = x - POND.x
  const dz = z - POND.z
  return dx * dx + dz * dz < (POND.radius + 0.45) * (POND.radius + 0.45)
}
