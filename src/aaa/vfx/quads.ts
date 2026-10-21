import * as THREE from 'three'

const _corner = new THREE.Vector3()

export type Rgba = { r: number; g: number; b: number; a: number }

/** Append a camera-facing quad. axisA/axisB are half-extents. Returns next vertex. */
export function writeQuad(
  positions: Float32Array,
  colors: Float32Array,
  vertex: number,
  center: THREE.Vector3,
  axisA: THREE.Vector3,
  axisB: THREE.Vector3,
  color: Rgba,
): number {
  const signs: ReadonlyArray<readonly [number, number]> = [
    [1, 1],
    [-1, 1],
    [-1, -1],
    [1, 1],
    [-1, -1],
    [1, -1],
  ]
  for (const [s, t] of signs) {
    _corner.copy(center)
    _corner.addScaledVector(axisA, s)
    _corner.addScaledVector(axisB, t)
    const p = vertex * 3
    const c = vertex * 4
    positions[p] = _corner.x
    positions[p + 1] = _corner.y
    positions[p + 2] = _corner.z
    colors[c] = color.r
    colors[c + 1] = color.g
    colors[c + 2] = color.b
    colors[c + 3] = color.a
    vertex += 1
  }
  return vertex
}

export function makePaintedGeometry(maxVerts: number): THREE.BufferGeometry {
  const geom = new THREE.BufferGeometry()
  const positions = new THREE.BufferAttribute(new Float32Array(maxVerts * 3), 3)
  const colors = new THREE.BufferAttribute(new Float32Array(maxVerts * 4), 4)
  positions.setUsage(THREE.DynamicDrawUsage)
  colors.setUsage(THREE.DynamicDrawUsage)
  geom.setAttribute('position', positions)
  geom.setAttribute('color', colors)
  geom.setDrawRange(0, 0)
  geom.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 200)
  return geom
}

export function paint(
  geom: THREE.BufferGeometry,
  vertexCount: number,
): void {
  const position = geom.getAttribute('position')
  const color = geom.getAttribute('color')
  position.needsUpdate = true
  color.needsUpdate = true
  geom.setDrawRange(0, vertexCount)
}

export function kartToWorld(
  x: number,
  z: number,
  yaw: number,
  lx: number,
  ly: number,
  lz: number,
  out: THREE.Vector3,
): THREE.Vector3 {
  const s = Math.sin(yaw)
  const c = Math.cos(yaw)
  return out.set(x + c * lx + s * lz, ly, z - s * lx + c * lz)
}

export function kartAxes(
  yaw: number,
  forward: THREE.Vector3,
  right: THREE.Vector3,
): void {
  const s = Math.sin(yaw)
  const c = Math.cos(yaw)
  forward.set(s, 0, c)
  right.set(c, 0, -s)
}
