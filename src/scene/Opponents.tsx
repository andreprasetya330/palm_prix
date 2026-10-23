import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { RIVALS, rivalAngle } from '../game/raceLoop'

export function Opponents({ elapsed }: { elapsed: number }) {
  return <>{RIVALS.map((r, i) => <Rival key={r.name} index={i} elapsed={elapsed} />)}</>
}
function Rival({ index, elapsed }: { index: number; elapsed: number }) {
  const root = useRef<THREE.Group>(null)
  const wheels = useRef<THREE.Group>(null)
  const r = RIVALS[index]
  useFrame(() => {
    const t = rivalAngle(index, elapsed)
    const radius = r.lane + Math.sin(t * 2 + index) * 0.35
    if (root.current) {
      root.current.position.set(Math.sin(t) * radius * 1.15, 0.04, Math.cos(t) * radius)
      root.current.rotation.y = Math.atan2(Math.cos(t) * 1.15, -Math.sin(t))
    }
    if (wheels.current) wheels.current.children.forEach(w => { w.rotation.x = elapsed * 40 })
  })
  return <group ref={root}>
    <RoundedBox args={[1.22, 0.32, 1.7]} radius={0.14} position={[0, 0.42, 0]} castShadow><meshStandardMaterial color={r.color} roughness={0.26} metalness={0.35} /></RoundedBox>
    <RoundedBox args={[0.9, 0.25, 0.75]} radius={0.11} position={[0, 0.53, 0.65]} castShadow><meshStandardMaterial color={r.color} roughness={0.25} metalness={0.3} /></RoundedBox>
    <mesh position={[0, 0.68, -0.1]} castShadow><sphereGeometry args={[0.42, 20, 16]} /><meshStandardMaterial color="#172637" roughness={0.5} /></mesh>
    <mesh position={[0, 1.15, -0.14]} castShadow><sphereGeometry args={[0.34, 24, 20]} /><meshStandardMaterial color={r.color} metalness={0.35} roughness={0.2} /></mesh>
    <mesh position={[0, 1.15, 0.13]} scale={[1, 0.42, 0.5]}><sphereGeometry args={[0.28, 24, 16]} /><meshStandardMaterial color="#101e32" roughness={0.12} metalness={0.6} /></mesh>
    <mesh position={[0, 0.78, -0.93]} castShadow><boxGeometry args={[1.5, 0.08, 0.3]} /><meshStandardMaterial color={r.color} metalness={0.5} roughness={0.3} /></mesh>
    {[-0.46, 0.46].map(x => <mesh key={x} position={[x, 0.6, -0.9]}><boxGeometry args={[0.06, 0.36, 0.06]} /><meshStandardMaterial color="#202c39" /></mesh>)}
    <group ref={wheels}>{[-1,1].flatMap(x => [-1,1].map(z => <group key={`${x}${z}`} position={[x * 0.68, 0.3, z * 0.6]}><mesh rotation={[0,0,Math.PI/2]} castShadow><cylinderGeometry args={[0.3,0.3,0.28,20]} /><meshStandardMaterial color="#151c28" roughness={0.9} /></mesh><mesh rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[0.16,0.16,0.29,12]} /><meshStandardMaterial color="#bdcdd8" metalness={0.8} roughness={0.25} /></mesh></group>))}</group>
    {[-0.34,0.34].map(x => <mesh key={x} position={[x,0.49,1.035]}><boxGeometry args={[0.22,0.075,0.02]} /><meshStandardMaterial color="#fff5d9" emissive="#ffdf99" emissiveIntensity={1.2} /></mesh>)}
  </group>
}
