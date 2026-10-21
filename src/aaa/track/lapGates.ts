import { CHECKPOINT_ANGLES } from '../../game/raceLoop'
import { getTrackFrames, trackLength } from './spline'

/**
 * `updateCheckpoints` only counts a gate while the kart is inside the old
 * origin annulus, 12 < r < 26, and within 0.35 rad of the next bearing.
 * On Lagoon Loop that annulus crosses the asphalt twice: the north arc, then
 * the return onto the start straight. The back straight is x = -32, so a
 * bearing there can never count. These four bearings sit on those two
 * crossings, in the order a kart leaving the grid meets them.
 */
const ANNULUS_MIN = 12
const ANNULUS_MAX = 26

type Span = { start: number; end: number }

function inAnnulus(x: number, z: number): boolean {
  const r = Math.hypot(x, z)
  return r > ANNULUS_MIN && r < ANNULUS_MAX
}

/** Centerline spans inside the annulus. A crossing split by the seam is one span. */
function annulusSpans(): Span[] {
  const frames = getTrackFrames()
  const length = trackLength()
  const spans: Span[] = []
  let start: number | null = null
  for (const frame of frames) {
    if (inAnnulus(frame.p.x, frame.p.z)) {
      if (start === null) start = frame.distance
    } else if (start !== null) {
      spans.push({ start, end: frame.distance })
      start = null
    }
  }
  if (start !== null) spans.push({ start, end: length })

  if (spans.length >= 2) {
    const first = spans[0]
    const last = spans[spans.length - 1]
    if (first.start <= 0.05 && last.end >= length - 0.05) {
      spans[spans.length - 1] = { start: last.start, end: length + first.end }
      spans.shift()
    }
  }
  return spans
}

function bearingAt(distance: number): number {
  const frames = getTrackFrames()
  const length = trackLength()
  let d = distance % length
  if (d < 0) d += length
  let frame = frames[0]
  for (const candidate of frames) {
    if (candidate.distance <= d) frame = candidate
    else break
  }
  return Math.atan2(frame.p.x, frame.p.z)
}

/** Two bearings on each annulus crossing, ahead of the center grid slot. */
export function ribbonGateAngles(): number[] {
  const frames = getTrackFrames()
  let grid = 0
  let best = Infinity
  for (const frame of frames) {
    const dd = frame.p.x * frame.p.x + (frame.p.z - 8) * (frame.p.z - 8)
    if (dd < best) {
      best = dd
      grid = frame.distance
    }
  }

  const ahead = annulusSpans()
    .filter((span) => span.start > grid + 1)
    .sort((a, b) => a.start - b.start)

  const angles: number[] = []
  for (const span of ahead) {
    const along = span.end - span.start
    angles.push(bearingAt(span.start + along * 0.32))
    angles.push(bearingAt(span.start + along * 0.68))
  }
  return angles
}

/** Point the race-loop bearings at the ribbon. The array is read live. */
export function placeLapGates(): number[] {
  const angles = ribbonGateAngles()
  if (angles.length < 2) return [...CHECKPOINT_ANGLES]
  CHECKPOINT_ANGLES.splice(0, CHECKPOINT_ANGLES.length, ...angles)
  return angles
}

placeLapGates()
