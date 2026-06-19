import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  MAX_FILE_BYTES,
  MAX_FILES,
  cleanText,
  sendFeatureRequestEmail,
} from './featureRequestCore.js'

dotenv.config()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3001

const RATE_WINDOW_MS = 60 * 60 * 1000
const RATE_MAX = 8

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: MAX_FILES },
})

const rateBuckets = new Map()

function rateLimit(ip) {
  const now = Date.now()
  const bucket = rateBuckets.get(ip) ?? { count: 0, resetAt: now + RATE_WINDOW_MS }
  if (now > bucket.resetAt) {
    bucket.count = 0
    bucket.resetAt = now + RATE_WINDOW_MS
  }
  bucket.count += 1
  rateBuckets.set(ip, bucket)
  return bucket.count <= RATE_MAX
}

app.use(cors({ origin: true }))
app.use(express.json({ limit: '32kb' }))

app.post('/api/feature-request', upload.array('files', MAX_FILES), async (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown'
  if (!rateLimit(ip)) {
    res.status(429).json({ ok: false, error: 'Too many requests. Try again later.' })
    return
  }

  try {
    await sendFeatureRequestEmail({
      name: cleanText(req.body.name, 120),
      replyTo: cleanText(req.body.replyTo, 160),
      category: cleanText(req.body.category, 80),
      message: cleanText(req.body.message, 4000),
      files: req.files ?? [],
    })
    res.json({ ok: true })
  } catch (error) {
    if (error.code === 'NOT_CONFIGURED') {
      res.status(503).json({
        ok: false,
        error: 'Request delivery is not configured on the server yet.',
      })
      return
    }
    if (error.code === 'VALIDATION') {
      res.status(400).json({ ok: false, error: error.message })
      return
    }
    console.error('Feature request email failed:', error)
    res.status(500).json({
      ok: false,
      error: 'Could not send your request right now. Please try again later.',
    })
  }
})

if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../dist')
  app.use(express.static(distPath))
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

app.listen(PORT, () => {
  console.log(`API server listening on http://localhost:${PORT}`)
})
