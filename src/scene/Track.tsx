import { Suspense, useMemo, useEffect } from 'react'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { TrackProps } from './TrackProps'
import { getTrackSample, TRACK_LENGTH } from '../game/trackLayout'

function ribbon(inner: number, outer: number, wallHeight = 0) {
  const positions: number[] = [], indices: number[] = [], uvs: number[] = []
  for (let i = 0; i <= 384; i++) {
    const sample = getTrackSample(i / 384)
    for (const [j, offset] of [inner, outer].entries()) {
      const p = sample.point.clone().addScaledVector(sample.normal, offset)
      positions.push(p.x, j * wallHeight, p.z); uvs.push(p.x / 5, p.z / 5)
    }
    if (i < 384) { const n = i * 2; indices.push(n, n + 2, n + 1, n + 1, n + 2, n + 3) }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); g.setIndex(indices); g.computeVertexNormals()
  return g
}
function Ribbon({ inner, outer, color, y = 0, wallHeight = 0, glow = false }: { inner: number; outer: number; color: string; y?: number; wallHeight?: number; glow?: boolean }) {
  const geometry = useMemo(() => ribbon(inner, outer, wallHeight), [inner, outer, wallHeight])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh geometry={geometry} position={[0, y, 0]} receiveShadow><meshStandardMaterial color={color} roughness={0.8} emissive={glow ? color : '#000000'} emissiveIntensity={glow ? 0.8 : 0} side={THREE.DoubleSide} /></mesh>
}
function Asphalt() {
  const [sourceDiff, sourceNormal] = useTexture(['/assets/track/asphalt-diff.jpg', '/assets/track/asphalt-normal.jpg'])
  const {diff,normal}=useMemo(()=>{
    const diff=sourceDiff.clone(),normal=sourceNormal.clone()
    for(const texture of [diff,normal]){texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=4;texture.needsUpdate=true}
    diff.colorSpace=THREE.SRGBColorSpace
    return {diff,normal}
  },[sourceDiff,sourceNormal])
  useEffect(()=>()=>{diff.dispose();normal.dispose()},[diff,normal])
  const geometry = useMemo(() => ribbon(-4.5, 4.5), [])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh geometry={geometry} position={[0, 0.04, 0]} receiveShadow><meshStandardMaterial color="#9095a1" map={diff} normalMap={normal} normalScale={[0.18, 0.18]} roughness={0.83} side={THREE.DoubleSide} /></mesh>
}
/** Road stays exactly on the shared gameplay spline. Static details are merged into six draws. */
export function Track({ showcase = false }: { showcase?: boolean }) {
  const batches = useMemo(() => {
    const groups = new Map<string, THREE.BufferGeometry[]>()
    const add = (color: string, g: THREE.BufferGeometry) => { if (!groups.has(color)) groups.set(color, []); groups.get(color)!.push(g) }
    for (const side of [-1, 1]) {
      for (let i = 0; i < 260; i++) {
        const s = getTrackSample(i / 260), p = s.point.clone().addScaledVector(s.normal, side * 4.72)
        const g = new THREE.BoxGeometry(0.5, 0.1, TRACK_LENGTH / 260 * 1.03)
        g.rotateY(s.yaw); g.translate(p.x, 0.07, p.z)
        add(i % 6 < 3 ? '#db7b4c' : '#d7dce0', g)
      }
      for (let i = 0; i < 90; i++) {
        const s = getTrackSample(i / 90), p = s.point.clone().addScaledVector(s.normal, side * 6.4)
        add('#6c7985', new THREE.BoxGeometry(0.09, 1.3, 0.09).translate(p.x, 0.65, p.z))
      }
    }
    // Finish checker and staggered starting grid.
    const start = getTrackSample(0)
    for (let row = 0; row < 3; row++) for (let col = 0; col < 9; col++) {
      const g = new THREE.BoxGeometry(1, 0.012, 0.38).translate(col - 4, 0.07, (row - 1) * 0.38)
      g.rotateY(start.yaw); g.translate(start.point.x, 0, start.point.z)
      add((row + col) % 2 ? '#d7dce0' : '#152536', g)
    }
    for (let i = 0; i < 8; i++) {
      const s = getTrackSample(0.985 - Math.floor(i / 2) * 0.017), p = s.point.clone().addScaledVector(s.normal, i % 2 ? 2 : -2)
      const g = new THREE.BoxGeometry(1.8, 0.012, 0.09).rotateY(s.yaw).translate(p.x, 0.065, p.z)
      add('#d7dce0', g)
    }
    if (!showcase) {
      for (const side of [-1, 1]) {
        const p = start.point.clone().addScaledVector(start.normal, side * 5.35)
        add('#152536', new THREE.BoxGeometry(0.28, 5.8, 0.28).translate(p.x, 2.9, p.z))
      }
      const beam = new THREE.BoxGeometry(11.2, 0.8, 0.35).rotateY(start.yaw).translate(start.point.x, 5.6, start.point.z)
      add('#152536', beam)
      const light = new THREE.BoxGeometry(10.6, 0.07, 0.4).rotateY(start.yaw).translate(start.point.x, 5.15, start.point.z)
      add('#ffbd64', light)
    }
    return [...groups].map(([color, gs]) => { const geometry = mergeGeometries(gs); gs.forEach(g => g.dispose()); return { color, geometry } })
  }, [showcase])
  useEffect(() => () => batches.forEach(b => b.geometry.dispose()), [batches])
  return <group>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, 0]} receiveShadow><planeGeometry args={[240, 240]} /><meshStandardMaterial color="#263937" roughness={1} /></mesh>
    <Ribbon inner={-6.5} outer={6.5} color="#364451" y={0.012} />
    <Ribbon inner={-5.6} outer={5.6} color="#406c6b" y={0.025} />
    <Suspense fallback={<Ribbon inner={-4.5} outer={4.5} color="#313641" y={0.04} />}><Asphalt /></Suspense>
    {[-1, 1].map(side => <group key={side}>
      <Ribbon inner={side * 4.2} outer={side * 4.3} color="#e9e4d6" y={0.055} />
      <Ribbon inner={side * 6.18} outer={side * 6.18} color="#263c50" y={0.04} wallHeight={0.8} />
      <Ribbon inner={side * 6.18} outer={side * 6.4} color="#c1c9cf" y={0.84} />
      <Ribbon inner={side * 6.35} outer={side * 6.42} color="#df9b54" y={1.02} glow />
    </group>)}
    {batches.map(b => <mesh key={b.color} geometry={b.geometry} receiveShadow><meshStandardMaterial color={b.color} roughness={0.7} emissive={b.color === '#ffbd64' ? b.color : '#000000'} emissiveIntensity={0.6} /></mesh>)}
    <TrackProps />
  </group>
}
