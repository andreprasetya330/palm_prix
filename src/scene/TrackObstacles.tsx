import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { OBSTACLES, getObstaclePose } from '../game/obstacles'
import type { RaceRuntime } from '../game/runtime'

/** Three readable road hazards; groups move directly from shared simulation time. */
export function TrackObstacles({ runtime }: { runtime: RaceRuntime }) {
  const refs = useRef<(THREE.Group | null)[]>([])
  const geometry = useMemo(() => {
    const pieces: THREE.BufferGeometry[] = []
    const box = (x: number, y: number, z: number, w: number, h: number, d: number, color: string) => {
      const g = new THREE.BoxGeometry(w, h, d).translate(x, y, z), c = new THREE.Color(color)
      const colors = new Float32Array(g.getAttribute('position').count * 3)
      for (let i = 0; i < colors.length; i += 3) { colors[i] = c.r; colors[i + 1] = c.g; colors[i + 2] = c.b }
      g.setAttribute('color', new THREE.BufferAttribute(colors, 3)); pieces.push(g)
    }
    box(0, .25, 0, 1.7, .5, 1.7, '#141725'); box(0, .55, 0, 1.45, .2, 1.45, '#edb548')
    for (const side of [-1, 1]) {
      box(side * .55, 1.0, 0, .1, .9, .1, '#b6bfce')
      box(0, 1.38, side * .06, 1.4, .45, .08, '#f9b64a')
      for (let i = 0; i < 4; i++) box(-.48 + i * .32, 1.38, side * .105, .13, .45, .015, '#211527')
    }
    const merged = mergeGeometries(pieces); pieces.forEach(g => g.dispose()); return merged
  }, [])
  useEffect(() => () => geometry.dispose(), [geometry])
  useFrame(() => { refs.current.forEach((group, i) => { if (!group) return; const pose = getObstaclePose(i, runtime.race.elapsed); group.position.set(pose.x, pose.y+(OBSTACLES[i].moving ? .06 + Math.sin(runtime.race.elapsed * 3) * .04 : 0), pose.z); group.rotation.set(-pose.pitch,pose.yaw,pose.bank,'YXZ') }) })
  return <>{OBSTACLES.map((o, i) => <group key={o.id} ref={g => { refs.current[i] = g }}>
    <mesh geometry={geometry} castShadow receiveShadow><meshStandardMaterial vertexColors roughness={.5} metalness={.25} /></mesh>
    <mesh position={[0, 1.7, 0]}><sphereGeometry args={[.13, 8, 6]} /><meshBasicMaterial color={o.moving ? '#21f5ed' : '#ff934c'} /></mesh>
    {o.moving && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .05, 0]}><ringGeometry args={[.78, 1.05, 24]} /><meshBasicMaterial color="#22ffed" transparent opacity={.65} side={THREE.DoubleSide} /></mesh>}
  </group>)}</>
}


