import { readFileSync } from 'node:fs'
import formidable from 'formidable'
import {
  cleanText,
  fieldValue,
  MAX_FILE_BYTES,
  MAX_FILES,
  sendFeatureRequestEmail,
  smtpAuthHint,
} from '../server/featureRequestCore.js'
import {
  checkRateLimit,
  clientIp,
  FEATURE_REQUEST_LIMIT,
} from '../server/rateLimit.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' })
    return
  }

  const rateKey = `feature-request:${clientIp(req)}`
  const { allowed, retryAfterMs } = checkRateLimit(rateKey, FEATURE_REQUEST_LIMIT)
  if (!allowed) {
    const retryAfterSec = Math.max(1, Math.ceil(retryAfterMs / 1000))
    res.setHeader('Retry-After', String(retryAfterSec))
    res.status(429).json({
      ok: false,
      error: `Too many requests. Try again in ${retryAfterSec} seconds.`,
    })
    return
  }

  try {
    const form = formidable({
      maxFiles: MAX_FILES,
      maxFileSize: MAX_FILE_BYTES,
      allowEmptyFiles: false,
    })

    const [fields, fileMap] = await form.parse(req)
    const uploaded = Object.values(fileMap).flat()

    await sendFeatureRequestEmail({
      name: cleanText(fieldValue(fields, 'name'), 120),
      replyTo: cleanText(fieldValue(fields, 'replyTo'), 160),
      category: cleanText(fieldValue(fields, 'category'), 80),
      message: cleanText(fieldValue(fields, 'message'), 4000),
      files: uploaded.map((file) => ({
        originalname: file.originalFilename || 'attachment',
        buffer: readFileSync(file.filepath),
        mimetype: file.mimetype || undefined,
      })),
    })

    res.status(200).json({ ok: true })
  } catch (error) {
    if (error.code === 'NOT_CONFIGURED') {
      res.status(503).json({
        ok: false,
        error:
          'Email is not configured yet. Add SMTP settings in Vercel environment variables.',
      })
      return
    }
    if (error.code === 'VALIDATION') {
      res.status(400).json({ ok: false, error: error.message })
      return
    }
    if (error.httpCode === 413 || error.message?.includes('maxFileSize')) {
      res.status(413).json({
        ok: false,
        error: 'Attachments are too large. Keep total upload under 4 MB.',
      })
      return
    }
    if (error.code === 'EAUTH' || error.code === 'ESOCKET' || error.responseCode === 535) {
      res.status(503).json({
        ok: false,
        error: error.message || smtpAuthHint() || 'Email server login failed.',
      })
      return
    }
    console.error('Feature request failed:', error)
    res.status(500).json({
      ok: false,
      error: 'Could not send your request right now. Please try again later.',
    })
  }
}
