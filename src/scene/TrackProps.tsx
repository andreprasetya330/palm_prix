import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { palette } from './palette'

function PalmTree({
  position,
  scale = 1,
  lean = 0,
}: {
  position: [number, number, number]
  scale?: number
  lean?: number
}) {
  return (
    <group position={position} scale={scale} rotation={[0, lean, lean * 0.15]}>
      <mesh castShadow position={[0, 1.1, 0]}>
        <cylinderGeometry args={[0.22, 0.32, 2.2, 6]} />
        <meshStandardMaterial color={palette.palmTrunk} roughness={0.85} />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2
        return (
          <mesh
            key={i}
            castShadow
            position={[Math.sin(a) * 0.55, 2.35, Math.cos(a) * 0.55]}
            rotation={[0.55, a, 0.15]}
          >
            <coneGeometry args={[0.55, 1.4, 5]} />
            <meshStandardMaterial color={palette.palmFrond} roughness={0.7} />
          </mesh>
        )
      })}
      <mesh position={[0, 2.45, 0]} castShadow>
        <sphereGeometry args={[0.35, 8, 8]} />
        <meshStandardMaterial color={palette.palmFrond} />
      </mesh>
    </group>
  )
}

function ItemBox({
  position,
  phase = 0,
}: {
  position: [number, number, number]
  phase?: number
}) {
  const ref = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const g = ref.current
    if (!g) return
    const t = clock.elapsedTime + phase
    g.position.y = position[1] + Math.sin(t * 2.2) * 0.22
    g.rotation.y = t * 1.4
  })

  return (
    <group ref={ref} position={position}>
      <mesh castShadow>
        <boxGeometry args={[0.85, 0.85, 0.85]} />
        <meshStandardMaterial
          color={palette.itemBox}
          emissive={palette.itemBox}
          emissiveIntensity={0.35}
          roughness={0.35}
          metalness={0.1}
        />
      </mesh>
      <mesh position={[0, 0, 0.44]}>
        <planeGeometry args={[0.55, 0.55]} />
        <meshStandardMaterial
          color={palette.itemBoxGlow}
          emissive={palette.itemBoxGlow}
          emissiveIntensity={0.8}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, 0, -0.44]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[0.55, 0.55]} />
        <meshStandardMaterial
          color={palette.itemBoxGlow}
          emissive={palette.itemBoxGlow}
          emissiveIntensity={0.8}
          side={THREE.DoubleSide}
        />
      </mesh>
      <pointLight color={palette.itemBoxGlow} intensity={0.6} distance={4} />
    </group>
  )
}

function CloudPuff({
  position,
  scale = 1,
}: {
  position: [number, number, number]
  scale?: number
}) {
  return (
    <group position={position} scale={scale}>
      {[
        [0, 0, 0, 1.2],
        [1.1, 0.15, 0.2, 0.9],
        [-1.0, 0.1, -0.15, 0.95],
        [0.2, 0.45, 0.1, 0.7],
      ].map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]}>
          <sphereGeometry args={[r, 10, 10]} />
          <meshStandardMaterial
            color={palette.cloud}
            roughness={1}
            flatShading
          />
        </mesh>
      ))}
    </group>
  )
}

function CartoonHill({
  position,
  color,
  scale = 1,
}: {
  position: [number, number, number]
  color: string
  scale?: number
}) {
  return (
    <mesh position={position} scale={scale} castShadow receiveShadow>
      <coneGeometry args={[6, 5.5, 6]} />
      <meshStandardMaterial color={color} flatShading roughness={0.9} />
    </mesh>
  )
}

/** Decorative props around the oval — palms, item boxes, clouds, hills. */
export function TrackProps() {
  const palms = useMemo(() => {
    const list: { pos: [number, number, number]; s: number; lean: number }[] =
      []
    for (let i = 0; i < 18; i++) {
      const t = (i / 18) * Math.PI * 2
      const r = 28 + (i % 3) * 2.2
      list.push({
        pos: [Math.sin(t) * r * 1.15, 0, Math.cos(t) * r],
        s: 0.85 + (i % 4) * 0.12,
        lean: ((i % 5) - 2) * 0.08,
      })
    }
    // inner garden palms
    for (let i = 0; i < 6; i++) {
      const t = (i / 6) * Math.PI * 2 + 0.3
      list.push({
        pos: [Math.sin(t) * 7.5 * 1.15, 0, Math.cos(t) * 7.5],
        s: 0.7,
        lean: 0.05,
      })
    }
    return list
  }, [])

  const boxes = useMemo(() => {
    return [0.35, 1.05, 1.75, 2.45].map((t, i) => {
      const r = 18
      return {
        pos: [Math.sin(t) * r * 1.15, 1.1, Math.cos(t) * r] as [
          number,
          number,
          number,
        ],
        phase: i * 0.7,
      }
    })
  }, [])

  return (
    <group>
      {palms.map((p, i) => (
        <PalmTree key={`p-${i}`} position={p.pos} scale={p.s} lean={p.lean} />
      ))}
      {boxes.map((b, i) => (
        <ItemBox key={`box-${i}`} position={b.pos} phase={b.phase} />
      ))}
      <CloudPuff position={[-18, 14, -22]} scale={1.4} />
      <CloudPuff position={[22, 16, -8]} scale={1.1} />
      <CloudPuff position={[-8, 15, 24]} scale={1.25} />
      <CloudPuff position={[16, 13, 18]} scale={0.9} />
      <CartoonHill position={[-38, 0, -20]} color={palette.hill} scale={1.4} />
      <CartoonHill position={[-32, 0, -28]} color={palette.hillFar} scale={1.1} />
      <CartoonHill position={[36, 0, -16]} color={palette.hill} scale={1.25} />
      <CartoonHill position={[40, 0, 10]} color={palette.hillFar} scale={0.95} />
      {/* sand berm / beach patches */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-26, 0.01, 8]} receiveShadow>
        <circleGeometry args={[5.5, 16]} />
        <meshStandardMaterial color={palette.sand} flatShading />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[24, 0.01, -14]} receiveShadow>
        <circleGeometry args={[4.2, 16]} />
        <meshStandardMaterial color={palette.sand} flatShading />
      </mesh>
      {/* tiny pond in infield */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]} receiveShadow>
        <circleGeometry args={[4.2, 24]} />
        <meshStandardMaterial
          color={palette.water}
          roughness={0.25}
          metalness={0.05}
        />
      </mesh>
    </group>
  )
}
