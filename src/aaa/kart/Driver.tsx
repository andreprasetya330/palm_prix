import * as THREE from 'three'
import { leafGeo } from './geom'
import { paint } from './palette'

type Props = {
  texture: THREE.Texture | null
  envMap: THREE.Texture | null
}

const cream = {
  color: '#fff3e4',
  roughness: 0.32,
  metalness: 0.04,
  clearcoat: 0.7,
  clearcoatRoughness: 0.18,
}

const coral = {
  color: '#ff3d66',
  roughness: 0.4,
  metalness: 0.02,
  clearcoat: 0.45,
  clearcoatRoughness: 0.25,
}

/**
 * Original Palm Prix driver. Cream helmet, coral team suit, palm crest.
 * Not a Nintendo character — no cap, no mustache, no borrowed marks.
 */
export function Driver({ texture, envMap }: Props) {
  return (
    <group position={[0, 0.5, -0.06]}>
      <mesh position={[0, 0.08, 0.02]} scale={[0.34, 0.16, 0.26]} castShadow>
        <sphereGeometry args={[1, 24, 16]} />
        <meshPhysicalMaterial {...coral} envMap={envMap ?? undefined} />
      </mesh>
      <mesh position={[0, 0.28, 0.02]} scale={[0.32, 0.26, 0.22]} castShadow>
        <sphereGeometry args={[1, 28, 20]} />
        <meshPhysicalMaterial {...coral} envMap={envMap ?? undefined} />
      </mesh>
      <mesh position={[0, 0.3, 0.16]} rotation={[0.15, 0, 0]}>
        <sphereGeometry args={[0.1, 16, 12]} />
        <meshPhysicalMaterial color="#fff3e4" roughness={0.45} clearcoat={0.3} />
      </mesh>
      <mesh position={[0, 0.4, 0]} rotation={[0.4, 0, 0]}>
        <torusGeometry args={[0.16, 0.045, 10, 22]} />
        <meshPhysicalMaterial {...cream} envMap={envMap ?? undefined} />
      </mesh>

      <Limb
        from={[-0.22, 0.34, 0.04]}
        to={[-0.16, 0.22, 0.28]}
        radius={0.055}
        color="#2f6bff"
        envMap={envMap}
      />
      <Limb
        from={[0.22, 0.34, 0.04]}
        to={[0.16, 0.22, 0.28]}
        radius={0.055}
        color="#2f6bff"
        envMap={envMap}
      />
      <mesh position={[-0.16, 0.2, 0.3]}>
        <sphereGeometry args={[0.07, 16, 12]} />
        <meshStandardMaterial color="#fff3e4" roughness={0.45} />
      </mesh>
      <mesh position={[0.16, 0.2, 0.3]}>
        <sphereGeometry args={[0.07, 16, 12]} />
        <meshStandardMaterial color="#fff3e4" roughness={0.45} />
      </mesh>

      <group position={[0, 0.56, 0.03]}>
        <mesh castShadow>
          <sphereGeometry args={[0.25, 32, 24]} />
          <meshPhysicalMaterial {...cream} envMap={envMap ?? undefined} envMapIntensity={0.9} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.252, 0.028, 8, 28]} />
          <meshPhysicalMaterial color="#ff3d66" roughness={0.35} clearcoat={0.5} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.25, 0.02, 8, 28, Math.PI]} />
          <meshStandardMaterial color="#2f6bff" roughness={0.4} />
        </mesh>

        {texture ? (
          <mesh position={[0, -0.01, 0.16]}>
            <circleGeometry args={[0.12, 24]} />
            <meshStandardMaterial map={texture} roughness={0.5} />
          </mesh>
        ) : (
          <group position={[0, -0.02, 0.12]}>
            <mesh position={[-0.07, 0.02, 0.06]}>
              <sphereGeometry args={[0.035, 12, 10]} />
              <meshStandardMaterial color="#fffaf2" />
            </mesh>
            <mesh position={[0.07, 0.02, 0.06]}>
              <sphereGeometry args={[0.035, 12, 10]} />
              <meshStandardMaterial color="#fffaf2" />
            </mesh>
            <mesh position={[-0.07, 0.02, 0.085]}>
              <sphereGeometry args={[0.018, 10, 8]} />
              <meshStandardMaterial color="#3a2a22" />
            </mesh>
            <mesh position={[0.07, 0.02, 0.085]}>
              <sphereGeometry args={[0.018, 10, 8]} />
              <meshStandardMaterial color="#3a2a22" />
            </mesh>
            <mesh position={[0, -0.045, 0.07]} rotation={[0.2, 0, 0]}>
              <torusGeometry args={[0.04, 0.008, 6, 10, Math.PI]} />
              <meshStandardMaterial color="#c46a62" />
            </mesh>
          </group>
        )}

        <mesh position={[0, -0.01, 0.1]} scale={[1.05, 0.72, 0.55]}>
          <sphereGeometry args={[0.2, 24, 16]} />
          <meshPhysicalMaterial
            color={paint.visor}
            transparent
            opacity={0.42}
            roughness={0.05}
            metalness={0.15}
            clearcoat={1}
            clearcoatRoughness={0.06}
            envMap={envMap ?? undefined}
            envMapIntensity={1.3}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh position={[0, 0.08, 0.14]} rotation={[1.15, 0, 0]}>
          <torusGeometry args={[0.14, 0.012, 8, 20, Math.PI]} />
          <meshStandardMaterial color="#ffc83d" metalness={0.7} roughness={0.22} />
        </mesh>

        {[
          [-0.7, 0.85],
          [-0.3, 1],
          [0, 1.15],
          [0.3, 1],
          [0.7, 0.85],
        ].map(([yaw, sc], i) => (
          <mesh
            key={i}
            geometry={leafGeo}
            position={[0, 0.2, 0]}
            rotation={[0.35, yaw, 0]}
            scale={sc}
            castShadow
          >
            <meshStandardMaterial color={i % 2 === 0 ? '#14a35a' : '#0c7a40'} roughness={0.55} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

function Limb({
  from,
  to,
  radius,
  color,
  envMap,
}: {
  from: [number, number, number]
  to: [number, number, number]
  radius: number
  color: string
  envMap: THREE.Texture | null
}) {
  const a = new THREE.Vector3(...from)
  const b = new THREE.Vector3(...to)
  const len = a.distanceTo(b)
  const mid = a.clone().lerp(b, 0.5)
  const q = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    b.clone().sub(a).normalize(),
  )
  const shaft = Math.max(0.02, len - radius * 2)
  return (
    <mesh position={mid} quaternion={q} castShadow>
      <capsuleGeometry args={[radius, shaft, 6, 12]} />
      <meshPhysicalMaterial
        color={color}
        roughness={0.42}
        clearcoat={0.35}
        envMap={envMap ?? undefined}
      />
    </mesh>
  )
}
