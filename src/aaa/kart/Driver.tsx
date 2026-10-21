import * as THREE from 'three'
import fabricNormalUrl from './assets/Fabric030_1K-JPG_NormalGL.jpg'
import fabricRoughUrl from './assets/Fabric030_1K-JPG_Roughness.jpg'
import { clothNormalScale, useLinearMap } from './textures'
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

const cloth = {
  color: '#c4254a',
  roughness: 0.96,
  metalness: 0,
}

/**
 * Original Palm Prix driver. Open-face cream helmet, eyes, coral team suit.
 * Not a Nintendo character — no cap, no mustache, no borrowed marks.
 */
function SuitMaterial({
  normal,
  rough,
}: {
  normal: THREE.Texture
  rough: THREE.Texture
}) {
  return (
    <meshStandardMaterial
      color={cloth.color}
      roughness={0.94}
      metalness={0}
      normalMap={normal}
      normalScale={clothNormalScale}
      roughnessMap={rough}
    />
  )
}

export function Driver({ texture, envMap }: Props) {
  const clothNormal = useLinearMap(fabricNormalUrl, 3, 3)
  const clothRough = useLinearMap(fabricRoughUrl, 3, 3)
  return (
    <group position={[0, 0.5, -0.06]}>
      <mesh position={[0, 0.08, 0.02]} scale={[0.34, 0.16, 0.26]} castShadow>
        <sphereGeometry args={[1, 24, 16]} />
        <SuitMaterial normal={clothNormal} rough={clothRough} />
      </mesh>
      <mesh position={[0, 0.28, 0.02]} scale={[0.32, 0.26, 0.22]} castShadow>
        <sphereGeometry args={[1, 28, 20]} />
        <SuitMaterial normal={clothNormal} rough={clothRough} />
      </mesh>
      <mesh position={[0, 0.3, 0.16]} rotation={[0.15, 0, 0]}>
        <sphereGeometry args={[0.1, 16, 12]} />
        <meshStandardMaterial color="#f3e6d4" roughness={0.94} />
      </mesh>
      <mesh position={[0, 0.4, 0]} rotation={[0.4, 0, 0]}>
        <torusGeometry args={[0.16, 0.045, 10, 22]} />
        <meshStandardMaterial color="#f6efe4" roughness={0.92} />
      </mesh>

      <Limb from={[-0.22, 0.34, 0.04]} to={[-0.16, 0.22, 0.28]} radius={0.055} color="#2a4fd0" />
      <Limb from={[0.22, 0.34, 0.04]} to={[0.16, 0.22, 0.28]} radius={0.055} color="#2a4fd0" />
      <Glove x={-0.16} />
      <Glove x={0.16} />

      <group position={[0, 0.56, 0.04]}>
        <mesh castShadow>
          <sphereGeometry args={[0.26, 48, 32, Math.PI / 2 + 0.58, Math.PI * 2 - 1.16]} />
          <meshPhysicalMaterial {...cream} envMap={envMap ?? undefined} envMapIntensity={0.85} />
        </mesh>
        <mesh castShadow>
          <sphereGeometry args={[0.26, 32, 16, Math.PI / 2 - 0.58, 1.16, 0, Math.PI / 2 - 0.4]} />
          <meshPhysicalMaterial {...cream} envMap={envMap ?? undefined} envMapIntensity={0.85} />
        </mesh>
        <mesh castShadow>
          <sphereGeometry args={[0.26, 32, 16, Math.PI / 2 - 0.58, 1.16, Math.PI / 2 + 0.32, Math.PI / 2 - 0.32]} />
          <meshPhysicalMaterial {...cream} envMap={envMap ?? undefined} envMapIntensity={0.85} />
        </mesh>
        <mesh position={[0, -0.01, 0.02]} scale={[0.85, 0.7, 0.45]}>
          <sphereGeometry args={[0.18, 24, 16]} />
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

        <mesh position={[0, 0.08, 0.16]} rotation={[1.15, 0, 0]} castShadow>
          <torusGeometry args={[0.16, 0.02, 10, 28, Math.PI]} />
          <meshPhysicalMaterial {...cream} envMap={envMap ?? undefined} />
        </mesh>
        <mesh position={[0, -0.09, 0.14]} rotation={[0.35, 0, Math.PI]} castShadow>
          <torusGeometry args={[0.14, 0.02, 10, 24, Math.PI]} />
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
    <group position={[0, -0.01, 0.14]}>
      <mesh scale={[1.05, 0.92, 0.62]}>
        <sphereGeometry args={[0.13, 24, 16]} />
        <meshStandardMaterial color="#f3c2a4" roughness={0.58} />
      </mesh>
      <Eye x={-0.055} />
      <Eye x={0.055} />
      <mesh position={[0, 0.004, 0.07]} scale={[0.7, 0.85, 0.8]}>
        <sphereGeometry args={[0.016, 12, 10]} />
        <meshStandardMaterial color="#e0a184" roughness={0.6} />
      </mesh>
      <Brow x={-0.058} />
      <Brow x={0.058} />
      <Mouth />
    </group>
  )
}

