import { useRef, useState } from 'react'
import {
  clearCachedAvatar,
  saveCachedAvatar,
  stylizeSelfie,
} from '../avatar/stylizeClient'

type Props = {
  videoRef: React.RefObject<HTMLVideoElement | null>
  currentAvatar: string | null
  onAvatar: (url: string | null) => void
  onDone: () => void
  onBack: () => void
}

export function AvatarStudio({
  videoRef,
  currentAvatar,
  onAvatar,
  onDone,
  onBack,
}: Props) {
  const [preview, setPreview] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(currentAvatar)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [optIn, setOptIn] = useState(false)
  const captureRef = useRef<HTMLCanvasElement>(null)

  const capture = () => {
    const video = videoRef.current
    const canvas = captureRef.current
    if (!video || !canvas) return
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext('2d')!
    // un-mirror for upload (video CSS is mirrored)
    ctx.save()
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0)
    ctx.restore()
    setPreview(canvas.toDataURL('image/jpeg', 0.92))
    setStatus('Selfie captured. Opt in to stylize with cloud AI, or skip.')
  }

  const stylize = async () => {
    const canvas = captureRef.current
    if (!canvas || !optIn) return
    setBusy(true)
    setStatus('Sending still to stylize API…')
    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('capture failed'))),
          'image/jpeg',
          0.9,
        )
      })
      const res = await stylizeSelfie(blob)
      if (!res.ok) {
        setStatus(`Stylize failed: ${res.error}`)
        return
      }
      setResult(res.imageUrl)
      onAvatar(res.imageUrl)
      saveCachedAvatar(res.imageUrl)
      setStatus(
        res.source === 'fal'
          ? 'Cloud stylize complete.'
          : `Used ${res.source} fallback (fal key missing or API error).`,
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="panel avatar-studio">
      <h2>Avatar Studio</h2>
      <p className="privacy">
        Hand-tracking video stays in this tab. Stylize uploads{' '}
        <strong>one still selfie</strong> only after you opt in below.
      </p>
      <div className="avatar-grid">
        <div>
          <p className="label">Live camera</p>
          <p className="hint">Use the PIP / calibrate view — capture freezes a frame.</p>
          <button type="button" onClick={capture} disabled={busy}>
            Capture selfie
          </button>
        </div>
        <div>
          <p className="label">Captured still</p>
          {preview ? (
            <img src={preview} alt="Captured selfie" className="avatar-preview" />
          ) : (
            <div className="avatar-placeholder">No capture yet</div>
          )}
        </div>
        <div>
          <p className="label">Cartoon result</p>
          {result ? (
            <img src={result} alt="Stylized avatar" className="avatar-preview" />
          ) : (
            <div className="avatar-placeholder">Default head on kart</div>
          )}
        </div>
      </div>
      <label className="opt-in">
        <input
          type="checkbox"
          checked={optIn}
          onChange={(e) => setOptIn(e.target.checked)}
        />
        Stylize with cloud AI (sends this still to our server → fal)
      </label>
      <div className="row">
        <button type="button" onClick={onBack} disabled={busy}>
          Back
        </button>
        <button
          type="button"
          onClick={() => void stylize()}
          disabled={busy || !preview || !optIn}
        >
          {busy ? 'Stylizing…' : 'Stylize'}
        </button>
        <button
          type="button"
          className="primary"
          onClick={() => {
            if (result) {
              onAvatar(result)
              saveCachedAvatar(result)
            }
            onDone()
          }}
          disabled={busy}
        >
          Continue
        </button>
        <button
          type="button"
          onClick={() => {
            clearCachedAvatar()
            setResult(null)
            onAvatar(null)
            setStatus('Cleared local avatar cache.')
          }}
        >
          Clear my data
        </button>
      </div>
      {status && <p className="status">{status}</p>}
      <canvas ref={captureRef} hidden />
    </div>
  )
}
