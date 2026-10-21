import { useEffect, useState } from 'react'
import { Atmosphere } from './Atmosphere'
import { Ceremony } from './Ceremony'
import { Road } from './Road'
import { createTrackTextures, disposeTrackTextures, type TrackTextures } from './textures'
import { World } from './World'

/** Palm Prix Lagoon Loop. Replaces the flat oval dressing. */
export function AaaTrackScene() {
  const [textures, setTextures] = useState<TrackTextures | null>(null)
  useEffect(() => {
    let live = true
    let current: TrackTextures | null = null
    createTrackTextures().then((next) => {
      if (!live) {
        disposeTrackTextures(next)
        return
      }
      current = next
      setTextures(next)
    })
    return () => {
      live = false
      if (current) disposeTrackTextures(current)
    }
  }, [])
  if (!textures) return null

  return (
    <group>
      <Atmosphere textures={textures} />
      <World textures={textures} />
      <Road textures={textures} />
      <Ceremony textures={textures} />
    </group>
  )
}
