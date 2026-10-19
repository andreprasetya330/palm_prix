import { HandDebugOverlay } from '../vision/HandDebugOverlay'
import type { HandSample } from '../vision/landmarks'

type Props = {
  videoRef: React.RefObject<HTMLVideoElement | null>
  hands: HandSample[]
  wheelAngle: number | null
  compact?: boolean
}

export function WebcamPip({ videoRef, hands, wheelAngle, compact }: Props) {
  return (
    <div className={`webcam-pip ${compact ? 'compact' : ''}`}>
      {/* Video mirrored for selfie; landmarks are already mirrored in sampleHand */}
      <video
        ref={videoRef}
        playsInline
        muted
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: 'scaleX(-1)',
        }}
      />
      <div style={{ position: 'absolute', inset: 0 }}>
        <HandDebugOverlay
          videoRef={videoRef}
          hands={hands}
          wheelAngle={wheelAngle}
        />
      </div>
    </div>
  )
}
