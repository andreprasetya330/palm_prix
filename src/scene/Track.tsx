import { useMemo } from 'react'
import * as THREE from 'three'

/** Simple oval ribbon track on flat ground. */
export function Track() {
  const asphalt = useMemo(() => {
    const shape = new THREE.Shape()
    const outerR = 22
    const innerR = 14
    const segments = 64
    for (let i = 0; i <= segments; i++) {
      const t = (i / segments) * Math.PI * 2
      const x = Math.sin(t) * outerR * 1.15
      const z = Math.cos(t) * outerR
      if (i === 0) shape.moveTo(x, z)
      else shape.lineTo(x, z)
    }
    // hole (inner)
    const hole = new THREE.Path()
    for (let i = 0; i <= segments; i++) {
      const t = (i / segments) * Math.PI * 2
      const x = Math.sin(t) * innerR * 1.15
      const z = Math.cos(t) * innerR
      if (i === 0) hole.moveTo(x, z)
      else hole.lineTo(x, z)
    }
    shape.holes.push(hole)
    return new THREE.ShapeGeometry(shape)
  }, [])

  return (
    <group>
      {/* grass */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#3a7d44" />
      </mesh>
      {/* asphalt oval (in XZ via rotated shape in XY then rotate) */}
      <mesh
        geometry={asphalt}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        receiveShadow
      >
        <meshStandardMaterial color="#3d3f45" />
      </mesh>
      {/* center line dashes */}
      {Array.from({ length: 24 }).map((_, i) => {
        const t = (i / 24) * Math.PI * 2
        const r = 18
        const x = Math.sin(t) * r * 1.15
        const z = Math.cos(t) * r
        return (
          <mesh
            key={i}
            position={[x, 0.03, z]}
            rotation={[0, -t, 0]}
          >
            <boxGeometry args={[0.3, 0.02, 1.2]} />
            <meshStandardMaterial color="#f0e68c" />
          </mesh>
        )
      })}
      {/* colorful barriers */}
      {Array.from({ length: 32 }).map((_, i) => {
        const t = (i / 32) * Math.PI * 2
        const r = 23.2
        const x = Math.sin(t) * r * 1.15
        const z = Math.cos(t) * r
        const color = i % 2 === 0 ? '#e63946' : '#f1faee'
        return (
          <mesh key={`b-${i}`} position={[x, 0.4, z]} rotation={[0, -t, 0]} castShadow>
            <boxGeometry args={[1.4, 0.8, 0.35]} />
            <meshStandardMaterial color={color} />
          </mesh>
        )
      })}
      {/* start/finish arch */}
      <group position={[0, 0, 18]}>
        <mesh position={[-3, 1.5, 0]}>
          <boxGeometry args={[0.4, 3, 0.4]} />
          <meshStandardMaterial color="#457b9d" />
        </mesh>
        <mesh position={[3, 1.5, 0]}>
          <boxGeometry args={[0.4, 3, 0.4]} />
          <meshStandardMaterial color="#457b9d" />
        </mesh>
        <mesh position={[0, 3.2, 0]}>
          <boxGeometry args={[6.4, 0.5, 0.4]} />
          <meshStandardMaterial color="#e9c46a" />
        </mesh>
      </group>
    </group>
  )
}
