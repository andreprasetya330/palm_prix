import { useProgress } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { advanceRuntime, type RaceRuntime } from '../game/runtime'

export function RaceSimulation({runtime}:{runtime:RaceRuntime}) {
  const loading=useProgress(state=>state.active)
  useFrame((_,dt)=>{if(!loading)advanceRuntime(runtime,dt)},-100)
  return null
}
