import * as THREE from 'three'
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
 * Original Palm Prix driver. Open-face cream helmet, eyes, coral team suit.
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

      <group position={[0, 0.56, 0.04]}>
        <mesh castShadow>
          <sphereGeometry args={[0.26, 48, 36]} />
          <meshPhysicalMaterial {...cream} envMap={envMap ?? undefined} envMapIntensity={0.85} />
        </mesh>
        <mesh position={[0, 0.02, 0.06]} scale={[0.95, 0.78, 0.55]}>
          <sphereGeometry args={[0.2, 28, 20]} />
          <meshStandardMaterial color="#1a1024" roughness={0.92} />
        </mesh>
        <mesh position={[0, 0.06, -0.16]} scale={[1.15, 0.72, 0.5]}>
          <sphereGeometry args={[0.16, 18, 14]} />
          <meshPhysicalMaterial color="#ff3d66" roughness={0.35} clearcoat={0.5} />
        </mesh>
        <mesh position={[-0.23, 0.0, 0.02]}>
          <sphereGeometry args={[0.07, 20, 16]} />
          <meshPhysicalMaterial color="#2f6bff" roughness={0.35} clearcoat={0.4} />
        </mesh>
        <mesh position={[0.23, 0.0, 0.02]}>
          <sphereGeometry args={[0.07, 20, 16]} />
          <meshPhysicalMaterial color="#2f6bff" roughness={0.35} clearcoat={0.4} />
        </mesh>

        <mesh position={[0, 0.11, 0.14]} rotation={[0.55, 0, 0]} castShadow>
          <torusGeometry args={[0.15, 0.032, 12, 24, Math.PI]} />
          <meshPhysicalMaterial {...cream} envMap={envMap ?? undefined} />
        </mesh>
        <mesh position={[0, -0.11, 0.12]} rotation={[0.2, 0, Math.PI]} castShadow>
          <torusGeometry args={[0.13, 0.03, 12, 22, Math.PI]} />
          <meshPhysicalMaterial {...cream} envMap={envMap ?? undefined} />
        </mesh>

        {texture ? (
          <mesh position={[0, -0.01, 0.14]}>
            <circleGeometry args={[0.12, 24]} />
            <meshStandardMaterial map={texture} roughness={0.5} />
          </mesh>
        ) : (
          <Face />
        )}

        <mesh>
          <sphereGeometry
            args={[0.3, 48, 32, Math.PI / 2 - 0.66, 1.32, Math.PI / 2 - 0.5, 0.82]}
          />
          <meshPhysicalMaterial
            color="#b7e4f2"
            transparent
            opacity={0.42}
            roughness={0.04}
            metalness={0}
            clearcoat={1}
            clearcoatRoughness={0.06}
            transmission={0.35}
            thickness={0.06}
            ior={1.4}
            envMap={envMap ?? undefined}
            envMapIntensity={0.12}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
        <mesh position={[0, -0.01, 0.08]} rotation={[0.08, 0, 0]}>
          <torusGeometry args={[0.175, 0.018, 12, 36, Math.PI * 1.35]} />
          <meshStandardMaterial color="#1c1e26" roughness={0.72} metalness={0.05} />
        </mesh>
      </group>
    </group>
  )
}

function Face() {
  return (
    <group position={[0, -0.02, 0.1]}>
      <mesh scale={[1.05, 0.92, 0.62]}>
        <sphereGeometry args={[0.13, 24, 16]} />
        <meshStandardMaterial color="#f3c2a4" roughness={0.58} />
      </mesh>
      <Eye x={-0.055} />
      <Eye x={0.055} />
      <mesh position={[0, -0.015, 0.075]} scale={[0.7, 0.85, 1]}>
        <sphereGeometry args={[0.016, 10, 8]} />
        <meshStandardMaterial color="#e0a184" roughness={0.6} />
      </mesh>
      <mesh position={[0, -0.05, 0.078]} rotation={[0.15, 0, Math.PI]}>
        <torusGeometry args={[0.042, 0.009, 8, 16, Math.PI]} />
        <meshStandardMaterial color="#c45b58" roughness={0.45} />
      </mesh>
      <mesh position={[-0.055, 0.055, 0.06]} rotation={[0, 0, 0.35]}>
        <capsuleGeometry args={[0.008, 0.04, 4, 8]} />
        <meshStandardMaterial color="#3a2a22" roughness={0.5} />
      </mesh>
      <mesh position={[0.055, 0.055, 0.06]} rotation={[0, 0, -0.35]}>
        <capsuleGeometry args={[0.008, 0.04, 4, 8]} />
        <meshStandardMaterial color="#3a2a22" roughness={0.5} />
      </mesh>
    </group>
  )
}

function Eye({ x }: { x: number }) {
  return (
    <group position={[x, 0.02, 0.07]}>
      <mesh>
        <sphereGeometry args={[0.048, 16, 12]} />
        <meshStandardMaterial color="#fffaf4" roughness={0.25} emissive="#fffaf4" emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[0, 0, 0.026]}>
        <sphereGeometry args={[0.026, 12, 10]} />
        <meshStandardMaterial color="#5a3a28" roughness={0.35} />
      </mesh>
      <mesh position={[0, 0, 0.042]}>
        <sphereGeometry args={[0.014, 10, 8]} />
        <meshStandardMaterial color="#1a1020" roughness={0.3} />
      </mesh>
      <mesh position={[0.01, 0.012, 0.04]}>
        <sphereGeometry args={[0.006, 8, 6]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.8} />
      </mesh>
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
