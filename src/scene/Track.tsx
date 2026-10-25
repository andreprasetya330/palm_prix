import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { getTrackSample, TRACK_LENGTH, ROAD_HALF_WIDTH } from '../game/trackLayout'

/** A floating ceramic ribbon; the top stays aligned with the gameplay corridor at y=0. */
function ribbon(inner: number, outer: number, rise = 0) {
  const positions: number[] = [], indices: number[] = [], uvs: number[] = []
  for (let i = 0; i <= 384; i++) {
    const s = getTrackSample(i / 384)
    for (const [j, offset] of [inner, outer].entries()) {
      const p = s.point.clone().addScaledVector(s.normal, offset)
      positions.push(p.x, j * rise, p.z)
      uvs.push((offset + ROAD_HALF_WIDTH) / 4, i / 384 * TRACK_LENGTH / 4)
    }
    if (i < 384) { const n = i * 2; indices.push(n, n + 2, n + 1, n + 1, n + 2, n + 3) }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices); geometry.computeVertexNormals()
  return geometry
}
/** Small porcelain tiles provide motion cues without loud lane stripes. */
function CeramicRoad() {
  const geometry = useMemo(() => ribbon(-ROAD_HALF_WIDTH, ROAD_HALF_WIDTH), [])
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#cbd5d1'; ctx.fillRect(0, 0, 512, 512)
    let seed = 4187
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) / 4294967296 }
    for (let row = 0; row < 4; row++) {
      const shift = row % 2 ? 128 : 0
      for (let col = -1; col < 3; col++) {
        const x = col * 256 + shift, y = row * 128
        const value = 228 + Math.floor(random() * 10)
        ctx.fillStyle = `rgb(${value - 3},${value + 2},${value})`
        ctx.fillRect(x + 1, y + 1, 254, 126)
        ctx.strokeStyle = 'rgba(255,255,255,0.13)'; ctx.lineWidth = 1
        ctx.strokeRect(x + 2, y + 2, 252, 124)
      }
    }
    // Restrained fired-glaze variation; no coarse noise or cracked asphalt.
    for (let i = 0; i < 5000; i++) {
      ctx.fillStyle = random() > 0.5 ? 'rgba(255,255,255,0.018)' : 'rgba(60,90,82,0.018)'
      ctx.beginPath(); ctx.ellipse(random() * 512, random() * 512, random() * 4 + 1, random() * 2 + 1, 0, 0, Math.PI * 2); ctx.fill()
    }
    const map = new THREE.CanvasTexture(canvas)
    map.wrapS = map.wrapT = THREE.RepeatWrapping; map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8
    return map
  }, [])
  useEffect(() => () => { geometry.dispose(); texture.dispose() }, [geometry, texture])
  return <mesh geometry={geometry} receiveShadow><meshStandardMaterial color="#a0b9b2" map={texture} bumpMap={texture} bumpScale={0.012} roughness={0.6} metalness={0} side={THREE.DoubleSide} /></mesh>
}
const GOLD = '#edbd62'
const CREAM = '#fff0cf'
const EDGE = ROAD_HALF_WIDTH + 1.68

