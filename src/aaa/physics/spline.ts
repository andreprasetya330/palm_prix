/**
 * Lagoon Loop centerline, mirrored from the track spline.
 * This branch does not carry `src/aaa/track`, so the numbers live here.
 * Right of travel is positive lateral (outside this clockwise loop).
 */
import { clamp } from './math'

export const TRACK_HALF = 3.62
export const CURB_0 = 3.52
export const CURB_1 = 4.46
export const SAND_0 = 4.42
export const SAND_1 = 6.7

export const LAGOON = { x: -12.2, z: 4.6, rx: 5.4, rz: 4.3 }

/** Center grid slot under the gate. Faces −Z, down the start straight. */
export const GRID_POSE = { x: 0, z: 8, yaw: Math.PI }

export type TrackFrame = {
  x: number
  z: number
  tx: number
  tz: number
  rx: number
  rz: number
  distance: number
}

export type TrackProjection = {
  x: number
  z: number
  tx: number
  tz: number
  rx: number
  rz: number
  lateral: number
  distance: number
}

type TrackCache = { frames: TrackFrame[]; length: number }

let cache: TrackCache | null = null

function pushLine(
  pts: { x: number; z: number }[],
  ax: number,
  az: number,
  bx: number,
  bz: number,
  n: number,
): void {
  for (let i = 0; i < n; i++) {
    const t = i / n
    pts.push({ x: ax + (bx - ax) * t, z: az + (bz - az) * t })
  }
}

function pushArc(
  pts: { x: number; z: number }[],
  cx: number,
  cz: number,
  r: number,
  a0: number,
  a1: number,
  n: number,
): void {
  for (let i = 0; i < n; i++) {
    const t = a0 + ((a1 - a0) * i) / n
    pts.push({ x: cx + r * Math.cos(t), z: cz + r * Math.sin(t) })
  }
}

function buildPoints(): { x: number; z: number }[] {
  const pts: { x: number; z: number }[] = []
  // Right straight, south → north. Travel is −Z. The kart at z = 8 sits on this line.
  pushLine(pts, 0, 16, 0, -2, 42)
  // North corner, left turn, bulging toward −Z.
  pushArc(pts, -16, -2, 16, 0, -Math.PI, 56)
  // Back straight, travel +Z.
  pushLine(pts, -32, -2, -32, 16, 42)
  // South corner, back to the straight.
  pushArc(pts, -16, 16, 16, Math.PI, 0, 56)
  return pts
}

function buildTrack(): TrackCache {
  const pts = buildPoints()
  const n = pts.length
  const frames: TrackFrame[] = []
  let distance = 0
  for (let i = 0; i < n; i++) {
    const next = pts[(i + 1) % n]
    let tx = next.x - pts[i].x
    let tz = next.z - pts[i].z
    const len = Math.hypot(tx, tz)
    if (len < 1e-8) {
      tx = 0
      tz = -1
    } else {
      tx /= len
      tz /= len
    }
    // right = tangent × up
    const rx = -tz
    const rz = tx
    frames.push({ x: pts[i].x, z: pts[i].z, tx, tz, rx, rz, distance })
    distance += len
  }
  return { frames, length: distance }
}

export function getTrack(): TrackCache {
  if (!cache) cache = buildTrack()
  return cache
}

export function trackLength(): number {
  return getTrack().length
}

export function projectTrack(x: number, z: number): TrackProjection {
  const { frames } = getTrack()
  const n = frames.length
  let bestD = Infinity
  let best: TrackProjection = {
    x: frames[0].x,
    z: frames[0].z,
    tx: frames[0].tx,
    tz: frames[0].tz,
    rx: frames[0].rx,
    rz: frames[0].rz,
    lateral: 0,
    distance: 0,
  }
  for (let i = 0; i < n; i++) {
    const a = frames[i]
    const b = frames[(i + 1) % n]
    const abx = b.x - a.x
    const abz = b.z - a.z
    const ab2 = abx * abx + abz * abz || 1
    let u = ((x - a.x) * abx + (z - a.z) * abz) / ab2
    if (u < 0) u = 0
    else if (u > 1) u = 1
    const px = a.x + abx * u
    const pz = a.z + abz * u
    const dx = x - px
    const dz = z - pz
    const d2 = dx * dx + dz * dz
    if (d2 < bestD) {
      bestD = d2
      best = {
        x: px,
        z: pz,
        tx: a.tx,
        tz: a.tz,
        rx: a.rx,
        rz: a.rz,
        lateral: dx * a.rx + dz * a.rz,
        distance: a.distance + Math.sqrt(ab2) * u,
      }
    }
  }
  return best
}

/** Centerline sample `ahead` meters in the race direction. */
export function pointAhead(distance: number, ahead: number): { x: number; z: number } {
  const { frames, length } = getTrack()
  const span = length > 1 ? length : 1
  let d = (distance + ahead) % span
  if (d < 0) d += span
  let lo = 0
  let hi = frames.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (frames[mid].distance <= d) lo = mid
    else hi = mid - 1
  }
  const a = frames[lo]
  const b = frames[(lo + 1) % frames.length]
  const seg = Math.hypot(b.x - a.x, b.z - a.z) || 1
  const u = clamp((d - a.distance) / seg, 0, 1)
  return { x: a.x + (b.x - a.x) * u, z: a.z + (b.z - a.z) * u }
}

export function ellipseValue(
  x: number,
  z: number,
  cx: number,
  cz: number,
  rx: number,
  rz: number,
): number {
  const dx = (x - cx) / rx
  const dz = (z - cz) / rz
  return dx * dx + dz * dz
}
