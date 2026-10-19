/**
 * Offline / dev fallback: crude posterize + edge tint.
 * Not the primary avatar path — cloud fal stylize is.
 */
export async function localCartoonFilter(blob: Blob): Promise<string> {
  const bmp = await createImageBitmap(blob)
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bmp, 0, 0, size, size)
  const img = ctx.getImageData(0, 0, size, size)
  const d = img.data
  const levels = 5
  const step = 255 / (levels - 1)
  for (let i = 0; i < d.length; i += 4) {
    d[i] = Math.round(d[i] / step) * step
    d[i + 1] = Math.round(d[i + 1] / step) * step
    d[i + 2] = Math.round(d[i + 2] / step) * step
    // warm cartoon bias
    d[i] = Math.min(255, d[i] * 1.05 + 8)
    d[i + 2] = Math.min(255, d[i + 2] * 0.95)
  }
  ctx.putImageData(img, 0, 0)
  return canvas.toDataURL('image/png')
}
