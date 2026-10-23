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
    <TrackFurniture />
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
/** Hundreds of curb/rail pieces share four draw calls instead of individual meshes. */
function TrackFurniture() {
  const meshes = useMemo(() => {
    const matrix = new THREE.Object3D()
    const create = (geometry: THREE.BufferGeometry, count: number, place: (i: number) => {t: number; offset: number; y: number; color: string}) => {
      const mesh = new THREE.InstancedMesh(geometry, new THREE.MeshStandardMaterial({roughness:0.7}), count)
      for (let i=0;i<count;i++) {
        const spec=place(i), sample=getTrackSample(spec.t)
        matrix.position.copy(sample.point).addScaledVector(sample.normal,spec.offset)
        matrix.position.y=spec.y; matrix.rotation.set(0,sample.yaw,0);matrix.updateMatrix()
        mesh.setMatrixAt(i,matrix.matrix);mesh.setColorAt(i,new THREE.Color(spec.color))
      }
      mesh.receiveShadow=true;mesh.computeBoundingSphere();return mesh
    }
    return [
      create(new THREE.BoxGeometry(.5,.13,TRACK_LENGTH/260*1.04),520,i=>({t:(i%260)/260,offset:i<260?-4.7:4.7,y:.075,color:i%4<2?'#f76c56':'#fff4dd'})),
      create(new THREE.BoxGeometry(.085,.015,1.25),68,i=>({t:i/68,offset:0,y:.065,color:'#c4cbd1'})),
      create(new THREE.BoxGeometry(.12,.7,.12),180,i=>({t:(i%90)/90,offset:i<90?-6.3:6.3,y:.35,color:'#e5dfc9'})),
    ]
  },[])
  useEffect(()=>()=>{meshes.forEach(m=>{m.geometry.dispose();(m.material as THREE.Material).dispose();m.dispose()})},[meshes])
  return <>
    {meshes.map((mesh,i)=><primitive key={i} object={mesh}/>)}
    {[-1,1].map(side=><group key={side}>
      <Ribbon inner={side*6.2} outer={side*6.45} color="#fff3d7" y={.65}/>
      <Ribbon inner={side*6.2} outer={side*6.45} color="#137d89" y={.26}/>
    </group>)}
  </>
}
function Banner() {
  const texture = useMemo(() => { const c = document.createElement('canvas'); c.width = 1024; c.height = 128; const ctx = c.getContext('2d')!; ctx.fillStyle = '#123c4b'; ctx.fillRect(0, 0, 1024, 128); ctx.fillStyle = '#fff3d8'; ctx.textAlign = 'center'; ctx.font = '900 72px Arial'; ctx.fillText('PALM  PRIX', 512, 91); ctx.fillStyle = '#fcb457'; ctx.fillRect(20, 20, 12, 88); ctx.fillRect(992, 20, 12, 88); return new THREE.CanvasTexture(c) }, [])
  useEffect(() => () => texture.dispose(), [texture])
  return <>{[1, -1].map(s => <mesh key={s} position={[0, 5.35, s * 0.232]} rotation={[0, s < 0 ? Math.PI : 0, 0]}><planeGeometry args={[10.5, 1]} /><meshBasicMaterial map={texture} /></mesh>)}</>
}


