import { useMemo } from 'react'
import * as THREE from 'three'
import { TrackProps } from './TrackProps'

function ribbon(inner: number, outer: number) {
  const positions: number[] = [], indices: number[] = [], uvs: number[] = []
  for (let i = 0; i <= 256; i++) {
    const t = i / 256 * Math.PI * 2
    for (const r of [inner, outer]) {positions.push(Math.sin(t) * r * 1.15, 0, Math.cos(t) * r);uvs.push(Math.sin(t)*r*1.15/4,Math.cos(t)*r/4)}
    if(i < 256) {const n=i*2; indices.push(n,n+1,n+2,n+1,n+3,n+2)}
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals()
  return g
}
function surfaceTexture(){
 const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256
 const context=canvas.getContext('2d')!,pixels=context.createImageData(256,256)
 let seed=1337
 for(let i=0;i<pixels.data.length;i+=4){seed=(Math.imul(seed,1664525)+1013904223)|0;const value=210+(seed>>>24)/255*45;pixels.data[i]=value;pixels.data[i+1]=value;pixels.data[i+2]=value;pixels.data[i+3]=255}
 context.putImageData(pixels,0,0)
 const texture=new THREE.CanvasTexture(canvas);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;return texture
}
function Ring({inner,outer,color,y=0,textured=false}:{inner:number;outer:number;color:string;y?:number;textured?:boolean}){
 const geometry=useMemo(()=>ribbon(inner,outer),[inner,outer])
 const grain=useMemo(()=>textured?surfaceTexture():null,[textured])
 return <mesh geometry={geometry} position={[0,y,0]} receiveShadow><meshStandardMaterial color={color} map={grain} roughness={0.88} side={THREE.DoubleSide}/></mesh>
}
export function Track(){
 return <group>
  <mesh rotation={[-Math.PI/2,0,0]} position={[0,-0.55,0]}><planeGeometry args={[1000,1000]}/><meshStandardMaterial color="#10acc1" roughness={0.27} metalness={0.22}/></mesh>
  <mesh position={[0,-0.5,0]} scale={[1.15,1,1]} receiveShadow><cylinderGeometry args={[38,39,0.9,128]}/><meshStandardMaterial color="#f6dfa0" roughness={1}/></mesh>
  <mesh position={[0,-0.1,0]} scale={[1.15,1,1]} receiveShadow><cylinderGeometry args={[27,28,0.25,128]}/><meshStandardMaterial color="#7eae56" roughness={1}/></mesh>
  <Ring inner={0.01} outer={13.4} color="#80ad59" y={0.035} textured/>
  <Ring inner={13.6} outer={22.4} color="#414b5b" y={0.04} textured/>
  <Ring inner={14} outer={14.12} color="#fff2d7" y={0.055}/>
  <Ring inner={21.88} outer={22} color="#fff2d7" y={0.055}/>
  {[13.7,22.3].map(r=>Array.from({length:128},(_,i)=>{
   const t=i/128*Math.PI*2, angle=Math.atan2(-Math.sin(t),1.15*Math.cos(t))
   return <mesh key={`${r}-${i}`} position={[Math.sin(t)*r*1.15,0.06,Math.cos(t)*r]} rotation={[0,-angle,0]} receiveShadow><boxGeometry args={[r*0.054,0.13,0.48]}/><meshStandardMaterial color={i%4<2?'#f76c56':'#fff4dd'} roughness={0.7}/></mesh>
  }))}
  {Array.from({length:40},(_,i)=>{const t=i/40*Math.PI*2;return <mesh key={i} position={[Math.sin(t)*18*1.15,0.065,Math.cos(t)*18]} rotation={[0,Math.atan2(Math.sin(t),1.15*Math.cos(t)),0]}><boxGeometry args={[0.95,0.015,0.085]}/><meshStandardMaterial color="#b8c4ce"/></mesh>})}
  <Ring inner={23.1} outer={23.5} color="#fff3d7" y={0.6}/>
  <Ring inner={23.1} outer={23.5} color="#137d89" y={0.22}/>
  {Array.from({length:56},(_,i)=>{const t=i/56*Math.PI*2;return <mesh key={`post-${i}`} position={[Math.sin(t)*23.3*1.15,0.35,Math.cos(t)*23.3]} castShadow><boxGeometry args={[0.15,0.7,0.15]}/><meshStandardMaterial color="#e5dfc9"/></mesh>})}
  <group position={[0,0,18]} rotation={[0,Math.PI/2,0]}>
   {Array.from({length:24},(_,i)=><mesh key={i} position={[(i%8-3.5),0.075,(Math.floor(i/8)-1)*0.4]}><boxGeometry args={[1,0.015,0.4]}/><meshStandardMaterial color={(i+Math.floor(i/8))%2?'#fff7e5':'#172b36'}/></mesh>)}
   {[-4.7,4.7].map(x=><group key={x} position={[x,0,0]}><mesh position={[0,2.8,0]} castShadow><cylinderGeometry args={[0.16,0.24,5.6,12]}/><meshStandardMaterial color="#176c77" metalness={0.4} roughness={0.4}/></mesh><mesh position={[0,0.4,0]}><boxGeometry args={[0.9,0.8,0.9]}/><meshStandardMaterial color="#f7ba57"/></mesh></group>)}
   <mesh position={[0,5.35,0]} castShadow><boxGeometry args={[10.1,1.1,0.45]}/><meshStandardMaterial color="#123c4b"/></mesh>
   <Banner/>
   {[-1,0,1].map(x=><mesh key={x} position={[x*0.5,4.55,0]}><sphereGeometry args={[0.12,12,12]}/><meshStandardMaterial color="#aaffc9" emissive="#44ee99" emissiveIntensity={1}/></mesh>)}
  </group>
  <TrackProps/>
 </group>
}
function Banner(){
 const texture=useMemo(()=>{const c=document.createElement('canvas');c.width=1024;c.height=128;const ctx=c.getContext('2d')!;ctx.fillStyle='#123c4b';ctx.fillRect(0,0,1024,128);ctx.fillStyle='#fff3d8';ctx.textAlign='center';ctx.font='900 72px Arial';ctx.fillText('PALM  PRIX',512,91);ctx.fillStyle='#fcb457';ctx.fillRect(20,20,12,88);ctx.fillRect(992,20,12,88);return new THREE.CanvasTexture(c)},[])
 return <>{[1,-1].map(s=><mesh key={s} position={[0,5.35,s*0.232]} rotation={[0,s<0?Math.PI:0,0]}><planeGeometry args={[9.7,1]}/><meshBasicMaterial map={texture}/></mesh>)}</>
}