export function Track({ showcase = false }: { showcase?: boolean }) {
  // showcase remains part of the public API; Cloud Carnival's arch is a separate landmark.
  void showcase
  const batches = useMemo(() => {
    const buckets = new Map<string, THREE.BufferGeometry[]>()
    const add = (color: string, geometry: THREE.BufferGeometry) => { if (!buckets.has(color)) buckets.set(color, []); buckets.get(color)!.push(geometry) }
    const place = (g: THREE.BufferGeometry, t: number, lateral: number, y: number, color: string) => {
      const s = getTrackSample(t), p = s.point.clone().addScaledVector(s.normal, lateral)
      g.rotateY(s.yaw); g.translate(p.x, y, p.z); add(color, g)
    }
    // Deliberate long colour blocks, not noisy candy stripes. Rounded rail finials
    // add silhouette detail with one draw per material across the entire circuit.
    for (const side of [-1, 1]) {
      const palette = ['#eea8ba', '#88cec4', '#b8ade1', '#f0c67d']
      for (let i = 0; i < 180; i++) {
        const color = palette[Math.floor(i / 15) % palette.length]
        place(new THREE.BoxGeometry(0.24, 0.64, TRACK_LENGTH / 180 * 1.015), i / 180, side * EDGE, 0.37, color)
      }
      for (let i = 0; i < 72; i++) {
        place(new THREE.CylinderGeometry(0.085, 0.13, 1.12, 8), i / 72, side * (EDGE + 0.08), 0.57, GOLD)
        place(new THREE.SphereGeometry(0.19, 8, 6), i / 72, side * (EDGE + 0.08), 1.18, CREAM)
        place(new THREE.CylinderGeometry(0.23, 0.28, 0.1, 8), i / 72, side * (EDGE + 0.08), 0.09, '#418d99')
      }
      // Recessed rounded-looking curb blocks outline the playable cream road.
      for (let i = 0; i < 150; i++) place(new THREE.BoxGeometry(0.32, 0.06, TRACK_LENGTH / 150 * 0.8), i / 150, side * (ROAD_HALF_WIDTH + 0.1), 0.03, i % 2 ? CREAM : '#82c8c3')
    }
    // Gold ribs beneath the suspended deck give it depth when seen from the menu.
    for (let i = 0; i < 40; i++) {
      place(new THREE.BoxGeometry(EDGE * 2 + 0.5, 0.18, 0.22), i / 40, 0, -1.45, GOLD)
      for (const side of [-1, 1]) place(new THREE.SphereGeometry(0.38, 8, 6), i / 40, side * (EDGE - 0.1), -1.15, '#57aeb7')
    }
    // Sparse inset diamonds define the racing line without competing with rewards.
    for (let i = 0; i < 60; i++) {
      const tile = new THREE.PlaneGeometry(0.11, 0.8).rotateX(-Math.PI / 2)
      place(tile, i / 60, 0, 0.014, '#dacdaf')
    }
    // Broad arrow inlays before major corners. Each chevron is part of one gold mesh.
    for (let i = 0; i < 22; i++) {
      const t = i / 22, current = getTrackSample(t), next = getTrackSample(t + 0.02)
      const turn = current.tangent.x * next.tangent.z - current.tangent.z * next.tangent.x
      if (Math.abs(turn) < 0.12) continue
      for (const side of [-1, 1]) {
        const shape = new THREE.Shape()
        shape.moveTo(-0.48, -0.3); shape.lineTo(0, 0.38); shape.lineTo(0.48, -0.3)
        shape.lineTo(0.27, -0.3); shape.lineTo(0, 0.08); shape.lineTo(-0.27, -0.3); shape.closePath()
        const geo = new THREE.ShapeGeometry(shape).rotateX(Math.PI / 2)
        place(geo, t, side * (ROAD_HALF_WIDTH - 1.0), 0.018, GOLD)
      }
    }
    // Pearl and teal finish line with eight spacious staggered grid slots.
    const start = getTrackSample(0)
    for (let row = 0; row < 3; row++) for (let col = 0; col < ROAD_HALF_WIDTH * 2; col++) {
      const g = new THREE.BoxGeometry(1, 0.012, 0.38).translate(col - ROAD_HALF_WIDTH + 0.5, 0.017, (row - 1) * 0.38)
      g.rotateY(start.yaw); g.translate(start.point.x, 0, start.point.z)
      add((row + col) % 2 ? '#fff7e7' : '#3b8391', g)
    }
    for (let i = 0; i < 8; i++) place(new THREE.BoxGeometry(2.3, 0.012, 0.1), 0.985 - Math.floor(i / 2) * 0.017, i % 2 ? 3.3 : -3.3, 0.018, '#bda776')
    // Bake structural ribbons and colored trim into just two material batches.
    const strip=(inner:number,outer:number,color:string,y=0,rise=0)=>add(color,ribbon(inner,outer,rise).translate(0,y,0))
    strip(-EDGE-.35,EDGE+.35,'#285969',-1.55)
    strip(-EDGE-.2,EDGE+.2,'#f3c5cc',-.015)
    for(const side of [-1,1]){
      strip(side*(EDGE+.2),side*(EDGE+.2),'#438899',-1.5,1.47)
      strip(side*(EDGE+.08),side*(EDGE+.35),GOLD,-1.49)
      strip(side*(EDGE-.14),side*(EDGE+.14),CREAM,.72)
      strip(side*(EDGE-.18),side*(EDGE+.18),GOLD,.76)
      strip(side*(ROAD_HALF_WIDTH-.42),side*(ROAD_HALF_WIDTH-.08),'#83c8c2',.008)
      strip(side*(ROAD_HALF_WIDTH-.49),side*(ROAD_HALF_WIDTH-.44),GOLD,.009)
    }
    const painted:THREE.BufferGeometry[]=[],gold:THREE.BufferGeometry[]=[]
    for(const [color,geometries] of buckets){
      const value=new THREE.Color(color)
      for(const original of geometries){
        const g=original.index?original.toNonIndexed():original
        if(g!==original)original.dispose()
        g.deleteAttribute('uv')
        const values=new Float32Array(g.attributes.position.count*3)
        for(let i=0;i<values.length;i+=3)value.toArray(values,i)
        g.setAttribute('color',new THREE.BufferAttribute(values,3))
        ;(color===GOLD?gold:painted).push(g)
      }
    }
    return [painted,gold].map((geometries,index)=>{
      const geometry=mergeGeometries(geometries,false)!
      geometries.forEach(g=>g.dispose());geometry.computeBoundingSphere()
      return {color:index===1?'gold':'paint',geometry}
    })
  }, [])
  useEffect(() => () => batches.forEach(b => b.geometry.dispose()), [batches])
  return <group>
    <CeramicRoad />
    {batches.map(b=><mesh key={b.color} geometry={b.geometry} receiveShadow><meshStandardMaterial vertexColors roughness={b.color==='gold'?.44:.52} metalness={b.color==='gold'?.3:.05} side={THREE.DoubleSide}/></mesh>)}
  </group>
}
