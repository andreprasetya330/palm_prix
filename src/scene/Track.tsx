import { useMemo, useEffect } from 'react'
import * as THREE from 'three'
import { TrackProps } from './TrackProps'
import { Ocean } from './Ocean'
import { getTrackSample, TRACK_LENGTH } from '../game/trackLayout'

function ribbon(inner: number, outer: number) {
  const positions: number[] = [], indices: number[] = [], uvs: number[] = []
  for (let i = 0; i <= 512; i++) {
    const sample = getTrackSample(i / 512)
    for (const offset of [inner, outer]) {
      const p = sample.point.clone().addScaledVector(sample.normal, offset)
      positions.push(p.x, 0, p.z); uvs.push(p.x / 4, p.z / 4)
    }
    if (i < 512) { const n = i * 2; indices.push(n, n + 2, n + 1, n + 1, n + 2, n + 3) }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); g.setIndex(indices); g.computeVertexNormals()
  return g
}
function surfaceTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256
  const context = canvas.getContext('2d')!, pixels = context.createImageData(256, 256)
  let seed = 1337
  for (let i = 0; i < pixels.data.length; i += 4) { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; const v = 210 + (seed >>> 24) / 255 * 45; pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = v; pixels.data[i + 3] = 255 }
  context.putImageData(pixels, 0, 0)
  const texture = new THREE.CanvasTexture(canvas); texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8; return texture
}
function Ribbon({ inner, outer, color, y = 0, textured = false }: { inner: number; outer: number; color: string; y?: number; textured?: boolean }) {
  const geometry = useMemo(() => ribbon(inner, outer), [inner, outer])
  const grain = useMemo(() => textured ? surfaceTexture() : null, [textured])
  useEffect(() => () => { geometry.dispose(); grain?.dispose() }, [geometry, grain])
  return <mesh geometry={geometry} position={[0, y, 0]} receiveShadow><meshStandardMaterial color={color} map={grain} roughness={0.88} side={THREE.DoubleSide} /></mesh>
}
export function Track({ showcase = false }: { showcase?: boolean }) {
  const start = getTrackSample(0)
  return <group>
    <Ocean />
    <mesh position={[0, -0.5, 0]} scale={[1.08, 1, 1]} receiveShadow><cylinderGeometry args={[47, 48, 0.9, 128]} /><meshStandardMaterial color="#f6dfa0" roughness={1} /></mesh>
    <mesh position={[0, -0.1, 0]} scale={[1.08, 1, 1]} receiveShadow><cylinderGeometry args={[40, 41, 0.25, 128]} /><meshStandardMaterial color="#7eae56" roughness={1} /></mesh>
    <Ribbon inner={-5.1} outer={5.1} color="#d6bf84" y={0.035} />
    <Ribbon inner={-4.5} outer={4.5} color="#414b5b" y={0.04} textured />
    {[-1, 1].map(side => <Ribbon key={side} inner={side * 4.20} outer={side * 4.32} color="#fff2d7" y={0.055} />)}
    {[-1, 1].map(side => Array.from({ length: 260 }, (_, i) => {
      const s = getTrackSample(i / 260), p = s.point.clone().addScaledVector(s.normal, side * 4.7)
      return <mesh key={`${side}-${i}`} position={[p.x, 0.075, p.z]} rotation={[0, s.yaw, 0]} receiveShadow><boxGeometry args={[0.5, 0.13, TRACK_LENGTH / 260 * 1.04]} /><meshStandardMaterial color={i % 4 < 2 ? '#f76c56' : '#fff4dd'} roughness={0.7} /></mesh>
    }))}
    {Array.from({ length: 68 }, (_, i) => { const s = getTrackSample(i / 68); return <mesh key={i} position={[s.point.x, 0.065, s.point.z]} rotation={[0, s.yaw, 0]}><boxGeometry args={[0.085, 0.015, 1.25]} /><meshStandardMaterial color="#c4cbd1" /></mesh> })}
    {[-1, 1].map(side => <group key={side}>
      <Ribbon inner={side * 6.2} outer={side * 6.45} color="#fff3d7" y={0.65} />
      <Ribbon inner={side * 6.2} outer={side * 6.45} color="#137d89" y={0.26} />
      {Array.from({ length: 90 }, (_, i) => { const s = getTrackSample(i / 90), p = s.point.clone().addScaledVector(s.normal, side * 6.3); return <mesh key={i} position={[p.x, 0.35, p.z]} castShadow><boxGeometry args={[0.12, 0.7, 0.12]} /><meshStandardMaterial color="#e5dfc9" /></mesh> })}
    </group>)}
    <group position={start.point} rotation={[0, start.yaw, 0]}>
      {Array.from({ length: 27 }, (_, i) => <mesh key={i} position={[(i % 9 - 4), 0.075, (Math.floor(i / 9) - 1) * 0.4]}><boxGeometry args={[1, 0.015, 0.4]} /><meshStandardMaterial color={(i + Math.floor(i / 9)) % 2 ? '#fff7e5' : '#172b36'} /></mesh>)}
      {!showcase && <group>
      {[-5.15, 5.15].map(x => <group key={x} position={[x, 0, 0]}><mesh position={[0, 2.8, 0]} castShadow><cylinderGeometry args={[0.16, 0.24, 5.6, 12]} /><meshStandardMaterial color="#176c77" metalness={0.4} roughness={0.4} /></mesh><mesh position={[0, 0.4, 0]}><boxGeometry args={[0.9, 0.8, 0.9]} /><meshStandardMaterial color="#f7ba57" /></mesh></group>)}
      <mesh position={[0, 5.35, 0]} castShadow><boxGeometry args={[11, 1.1, 0.45]} /><meshStandardMaterial color="#123c4b" /></mesh>
      <Banner />
      {[-1, 0, 1].map(x => <mesh key={x} position={[x * 0.5, 4.55, 0]}><sphereGeometry args={[0.12, 12, 12]} /><meshStandardMaterial color="#aaffc9" emissive="#44ee99" emissiveIntensity={1} /></mesh>)}
      </group>}
    </group>
    <TrackProps />
  </group>
}
function Banner() {
  const texture = useMemo(() => { const c = document.createElement('canvas'); c.width = 1024; c.height = 128; const ctx = c.getContext('2d')!; ctx.fillStyle = '#123c4b'; ctx.fillRect(0, 0, 1024, 128); ctx.fillStyle = '#fff3d8'; ctx.textAlign = 'center'; ctx.font = '900 72px Arial'; ctx.fillText('PALM  PRIX', 512, 91); ctx.fillStyle = '#fcb457'; ctx.fillRect(20, 20, 12, 88); ctx.fillRect(992, 20, 12, 88); return new THREE.CanvasTexture(c) }, [])
  useEffect(() => () => texture.dispose(), [texture])
  return <>{[1, -1].map(s => <mesh key={s} position={[0, 5.35, s * 0.232]} rotation={[0, s < 0 ? Math.PI : 0, 0]}><planeGeometry args={[10.5, 1]} /><meshBasicMaterial map={texture} /></mesh>)}</>
}


