import { Canvas } from '@react-three/fiber'
import { Sky } from '@react-three/drei'
import type { KartState } from '../game/kartPhysics'
import { FollowCamera } from './FollowCamera'
import { Kart } from './Kart'
import { AaaTrackScene } from '../aaa/track'

type Props = {
  kart: KartState
  driverTextureUrl: string | null
}

export function RaceScene({ kart, driverTextureUrl }: Props) {
  return (
    <Canvas
      shadows
      camera={{ position: [0, 6, 14], fov: 52 }}
      dpr={[1, 1.75]}
      style={{ width: '100%', height: '100%' }}
      gl={{ antialias: true, toneMappingExposure: 1.15 }}
    >
      <color attach="background" args={['#5ec8ff']} />
      {/* bright, playful lighting — not photoreal */}
      <hemisphereLight args={['#9adcff', '#3ecf5a', 0.95]} />
      <ambientLight intensity={0.65} color="#fff8e8" />
      <directionalLight
        castShadow
        position={[24, 36, 12]}
        intensity={1.55}
        color="#fff1c2"
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={90}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
      />
      <directionalLight position={[-18, 12, -10]} intensity={0.4} color="#a8d8ff" />
      <Sky
        sunPosition={[80, 40, 30]}
        turbidity={2.2}
        rayleigh={0.45}
        mieCoefficient={0.003}
        mieDirectionalG={0.9}
      />
      <fog attach="fog" args={['#b8e8ff', 60, 120]} />
      <AaaTrackScene />
      <Kart kart={kart} driverTextureUrl={driverTextureUrl} />
      <FollowCamera kart={kart} />
    </Canvas>
  )
}
