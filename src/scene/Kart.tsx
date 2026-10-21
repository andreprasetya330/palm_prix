import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { KartState } from '../game/kartPhysics'
import { palette } from './palette'

type Props = {
  kart: KartState
  driverTextureUrl: string | null
}

const WHEEL_POS = [
  [-0.58, 0.28, 0.62],
  [0.58, 0.28, 0.62],
  [-0.58, 0.28, -0.62],
  [0.58, 0.28, -0.62],
] as const

export function Kart({ kart, driverTextureUrl }: Props) {
  const rootRef = useRef<THREE.Group>(null)
  const wheelsRef = useRef<THREE.Group[]>([])
  const bobPhase = useRef(0)

  const texture = useMemo(() => {
    if (!driverTextureUrl) return null
    const t = new THREE.TextureLoader().load(driverTextureUrl)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [driverTextureUrl])

  useFrame((_, dt) => {
    const spin = kart.speed * 2.4 * dt
    for (const w of wheelsRef.current) {
      if (w) w.rotation.x += spin
    }
    bobPhase.current += dt * (4 + Math.min(8, Math.abs(kart.speed) * 0.15))
    const root = rootRef.current
    if (root) {
      root.position.set(kart.x, 0.05 + Math.sin(bobPhase.current) * 0.03, kart.z)
      root.rotation.y = kart.yaw
    }
  })

  const boosting = kart.boostTimer > 0

  return (
    <group ref={rootRef} position={[kart.x, 0.05, kart.z]} rotation={[0, kart.yaw, 0]}>
      {/* soft ground shadow disc */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[1.15, 20]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.22} />
      </mesh>

      {/* chassis — rounded low-poly look */}
      <mesh castShadow position={[0, 0.32, 0.05]}>
        <boxGeometry args={[1.15, 0.32, 1.65]} />
        <meshStandardMaterial
          color={palette.kartBody}
          roughness={0.45}
          flatShading
        />
      </mesh>
      {/* nose scoop */}
      <mesh castShadow position={[0, 0.28, 0.78]}>
        <boxGeometry args={[0.85, 0.22, 0.45]} />
        <meshStandardMaterial
          color={palette.kartAccent}
          roughness={0.4}
          flatShading
        />
      </mesh>
      {/* side pods */}
      <mesh castShadow position={[-0.62, 0.3, 0]}>
        <boxGeometry args={[0.22, 0.28, 1.1]} />
        <meshStandardMaterial color={palette.kartAccent} flatShading />
      </mesh>
      <mesh castShadow position={[0.62, 0.3, 0]}>
        <boxGeometry args={[0.22, 0.28, 1.1]} />
        <meshStandardMaterial color={palette.kartAccent} flatShading />
      </mesh>
      {/* cockpit / seat */}
      <mesh castShadow position={[0, 0.55, -0.15]}>
        <boxGeometry args={[0.75, 0.35, 0.7]} />
        <meshStandardMaterial color={palette.kartSeat} flatShading />
      </mesh>
      {/* windshield */}
      <mesh castShadow position={[0, 0.78, 0.18]} rotation={[-0.35, 0, 0]}>
        <boxGeometry args={[0.7, 0.35, 0.08]} />
        <meshStandardMaterial
          color={palette.windshield}
          transparent
          opacity={0.75}
          roughness={0.15}
          metalness={0.2}
        />
      </mesh>
      {/* rear spoiler */}
      <mesh castShadow position={[0, 0.72, -0.85]}>
        <boxGeometry args={[1.05, 0.1, 0.28]} />
        <meshStandardMaterial color={palette.kartRim} flatShading />
      </mesh>
      <mesh castShadow position={[-0.4, 0.55, -0.78]}>
        <boxGeometry args={[0.08, 0.35, 0.08]} />
        <meshStandardMaterial color={palette.kartAccent} />
      </mesh>
      <mesh castShadow position={[0.4, 0.55, -0.78]}>
        <boxGeometry args={[0.08, 0.35, 0.08]} />
        <meshStandardMaterial color={palette.kartAccent} />
      </mesh>
      {/* headlights */}
      <mesh position={[-0.32, 0.35, 0.98]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshStandardMaterial
          color="#fff6c2"
          emissive="#fff6c2"
          emissiveIntensity={0.9}
        />
      </mesh>
      <mesh position={[0.32, 0.35, 0.98]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshStandardMaterial
          color="#fff6c2"
          emissive="#fff6c2"
          emissiveIntensity={0.9}
        />
      </mesh>

      {/* cartoon tires + yellow rims */}
      {WHEEL_POS.map((pos, i) => (
        <group
          key={i}
          position={[...pos]}
          rotation={[0, 0, Math.PI / 2]}
          ref={(el) => {
            if (el) wheelsRef.current[i] = el
          }}
        >
          <mesh castShadow>
            <cylinderGeometry args={[0.32, 0.32, 0.28, 10]} />
            <meshStandardMaterial color={palette.tire} roughness={0.95} flatShading />
          </mesh>
          <mesh>
            <cylinderGeometry args={[0.18, 0.18, 0.3, 8]} />
            <meshStandardMaterial
              color={palette.kartRim}
              emissive={palette.kartRim}
              emissiveIntensity={0.2}
              flatShading
            />
          </mesh>
        </group>
      ))}

      {/* driver portrait card */}
      <mesh position={[0, 1.15, -0.12]} castShadow>
        <planeGeometry args={[0.72, 0.72]} />
        <meshStandardMaterial
          map={texture ?? undefined}
          color={texture ? '#ffffff' : '#ffd6a5'}
          side={THREE.DoubleSide}
          roughness={0.6}
        />
      </mesh>
      {!texture && (
        <group position={[0, 1.15, -0.1]}>
          <mesh>
            <circleGeometry args={[0.2, 16]} />
            <meshStandardMaterial color="#5c4d6d" />
          </mesh>
          <mesh position={[0, -0.22, 0.01]}>
            <boxGeometry args={[0.35, 0.2, 0.04]} />
            <meshStandardMaterial color="#3d7cff" />
          </mesh>
        </group>
      )}

      {/* boost trail / flame */}
      {boosting && (
        <group position={[0, 0.35, -1.15]}>
          <mesh>
            <coneGeometry args={[0.28, 0.9, 8]} />
            <meshStandardMaterial
              color={palette.boost}
              emissive={palette.boost}
              emissiveIntensity={2.2}
              transparent
              opacity={0.9}
            />
          </mesh>
          <mesh position={[0, 0, -0.35]} scale={0.65}>
            <coneGeometry args={[0.22, 0.7, 8]} />
            <meshStandardMaterial
              color="#fff59a"
              emissive="#fff59a"
              emissiveIntensity={2.5}
              transparent
              opacity={0.85}
            />
          </mesh>
          <pointLight color={palette.boost} intensity={2.5} distance={6} />
        </group>
      )}
    </group>
  )
}
