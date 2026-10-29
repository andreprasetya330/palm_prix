import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'

/** DOM-only development diagnostics, sampled after rendering; no React updates per frame. */
export function FrameDiagnostics(){
  const {gl}=useThree()
  const samples=useRef<number[]>([]), elapsed=useRef(0)
  useFrame((_,dt)=>{
    if(document.hidden)return
    samples.current.push(dt*1000);elapsed.current+=dt
    if(samples.current.length>180)samples.current.shift()
    if(elapsed.current<1)return
    elapsed.current=0
    const sorted=[...samples.current].sort((a,b)=>a-b)
    const avg=samples.current.reduce((a,b)=>a+b,0)/samples.current.length
    const p95=sorted[Math.floor(sorted.length*.95)]??0
    const data=document.documentElement.dataset
    data.raceFps=(1000/avg).toFixed(1);data.raceFrameP95=p95.toFixed(1)
    data.raceDrawCalls=String(gl.info.render.calls);data.raceTriangles=String(gl.info.render.triangles)
  },-99)
  useEffect(()=>()=>{for(const key of ['raceFps','raceFrameP95','raceDrawCalls','raceTriangles'])delete document.documentElement.dataset[key]},[])
  return null
}
