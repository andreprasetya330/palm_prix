import { useCallback, useEffect, useRef } from 'react'
import { ZERO_CONTROL, type ControlState } from '../game/controlState'

/** Arrow / WASD + Space item — demo fallback. */
export function useKeyboardControls(): () => ControlState {
  const keys = useRef(new Set<string>())
  const itemEdge = useRef(false)

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keys.current.add(e.code)
      if (e.code === 'Space') {
        e.preventDefault()
        itemEdge.current = true
      }
    }
    const up = (e: KeyboardEvent) => {
      keys.current.delete(e.code)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  return useCallback(() => {
    const k = keys.current
    let steer = 0
    if (k.has('ArrowLeft') || k.has('KeyA')) steer -= 1
    if (k.has('ArrowRight') || k.has('KeyD')) steer += 1
    let throttle = 0
    if (k.has('ArrowUp') || k.has('KeyW')) throttle = 1
    let brake = 0
    if (k.has('ArrowDown') || k.has('KeyS')) brake = 1
    const item = itemEdge.current
    itemEdge.current = false
    if (!steer && !throttle && !brake && !item) return ZERO_CONTROL
    return { steer, throttle, brake, item }
  }, [])
}
