import { CatmullRomCurve3, Vector3 } from 'three'

export const ROAD_HALF_WIDTH = 4.5
/** Closed coast circuit: start straight, sweeping cape, inland S, and marina hairpin. */
const curve = new CatmullRomCurve3([
  [0, 26], [20, 26], [33, 15], [30, -1], [13, -8], [22, -23],
  [5, -32], [-20, -26], [-31, -10], [-20, 1], [-29, 15], [-18, 26],
].map(([x, z]) => new Vector3(x, 0, z)), true, 'centripetal')
curve.arcLengthDivisions = 2048
export const TRACK_LENGTH = curve.getLength()
const wrap = (t: number) => ((t % 1) + 1) % 1
export function getTrackPoint(t: number) { return curve.getPointAt(wrap(t)) }
export function getTrackSample(t: number) {
  t = wrap(t)
  const point = getTrackPoint(t), tangent = curve.getTangentAt(t).normalize()
  const normal = new Vector3(tangent.z, 0, -tangent.x)
  return { point, tangent, normal, yaw: Math.atan2(tangent.x, tangent.z), t }
}
const COUNT = 512
export const TRACK_SAMPLES = Array.from({ length: COUNT + 1 }, (_, i) => getTrackSample(i / COUNT))
/** Project onto the sampled centerline segments, retaining continuous arc progress. */
export function nearestTrack(x: number, z: number) {
  let bestDistanceSq = Infinity, bestT = 0, px = 0, pz = 0
  for (let i = 0; i < COUNT; i++) {
    const a = TRACK_SAMPLES[i].point, b = TRACK_SAMPLES[i + 1].point
    const dx = b.x - a.x, dz = b.z - a.z
    const u = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)))
    const qx = a.x + dx * u, qz = a.z + dz * u
    const distanceSq = (x - qx) ** 2 + (z - qz) ** 2
    if (distanceSq < bestDistanceSq) { bestDistanceSq = distanceSq; bestT = (i + u) / COUNT; px = qx; pz = qz }
  }
  const sample = getTrackSample(bestT)
  sample.point.set(px, 0, pz)
  return { ...sample, distance: Math.sqrt(bestDistanceSq), signedDistance: (x - px) * sample.normal.x + (z - pz) * sample.normal.z }
}
