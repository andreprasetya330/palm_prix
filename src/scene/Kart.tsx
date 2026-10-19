import { useMemo } from 'react'
import * as THREE from 'three'
import type { KartState } from '../game/kartPhysics'

type Props = {
  kart: KartState
  driverTextureUrl: string | null
}

export function Kart({ kart, driverTextureUrl }: Props) {
  const texture = useMemo(() => {
    if (!driverTextureUrl) return null
    const t = new THREE.TextureLoader().load(driverTextureUrl)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [driverTextureUrl])

  return (
    <group position={[kart.x, 0.35, kart.z]} rotation={[0, kart.yaw, 0]}>
      {/* body */}
      <mesh castShadow position={[0, 0.2, 0]}>
        <boxGeometry args={[1.1, 0.35, 1.8]} />
        <meshStandardMaterial color="#e76f51" />
      </mesh>
      <mesh castShadow position={[0, 0.45, -0.15]}>
        <boxGeometry args={[0.9, 0.35, 0.9]} />
        <meshStandardMaterial color="#264653" />
      </mesh>
      {/* wheels */}
      {(
        [
          [-0.55, 0.15, 0.55],
          [0.55, 0.15, 0.55],
          [-0.55, 0.15, -0.55],
          [0.55, 0.15, -0.55],
        ] as const
      ).map((pos, i) => (
        <mesh key={i} position={[...pos]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.28, 0.28, 0.22, 12]} />
          <meshStandardMaterial color="#1b1b1b" />
        </mesh>
      ))}
      {/* driver billboard / face card */}
      <mesh position={[0, 1.05, -0.1]} castShadow>
        <planeGeometry args={[0.7, 0.7]} />
        <meshStandardMaterial
          map={texture ?? undefined}
          color={texture ? '#ffffff' : '#ffd6a5'}
          side={THREE.DoubleSide}
        />
      </mesh>
      {!texture && (
        <mesh position={[0, 1.05, -0.09]}>
          <circleGeometry args={[0.18, 16]} />
          <meshStandardMaterial color="#6d597a" />
        </mesh>
      )}
      {/* boost glow */}
      {kart.boostTimer > 0 && (
        <mesh position={[0, 0.2, 1.1]}>
          <sphereGeometry args={[0.25, 12, 12]} />
          <meshStandardMaterial
            color="#80ed99"
            emissive="#80ed99"
            emissiveIntensity={2}
          />
        </mesh>
      )}
    </group>
  )
}
