import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { palette } from './palette'
import { buildCurb, buildStrip } from './ribbons'
import {
  TRACK,
  frameMatrix,
  getTrackFrames,
  lateralOf,
  pointOn,
  trackLength,
  type Frame,
} from './spline'
import type { TrackTextures } from './textures'

/** Flat asphalt inside the cut, so the chase camera and the kart stand on the road. */
function buildApron(): THREE.BufferGeometry {
  const x0 = -34
  const x1 = 4
  const z0 = -26
  const z1 = 30
  const nx = 76
  const nz = 84
  const stride = nx + 1
  const positions: number[] = []
  const uvs: number[] = []
  const keep = new Uint8Array(stride * (nz + 1))
  for (let j = 0; j <= nz; j++) {
    for (let i = 0; i <= nx; i++) {
      const x = x0 + ((x1 - x0) * i) / nx
      const z = z0 + ((z1 - z0) * j) / nz
      const lat = lateralOf(x, z)
      const water = Math.hypot((x + 12.2) / 5.15, (z - 4.6) / 4.05)
      // Inside the inner curb, including the lagoon shore, so the cut stays on asphalt.
      keep[j * stride + i] = lat < -4.15 && water > 1 ? 1 : 0
      positions.push(x, 0.045, z)
      uvs.push(x / 3.5, z / 3.5)
    }
  }
  const indices: number[] = []
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * stride + i
      const b = a + 1
      const c = a + stride
      const d = c + 1
      if (keep[a] && keep[b] && keep[c] && keep[d]) indices.push(a, c, b, b, c, d)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

const asphaltColumns = [
  { lat: -TRACK.halfWidth, lift: 0.0 },
  { lat: -TRACK.halfWidth * 0.45, lift: 0.03 },
  { lat: 0, lift: 0.045 },
  { lat: TRACK.halfWidth * 0.45, lift: 0.03 },
  { lat: TRACK.halfWidth, lift: 0.0 },
]

function useDashMatrices(frames: Frame[]) {
  return useMemo(() => {
    const unique = frames.slice(0, -1)
    const length = trackLength()
    const step = TRACK.dashLength + TRACK.dashGap
    const matrices: THREE.Matrix4[] = []
    const m = new THREE.Matrix4()
    for (let d = 0; d < length; d += step) {
      let frame = unique[0]
      for (let i = 0; i < unique.length; i++) {
        if (unique[i].distance <= d) frame = unique[i]
        else break
      }
      // Keep the dash on the centerline, clear of both curbs.
      matrices.push(frameMatrix(frame, 0, 0.03, m).clone())
    }
    return matrices
  }, [frames])
}

export function Road({ textures }: { textures: TrackTextures }) {
  const frames = useMemo(() => getTrackFrames(), [])
  const dashes = useDashMatrices(frames)
  const dashRef = useRef<THREE.InstancedMesh>(null)

  const geos = useMemo(() => {
    const hot = new THREE.Color(palette.curbHot)
    const cream = new THREE.Color(palette.curbCream)
    const halfEdge = TRACK.edgeWidth * 0.5
    return {
      apron: buildApron(),
      asphalt: buildStrip(frames, asphaltColumns),
      edgeOut: buildStrip(frames, [
        { lat: TRACK.edgeLat - halfEdge, lift: 0.03 },
        { lat: TRACK.edgeLat + halfEdge, lift: 0.03 },
      ]),
      edgeIn: buildStrip(frames, [
        { lat: -TRACK.edgeLat - halfEdge, lift: 0.03 },
        { lat: -TRACK.edgeLat + halfEdge, lift: 0.03 },
      ]),
      sandOut: buildStrip(frames, [
        { lat: TRACK.sand0, lift: 0.01 },
        { lat: TRACK.sand1, lift: 0.0 },
      ]),
      sandIn: buildStrip(frames, [
        { lat: -TRACK.sand1, lift: 0.0 },
        { lat: -TRACK.sand0, lift: 0.01 },
      ]),
      curbOut: buildCurb(frames, 1, 1.5, hot, cream),
      curbIn: buildCurb(frames, -1, 1.5, cream, hot),
    }
  }, [frames])

  useLayoutEffect(() => {
    const mesh = dashRef.current
    if (!mesh) return
    dashes.forEach((matrix, i) => mesh.setMatrixAt(i, matrix))
    mesh.instanceMatrix.needsUpdate = true
  }, [dashes])

  return (
    <group>
      <mesh geometry={geos.apron} receiveShadow>
        <meshStandardMaterial
          map={textures.asphalt}
          normalMap={textures.asphaltNormal}
          normalScale={new THREE.Vector2(0.65, 0.65)}
          color={'#8d97ab'}
          roughness={0.84}
          metalness={0.04}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-1}
        />
      </mesh>
      <mesh geometry={geos.asphalt} receiveShadow>
        <meshStandardMaterial
          map={textures.asphalt}
          normalMap={textures.asphaltNormal}
          normalScale={new THREE.Vector2(0.65, 0.65)}
          color={'#8d97ab'}
          vertexColors
          roughness={0.84}
          metalness={0.04}
        />
      </mesh>
      {[geos.edgeOut, geos.edgeIn].map((geo, i) => (
        <mesh key={i} geometry={geo} receiveShadow>
          <meshStandardMaterial
            color={palette.edge}
            roughness={0.38}
            metalness={0.02}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        </mesh>
      ))}
      {[geos.sandOut, geos.sandIn].map((geo, i) => (
        <mesh key={i} geometry={geo} receiveShadow>
          <meshStandardMaterial
            map={textures.sand}
            normalMap={textures.sandNormal}
            normalScale={new THREE.Vector2(0.55, 0.55)}
            color="#fff6ea"
            roughness={0.9}
            vertexColors
          />
        </mesh>
      ))}
      {[geos.curbOut, geos.curbIn].map((geo, i) => (
        <mesh key={i} geometry={geo} castShadow receiveShadow>
          <meshStandardMaterial
            vertexColors
            roughness={0.38}
            metalness={0.03}
          />
        </mesh>
      ))}
      <instancedMesh
        ref={dashRef}
        args={[undefined, undefined, dashes.length]}
        castShadow
        receiveShadow
        frustumCulled={false}
      >
        <boxGeometry args={[TRACK.dashWidth, 0.035, TRACK.dashLength]} />
        <meshStandardMaterial
          color={palette.dash}
          emissive={palette.dash}
          emissiveIntensity={0.18}
          roughness={0.42}
        />
      </instancedMesh>
    </group>
  )
}

export function nearestFrame(frames: Frame[], x: number, z: number): Frame {
  let best = frames[0]
  let bestD = Infinity
  for (let i = 0; i < frames.length - 1; i++) {
    const f = frames[i]
    const d = (f.p.x - x) ** 2 + (f.p.z - z) ** 2
    if (d < bestD) {
      bestD = d
      best = f
    }
  }
  return best
}

export { pointOn }
