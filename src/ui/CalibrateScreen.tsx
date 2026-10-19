import { useState } from 'react'
import {
  DEFAULT_CALIBRATION,
  saveCalibration,
  type Calibration,
} from '../vision/calibration'
import type { MapperDebug } from '../vision/gestureMapper'
import type { ControlState } from '../game/controlState'
import type { HandSample } from '../vision/landmarks'

type Props = {
  hands: HandSample[]
  control: ControlState
  debug: MapperDebug
  calibration: Calibration
  onCalibration: (c: Calibration) => void
  onDone: () => void
  onBack: () => void
}

export function CalibrateScreen({
  hands,
  control,
  debug,
  calibration,
  onCalibration,
  onDone,
  onBack,
}: Props) {
  const [msg, setMsg] = useState('Hold both fists like a steering wheel, level.')

  const captureNeutral = () => {
    const fists = hands.filter((h) => h.isFist)
    if (fists.length >= 2) {
      const sorted = [...fists].sort((a, b) => a.grip.x - b.grip.x)
      const left = sorted[0].grip
      const right = sorted[sorted.length - 1].grip
      const neutralAngle = Math.atan2(right.y - left.y, right.x - left.x)
      const next = { ...calibration, neutralAngle }
      onCalibration(next)
      saveCalibration(next)
      setMsg(
        `Neutral wheel saved (${((neutralAngle * 180) / Math.PI).toFixed(0)}°). Twist L/R to feel steer.`,
      )
    } else if (hands.length >= 1) {
      const next = {
        ...calibration,
        oneHandNeutral: hands[0].yaw,
      }
      onCalibration(next)
      saveCalibration(next)
      setMsg('One-hand neutral yaw saved. Raise both fists for best steering.')
    } else {
      setMsg('No hands visible — raise fists in frame.')
    }
  }

  const reset = () => {
    onCalibration({ ...DEFAULT_CALIBRATION })
    saveCalibration(DEFAULT_CALIBRATION)
    setMsg('Calibration reset to defaults.')
  }

  return (
    <div className="panel calibrate">
      <h2>Calibrate wheel</h2>
      <p>
        Steering uses <strong>wheel angle</strong> (fist rotation), not palm X.
        Hold fists chest–shoulder height to accelerate; drop or pull back to
        brake. Keyboard: WASD / arrows + Space boost.
      </p>
      <div className="hud-stats">
        <span>Mode: {debug.mode}</span>
        <span>Hands: {debug.handsVisible}</span>
        <span>Fists: {debug.fists}</span>
        <span>Steer: {control.steer.toFixed(2)}</span>
        <span>Throttle: {control.throttle.toFixed(2)}</span>
        <span>Brake: {control.brake.toFixed(2)}</span>
      </div>
      <p className="status">{msg}</p>
      <div className="row">
        <button type="button" onClick={onBack}>
          Back
        </button>
        <button type="button" onClick={captureNeutral}>
          Save neutral pose
        </button>
        <button type="button" onClick={reset}>
          Reset
        </button>
        <button type="button" className="primary" onClick={onDone}>
          Start race
        </button>
      </div>
    </div>
  )
}
