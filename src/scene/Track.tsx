import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { getTrackSample, getTrackSurface, ROAD_HALF_WIDTH, TRACK_LENGTH } from '../game/trackLayout'

const EDGE = ROAD_HALF_WIDTH + 1.68
function ribbon(inner: number, outer: number, y: number, rise = 0) {
  const positions: number[] = [], indices: number[] = []
  for (let i = 0; i <= 512; i++) {
    for (const [j, offset] of [inner, outer].entries()) { const p = getTrackSurface(i / 512, offset).point; positions.push(p.x, p.y + y + j * rise, p.z) }
    if (i < 512) { const n = i * 2; indices.push(n, n + 2, n + 1, n + 1, n + 2, n + 3) }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.setIndex(indices); g.computeVertexNormals(); return g
}
/** Five material batches for the complete road, elevated deck, markings and neon rails. */
export function Track({ showcase = false }: { showcase?: boolean }) {
  void showcase
  const batches = useMemo(() => {
    const buckets: THREE.BufferGeometry[][] = [[], [], [], [], []]
    const add = (batch: number, color: string, g: THREE.BufferGeometry) => {
      g.deleteAttribute('uv')
      const c = new THREE.Color(color), colors = new Float32Array(g.getAttribute('position').count * 3)
      for (let i = 0; i < colors.length; i += 3) { colors[i] = c.r; colors[i + 1] = c.g; colors[i + 2] = c.b }
      g.setAttribute('color', new THREE.BufferAttribute(colors, 3)); buckets[batch].push(g)
    }
    const place = (batch: number, color: string, g: THREE.BufferGeometry, t: number, offset: number, y: number) => {
      const s = getTrackSurface(t, offset), p = s.point
      g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-s.pitch, s.yaw, s.bank, 'YXZ')))
      g.translate(p.x, p.y + y, p.z); add(batch, color, g)
    }
    add(0, '#242037', ribbon(-ROAD_HALF_WIDTH, ROAD_HALF_WIDTH, 0))
    add(1, '#29253e', ribbon(-EDGE - .3, EDGE + .3, -.025))
    add(1, '#41415e', ribbon(-EDGE - .3, EDGE + .3, -1.1))
    for (const side of [-1, 1]) {
      add(1, '#56516f', ribbon(side * (EDGE + .3), side * (EDGE + .3), -1.1, 1.05))
      add(1, '#25263f', ribbon(side * EDGE, side * EDGE, 0, .7))
      add(1, '#4d506e', ribbon(side * (EDGE - .12), side * (EDGE + .12), .7))
      add(2, side < 0 ? '#ff38a9' : '#38e6f3', ribbon(side * (ROAD_HALF_WIDTH + .12), side * (ROAD_HALF_WIDTH + .21), .025))
      add(2, side < 0 ? '#ff38a9' : '#38e6f3', ribbon(side * (EDGE - .12), side * (EDGE + .12), .74))
      add(3, '#b9c5d7', ribbon(side * (ROAD_HALF_WIDTH - .35), side * (ROAD_HALF_WIDTH - .23), .012))
      for (let i = 0; i < 100; i++) {
        place(1, '#48485e', new THREE.BoxGeometry(.08, 1.1, .08), i / 100, side * EDGE, .55)
        place(2, side < 0 ? '#ff38a9' : '#38e6f3', new THREE.BoxGeometry(.15, .12, .15), i / 100, side * EDGE, 1.12)
      }
      for (let i = 0; i < 180; i++) place(3, i % 4 < 2 ? '#949eb6' : '#393048', new THREE.BoxGeometry(.48, .04, TRACK_LENGTH / 180 * .95), i / 180, side * (ROAD_HALF_WIDTH + .55), .02)
    }
    // Subtle two-lane dashed rhythm, and vertical bridge piers below the elevated roadway.
    for (let i = 0; i < 78; i++) place(3, '#aaaec2', new THREE.BoxGeometry(.12, .012, 1.5), i / 78, 0, .012)
    for (let i = 0; i < 40; i++) {
      const t = i / 40, center = getTrackSample(t)
      if (center.height < 1.6) continue
      for (const side of [-1, 1]) {
        const surface = getTrackSurface(t, side * 5.7), top = surface.height - 1.12
        const bottom = -.32, height = Math.max(.1, top - bottom)
        const pier = new THREE.BoxGeometry(.9, height, 1.4).rotateY(center.yaw).translate(surface.point.x, bottom + height / 2, surface.point.z)
        add(1, '#69607d', pier)
      }
      place(1, '#35324d', new THREE.BoxGeometry(13.2, .4, 1.5), t, 0, -1.25)
    }    // Road-surface arrows mark each bend; their orientation follows the actual spline.
    for (let i = 0; i < 28; i++) {
      const t = i / 28, a = getTrackSample(t), b = getTrackSample(t + .018)
      if (a.tangent.dot(b.tangent) > .985) continue
      for (const side of [-1, 1]) {
        const shape = new THREE.Shape(); shape.moveTo(-.65, -.35); shape.lineTo(0, .5); shape.lineTo(.65, -.35); shape.lineTo(.35, -.35); shape.lineTo(0, .13); shape.lineTo(-.35, -.35); shape.closePath()
        place(3, '#d0d5e3', new THREE.ShapeGeometry(shape).rotateX(Math.PI / 2), t, side * 6.2, .018)
      }
    }
    for (let row = 0; row < 3; row++) for (let col = 0; col < ROAD_HALF_WIDTH * 2; col++) {
      place(3, (row + col) % 2 ? '#e2dfef' : '#241c3b', new THREE.BoxGeometry(1, .012, .42), (row - 1) * .42 / TRACK_LENGTH, col - ROAD_HALF_WIDTH + .5, .018)
    }    for (let i = 0; i < 8; i++) {
      const t = .985 - Math.floor(i / 2) * .017, offset = i % 2 ? 3.3 : -3.3
      place(3, '#aaaec2', new THREE.BoxGeometry(2.2, .012, .12), t, offset, .018)
    }
    // Sparse amber reflectors add another visual beat without extra scene objects.
    for (let i = 0; i < 48; i++) for (const side of [-1, 1]) place(4, '#ffbc53', new THREE.BoxGeometry(.12, .03, .28), i / 48, side * (ROAD_HALF_WIDTH - .6), .025)
    return buckets.map(gs => { const merged = mergeGeometries(gs); gs.forEach(g => g.dispose()); return merged })
  }, [])
  useEffect(() => () => batches.forEach(g => g.dispose()), [batches])
  return <group>
    <mesh geometry={batches[0]} receiveShadow><meshStandardMaterial vertexColors roughness={.88} metalness={.02} envMapIntensity={.1} side={THREE.DoubleSide} /></mesh>
    <mesh geometry={batches[1]} receiveShadow><meshStandardMaterial vertexColors roughness={.62} metalness={.3} side={THREE.DoubleSide} /></mesh>
    <mesh geometry={batches[2]}><meshBasicMaterial vertexColors color={[2,2,2]} toneMapped={false} side={THREE.DoubleSide} /></mesh>
    <mesh geometry={batches[3]} receiveShadow><meshStandardMaterial vertexColors roughness={.6} side={THREE.DoubleSide} /></mesh>
    <mesh geometry={batches[4]}><meshBasicMaterial vertexColors toneMapped={false} /></mesh>
  </group>
}
