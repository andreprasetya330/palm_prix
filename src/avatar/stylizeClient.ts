import { localCartoonFilter } from './localFilter'

export type StylizeResult =
  | { ok: true; imageUrl: string; source: 'fal' | 'local' | 'placeholder' }
  | { ok: false; error: string }

const AVATAR_KEY = 'palm-kart-avatar-v1'

export function loadCachedAvatar(): string | null {
  try {
    return localStorage.getItem(AVATAR_KEY)
  } catch {
    return null
  }
}

export function saveCachedAvatar(dataUrl: string): void {
  localStorage.setItem(AVATAR_KEY, dataUrl)
}

export function clearCachedAvatar(): void {
  localStorage.removeItem(AVATAR_KEY)
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

/** Resize still before upload (~512px). */
export async function resizeSelfie(blob: Blob, max = 512): Promise<Blob> {
  const bmp = await createImageBitmap(blob)
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const w = Math.round(bmp.width * scale)
  const h = Math.round(bmp.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bmp, 0, 0, w, h)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
      'image/jpeg',
      0.9,
    )
  })
}

export async function stylizeSelfie(blob: Blob): Promise<StylizeResult> {
  const mode = import.meta.env.VITE_STYLIZE_MODE as string | undefined
  if (mode === 'local') {
    const url = await localCartoonFilter(blob)
    return { ok: true, imageUrl: url, source: 'local' }
  }

  try {
    const resized = await resizeSelfie(blob)
    const form = new FormData()
    form.append('image', resized, 'selfie.jpg')
    const res = await fetch('/api/stylize', { method: 'POST', body: form })
    const data = (await res.json()) as {
      ok?: boolean
      imageUrl?: string
      error?: string
      placeholder?: boolean
    }
    if (!res.ok || !data.ok || !data.imageUrl) {
      // graceful: local filter fallback
      const url = await localCartoonFilter(blob)
      return {
        ok: true,
        imageUrl: url,
        source: data.placeholder ? 'placeholder' : 'local',
      }
    }
    // if server returned a remote URL, fetch → data URL for persistence
    if (data.imageUrl.startsWith('data:')) {
      return { ok: true, imageUrl: data.imageUrl, source: 'fal' }
    }
    try {
      const imgRes = await fetch(data.imageUrl)
      const imgBlob = await imgRes.blob()
      const dataUrl = await blobToDataUrl(imgBlob)
      return { ok: true, imageUrl: dataUrl, source: 'fal' }
    } catch {
      return { ok: true, imageUrl: data.imageUrl, source: 'fal' }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    try {
      const url = await localCartoonFilter(blob)
      return { ok: true, imageUrl: url, source: 'local' }
    } catch {
      return { ok: false, error: msg }
    }
  }
}
