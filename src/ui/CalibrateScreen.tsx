import { useState } from 'react'
import {
  DEFAULT_CALIBRATION,
  saveCalibration,
  type Calibration,
} from '../vision/calibration'
import type { MapperDebug } from '../vision/gestureMapper'
import type { ControlState } from '../game/controlState'
import { wheelAngle, type HandSample } from '../vision/landmarks'

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
      const left = sorted[0]
      const right = sorted[sorted.length - 1]
      const neutralAngle = wheelAngle(left, right)
      const next = { ...calibration, neutralAngle }
      onCalibration(next)
      saveCalibration(next)
      setMsg(
        `Neutral wheel saved (${((neutralAngle * 180) / Math.PI).toFixed(0)}°). Twist L/R to feel steer.`,
      )
    } else {
      setMsg('Keep two closed fists visible and apart before saving.')
    }
  }

  const reset = () => {
    onCalibration({ ...DEFAULT_CALIBRATION })
    saveCalibration(DEFAULT_CALIBRATION)
    setMsg('Calibration reset to defaults.')
  }

  return (
    <div className="panel calibrate">
      <span style={{ color: "#78f7d5", fontSize: 11, letterSpacing: "0.2em", fontWeight: 800 }}>DRIVER SETUP</span><h2>Find your racing line.</h2>
      <p>
        Steering uses <strong>wheel angle</strong> (fist rotation), not palm X.
        Close both fists to accelerate at any height. Open either palm to brake, then reverse while held. One fist or no hands coasts. Keyboard: WASD / arrows + Space boost.
      </p>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '18px 0' }}>
        <div aria-hidden="true" style={{ width: 70, height: 70, flexShrink: 0, border: '5px solid #78f7d5', borderRadius: '50%', transform: `rotate(${control.steer * 55}deg)`, display: 'grid', placeItems: 'center', boxShadow: '0 0 25px #78f7d522', transition: 'transform 80ms linear' }}><div style={{ width: 58, height: 5, background: '#78f7d5' }} /></div>
        <div><strong>{debug.fists >= 2 ? 'Wheel connected' : debug.handsVisible ? 'Close your fists' : 'Let’s find your hands'}</strong><p style={{ margin: '5px 0', fontSize: 13 }}>Start with both palms facing the camera, then close your fists. Keep your hands shoulder-width apart with wrists in view, and light them from the front. If the finger outlines disappear, move closer or use Reset tracking in the camera view.</p></div>
      </div>
      <div className="hud-stats">
        <span>Mode: {debug.mode}</span>
        <span>Hands: {debug.handsVisible}</span>
        <span>Fists: {debug.fists}</span>
        <span>Steer: {control.steer.toFixed(2)}</span>
        <span>Throttle: {control.throttle.toFixed(2)}</span>
        <span>Brake: {control.brake.toFixed(2)}</span>
      </div>
      <p className="status" role="status">{msg}</p>
      <div className="row">
        <button type="button" onClick={onBack}>
          Back
        </button>
        <button type="button" onClick={captureNeutral} disabled={hands.filter((h) => h.isFist).length < 2}>
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




