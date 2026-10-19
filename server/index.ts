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

/** Simple SVG cartoon head when FAL_KEY is missing (dev placeholder). */
function placeholderDataUrl(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
  <stop stop-color="#ffd6a5"/><stop offset="1" stop-color="#f4a261"/></linearGradient></defs>
  <rect width="256" height="256" fill="#264653"/>
  <circle cx="128" cy="120" r="70" fill="url(#g)"/>
  <circle cx="105" cy="110" r="8" fill="#1d3557"/>
  <circle cx="151" cy="110" r="8" fill="#1d3557"/>
  <path d="M100 145 Q128 165 156 145" stroke="#1d3557" stroke-width="6" fill="none" stroke-linecap="round"/>
  <text x="128" y="230" text-anchor="middle" fill="#e9c46a" font-family="sans-serif" font-size="14">dev placeholder</text>
  </svg>`
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    falConfigured: Boolean(process.env.FAL_KEY),
    model: FAL_STYLIZE_MODEL,
  })
})

app.post('/api/stylize', upload.single('image'), async (req, res) => {
  try {
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
      res.json({
        ok: true,
        imageUrl: placeholderDataUrl(),
        placeholder: true,
        warning: 'FAL_KEY not set — returned placeholder cartoon head',
      })
      return
    }

    const b64 = req.file.buffer.toString('base64')
    const dataUri = `data:${mime};base64,${b64}`

    const result = await fal.subscribe(FAL_STYLIZE_MODEL, {
      input: {
        image_url: dataUri,
        prompt:
          'cartoon anime character portrait, clean cel shading, big expressive eyes, vibrant colors, simple background, stylized face suitable as a racing game driver avatar',
        strength: 0.75,
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
    res.status(500).json({ ok: false, error: msg })
  }
})

app.listen(PORT, () => {
  console.log(
    `[stylize] http://localhost:${PORT}/api/stylize  model=${FAL_STYLIZE_MODEL} fal=${Boolean(process.env.FAL_KEY)}`,
  )
})
