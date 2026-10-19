import { useEffect, useRef } from 'react'
import type { HandSample } from './landmarks'
import { LM } from './landmarks'

type Props = {
  videoRef: React.RefObject<HTMLVideoElement | null>
  hands: HandSample[]
  wheelAngle: number | null
  className?: string
}

/** Skeleton + virtual wheel line between fists. */
export function HandDebugOverlay({
  videoRef,
  hands,
  wheelAngle,
  className,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return
    const w = video.videoWidth || 640
    const h = video.videoHeight || 480
    if (canvas.width !== w) canvas.width = w
    if (canvas.height !== h) canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, w, h)

    const fists = hands.filter((hand) => hand.isFist)

    for (const hand of hands) {
      const color = hand.isFist ? '#3ddc97' : '#f4a261'
      for (const p of hand.landmarks) {
        ctx.beginPath()
        ctx.arc(p.x * w, p.y * h, 3, 0, Math.PI * 2)
        ctx.fillStyle = color
        ctx.fill()
      }
      // palm bone
      const a = hand.landmarks[LM.WRIST]
      const b = hand.landmarks[LM.MIDDLE_MCP]
      ctx.beginPath()
      ctx.moveTo(a.x * w, a.y * h)
      ctx.lineTo(b.x * w, b.y * h)
      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.stroke()
    }

    if (fists.length >= 2) {
      const sorted = [...fists].sort((a, b) => a.grip.x - b.grip.x)
      const left = sorted[0].grip
      const right = sorted[sorted.length - 1].grip
      ctx.beginPath()
      ctx.moveTo(left.x * w, left.y * h)
      ctx.lineTo(right.x * w, right.y * h)
      ctx.strokeStyle = '#ffe66d'
      ctx.lineWidth = 4
      ctx.stroke()
      // wheel hub
      const cx = ((left.x + right.x) / 2) * w
      const cy = ((left.y + right.y) / 2) * h
      ctx.beginPath()
      ctx.arc(cx, cy, 18, 0, Math.PI * 2)
      ctx.strokeStyle = '#ffe66d'
      ctx.lineWidth = 2
      ctx.stroke()
      if (wheelAngle != null) {
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(cx + Math.cos(wheelAngle) * 28, cy + Math.sin(wheelAngle) * 28)
        ctx.stroke()
      }
    }
  }, [hands, videoRef, wheelAngle])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        transform: 'scaleX(1)',
      }}
    />
  )
}
