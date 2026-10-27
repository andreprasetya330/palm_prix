import { CatmullRomCurve3, Vector3 } from 'three'

export const ROAD_HALF_WIDTH = 8
/** A full city tour: waterfront launch, coastal bridge, northern switchbacks and rooftop return. */
const curve = new CatmullRomCurve3([
  [0,64],[35,64],[65,46],[70,12],[62,-25],[72,-63],[58,-104],
  [28,-125],[0,-115],[-20,-150],[-60,-170],[-100,-155],[-114,-120],
  [-91,-91],[-100,-60],[-140,-57],[-164,-22],[-158,23],[-128,42],
  [-112,78],[-78,100],[-45,86],[-25,65],
].map(([x,z]) => new Vector3(x,0,z)).map((p,i,nodes) => p.clone().multiplyScalar(.5).addScaledVector(nodes[(i+nodes.length-1)%nodes.length],.25).addScaledVector(nodes[(i+1)%nodes.length],.25)),true,'centripetal')
curve.arcLengthDivisions = 2048
export const TRACK_LENGTH = curve.getLength()
const wrap = (t: number) => ((t % 1) + 1) % 1
export const COURSE_SECTORS = [
  {name:'Marina Launch',start:0,end:.15,label:'WATERFRONT / 01'},
  {name:'Coastal Skyway',start:.15,end:.34,label:'SUSPENSION BRIDGE / 02'},
  {name:'Sunset Switchbacks',start:.34,end:.49,label:'NORTH SHORE / 03'},
  {name:'Uptown Ascent',start:.49,end:.61,label:'CITY CLIMB / 04'},
  {name:'Rooftop Run',start:.61,end:.73,label:'SKYLINE / 05'},
  {name:'Night Market',start:.73,end:.89,label:'COVERED ARCADE / 06'},
  {name:'Neon Mile',start:.89,end:1,label:'HOME STRAIGHT / 07'},
] as const
export function getCourseSector(t:number){return COURSE_SECTORS.find(sector=>wrap(t)<sector.end)??COURSE_SECTORS[0]}
export const ELEVATION_PROFILE = [[0,0],[.035,0],[.19,18],[.33,18],[.445,6],[.59,24],[.70,24],[.865,0],[1,0]] as const
/** Quintic ramps have zero slope and curvature at each plateau transition. */
function elevation(t: number) {
  t = wrap(t)
  for (let i = 0; i < ELEVATION_PROFILE.length - 1; i++) {
    const [a, low] = ELEVATION_PROFILE[i], [b, high] = ELEVATION_PROFILE[i + 1]
    if (t > b) continue
    const u = (t - a) / (b - a), blend = u * u * u * (u * (u * 6 - 15) + 10)
    const height = low + (high - low) * blend
    const grade = (high - low) * 30 * u * u * (u - 1) * (u - 1) / ((b - a) * TRACK_LENGTH)
    const bank = .095 * Math.sin(t * Math.PI * 2) * height / 24
    const bankDerivative = .095 * (Math.PI * 2 * Math.cos(t * Math.PI * 2) * height / 24 + Math.sin(t * Math.PI * 2) * grade * TRACK_LENGTH / 24) / TRACK_LENGTH
    return { height, grade, bank, bankDerivative }
  }
  return { height: 0, grade: 0, bank: 0, bankDerivative: 0 }
}
export function getTrackPoint(t: number) {
  const point = curve.getPointAt(wrap(t)); point.y = elevation(t).height; return point
}
export function getTrackSample(t: number) {
  t = wrap(t)
  const point = getTrackPoint(t), tangent = curve.getTangentAt(t).normalize()
  const normal = new Vector3(tangent.z, 0, -tangent.x)
  const { height, grade, bank } = elevation(t)
  return { point, tangent, normal, yaw: Math.atan2(tangent.x, tangent.z), t, height, grade, pitch: Math.atan(grade), bank }
}
/** Surface convention: positive bank raises positive lane; lane is horizontal metres. */
export function getTrackSurface(t: number, lane = 0) {
  const sample = getTrackSample(t), e = elevation(t)
  const height = e.height + Math.tan(e.bank) * lane
  const grade = e.grade + lane * e.bankDerivative / Math.cos(e.bank) ** 2
  sample.point.addScaledVector(sample.normal, lane); sample.point.y = height
  return { ...sample, height, grade, pitch: Math.atan(grade), lane }
}const COUNT = 1024
export const TRACK_SAMPLES = Array.from({ length: COUNT + 1 }, (_, i) => getTrackSample(i / COUNT))
export const TRACK_BOUNDS = {
  minX: Math.min(...TRACK_SAMPLES.map(s => s.point.x)) - ROAD_HALF_WIDTH,
  maxX: Math.max(...TRACK_SAMPLES.map(s => s.point.x)) + ROAD_HALF_WIDTH,
  minZ: Math.min(...TRACK_SAMPLES.map(s => s.point.z)) - ROAD_HALF_WIDTH,
  maxZ: Math.max(...TRACK_SAMPLES.map(s => s.point.z)) + ROAD_HALF_WIDTH,
}
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
  sample.point.set(px, sample.height, pz)
  return { ...sample, distance: Math.sqrt(bestDistanceSq), signedDistance: (x - px) * sample.normal.x + (z - pz) * sample.normal.z }
}




/** Project an arbitrary vehicle XZ position onto the banked road without changing physics XZ. */
export function getRoadPose(x: number, z: number) {
  const near = nearestTrack(x, z)
  // Refine only the visual pose: chord projection at an outer bank can otherwise
  // introduce a few centimetres of height chatter. Physics keeps its existing projection.
  let t = near.t
  for (let i = 0; i < 3; i++) {
    const s = getTrackSample(t), a = getTrackSample(t - .0001), b = getTrackSample(t + .0001)
    const dx = s.point.x - x, dz = s.point.z - z
    const derivative = TRACK_LENGTH + dx * (b.tangent.x - a.tangent.x) / .0002 + dz * (b.tangent.z - a.tangent.z) / .0002
    if (Math.abs(derivative) < 1) break
    t = wrap(t - Math.max(-.005, Math.min(.005, (dx * s.tangent.x + dz * s.tangent.z) / derivative)))
  }
  const sample = getTrackSample(t), lane = (x - sample.point.x) * sample.normal.x + (z - sample.point.z) * sample.normal.z
  const surface = getTrackSurface(t, lane)
  surface.point.set(x, surface.height, z)
  return { ...near, ...surface, distance: near.distance, signedDistance: lane }
}
