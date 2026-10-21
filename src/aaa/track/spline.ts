import * as THREE from 'three'

/**
 * Lagoon Loop ribbon.
 * The default kart pose is (0, 8) with yaw = π, which faces −Z.
 * The start straight runs along Z at x = 0 so that pose sits in the center grid slot,
 * under the gate, looking down the straight into the first left-hand corner.
 */
export const TRACK = {
  halfWidth: 3.62,
  curb0: 3.55,
  curb1: 4.42,
  edgeLat: 3.38,
  edgeWidth: 0.16,
  sand0: 4.42,
  sand1: 6.7,
  groundY: 0,
  dashLength: 1.45,
  dashGap: 1.7,
  dashWidth: 0.34,
} as const

/** Center slot is the default kart. Slots run across X; the straight runs along Z. */
export const GRID = {
  slotX: [-2.2, 0, 2.2] as const,
  z0: 6.55,
  z1: 9.75,
  gateZ: 8.15,
  lineZ: 6.28,
  lineDepth: 1.55,
}

export const LAGOON = { x: -12.2, z: 4.6, rx: 5.4, rz: 4.3 }

export type Frame = {
  p: THREE.Vector3
  tangent: THREE.Vector3
  /** Right of travel. Positive lateral is the outside of this clockwise loop. */
  right: THREE.Vector3
  bank: number
  distance: number
}

const UP = new THREE.Vector3(0, 1, 0)

function pushLine(
  pts: THREE.Vector3[],
  a: THREE.Vector3,
  b: THREE.Vector3,
  n: number,
) {
  for (let i = 0; i < n; i++) pts.push(a.clone().lerp(b, i / n))
}

function pushArc(
  pts: THREE.Vector3[],
  cx: number,
  cz: number,
  r: number,
  a0: number,
  a1: number,
  n: number,
) {
  for (let i = 0; i < n; i++) {
    const t = a0 + ((a1 - a0) * i) / n
    pts.push(new THREE.Vector3(cx + r * Math.cos(t), 0, cz + r * Math.sin(t)))
  }
}

function buildPoints(): THREE.Vector3[] {
  const pts: THREE.Vector3[] = []
  // Right straight, south → north. Travel is −Z. Kart at z = 8 sits on this line.
  pushLine(pts, new THREE.Vector3(0, 0, 16), new THREE.Vector3(0, 0, -2), 42)
  // North corner, left turn, bulging toward −Z.
  pushArc(pts, -16, -2, 16, 0, -Math.PI, 56)
  // Back straight, travel +Z.
  pushLine(pts, new THREE.Vector3(-32, 0, -2), new THREE.Vector3(-32, 0, 16), 42)
  // South corner, back to the straight.
  pushArc(pts, -16, 16, 16, Math.PI, 0, 56)
  return pts
}

function buildFrames(): Frame[] {
  const pts = buildPoints()
  const n = pts.length
  const frames: Frame[] = []
  for (let i = 0; i < n; i++) {
    const next = pts[(i + 1) % n]
    const tangent = next.clone().sub(pts[i])
    if (tangent.lengthSq() < 1e-8) tangent.set(0, 0, -1)
    tangent.normalize()
    const right = new THREE.Vector3().crossVectors(tangent, UP)
    if (right.lengthSq() < 1e-8) right.set(1, 0, 0)
    right.normalize()
    frames.push({
      p: pts[i],
      tangent,
      right,
      bank: 0,
      distance: 0,
    })
  }

  const raw = frames.map((_, i) => {
    const prev = frames[(i - 1 + n) % n].tangent
    const nxt = frames[(i + 1) % n].tangent
    return prev.angleTo(nxt)
  })
  const smooth = raw.slice()
  for (let pass = 0; pass < 4; pass++) {
    for (let i = 0; i < n; i++) {
      const a = smooth[(i - 1 + n) % n]
      const b = smooth[i]
      const c = smooth[(i + 1) % n]
      smooth[i] = a * 0.25 + b * 0.5 + c * 0.25
    }
  }
  let distance = 0
  for (let i = 0; i < n; i++) {
    frames[i].distance = distance
    frames[i].bank = THREE.MathUtils.clamp(0.015 + smooth[i] * 1.35, 0.015, 0.24)
    distance += frames[i].p.distanceTo(pts[(i + 1) % n])
  }

  const first = frames[0]
  frames.push({
    p: first.p.clone(),
    tangent: first.tangent.clone(),
    right: first.right.clone(),
    bank: first.bank,
    distance,
  })
  return frames
}

let cache: Frame[] | null = null

export function getTrackFrames(): Frame[] {
  if (!cache) cache = buildFrames()
  return cache
}

export function trackLength(): number {
  const frames = getTrackFrames()
  return frames[frames.length - 1].distance
}

/** Signed offset from the racing line. Negative is inside the loop. */
export function lateralOf(x: number, z: number): number {
  const frames = getTrackFrames()
  let best = Infinity
  let lateral = 0
  for (let i = 0; i < frames.length - 1; i++) {
    const frame = frames[i]
    const dx = x - frame.p.x
    const dz = z - frame.p.z
    const d2 = dx * dx + dz * dz
    if (d2 < best) {
      best = d2
      lateral = dx * frame.right.x + dz * frame.right.z
    }
  }
  return lateral
}

export function roadUp(frame: Frame, target = new THREE.Vector3()): THREE.Vector3 {
  const s = Math.sin(frame.bank)
  const c = Math.cos(frame.bank)
  return target.set(-frame.right.x * s, c, -frame.right.z * s).normalize()
}

export function bankedRight(frame: Frame, target = new THREE.Vector3()): THREE.Vector3 {
  const c = Math.cos(frame.bank)
  const s = Math.sin(frame.bank)
  return target.set(frame.right.x * c, s, frame.right.z * c).normalize()
}

/** Point on the banked deck. Positive lateral is outside / right of travel. */
export function pointOn(frame: Frame, lateral: number, lift = 0): THREE.Vector3 {
  const x = bankedRight(frame)
  const y = roadUp(frame)
  return new THREE.Vector3(
    frame.p.x + x.x * lateral + y.x * lift,
    frame.p.y + x.y * lateral + y.y * lift,
    frame.p.z + x.z * lateral + y.z * lift,
  )
}

const _x = new THREE.Vector3()
const _y = new THREE.Vector3()
const _z = new THREE.Vector3()

/** Right-handed basis: local X across the road, Y up the deck, Z along travel. */
export function frameMatrix(
  frame: Frame,
  lateral: number,
  lift: number,
  target: THREE.Matrix4,
): THREE.Matrix4 {
  bankedRight(frame, _x)
  _z.copy(frame.tangent)
  _y.crossVectors(_z, _x)
  if (_y.y < 0) {
    _x.negate()
    _y.negate()
  }
  _y.normalize()
  const p = pointOn(frame, lateral, lift)
  return target.makeBasis(_x, _y, _z).setPosition(p)
}
