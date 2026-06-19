import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import multer from 'multer'
import nodemailer from 'nodemailer'
import path from 'path'
import { fileURLToPath } from 'url'

dotenv.config()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3001

const MAX_FILES = 5
const MAX_FILE_BYTES = 10 * 1024 * 1024
const RATE_WINDOW_MS = 60 * 60 * 1000
const RATE_MAX = 8

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: MAX_FILES },
})

const rateBuckets = new Map()

function getRecipients() {
  return (process.env.FEATURE_REQUEST_RECIPIENTS || '')
    .split(',')
    .map((email) => email.trim())
    .filter(Boolean)
}

function getMailer() {
  const host = process.env.SMTP_HOST
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  if (!host || !user || !pass) return null

  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user, pass },
  })
}

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

function cleanText(value, maxLen) {
  return String(value ?? '')
    .replace(/[\0\r\n]+/g, ' ')
    .trim()
    .slice(0, maxLen)
}

app.use(cors({ origin: true }))
app.use(express.json({ limit: '32kb' }))

app.post('/api/feature-request', upload.array('files', MAX_FILES), async (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown'
  if (!rateLimit(ip)) {
    res.status(429).json({ ok: false, error: 'Too many requests. Try again later.' })
    return
  }

  const recipients = getRecipients()
  const mailer = getMailer()
  if (recipients.length === 0 || !mailer) {
    res.status(503).json({
      ok: false,
      error: 'Request delivery is not configured on the server yet.',
    })
    return
  }

  const name = cleanText(req.body.name, 120)
  const replyTo = cleanText(req.body.replyTo, 160)
  const category = cleanText(req.body.category, 80)
  const message = cleanText(req.body.message, 4000)

  if (!message) {
    res.status(400).json({ ok: false, error: 'Please enter a message describing your request.' })
    return
  }

  if (replyTo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(replyTo)) {
    res.status(400).json({ ok: false, error: 'Please enter a valid reply email address.' })
    return
  }

  const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER
  const subject = `[MEM Planner] ${category || 'Feature request'}${name ? ` — ${name}` : ''}`

  const text = [
    'New MEM Course Planner request',
    '',
    `Category: ${category || 'Not specified'}`,
    name ? `From: ${name}` : null,
    replyTo ? `Reply to: ${replyTo}` : null,
    '',
    'Message:',
    message,
    '',
    req.files?.length ? `Attachments: ${req.files.length} file(s)` : 'Attachments: none',
  ]
    .filter(Boolean)
    .join('\n')

  const html = `
    <h2>MEM Course Planner request</h2>
    <p><strong>Category:</strong> ${escapeHtml(category || 'Not specified')}</p>
    ${name ? `<p><strong>From:</strong> ${escapeHtml(name)}</p>` : ''}
    ${replyTo ? `<p><strong>Reply to:</strong> ${escapeHtml(replyTo)}</p>` : ''}
    <p><strong>Message:</strong></p>
    <pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(message)}</pre>
    <p><strong>Attachments:</strong> ${req.files?.length ?? 0} file(s)</p>
  `

  try {
    await mailer.sendMail({
      from: fromAddress,
      to: recipients,
      replyTo: replyTo || undefined,
      subject,
      text,
      html,
      attachments: (req.files ?? []).map((file) => ({
        filename: sanitizeFilename(file.originalname),
        content: file.buffer,
        contentType: file.mimetype,
      })),
    })

    res.json({ ok: true })
  } catch (error) {
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

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function sanitizeFilename(name) {
  const base = path.basename(String(name || 'attachment'))
  return base.replace(/[^\w.\-()+ ]/g, '_').slice(0, 120) || 'attachment'
}
