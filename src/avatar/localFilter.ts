/** Local posterized portrait effect. No AI inference and no network requests. */
export async function localCartoonFilter(blob: Blob): Promise<string> {
  const bitmap = await createImageBitmap(blob)
  const size = 512, canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const context = canvas.getContext('2d')!
  const crop = Math.min(bitmap.width, bitmap.height)
  context.drawImage(bitmap, (bitmap.width-crop)/2, (bitmap.height-crop)/2, crop, crop, 0, 0, size, size)
  bitmap.close()
  const image = context.getImageData(0, 0, size, size), data = image.data
  const source = new Uint8ClampedArray(data)
  const step = 255 / 8
  for (let y=0; y<size; y++) for (let x=0; x<size; x++) {
    const i=(y*size+x)*4
    const edge = x>0 && y>0 ? Math.abs(source[i]-source[i-4])+Math.abs(source[i+1]-source[i-size*4+1]) : 0
    const shade = edge>70 ? 0.72 : 1
    data[i] = Math.min(255, (Math.round(source[i]/step)*step*1.04+3)*shade)
    data[i+1] = Math.round(source[i+1]/step)*step*shade
    data[i+2] = Math.round(source[i+2]/step)*step*0.96*shade
  }
  context.putImageData(image, 0, 0)
  return canvas.toDataURL('image/png')
}
