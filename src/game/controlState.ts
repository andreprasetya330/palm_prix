/**
 * Sole input contract into the race sim.
 * Hands, keyboard, and future netcode all produce this shape.
 */
export type ControlState = {
  /** −1 left … +1 right */
  steer: number
  /** 0…1 throttle */
  throttle: number
  /** 0…1 brake */
  brake: number
  /** edge-triggered item use this frame */
  item: boolean
}

export const ZERO_CONTROL: ControlState = {
  steer: 0,
  throttle: 0,
  brake: 0,
  item: false,
}

export function clampControl(c: ControlState): ControlState {
  return {
    steer: Math.max(-1, Math.min(1, c.steer)),
    throttle: Math.max(0, Math.min(1, c.throttle)),
    brake: Math.max(0, Math.min(1, c.brake)),
    item: c.item,
  }
}
