import type { DriverStyle } from '../avatar/driverStyle'
import { Canvas } from '@react-three/fiber'
import { Sky } from '@react-three/drei'
import type { KartState } from '../game/kartPhysics'
import { FollowCamera } from './FollowCamera'
import { Kart } from '../aaa/kart'
import { Track } from './Track'
import { RaceEffects } from './RaceEffects'
import { Opponents } from './Opponents'
import type { RaceStatus } from '../game/raceLoop'

type Props = {
  driverStyle?: DriverStyle
  race?: RaceStatus
  showcase?: boolean
  kart: KartState
  driverTextureUrl: string | null
}

export function RaceScene({ kart, driverTextureUrl, race, showcase = false, driverStyle }: Props) {
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
        position={[30, 55, 25]}
        intensity={1.55}
        color="#fff1c2"
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={160}
        shadow-camera-left={-55}
        shadow-camera-right={55}
        shadow-camera-top={55}
        shadow-camera-bottom={-55}
      />
      <directionalLight position={[-18, 12, -10]} intensity={0.4} color="#a8d8ff" />
      <Sky
        sunPosition={[80, 40, 30]}
        turbidity={3.5}
        rayleigh={1.1}
        mieCoefficient={0.003}
        mieDirectionalG={0.9}
      />
      <fog attach="fog" args={['#c5e8e5', 85, 220]} />
      <Track showcase={showcase} />
      <Kart driverStyle={driverStyle} kart={kart} driverTextureUrl={driverTextureUrl} />
      <Opponents elapsed={race?.elapsed ?? 0} />
      <RaceEffects kart={kart} />
      <FollowCamera kart={kart} showcase={showcase} />
    </Canvas>
  )
}


