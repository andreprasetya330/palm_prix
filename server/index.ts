/**
 * Tiny stylize proxy — keeps FAL_KEY off the client.
 * Default model: fal-ai/flux/dev/image-to-image (cartoon/anime prompt).
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import cors from 'cors'
import express from 'express'
import multer from 'multer'
import { fal } from '@fal-ai/client'

/** Minimal .env loader (no dependency) — does not override existing env. */
function loadDotEnv(file = '.env') {
  const path = resolve(process.cwd(), file)
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = val
  }
}
loadDotEnv()

/** Documented in README — swap via FAL_STYLIZE_MODEL if needed. */
export const FAL_STYLIZE_MODEL =
  process.env.FAL_STYLIZE_MODEL ?? 'fal-ai/flux/dev/image-to-image'

const PORT = Number(process.env.STYLIZE_PORT ?? 8787)
const MAX_BYTES = 2 * 1024 * 1024

const app = express()
app.use(cors({ origin: true }))
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES },
})

fal.config({
  credentials: process.env.FAL_KEY,
})

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    falConfigured: Boolean(process.env.FAL_KEY),
    model: FAL_STYLIZE_MODEL,
  })
})

app.post('/api/stylize', upload.single('image'), async (req, res) => {
  try {
    if (req.body?.consent !== 'cloud-still') {
      res.status(400).json({ ok: false, error: 'Confirm cloud portrait consent before uploading a still.' })
      return
    }
    if (!req.file) {
      res.status(400).json({ ok: false, error: 'Expected multipart field "image"' })
      return
    }
    const mime = req.file.mimetype || ''
    if (!mime.startsWith('image/')) {
      res.status(400).json({ ok: false, error: 'Non-image payload rejected' })
      return
    }

    if (!process.env.FAL_KEY) {
      res.status(503).json({ ok: false, error: 'Cloud AI is not configured. Use Local portrait, or configure FAL_KEY on the server.' })
      return
    }

    const b64 = req.file.buffer.toString('base64')
    const dataUri = `data:${mime};base64,${b64}`

    const result = await fal.subscribe(FAL_STYLIZE_MODEL, {
      input: {
        image_url: dataUri,
        prompt:
          'A square front-facing stylized 3D racing game face portrait of this same person. Preserve recognizable facial features, skin tone, eye color and expression. Center the face and tightly crop forehead to chin; face fills the frame. Soft polished animation-film shading, warm daylight, friendly confident expression. No helmet, no text, no body, no accessories, no frame. Simple neutral background.',
        strength: 0.45,
        num_images: 1,
        output_format: 'png',
      },
      logs: false,
    })

    const data = result.data as {
      images?: { url: string }[]
      image?: { url: string }
    }
    const imageUrl = data.images?.[0]?.url ?? data.image?.url
    if (!imageUrl) {
      res.status(502).json({ ok: false, error: 'fal returned no image URL' })
      return
    }
    res.json({ ok: true, imageUrl, model: FAL_STYLIZE_MODEL })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[stylize]', msg)
    res.status(502).json({ ok: false, error: 'Cloud portrait generation failed. Retry, or choose Local portrait without AI.' })
  }
})

app.listen(PORT, () => {
  console.log(
    `[stylize] http://localhost:${PORT}/api/stylize  model=${FAL_STYLIZE_MODEL} fal=${Boolean(process.env.FAL_KEY)}`,
  )
})

