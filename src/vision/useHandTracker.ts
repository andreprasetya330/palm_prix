import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'
import { useCallback, useEffect, useState } from 'react'
import { sampleHand, type HandSample } from './landmarks'

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm'
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'
export type TrackerStatus = 'idle' | 'loading' | 'ready' | 'error' | 'denied'

export function useHandTracker(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const [attempt, setAttempt] = useState(0)
  const retry = useCallback(() => setAttempt((value) => value + 1), [])
  const [status, setStatus] = useState<TrackerStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [hands, setHands] = useState<HandSample[]>([])
  useEffect(() => {
    // Resources belong to this effect invocation, including under StrictMode.
    let cancelled = false
    let raf = 0
    let startupTimer = 0
    let startupPhase: 'permission' | 'video' | 'model' = 'permission'
    let stream: MediaStream | null = null
    let landmarker: HandLandmarker | null = null
    let lastVideoTime = -1
    let lastDetection = 0
    const release = () => {
      window.clearTimeout(startupTimer)
      cancelAnimationFrame(raf)
      landmarker?.close()
      landmarker = null
      stream?.getTracks().forEach((track) => track.stop())
      stream = null
    }
    const fail = (e: unknown) => {
      if (cancelled) return
      release()
      setHands([])
      const name = e instanceof Error ? e.name : ''
      const denied = name === 'NotAllowedError' || name === 'SecurityError'
      setStatus(denied ? 'denied' : 'error')
      setError(name === 'TimeoutError'
        ? startupPhase === 'permission'
          ? 'Camera permission is still waiting. Allow access in your browser, then retry or reload. You can race now with WASD / arrows.'
          : startupPhase === 'video'
            ? 'The camera is not sending video. Close other camera apps, then retry or reload. Keyboard racing is ready.'
            : 'Hand tracking download timed out. Check your connection, then retry or reload. Keyboard racing is ready.'
        : denied
        ? 'Camera permission is off. Allow camera access in your browser and reload, or race with WASD / arrows.'
        : name === 'NotFoundError'
          ? 'No camera found. Connect a webcam and reload, or use WASD / arrows.'
          : name === 'NotReadableError'
            ? 'Camera is busy. Close other camera apps and reload. Keyboard racing is available.'
            : 'Hand tracking could not start. Check your connection and reload, or race with the keyboard.')
    }
    const armTimeout = (ms: number) => {
      window.clearTimeout(startupTimer)
      startupTimer = window.setTimeout(() => {
        fail(new DOMException('Camera setup timed out', 'TimeoutError'))
        // A permission prompt or model import cannot always be aborted. Ignore
        // its eventual result and dispose resources when that promise resolves.
        cancelled = true
      }, ms)
    }
    const visibility = () => { if (document.hidden) setHands([]) }
    document.addEventListener('visibilitychange', visibility)
    async function start() {
      setStatus('loading')
      setError(null)
      setHands([])
      armTimeout(20000)
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera requires HTTPS or localhost')
        const acquired = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user', frameRate: { ideal: 30, max: 30 } }, audio: false,
        })
        if (cancelled) { acquired.getTracks().forEach((t) => t.stop()); return }
        stream = acquired
        const video = videoRef.current
        if (!video) throw new Error('Video element missing')
        startupPhase = 'video'
        armTimeout(10000)
        video.srcObject = stream
        await video.play()
        if (cancelled) return
        startupPhase = 'model'
        armTimeout(30000)
        const vision = await FilesetResolver.forVisionTasks(WASM_URL)
        if (cancelled) return
        const create = (delegate: 'GPU' | 'CPU') => HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate }, runningMode: 'VIDEO', numHands: 2,
          minHandDetectionConfidence: 0.6, minHandPresenceConfidence: 0.6, minTrackingConfidence: 0.6,
        })
        let detector: HandLandmarker
        try { detector = await create('GPU') } catch { if (cancelled) return; detector = await create('CPU') }
        if (cancelled) { detector.close(); return }
        landmarker = detector
        stream.getVideoTracks().forEach((track) => track.addEventListener('ended', () => fail(new Error('Camera disconnected'))))
        window.clearTimeout(startupTimer)
        setStatus('ready')
        const loop = (now: number) => {
          if (cancelled) return
          const v = videoRef.current
          try {
            if (!document.hidden && v && landmarker && v.readyState >= 2 && v.currentTime !== lastVideoTime && now - lastDetection >= 32) {
              lastVideoTime = v.currentTime
              lastDetection = now
              const result = landmarker.detectForVideo(v, now)
              setHands((result.landmarks ?? []).map((points) => sampleHand(points.map((p) => ({ x: p.x, y: p.y, z: p.z })), true)))
            } else if (now - lastDetection > 500) {
              setHands((current) => current.length ? [] : current)
            }
            raf = requestAnimationFrame(loop)
          } catch (e) { fail(e) }
        }
        raf = requestAnimationFrame(loop)
      } catch (e) { fail(e) }
    }
    void start()
    return () => { cancelled = true; release(); document.removeEventListener('visibilitychange', visibility) }
  }, [videoRef, attempt])
  return { status, error, hands, retry }
}

