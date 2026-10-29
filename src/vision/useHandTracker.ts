import { FrameCadence } from './frameCadence'
import { useCallback, useEffect, useState } from 'react'
import type { HandSample } from './landmarks'
import type { TrackingRequest, TrackingResponse } from './handTracking.worker'

export type TrackerStatus = 'idle' | 'loading' | 'ready' | 'error' | 'denied'

export function useHandTracker(videoRef: React.RefObject<HTMLVideoElement | null>, enabled = true) {
  const [attempt, setAttempt] = useState(0)
  const retry = useCallback(() => setAttempt((value) => value + 1), [])
  const [status, setStatus] = useState<TrackerStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [trackingLatencyMs, setTrackingLatencyMs] = useState<number | null>(null)
  const [hands, setHands] = useState<HandSample[]>([])
  const [stage, setStage] = useState('Camera off')
  useEffect(() => {
    let cancelled = false
    let raf = 0
    let videoFrame = 0
    let startupTimer = 0
    let frameTimer = 0
    let captureTimer = 0
    let startupPhase: 'permission' | 'video' | 'model' = 'permission'
    let stream: MediaStream | null = null
    let worker: Worker | null = null
    let ready = false
    let inFlight = false
    let lastVideoTime = -1
    let lastVideoCallback = -Infinity
    let lastResultTime = 0
    const cadence = new FrameCadence()
    let staleCleared = true
    let lastSampleTime = 0
    let frameInterval = 1000 / 30
    let captureWidth = 960
    let averageDetectionMs = 0
    let fastFrames = 0
    const video = videoRef.current
    const release = () => {
      window.clearTimeout(startupTimer)
      window.clearTimeout(frameTimer)
      window.clearTimeout(captureTimer)
      cancelAnimationFrame(raf)
      if (videoFrame) video?.cancelVideoFrameCallback(videoFrame)
      worker?.terminate()
      worker = null
      stream?.getTracks().forEach((track) => track.stop())
      if (video && video.srcObject === stream) video.srcObject = null
      stream = null
    }
    const fail = (e: unknown) => {
      if (cancelled) return
      cancelled = true
      release()
      setHands([]); setTrackingLatencyMs(null)
      const name = e instanceof Error ? e.name : ''
      const denied = name === 'NotAllowedError' || name === 'SecurityError'
      setStatus(denied ? 'denied' : 'error')
      setStage(denied ? 'Camera blocked' : 'Tracking unavailable')
      setError(name === 'TimeoutError'
        ? startupPhase === 'permission'
          ? 'Camera permission is still waiting. Allow access in your browser, then retry. Keyboard racing is ready.'
          : startupPhase === 'video'
            ? 'The camera is not sending video. Close other camera apps, then retry. Keyboard racing is ready.'
            : ready
              ? 'Hand tracking stopped responding. Retry the camera, or continue with the keyboard.'
              : 'Hand tracking download timed out. Check your connection, then retry. Keyboard racing is ready.'
        : denied
          ? 'Camera permission is off. Allow camera access in your browser, then retry, or race with WASD / arrows.'
          : name === 'NotFoundError'
            ? 'No camera found. Connect a webcam and retry, or use WASD / arrows.'
            : name === 'NotReadableError'
              ? 'Camera is busy. Close other camera apps and retry. Keyboard racing is ready.'
              : 'Hand tracking is unavailable. Retry with a current browser and internet connection, or race with the keyboard.')
    }
    const armTimeout = (ms: number) => {
      window.clearTimeout(startupTimer)
      startupTimer = window.setTimeout(() => fail(new DOMException('Camera setup timed out', 'TimeoutError')), ms)
    }
    const visibility = () => { if (document.hidden && !cancelled) { setHands([]); setTrackingLatencyMs(null) } }
    document.addEventListener('visibilitychange', visibility)
    async function sendFrame(v: HTMLVideoElement, timestamp: number) {
      inFlight = true
      // Covers both a stalled bitmap conversion and a stalled worker inference.
      frameTimer = window.setTimeout(() => fail(new DOMException('Tracking frame timed out', 'TimeoutError')), 5000)
      try {
        const width = Math.min(captureWidth,v.videoWidth)
        const bitmap = await createImageBitmap(v, { resizeWidth: width, resizeHeight: Math.max(1, Math.round(width * v.videoHeight / v.videoWidth)), resizeQuality: 'low' })
        if (cancelled || !worker) { bitmap.close(); return }
        if (document.hidden) {
          bitmap.close()
          inFlight = false
          window.clearTimeout(frameTimer)
          return
        }
        const request: TrackingRequest = { type: 'frame', bitmap, timestamp }
        try { worker.postMessage(request, [bitmap]) } catch (e) { bitmap.close(); throw e }
      } catch (e) { fail(e) }
    }
    const capture = (now: number) => {
      if (!document.hidden && video && ready && !inFlight && video.readyState >= 2 && video.videoWidth > 0 && video.currentTime !== lastVideoTime && cadence.consume(now, frameInterval)) {
        lastVideoTime = video.currentTime

        void sendFrame(video, now)
      }
    }
    // Camera frames have their own clock; a busy Three.js render must not be
    // the only trigger for inference. Keep one bitmap/inference in flight.
    const onVideoFrame = () => {
      if (cancelled || !video) return
      lastVideoCallback = performance.now()
      capture(lastVideoCallback)
      videoFrame = video.requestVideoFrameCallback(onVideoFrame)
    }
    const pollCamera = () => {
      if (cancelled) return
      const now = performance.now()
      // Some browsers throttle presentation callbacks for a hidden preview.
      // Poll independently of scene painting when those callbacks stop.
      if (now-lastVideoCallback > 100) capture(now)
      captureTimer = window.setTimeout(pollCamera,1000/30)
    }
    const loop = (now: number) => {
      if (cancelled) return
      if (ready && !document.hidden && !inFlight && now-lastResultTime > 5000) {
        setStage('Waiting for camera frames — try Reset tracking')
      }
      if (!staleCleared && now - lastSampleTime > 250) {
        staleCleared = true
        setHands([])
        setTrackingLatencyMs(null)
      }
      raf = requestAnimationFrame(loop)
    }
    async function start() {
      setStatus('loading')
      setStage('Allow camera access')
      setError(null)
      setHands([]); setTrackingLatencyMs(null)
      armTimeout(20000)
      try {
        if (!navigator.mediaDevices?.getUserMedia || typeof Worker === 'undefined' || typeof createImageBitmap === 'undefined') throw new Error('Camera tracking requires a modern secure browser')
        const acquired = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user', frameRate: { ideal: 30, max: 30 } }, audio: false })
        if (cancelled) { acquired.getTracks().forEach((track) => track.stop()); return }
        stream = acquired
        if (!video) throw new Error('Video element missing')
        startupPhase = 'video'
        setStage('Opening camera')
        armTimeout(10000)
        video.srcObject = stream
        await video.play()
        if (cancelled) return
        stream.getVideoTracks().forEach((track) => track.addEventListener('ended', () => fail(new Error('Camera disconnected'))))
        startupPhase = 'model'
        setStage('Loading hand detector')
        armTimeout(30000)
        worker = new Worker(new URL('./handTracking.worker.ts', import.meta.url), { type: 'module' })
        worker.onerror = () => fail(new Error('Hand tracking worker failed'))
        worker.onmessageerror = () => fail(new Error('Hand tracking message failed'))
        worker.onmessage = ({ data }: MessageEvent<TrackingResponse>) => {
          if (cancelled) return
          if (data.type === 'error') { fail(new Error(data.message)); return }
          if (data.type === 'ready') {
            ready = true
            window.clearTimeout(startupTimer)
            setStatus('ready')
            setStage('Finding hands')
            lastResultTime = performance.now()
            if (video.requestVideoFrameCallback) videoFrame = video.requestVideoFrameCallback(onVideoFrame)
            pollCamera()
            raf = requestAnimationFrame(loop)
          } else {
            inFlight = false
            window.clearTimeout(frameTimer)
            averageDetectionMs = averageDetectionMs ? averageDetectionMs*0.8+data.detectionMs*0.2 : data.detectionMs
            frameInterval = averageDetectionMs < 40 ? 1000 / 30 : 50
            // Keep extra finger detail on capable devices, with hysteresis so
            // a slower machine doesn't accumulate latency or oscillate sizes.
            if (averageDetectionMs > 55) { captureWidth = 640; fastFrames = 0 }
            else if (averageDetectionMs < 28 && ++fastFrames >= 60) { captureWidth = 960; fastFrames = 0 }
            else if (averageDetectionMs >= 28) fastFrames = 0
            const latency = performance.now() - data.timestamp
            if (latency > 180) { captureWidth = 640; fastFrames = 0 }
            lastResultTime = performance.now()
            setStage(latency > 250 ? 'Tracking is catching up' : data.hands.length ? 'Hands detected' : 'Show both palms to the camera')
            setTrackingLatencyMs(latency)
            lastSampleTime = data.timestamp
            staleCleared = document.hidden || latency > 250 || data.hands.length === 0
            // Never apply a stale frame or revive gestures while the tab is hidden.
            setHands(!document.hidden && latency <= 250 ? data.hands.map((hand) => ({ ...hand, trackingLatencyMs: latency, detectionMs: data.detectionMs })) : [])
          }
        }
        worker.postMessage({ type: 'init' } satisfies TrackingRequest)
      } catch (e) { fail(e) }
    }
    if (enabled) void start()
    else { setStatus('idle'); setStage('Camera off'); setError(null); setHands([]); setTrackingLatencyMs(null) }
    return () => { cancelled = true; release(); document.removeEventListener('visibilitychange', visibility) }
  }, [videoRef, attempt, enabled])
  return { status, stage, error, hands, retry, trackingLatencyMs }
}




