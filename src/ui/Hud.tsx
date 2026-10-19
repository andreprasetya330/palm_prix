import type { ControlState } from '../game/controlState'
import type { KartState } from '../game/kartPhysics'
import type { RaceStatus } from '../game/raceLoop'
import type { MapperDebug } from '../vision/gestureMapper'

type Props = {
  race: RaceStatus
  kart: KartState
  control: ControlState
  debug: MapperDebug
  showPipHint?: boolean
}

export function Hud({ race, kart, control, debug, showPipHint }: Props) {
  return (
    <div className="hud">
      <div className="hud-top">
        <div className="hud-badge">
          Lap {race.lap}/{race.totalLaps}
        </div>
        <div className="hud-badge">
          {race.elapsed.toFixed(1)}s
        </div>
        {kart.boostTimer > 0 && (
          <div className="hud-badge boost">BOOST</div>
        )}
      </div>
      {race.phase === 'countdown' && (
        <div className="countdown">{Math.ceil(race.countdown)}</div>
      )}
      {race.phase === 'finish' && (
        <div className="finish-banner">
          <h2>Finish!</h2>
          <p>Time {race.elapsed.toFixed(2)}s — rematch from menu.</p>
        </div>
      )}
      <div className="hud-bottom">
        <div className="speed-bar">
          <div
            className="speed-fill"
            style={{
              width: `${Math.min(100, (Math.abs(kart.speed) / 28) * 100)}%`,
            }}
          />
        </div>
        <div className="hud-stats tiny">
          <span>steer {control.steer.toFixed(2)}</span>
          <span>{debug.mode}</span>
          {showPipHint && <span>Raise both fists for best steering</span>}
        </div>
      </div>
    </div>
  )
}
