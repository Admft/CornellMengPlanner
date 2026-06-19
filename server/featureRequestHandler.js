import formidable from 'formidable'
import {
  cleanText,
  fieldValue,
  MAX_FILE_BYTES,
  MAX_FILES,
  sendFeatureRequestEmail,
  smtpAuthHint,
} from './featureRequestCore.js'

async function handleFeatureRequest(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }))
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
      files: await Promise.all(
        uploaded.map(async (file) => {
          const { readFileSync } = await import('node:fs')
          return {
            originalname: file.originalFilename || 'attachment',
            buffer: readFileSync(file.filepath),
            mimetype: file.mimetype || undefined,
          }
        }),
      ),
    })

    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ ok: true }))
  } catch (error) {
    let status = 500
    let message = 'Could not send your request right now. Please try again later.'

    if (error.code === 'NOT_CONFIGURED') {
      status = 503
      message =
        'Email is not configured yet. Add SMTP settings to your .env file (see .env.example).'
    } else if (error.code === 'VALIDATION') {
      status = 400
      message = error.message
    } else if (error.httpCode === 413 || error.message?.includes('maxFileSize')) {
      status = 413
      message = 'Attachments are too large. Keep total upload under 4 MB.'
    } else if (error.code === 'EAUTH' || error.code === 'ESOCKET' || error.responseCode === 535) {
      status = 503
      message = error.message || smtpAuthHint() || 'Email server login failed.'
    } else {
      console.error('Feature request failed:', error)
    }

    res.statusCode = status
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ ok: false, error: message }))
  }
}

/** Shared handler for Express production server. */
export function mountFeatureRequestRoute(app) {
  app.post('/api/feature-request', (req, res) => {
    void handleFeatureRequest(req, res)
  })
}

/** Vite plugin — serves /api/feature-request during dev without a second process. */
export function featureRequestDevPlugin() {
  return {
    name: 'feature-request-dev-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0]
        if (url !== '/api/feature-request') {
          next()
          return
        }
        void handleFeatureRequest(req, res)
      })
    },
  }
}
