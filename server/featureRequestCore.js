import nodemailer from 'nodemailer'

export const MAX_FILES = 5
/** Vercel request body limit is ~4.5 MB — keep under that in production. */
export const MAX_FILE_BYTES = 4 * 1024 * 1024

export function getRecipients() {
  return (process.env.FEATURE_REQUEST_RECIPIENTS || '')
    .split(',')
    .map((email) => email.trim())
    .filter(Boolean)
}

export function getMailer() {
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

export function cleanText(value, maxLen) {
  return String(value ?? '')
    .replace(/[\0\r\n]+/g, ' ')
    .trim()
    .slice(0, maxLen)
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function sanitizeFilename(name) {
  const base = String(name || 'attachment').split(/[/\\]/).pop() || 'attachment'
  return base.replace(/[^\w.\-()+ ]/g, '_').slice(0, 120) || 'attachment'
}

/**
 * @param {{ name: string, replyTo: string, category: string, message: string, files: Array<{ originalname: string, buffer: Buffer, mimetype?: string }> }} input
 */
export async function sendFeatureRequestEmail(input) {
  const recipients = getRecipients()
  const mailer = getMailer()
  if (recipients.length === 0 || !mailer) {
    const error = new Error('NOT_CONFIGURED')
    error.code = 'NOT_CONFIGURED'
    throw error
  }

  const { name, replyTo, category, message, files = [] } = input

  if (!message) {
    const error = new Error('Please enter a message describing your request.')
    error.code = 'VALIDATION'
    throw error
  }

  if (replyTo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(replyTo)) {
    const error = new Error('Please enter a valid reply email address.')
    error.code = 'VALIDATION'
    throw error
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
    files.length ? `Attachments: ${files.length} file(s)` : 'Attachments: none',
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
    <p><strong>Attachments:</strong> ${files.length} file(s)</p>
  `

  await mailer.sendMail({
    from: fromAddress,
    to: recipients,
    replyTo: replyTo || undefined,
    subject,
    text,
    html,
    attachments: files.map((file) => ({
      filename: sanitizeFilename(file.originalname),
      content: file.buffer,
      contentType: file.mimetype,
    })),
  })
}

export function fieldValue(fields, key) {
  const value = fields[key]
  if (Array.isArray(value)) return value[0]
  return value
}
