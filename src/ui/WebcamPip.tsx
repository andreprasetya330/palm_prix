import { HandDebugOverlay } from '../vision/HandDebugOverlay'
import type { HandSample } from '../vision/landmarks'

type Props = {
  videoRef: React.RefObject<HTMLVideoElement | null>
  hands: HandSample[]
  wheelAngle: number | null
  compact?: boolean
}

export function WebcamPip({ videoRef, hands, wheelAngle, compact }: Props) {
  const fists = hands.filter((h) => h.isFist).length
  const feedback = fists === 2 ? '2 GRIPS · DRIVE' : hands.some((h) => h.pose === 'open') ? 'OPEN PALM · REVERSE' : hands.length ? 'CLOSE BOTH FISTS' : 'NO HANDS DETECTED'
  return (
    <div className={`webcam-pip ${compact ? 'compact' : ''}`}>
      <div style={{ position: 'absolute', zIndex: 2, top: 10, left: 10, right: 10, display: 'flex', justifyContent: 'space-between', color: '#fff', fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textShadow: '0 2px 6px #000' }}>
        <span>● LOCAL VISION</span><span style={{ color: hands.length ? '#79ffd4' : '#ffd889' }}>{feedback}</span>
      </div>
      {hands[0]?.trackingLatencyMs !== undefined && <div style={{ position: 'absolute', zIndex: 2, bottom: 8, left: 10, color: '#fff', fontSize: 10, textShadow: '0 1px 4px #000' }}>Tracking {Math.round(hands[0].trackingLatencyMs)} ms · inference {Math.round(hands[0].detectionMs ?? 0)} ms</div>}
      {/* Video mirrored for selfie; landmarks are already mirrored in sampleHand */}
      <video
        ref={videoRef}
        playsInline
        muted
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
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




