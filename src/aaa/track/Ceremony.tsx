import { useMemo } from 'react'
import { palette } from './palette'
import { GRID } from './spline'
import type { TrackTextures } from './textures'

const SLOT_W = 1.85
const SLOT_L = GRID.z1 - GRID.z0

function Slot({ x, featured }: { x: number; featured: boolean }) {
  const z = (GRID.z0 + GRID.z1) / 2
  const color = featured ? palette.gold : palette.edge
  return (
    <group position={[x, 0.05, z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[SLOT_W, SLOT_L]} />
        <meshStandardMaterial
          color={featured ? '#ffe7a3' : '#f4f7fb'}
          transparent
          opacity={0.28}
          roughness={0.5}
          polygonOffset
          polygonOffsetFactor={-3}
          polygonOffsetUnits={-3}
        />
      </mesh>
      {[
        [0, SLOT_L / 2, SLOT_W, 0.12],
        [0, -SLOT_L / 2, SLOT_W, 0.12],
        [-SLOT_W / 2, 0, 0.1, SLOT_L],
        [SLOT_W / 2, 0, 0.1, SLOT_L],
      ].map(([px, pz, w, d], i) => (
        <mesh key={i} position={[px, 0.02, pz]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[w, d]} />
          <meshStandardMaterial color={color} roughness={0.4} />
        </mesh>
      ))}
    </group>
  )
}

function Pylon({ x }: { x: number }) {
  return (
    <group position={[x, 0, GRID.gateZ]}>
      <mesh castShadow receiveShadow position={[0, 0.18, 0]}>
        <cylinderGeometry args={[0.55, 0.62, 0.36, 12]} />
        <meshStandardMaterial color={palette.gold} roughness={0.4} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 1.45, 0]}>
        <cylinderGeometry args={[0.28, 0.4, 2.5, 12]} />
        <meshStandardMaterial color={palette.arch} roughness={0.45} />
      </mesh>
      <mesh castShadow position={[0, 2.15, 0]}>
        <torusGeometry args={[0.42, 0.07, 8, 18]} />
        <meshStandardMaterial color={palette.gold} roughness={0.35} metalness={0.15} />
      </mesh>
      <mesh position={[0, 2.85, 0]} castShadow>
        <sphereGeometry args={[0.22, 12, 10]} />
        <meshStandardMaterial
          color={palette.gold}
          emissive={palette.gold}
          emissiveIntensity={0.35}
        />
      </mesh>
    </group>
  )
}

export function Ceremony({ textures }: { textures: TrackTextures }) {
  const lights = useMemo(
    () =>
      [-3.1, -1.55, 0, 1.55, 3.1].map((x, i) => ({
        x,
        color: i === 2 ? palette.gold : palette.coral,
      })),
    [],
  )

  return (
    <group>
      <mesh
        position={[0, 0.055, GRID.lineZ]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[TRACK_WIDTH, GRID.lineDepth]} />
        <meshStandardMaterial
          map={textures.checkers}
          roughness={0.5}
          polygonOffset
          polygonOffsetFactor={-4}
          polygonOffsetUnits={-4}
        />
      </mesh>

      {GRID.slotX.map((x, i) => (
        <Slot key={x} x={x} featured={i === 1} />
      ))}

      <Pylon x={-5.35} />
      <Pylon x={5.35} />

      <mesh position={[0, 2.35, GRID.gateZ - 0.08]} castShadow>
        <boxGeometry args={[11.2, 1.05, 0.12]} />
        <meshStandardMaterial color={palette.gold} roughness={0.35} metalness={0.12} />
      </mesh>
      <mesh position={[0, 2.35, GRID.gateZ]} castShadow>
        <boxGeometry args={[10.85, 0.86, 0.16]} />
        <meshStandardMaterial map={textures.banner} roughness={0.42} />
      </mesh>

      <mesh position={[0, 1.78, GRID.gateZ]} castShadow>
        <boxGeometry args={[7.4, 0.14, 0.28]} />
        <meshStandardMaterial color={palette.ink} roughness={0.4} />
      </mesh>
      {lights.map((light) => (
        <mesh key={light.x} position={[light.x, 1.78, GRID.gateZ + 0.2]} castShadow>
          <sphereGeometry args={[0.2, 14, 12]} />
          <meshStandardMaterial
            color={light.color}
            emissive={light.color}
            emissiveIntensity={1.1}
            roughness={0.25}
          />
        </mesh>
      ))}
    </group>
  )
}

const TRACK_WIDTH = 7.15
