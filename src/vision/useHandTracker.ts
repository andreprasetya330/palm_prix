import { useCallback, useEffect, useState } from 'react'
import type { HandSample } from './landmarks'
import type { TrackingRequest, TrackingResponse } from './handTracking.worker'

export type TrackerStatus = 'idle' | 'loading' | 'ready' | 'error' | 'denied'

export function useHandTracker(videoRef: React.RefObject<HTMLVideoElement | null>, enabled = true) {
  const [attempt, setAttempt] = useState(0)
  const retry = useCallback(() => setAttempt((value) => value + 1), [])
  const [status, setStatus] = useState<TrackerStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [hands, setHands] = useState<HandSample[]>([])
  useEffect(() => {
    let cancelled = false
    let raf = 0
    let startupTimer = 0
    let frameTimer = 0
    let startupPhase: 'permission' | 'video' | 'model' = 'permission'
    let stream: MediaStream | null = null
    let worker: Worker | null = null
    let ready = false
    let inFlight = false
    let lastVideoTime = -1
    let lastSent = 0
    let lastResult = 0
    const video = videoRef.current
    const release = () => {
      window.clearTimeout(startupTimer)
      window.clearTimeout(frameTimer)
      cancelAnimationFrame(raf)
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
      setHands([])
      const name = e instanceof Error ? e.name : ''
      const denied = name === 'NotAllowedError' || name === 'SecurityError'
      setStatus(denied ? 'denied' : 'error')
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
    const visibility = () => { if (document.hidden && !cancelled) setHands([]) }
    document.addEventListener('visibilitychange', visibility)
    async function sendFrame(v: HTMLVideoElement, timestamp: number) {
      inFlight = true
      // Covers both a stalled bitmap conversion and a stalled worker inference.
      frameTimer = window.setTimeout(() => fail(new DOMException('Tracking frame timed out', 'TimeoutError')), 5000)
      try {
        const bitmap = await createImageBitmap(v, { resizeWidth: 480, resizeHeight: Math.max(1, Math.round(480 * v.videoHeight / v.videoWidth)), resizeQuality: 'low' })
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
    const loop = (now: number) => {
      if (cancelled) return
      if (!document.hidden && video && ready && !inFlight && video.readyState >= 2 && video.videoWidth > 0 && video.currentTime !== lastVideoTime && now - lastSent >= 50) {
        lastVideoTime = video.currentTime
        lastSent = now
        void sendFrame(video, now)
      }
      if (now - lastResult > 500) setHands((current) => current.length ? [] : current)
      raf = requestAnimationFrame(loop)
    }
    async function start() {
      setStatus('loading')
      setError(null)
      setHands([])
      armTimeout(20000)
      try {
        if (!navigator.mediaDevices?.getUserMedia || typeof Worker === 'undefined' || typeof createImageBitmap === 'undefined') throw new Error('Camera tracking requires a modern secure browser')
        const acquired = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user', frameRate: { ideal: 24, max: 30 } }, audio: false })
        if (cancelled) { acquired.getTracks().forEach((track) => track.stop()); return }
        stream = acquired
        if (!video) throw new Error('Video element missing')
        startupPhase = 'video'
        armTimeout(10000)
        video.srcObject = stream
        await video.play()
        if (cancelled) return
        stream.getVideoTracks().forEach((track) => track.addEventListener('ended', () => fail(new Error('Camera disconnected'))))
        startupPhase = 'model'
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
            lastResult = performance.now()
            setStatus('ready')
            raf = requestAnimationFrame(loop)
          } else {
            inFlight = false
            window.clearTimeout(frameTimer)
            lastResult = performance.now()
            // Never apply a stale frame or revive gestures while the tab is hidden.
            setHands(!document.hidden && lastResult - data.timestamp <= 500 ? data.hands : [])
          }
        }
        worker.postMessage({ type: 'init' } satisfies TrackingRequest)
      } catch (e) { fail(e) }
    }
    if (enabled) void start()
    else { setStatus('idle'); setError(null); setHands([]) }
    return () => { cancelled = true; release(); document.removeEventListener('visibilitychange', visibility) }
  }, [videoRef, attempt, enabled])
  return { status, error, hands, retry }
}