function Brow({ x }: { x: number }) {
  const side = Math.sign(x) || 1
  return (
    <group position={[x, 0.055, 0.055]} rotation={[0.35, 0, side * -0.35]}>
      <mesh castShadow scale={[1, 0.55, 0.7]}>
        <sphereGeometry args={[0.038, 16, 12]} />
        <meshStandardMaterial color="#3a2a22" roughness={0.55} />
      </mesh>
      <mesh position={[side * 0.012, -0.012, 0.02]} rotation={[0.4, 0, side * 0.2]} scale={[0.7, 0.45, 0.55]}>
        <sphereGeometry args={[0.028, 12, 10]} />
        <meshStandardMaterial color="#2a1c16" roughness={0.6} />
      </mesh>
    </group>
  )
}

function Mouth() {
  return (
    <group position={[0, -0.05, 0.068]}>
      <mesh position={[0, 0.018, 0.028]} scale={[1.7, 0.48, 0.85]} castShadow>
        <sphereGeometry args={[0.032, 18, 14]} />
        <meshStandardMaterial color="#c45b58" roughness={0.48} />
      </mesh>
      <mesh position={[0, -0.012, 0.034]} scale={[1.5, 0.55, 0.9]} castShadow>
        <sphereGeometry args={[0.03, 18, 14]} />
        <meshStandardMaterial color="#d4706c" roughness={0.5} />
      </mesh>
      <mesh position={[-0.05, 0.026, 0.02]} scale={[0.6, 0.45, 0.55]} castShadow>
        <sphereGeometry args={[0.018, 12, 10]} />
        <meshStandardMaterial color="#c45b58" roughness={0.5} />
      </mesh>
      <mesh position={[0.05, 0.026, 0.02]} scale={[0.6, 0.45, 0.55]} castShadow>
        <sphereGeometry args={[0.018, 12, 10]} />
        <meshStandardMaterial color="#c45b58" roughness={0.5} />
      </mesh>
    </group>
  )
}

function Glove({ x }: { x: number }) {
  const side = Math.sign(x) || 1
  return (
    <group position={[x, 0.2, 0.3]} rotation={[0.5, side * 0.2, side * -0.2]}>
      <mesh scale={[1.2, 0.62, 0.9]} castShadow>
        <sphereGeometry args={[0.06, 16, 12]} />
        <meshStandardMaterial color="#f3e6d4" roughness={0.94} />
      </mesh>
      <mesh
        position={[side * 0.048, 0.03, 0.012]}
        rotation={[0.15, 0, side * 0.85]}
        scale={[0.55, 0.95, 0.5]}
        castShadow
      >
        <sphereGeometry args={[0.03, 12, 10]} />
        <meshStandardMaterial color="#efe2cf" roughness={0.94} />
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
}: {
  from: [number, number, number]
  to: [number, number, number]
  radius: number
  color: string
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
      <meshStandardMaterial color={color} roughness={0.94} metalness={0} />
    </mesh>
  )
}
