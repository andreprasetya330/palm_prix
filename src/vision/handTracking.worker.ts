import { HandStabilizer } from './handStabilizer'
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'
import { sampleHand, type HandSample } from './landmarks'

export type TrackingRequest = { type: 'init' } | { type: 'frame'; bitmap: ImageBitmap; timestamp: number }
export type TrackingResponse = { type: 'ready' } | { type: 'result'; hands: HandSample[]; timestamp: number; detectionMs: number } | { type: 'error'; message: string }
const scope = self as unknown as {
  import?: (url: string) => Promise<void>
  dbg?: (message:string) => void
  onmessage: ((event: MessageEvent<TrackingRequest>) => void) | null
  postMessage: (message: TrackingResponse) => void
}
// Supply Emscripten's optional debug hook: its classic block-function fallback
// has different scoping when the loader is imported as a strict ES module.
scope.dbg = (message:string) => console.debug(message)
// MediaPipe's classic WASM loader declares `var ModuleFactory`. In a module
// worker that declaration is module-local, so publish it explicitly. The
// library calls this import hook after importScripts rejects in module workers.
scope.import = async (url: string) => {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`WASM loader request failed: ${response.status}`)
  const source = await response.text()
  const moduleUrl = URL.createObjectURL(new Blob([source, '\nself.ModuleFactory = ModuleFactory;'], { type: 'text/javascript' }))
  try { await import(/* @vite-ignore */ moduleUrl) } finally { URL.revokeObjectURL(moduleUrl) }
}
let detector: HandLandmarker | null = null
let initializing = false
const stabilizer = new HandStabilizer()

scope.onmessage = async ({ data }) => {
  if (data.type === 'init') {
    if (initializing || detector) return
    initializing = true
    try {
      const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm')
      detector = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
          delegate: 'CPU',
        },
        runningMode: 'VIDEO', numHands: 2,
        minHandDetectionConfidence: 0.5, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.45,
      })
      scope.postMessage({ type: 'ready' })
    } catch (error) {
      scope.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) })
    }
    return
  }
  try {
    if (!detector) throw new Error('Hand detector is not ready')
    const started = performance.now()
    const result = detector.detectForVideo(data.bitmap, data.timestamp)
    scope.postMessage({ type: 'result', timestamp: data.timestamp, detectionMs: performance.now() - started, hands: stabilizer.update((result.landmarks ?? []).map((points, i) => sampleHand(points, true, data.bitmap.width / data.bitmap.height, result.worldLandmarks?.[i])), data.timestamp) })
  } catch (error) {
    scope.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) })
  } finally {
    data.bitmap.close()
  }
}



