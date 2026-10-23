import { localCartoonFilter } from './localFilter'

export type StylizeResult =
  | { ok: true; imageUrl: string; source: 'fal' | 'local' }
  | { ok: false; error: string }
const AVATAR_KEY = 'palm-kart-avatar-v1'
export function loadCachedAvatar(): string | null {
  try { return localStorage.getItem(AVATAR_KEY) } catch { return null }
}
export function saveCachedAvatar(dataUrl: string): boolean {
  try { localStorage.setItem(AVATAR_KEY, dataUrl); return true } catch { return false }
}
export function clearCachedAvatar(): void {
  try { localStorage.removeItem(AVATAR_KEY) } catch { /* Storage can be disabled. */ }
}
async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Could not read portrait'))
    reader.readAsDataURL(blob)
  })
}
export async function resizeSelfie(blob: Blob, max = 512): Promise<Blob> {
  const bitmap = await createImageBitmap(blob)
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return new Promise((resolve, reject) => canvas.toBlob(
    result => result ? resolve(result) : reject(new Error('Could not prepare portrait')), 'image/jpeg', 0.9))
}
/** Cloud is explicitly chosen by the caller. Local mode never sends the still. */
export async function stylizeSelfie(blob: Blob, mode: 'cloud' | 'local' = 'cloud'): Promise<StylizeResult> {
  try {
    if (mode === 'local') return { ok: true, imageUrl: await localCartoonFilter(blob), source: 'local' }
    const form = new FormData()
    form.append('image', await resizeSelfie(blob), 'selfie.jpg')
    form.append('consent', 'cloud-still')
    const response = await fetch('/api/stylize', { method: 'POST', body: form, signal: AbortSignal.timeout(120_000) })
    const data = await response.json() as { ok?: boolean; imageUrl?: string; placeholder?: boolean; error?: string }
    if (!response.ok || !data.ok || !data.imageUrl || data.placeholder) {
      return { ok: false, error: data.error ?? 'Cloud AI is unavailable. Choose Local portrait to continue without an upload.' }
    }
    const imageResponse = await fetch(data.imageUrl, { signal: AbortSignal.timeout(30_000) })
    if (!imageResponse.ok) throw new Error('Could not download the generated portrait. Please retry.')
    const image = await imageResponse.blob()
    if (!image.type.startsWith('image/')) throw new Error('The service returned an invalid portrait.')
    return { ok: true, imageUrl: await blobToDataUrl(image), source: 'fal' }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Portrait creation failed. Please retry.' }
  }
}
