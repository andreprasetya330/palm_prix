import { useMemo } from 'react'
import * as THREE from 'three'
import { palette } from './palette'
import { TrackProps } from './TrackProps'

function ovalPoint(t: number, r: number): [number, number] {
  return [Math.sin(t) * r * 1.15, Math.cos(t) * r]
}

/** Mario Kart–style oval: bold markings, candy curbs, start banner, props. */
export function Track() {
  const asphalt = useMemo(() => {
    const shape = new THREE.Shape()
    const outerR = 22
    const innerR = 14
    const segments = 72
    for (let i = 0; i <= segments; i++) {
      const t = (i / segments) * Math.PI * 2
      const [x, z] = ovalPoint(t, outerR)
      if (i === 0) shape.moveTo(x, z)
      else shape.lineTo(x, z)
    }
    const hole = new THREE.Path()
    for (let i = 0; i <= segments; i++) {
      const t = (i / segments) * Math.PI * 2
      const [x, z] = ovalPoint(t, innerR)
      if (i === 0) hole.moveTo(x, z)
      else hole.lineTo(x, z)
    }
    shape.holes.push(hole)
    return new THREE.ShapeGeometry(shape)
  }, [])

  const curbBlocks = useMemo(() => {
    const blocks: {
      x: number
      z: number
      t: number
      color: string
      side: 'outer' | 'inner'
    }[] = []
    const count = 56
    for (let i = 0; i < count; i++) {
      const t = (i / count) * Math.PI * 2
      const color = i % 2 === 0 ? palette.curbRed : palette.curbWhite
      const [ox, oz] = ovalPoint(t, 22.35)
      const [ix, iz] = ovalPoint(t, 13.65)
      blocks.push({ x: ox, z: oz, t, color, side: 'outer' })
      blocks.push({
        x: ix,
        z: iz,
        t,
        color: i % 2 === 0 ? palette.curbWhite : palette.curbRed,
        side: 'inner',
      })
    }
    return blocks
  }, [])

  return (
    <group>
      {/* cheerful grass field */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]} receiveShadow>
        <planeGeometry args={[120, 120]} />
        <meshStandardMaterial color={palette.grass} roughness={0.95} />
      </mesh>
      {/* subtle darker grass patches */}
      {[
        [12, 0.0, -18, 8],
        [-16, 0.0, 12, 7],
        [20, 0.0, 16, 6],
        [-22, 0.0, -10, 9],
      ].map(([x, y, z, r], i) => (
        <mesh
          key={`patch-${i}`}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[x, y - 0.03, z]}
          receiveShadow
        >
          <circleGeometry args={[r, 16]} />
          <meshStandardMaterial color={palette.grassDark} roughness={1} />
        </mesh>
      ))}

      {/* asphalt ribbon */}
      <mesh
        geometry={asphalt}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        receiveShadow
      >
        <meshStandardMaterial color={palette.asphalt} roughness={0.88} />
      </mesh>

      {/* bold white edge lines */}
      {Array.from({ length: 48 }).map((_, i) => {
        const t = (i / 48) * Math.PI * 2
        const [ox, oz] = ovalPoint(t, 21.55)
        const [ix, iz] = ovalPoint(t, 14.45)
        return (
          <group key={`edge-${i}`}>
            <mesh position={[ox, 0.025, oz]} rotation={[0, -t, 0]}>
              <boxGeometry args={[0.55, 0.03, 1.55]} />
              <meshStandardMaterial color={palette.asphaltEdge} />
            </mesh>
            <mesh position={[ix, 0.025, iz]} rotation={[0, -t, 0]}>
              <boxGeometry args={[0.55, 0.03, 1.55]} />
              <meshStandardMaterial color={palette.asphaltEdge} />
            </mesh>
          </group>
        )
      })}

      {/* yellow center dashes */}
      {Array.from({ length: 28 }).map((_, i) => {
        const t = (i / 28) * Math.PI * 2
        const [x, z] = ovalPoint(t, 18)
        return (
          <mesh key={`dash-${i}`} position={[x, 0.04, z]} rotation={[0, -t, 0]}>
            <boxGeometry args={[0.38, 0.03, 1.45]} />
            <meshStandardMaterial
              color={palette.dash}
              emissive={palette.dash}
              emissiveIntensity={0.15}
            />
          </mesh>
        )
      })}

      {/* candy-stripe curbs */}
      {curbBlocks.map((b, i) => (
        <mesh
          key={`curb-${i}`}
          position={[b.x, 0.12, b.z]}
          rotation={[0, -b.t, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[1.15, 0.22, 0.55]} />
          <meshStandardMaterial color={b.color} roughness={0.55} />
        </mesh>
      ))}

      {/* outer barrier blocks (taller, striped) */}
      {Array.from({ length: 36 }).map((_, i) => {
        const t = (i / 36) * Math.PI * 2
        const [x, z] = ovalPoint(t, 24.1)
        const color = i % 2 === 0 ? palette.barrierA : palette.barrierB
        return (
          <mesh
            key={`bar-${i}`}
            position={[x, 0.55, z]}
            rotation={[0, -t, 0]}
            castShadow
          >
            <boxGeometry args={[1.55, 1.05, 0.4]} />
            <meshStandardMaterial color={color} roughness={0.5} />
          </mesh>
        )
      })}

      {/* start / finish: checkered strip + arch */}
      <group position={[0, 0, 18]}>
        {Array.from({ length: 8 }).map((_, i) => (
          <mesh
            key={`check-${i}`}
            position={[(i - 3.5) * 0.85, 0.05, 0]}
            receiveShadow
          >
            <boxGeometry args={[0.8, 0.04, 1.6]} />
            <meshStandardMaterial
              color={i % 2 === 0 ? '#1a1a1e' : '#fff8f0'}
            />
          </mesh>
        ))}
        <mesh position={[-3.4, 2.1, 0]} castShadow>
          <boxGeometry args={[0.45, 4.2, 0.45]} />
          <meshStandardMaterial color={palette.arch} />
        </mesh>
        <mesh position={[3.4, 2.1, 0]} castShadow>
          <boxGeometry args={[0.45, 4.2, 0.45]} />
          <meshStandardMaterial color={palette.arch} />
        </mesh>
        <mesh position={[0, 4.35, 0]} castShadow>
          <boxGeometry args={[7.3, 0.7, 0.5]} />
          <meshStandardMaterial
            color={palette.archBanner}
            emissive={palette.archBanner}
            emissiveIntensity={0.25}
          />
        </mesh>
        {/* banner stripes */}
        {[-2, 0, 2].map((x) => (
          <mesh key={`stripe-${x}`} position={[x, 4.35, 0.28]}>
            <boxGeometry args={[1.1, 0.45, 0.08]} />
            <meshStandardMaterial color={palette.curbRed} />
          </mesh>
        ))}
      </group>

      <TrackProps />
    </group>
  )
}
