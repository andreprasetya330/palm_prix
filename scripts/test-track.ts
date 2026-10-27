import assert from 'node:assert/strict'
import { getTrackSample, nearestTrack, ROAD_HALF_WIDTH, TRACK_LENGTH, TRACK_BOUNDS, getTrackSurface, getRoadPose, ELEVATION_PROFILE, COURSE_SECTORS, getCourseSector } from '../src/game/trackLayout'
import { createRaceStatus, updateCheckpoints, type RaceStatus } from '../src/game/raceLoop'
const count = 256
const borders = [-1, 1].map(side => Array.from({ length: count }, (_, i) => { const s = getTrackSample(i / count); return s.point.clone().addScaledVector(s.normal, side * (ROAD_HALF_WIDTH + 2)) }))
const cross = (a: { x: number; z: number }, b: { x: number; z: number }, c: { x: number; z: number }) => (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x)
for (let a = 0; a < 2; a++) for (let b = a; b < 2; b++) for (let i = 0; i < count; i++) for (let j = 0; j < count; j++) {
  if (a === b && (Math.abs(i - j) <= 1 || Math.abs(i - j) >= count - 1)) continue
  const p = borders[a][i], q = borders[a][(i + 1) % count], r = borders[b][j], s = borders[b][(j + 1) % count]
  assert(!(cross(p, q, r) * cross(p, q, s) < -1e-8 && cross(r, s, p) * cross(r, s, q) < -1e-8), `Road/runoff intersects at ${i}, ${j}`)
}
console.log('PASS full-width road and two-metre runoff have no self-intersections')
assert.equal(ROAD_HALF_WIDTH, 8)
assert(TRACK_LENGTH > 740 && TRACK_LENGTH < 850,'Full city tour must remain substantially longer than the former 431m loop')
for (let i = 0; i < count; i++) for (const side of [-1, 1]) {
  const s = getTrackSample(i / count), p = s.point.clone().addScaledVector(s.normal, side * ROAD_HALF_WIDTH)
  const nearest = nearestTrack(p.x, p.z)
  assert(nearest.distance > ROAD_HALF_WIDTH - 0.04 && nearest.distance < ROAD_HALF_WIDTH + 0.04)
}
console.log(`PASS sixteen-metre corridor stays clear over ${TRACK_LENGTH.toFixed(1)} metres`)
// City gateway and tunnel stay outside the road corridor.
for (const t of [.025,.43]) for (const side of [-1,1]) {
  const s=getTrackSample(t),p=s.point.clone().addScaledVector(s.normal,side*10.3)
  assert(nearestTrack(p.x,p.z).distance>ROAD_HALF_WIDTH+1.5)
}
console.log('PASS city gateway and tunnel supports clear the drivable road')
let race: RaceStatus = { ...createRaceStatus(), phase: 'racing' }
for (let lap = 0; lap < 3; lap++) for (const t of [0.25, 0.5, 0.75, 0]) { const p = getTrackSample(t).point; race = updateCheckpoints(race, p.x, p.z) }
assert.equal(race.phase, 'finish'); assert.equal(race.checkpointsHit, 12)
console.log('PASS enlarged circuit preserves ordered three-lap finish')
console.log('Track bounds', TRACK_BOUNDS)



// Elevation keeps the original XZ driving frame while adding smooth road poses.
let minHeight = Infinity, maxHeight = -Infinity, maxGrade = 0
for (let i = 0; i < 2000; i++) {
  const t = i / 2000, s = getTrackSample(t)
  assert(Math.abs(s.tangent.y) < 1e-12 && Math.abs(s.tangent.length() - 1) < 1e-10)
  assert(Math.abs(s.normal.y) < 1e-12 && Math.abs(s.normal.length() - 1) < 1e-10)
  assert(Math.abs(s.bank) <= .1)
  minHeight = Math.min(minHeight, s.height); maxHeight = Math.max(maxHeight, s.height)
  for (const lane of [-ROAD_HALF_WIDTH, 0, ROAD_HALF_WIDTH]) {
    const surface = getTrackSurface(t, lane)
    maxGrade = Math.max(maxGrade, Math.abs(surface.grade))
    const before = getTrackSurface(t - 1e-5, lane), after = getTrackSurface(t + 1e-5, lane)
    const derivative = (after.height - before.height) / (2e-5 * TRACK_LENGTH)
    assert(Math.abs(surface.grade - derivative) < 1e-5)
    assert(Math.abs(surface.point.y - surface.height) < 1e-10)
    const pose = getRoadPose(surface.point.x, surface.point.z)
    assert(Math.abs(pose.height - surface.height) < .025)
  }
  const near = nearestTrack(s.point.x, s.point.z)
  assert(Math.abs(near.point.y - s.height) < .015)
}
assert(minHeight === 0 && maxHeight >= 23.99)
assert(maxGrade <= .38)
for (const t of [0, 1]) {
  const s = getTrackSurface(t)
  assert(Math.abs(s.height) < 1e-10 && Math.abs(s.pitch) < 1e-10 && Math.abs(s.bank) < 1e-10)
}
for (const [t] of ELEVATION_PROFILE) {
  const a = getTrackSurface(t - 1e-6), b = getTrackSurface(t + 1e-6)
  assert(Math.abs(a.height - b.height) < .0001)
  assert(Math.abs(a.grade - b.grade) < .0001)
}
console.log(`PASS seamless C2 ramps, horizontal physics frames, bank and surface projection; height ${minHeight}–${maxHeight}m, max grade ${maxGrade.toFixed(3)}`)
assert.equal(COURSE_SECTORS.length,7)
for(let i=0;i<COURSE_SECTORS.length;i++){
  const sector=COURSE_SECTORS[i]
  assert(sector.end>sector.start)
  assert.equal(sector.start,i===0?0:COURSE_SECTORS[i-1].end)
  assert.equal(getCourseSector((sector.start+sector.end)/2).name,sector.name)
}
assert.equal(COURSE_SECTORS.at(-1)!.end,1)
assert.equal(getCourseSector(1).name,COURSE_SECTORS[0].name)
assert.equal(getCourseSector(-.01).name,COURSE_SECTORS.at(-1)!.name)
console.log('PASS seven connected named districts cover the complete course without metadata gaps')
