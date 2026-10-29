import { Suspense, useEffect, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { PaddockVehicles } from './PaddockVehicles'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

/** Static architecture is baked by material, not hundreds of independent scene objects. */
export function TrackProps() {
  const batches = useMemo(() => {
    const buckets = new Map<string, THREE.BufferGeometry[]>()
    const box = (color: string, x: number, y: number, z: number, w: number, h: number, d: number, yaw = 0) => {
      const g = new THREE.BoxGeometry(w, h, d)
      g.rotateY(yaw); g.translate(x, y, z)
      if (!buckets.has(color)) buckets.set(color, [])
      buckets.get(color)!.push(g)
    }
    // Grandstands: cantilever canopy, stepped seating, access aisles and steel supports.
    for (const [cx, cz, yaw, length] of [[0, -46, 0, 86], [-49, 0, Math.PI / 2, 66], [49, 0, -Math.PI / 2, 66]] as const) {
      const place = (color: string, x: number, y: number, z: number, w: number, h: number, d: number) => box(color, cx + Math.cos(yaw) * x + Math.sin(yaw) * z, y, cz - Math.sin(yaw) * x + Math.cos(yaw) * z, w, h, d, yaw)
      place('#273444', 0, 1.8, -2.2, length, 3.6, 8)
      for (let row = 0; row < 7; row++) {
        place('#7d8290', 0, 1.2 + row * 0.58, 1.6 - row * 0.92, length, 0.34, 1.05)
        for (let seat = 0; seat < length / 0.75; seat++) {
          if (seat % 20 < 2) continue
          const color = (seat + row * 3) % 13 < 3 ? '#e9b96a' : (seat + row) % 7 < 3 ? '#446179' : '#1e344d'
          place(color, -length / 2 + seat * 0.75 + 0.4, 1.65 + row * 0.58, 1.4 - row * 0.92, 0.5, 0.45, 0.42)
        }
      }
      place('#182639', 0, 8.2, -0.4, length + 1, 0.25, 12)
      place('#ffbd64', 0, 8.08, 5.5, length, 0.14, 0.16)
      for (let x = -length / 2 + 3; x < length / 2; x += 9) {
        place('#566575', x, 5.1, -5.4, 0.22, 6.1, 0.3)
        place('#566575', x, 7.9, -0.2, 0.16, 0.16, 11)
      }
      place('#172738', 0, 0.8, 5, length, 1.6, 0.35)
    }
    // Paddock garages, continuous hospitality glazing, rooftop guardrails.
    box('#263444', 0, 2.2, 40, 54, 4.4, 8)
    box('#182639', 0, 4.45, 40, 56, 0.35, 9)
    box('#435364', 0, 5.9, 40.5, 42, 2.6, 6.5)
    box('#294d60', 0, 5.9, 37.22, 40, 2.0, 0.08)
    box('#ffbd64', 0, 4.05, 35.94, 54, 0.11, 0.12)
    box('#182639', 0, 7.35, 40.5, 44, 0.22, 7.5)
    for (let i = 0; i < 10; i++) {
      const x = -23.5 + i * 5.2
      box('#101b2a', x, 1.7, 35.94, 4.4, 3, 0.1)
      for (let slat = 0; slat < 10; slat++) box('#435364', x, 0.4 + slat * 0.28, 35.87, 4.15, 0.045, 0.04)
      box('#c5cbd0', x + 2.4, 2.0, 35.85, 0.12, 4, 0.12)
      box('#ffbd64', x, 3.5, 35.8, 0.8, 0.2, 0.08)
    }
    for (let x = -20; x <= 20; x += 3.3) box('#c5cbd0', x, 5.9, 37.15, 0.08, 2.3, 0.08)
    // Floodlight masts: emissive panels instead of costly real-time point lights.
    for (const [x, z] of [[-38, -36], [38, -36], [-38, 34], [38, 34]]) {
      box('#697586', x, 8, z, 0.28, 16, 0.28)
      box('#162b3d', x, 16, z, 5.4, 1.4, 0.35)
      for (let i = 0; i < 6; i++) box('#fff4d3', x - 2.15 + i * 0.86, 16.03, z + (z > 0 ? -0.2 : 0.2), 0.65, 0.9, 0.04)
    }
    // Infield media tower and timing pylon sit clear of the road.
    box('#182639', 0, 5, -3, 1.1, 10, 1.1)
    box('#172738', 0, 8.2, -3, 12.5, 5.0, 0.65)
    return [...buckets].map(([color, geometries]) => {
      const geometry = mergeGeometries(geometries)
      geometries.forEach(g => g.dispose())
      return { color, geometry }
    })
  }, [])
  useEffect(() => () => batches.forEach(b => b.geometry.dispose()), [batches])
  return <group scale={1.7}>
    {batches.map(b => <mesh key={b.color} geometry={b.geometry} receiveShadow><meshStandardMaterial color={b.color} roughness={0.65} metalness={0.18} emissive={b.color === '#fff4d3' || b.color === '#ffbd64' ? b.color : '#000000'} emissiveIntensity={b.color === '#fff4d3' ? 2 : 0.35} /></mesh>)}
    <Sign position={[0, 8.2, -2.65]} width={12} height={4.5} title="PALM PRIX" subtitle="NIGHTFALL GRAND PRIX  /  LIVE" />
    <Sign position={[0, 2.0, -40.4]} width={42} height={1.6} title="PRECISION  /  PACE  /  PALM PRIX" subtitle="THE NIGHTFALL CIRCUIT" />
    <Sign position={[0, 6.0, 37.12]} rotation={Math.PI} width={18} height={1.8} title="PALM PRIX MOTORSPORT" subtitle="PIT LANE  /  TEAM HOSPITALITY" />
    <Suspense fallback={null}><ScannedBarriers /><PaddockVehicles/></Suspense>
  </group>
}
function Sign({ position, rotation = 0, width, height, title, subtitle }: { position: [number, number, number]; rotation?: number; width: number; height: number; title: string; subtitle: string }) {
  const map = useMemo(() => {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 256
    const ctx = c.getContext('2d')!; ctx.fillStyle = '#0c1727'; ctx.fillRect(0, 0, 1024, 256)
    ctx.fillStyle = '#ffb75f'; ctx.fillRect(0, 0, 12, 256); ctx.fillRect(1012, 0, 12, 256)
    ctx.textAlign = 'center'; ctx.fillStyle = '#fff3dc'; ctx.font = 'italic 900 66px Arial'; ctx.fillText(title, 512, 130, 950)
    ctx.font = '22px Arial'; ctx.fillStyle = '#ffbd64'; ctx.fillText(subtitle, 512, 190, 940)
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
  }, [title, subtitle])
  useEffect(() => () => map.dispose(), [map])
  return <mesh position={position} rotation={[0, rotation, 0]}><planeGeometry args={[width, height]} /><meshBasicMaterial map={map} toneMapped={false} side={THREE.DoubleSide} /></mesh>
}
function ScannedBarriers() {
  const { scene } = useGLTF('/assets/track/concrete-barrier-lod.glb')
  const geometry = useMemo(() => {
    scene.updateMatrixWorld(true)
    const gs: THREE.BufferGeometry[] = []
    scene.traverse(o => { if (o instanceof THREE.Mesh) gs.push(o.geometry.clone().applyMatrix4(o.matrixWorld)) })
    const merged = mergeGeometries(gs); gs.forEach(g => g.dispose()); merged.computeBoundingBox()
    const bounds = merged.boundingBox!, size = bounds.getSize(new THREE.Vector3())
    merged.translate(-(bounds.min.x + bounds.max.x) / 2, -bounds.min.y, -(bounds.min.z + bounds.max.z) / 2)
    merged.scale(2.7 / Math.max(size.x, size.z), 2.7 / Math.max(size.x, size.z), 2.7 / Math.max(size.x, size.z))
    return merged
  }, [scene])
  const material = useMemo(() => { let m: THREE.Material | undefined; scene.traverse(o => { if (o instanceof THREE.Mesh) m = Array.isArray(o.material) ? o.material[0] : o.material }); return m }, [scene])
  const ref = useRef<THREE.InstancedMesh>(null)
  useEffect(() => { if (!ref.current) return; const dummy = new THREE.Object3D(); for (let i = 0; i < 12; i++) { dummy.position.set(-16.5 + i * 3, 0.02, 34); dummy.updateMatrix(); ref.current.setMatrixAt(i, dummy.matrix) } ref.current.instanceMatrix.needsUpdate = true; ref.current.computeBoundingSphere() }, [])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <instancedMesh ref={ref} args={[geometry, material, 12]} receiveShadow />
}


