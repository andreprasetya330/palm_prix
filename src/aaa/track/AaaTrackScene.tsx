import { useEffect, useMemo } from 'react'
import { Atmosphere } from './Atmosphere'
import { Ceremony } from './Ceremony'
import { Road } from './Road'
import { createTrackTextures, disposeTrackTextures } from './textures'
import { World } from './World'

/** Palm Prix Lagoon Loop. Replaces the flat oval dressing. */
export function AaaTrackScene() {
  const textures = useMemo(() => createTrackTextures(), [])
  useEffect(() => () => disposeTrackTextures(textures), [textures])

  return (
    <group>
      <Atmosphere textures={textures} />
      <World textures={textures} />
      <Road textures={textures} />
      <Ceremony textures={textures} />
    </group>
  )
}
