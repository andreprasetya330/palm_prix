import assert from 'node:assert/strict'
import { getTrackSample, nearestTrack, ROAD_HALF_WIDTH, TRACK_LENGTH, TRACK_BOUNDS } from '../src/game/trackLayout'
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
assert(TRACK_LENGTH > 340 && TRACK_LENGTH < 430)
for (let i = 0; i < count; i++) for (const side of [-1, 1]) {
  const s = getTrackSample(i / count), p = s.point.clone().addScaledVector(s.normal, side * ROAD_HALF_WIDTH)
  const nearest = nearestTrack(p.x, p.z)
  assert(nearest.distance > ROAD_HALF_WIDTH - 0.04 && nearest.distance < ROAD_HALF_WIDTH + 0.04)
}
console.log(`PASS sixteen-metre corridor stays clear over ${TRACK_LENGTH.toFixed(1)} metres`)
// Closest architecture edges: pit facade, grandstand fronts, and scanned pit barriers.
for (let x = -46; x <= 46; x += 1) {
  assert(nearestTrack(x, 35.8 * 1.7).distance > ROAD_HALF_WIDTH + 2)
  assert(nearestTrack(x, -40.5 * 1.7).distance > ROAD_HALF_WIDTH + 2)
}
for (let z = -50; z <= 50; z += 1) for (const side of [-1, 1]) assert(nearestTrack(side * 43.5 * 1.7, z).distance > ROAD_HALF_WIDTH + 2)
for (let x = -30; x <= 30; x += 1) assert(nearestTrack(x, 34 * 1.7).distance > ROAD_HALF_WIDTH + 2)
console.log('PASS grandstands, garages, and service barriers remain clear of the road')
let race: RaceStatus = { ...createRaceStatus(), phase: 'racing' }
for (let lap = 0; lap < 3; lap++) for (const t of [0.25, 0.5, 0.75, 0]) { const p = getTrackSample(t).point; race = updateCheckpoints(race, p.x, p.z) }
assert.equal(race.phase, 'finish'); assert.equal(race.checkpointsHit, 12)
console.log('PASS enlarged circuit preserves ordered three-lap finish')
console.log('Track bounds', TRACK_BOUNDS)

