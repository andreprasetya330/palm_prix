import * as THREE from 'three'
import { pointOn, roadUp, type Frame } from './spline'

function roadNormal(frame: Frame, target: THREE.Vector3): THREE.Vector3 {
  return roadUp(frame, target)
}

/** Smooth deck strip. Columns are lateral stations; V repeats every 4 meters. */
export function buildStrip(
  frames: Frame[],
  columns: { lat: number; lift: number }[],
): THREE.BufferGeometry {
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const colors: number[] = []
  const indices: number[] = []
  const cols = columns.length
  const up = new THREE.Vector3()
  const minLat = columns[0].lat
  const maxLat = columns[cols - 1].lat
  const span = Math.max(0.001, maxLat - minLat)

  for (let i = 0; i < frames.length; i++) {
    const f = frames[i]
    roadNormal(f, up)
    const shade = 0.92 + 0.08 * Math.sin(f.distance * 0.17)
    const v = f.distance / 4
    for (let k = 0; k < cols; k++) {
      const p = pointOn(f, columns[k].lat, columns[k].lift)
      positions.push(p.x, p.y, p.z)
      normals.push(up.x, up.y, up.z)
      uvs.push(((columns[k].lat - minLat) / span) * (span / 4), v)
      const edge = Math.abs(columns[k].lat) / Math.max(Math.abs(minLat), Math.abs(maxLat))
      const value = shade * (1 - edge * 0.18)
      colors.push(value, value, value)
    }
    if (i < frames.length - 1) {
      const row = i * cols
      const next = row + cols
      for (let k = 0; k < cols - 1; k++) {
        const a = row + k
        const b = row + k + 1
        const c = next + k
        const d = next + k + 1
        indices.push(a, c, b, b, c, d)
      }
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geo.setIndex(indices)
  return geo
}

/**
 * Flat-shaded candy curb. Faces are not welded, so each side keeps a hard
 * lit/shade break and the red/cream stripes do not blend.
 */
export function buildCurb(
  frames: Frame[],
  side: 1 | -1,
  stripe: number,
  hot: THREE.Color,
  cream: THREE.Color,
): THREE.BufferGeometry {
  const profile = [
    { lat: side * 3.52, lift: 0.0 },
    { lat: side * 3.7, lift: 0.18 },
    { lat: side * 4.28, lift: 0.2 },
    { lat: side * 4.46, lift: 0.0 },
  ]
  const cols = profile.length
  const ring: THREE.Vector3[] = []
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i]
    for (let k = 0; k < cols; k++) ring.push(pointOn(f, profile[k].lat, profile[k].lift))
  }

  const positions: number[] = []
  const normals: number[] = []
  const colors: number[] = []

  const face = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, color: THREE.Color) => {
    const abx = b.x - a.x
    const aby = b.y - a.y
    const abz = b.z - a.z
    const acx = c.x - a.x
    const acy = c.y - a.y
    const acz = c.z - a.z
    let nx = aby * acz - abz * acy
    let ny = abz * acx - abx * acz
    let nz = abx * acy - aby * acx
    const len = Math.hypot(nx, ny, nz) || 1
    nx /= len
    ny /= len
    nz /= len
    for (const p of [a, b, c]) {
      positions.push(p.x, p.y, p.z)
      normals.push(nx, ny, nz)
      colors.push(color.r, color.g, color.b)
    }
  }

  for (let i = 0; i < frames.length - 1; i++) {
    const color = Math.floor(frames[i].distance / stripe) % 2 === 0 ? hot : cream
    for (let k = 0; k < cols - 1; k++) {
      const a = ring[i * cols + k]
      const b = ring[i * cols + k + 1]
      const c = ring[(i + 1) * cols + k]
      const d = ring[(i + 1) * cols + k + 1]
      if (side > 0) {
        face(a, c, b, color)
        face(b, c, d, color)
      } else {
        face(a, b, c, color)
        face(b, d, c, color)
      }
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  return geo
}
