import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'
import { useEffect, useRef, useState } from 'react'
import { sampleHand, type HandSample } from './landmarks'

const WASM_URL =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm'
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'

export type TrackerStatus = 'idle' | 'loading' | 'ready' | 'error' | 'denied'

export function useHandTracker(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const [status, setStatus] = useState<TrackerStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [hands, setHands] = useState<HandSample[]>([])
  const landmarkerRef = useRef<HandLandmarker | null>(null)
  const rafRef = useRef(0)
  const lastTsRef = useRef(-1)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    let cancelled = false

    async function start() {
      setStatus('loading')
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        const video = videoRef.current
        if (!video) throw new Error('Video element missing')
        video.srcObject = stream
        await video.play()

        const vision = await FilesetResolver.forVisionTasks(WASM_URL)
        const landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MODEL_URL,
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 2,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        })
        if (cancelled) {
          landmarker.close()
          return
        }
        landmarkerRef.current = landmarker
        setStatus('ready')

        const loop = () => {
          rafRef.current = requestAnimationFrame(loop)
          const v = videoRef.current
          const lm = landmarkerRef.current
          if (!v || !lm || v.readyState < 2) return
          const now = performance.now()
          if (now === lastTsRef.current) return
          lastTsRef.current = now
          const result = lm.detectForVideo(v, now)
          const samples =
            result.landmarks?.map((lmks) =>
              sampleHand(
                lmks.map((p) => ({ x: p.x, y: p.y, z: p.z })),
                true,
              ),
            ) ?? []
          setHands(samples)
        }
        rafRef.current = requestAnimationFrame(loop)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        setError(msg)
        setStatus(
          msg.toLowerCase().includes('permission') ||
            msg.toLowerCase().includes('denied')
            ? 'denied'
            : 'error',
        )
      }
    }

    void start()

    return () => {
      cancelled = true
      cancelAnimationFrame(rafRef.current)
      landmarkerRef.current?.close()
      landmarkerRef.current = null
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [videoRef])

  return { status, error, hands }
}
