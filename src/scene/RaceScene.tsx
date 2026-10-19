import { Canvas } from '@react-three/fiber'
import { Sky } from '@react-three/drei'
import type { KartState } from '../game/kartPhysics'
import { FollowCamera } from './FollowCamera'
import { Kart } from './Kart'
import { Track } from './Track'

type Props = {
  kart: KartState
  driverTextureUrl: string | null
}

export function RaceScene({ kart, driverTextureUrl }: Props) {
  return (
    <Canvas
      shadows
      camera={{ position: [0, 6, 14], fov: 55 }}
      dpr={[1, 1.5]}
      style={{ width: '100%', height: '100%' }}
    >
      <color attach="background" args={['#7ec8e3']} />
      <ambientLight intensity={0.55} />
      <directionalLight
        castShadow
        position={[20, 30, 10]}
        intensity={1.2}
        shadow-mapSize={[1024, 1024]}
      />
      <Sky sunPosition={[40, 20, 30]} turbidity={6} rayleigh={1.2} />
      <fog attach="fog" args={['#a8dadc', 40, 90]} />
      <Track />
      <Kart kart={kart} driverTextureUrl={driverTextureUrl} />
      <FollowCamera kart={kart} />
    </Canvas>
  )
}
