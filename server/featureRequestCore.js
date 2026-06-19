import dotenv from 'dotenv'
import nodemailer from 'nodemailer'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../.env') })

export const MAX_FILES = 5
/** Vercel request body limit is ~4.5 MB — keep under that in production. */
export const MAX_FILE_BYTES = 4 * 1024 * 1024

export function getRecipients() {
  return (process.env.FEATURE_REQUEST_RECIPIENTS || '')
    .split(',')
    .map((email) => email.trim())
    .filter(Boolean)
}

export function isEmailConfigured() {
  return !!(process.env.RESEND_API_KEY || (getSmtpConfig() && getMailer()))
}

function getSmtpConfig() {
  const host = process.env.SMTP_HOST
  const user = process.env.SMTP_USER?.trim()
  const pass = process.env.SMTP_PASS?.trim()
  if (!host || !user || !pass) return null
  return { host, user, pass }
}

function looksLikeGmailAppPassword(pass) {
  const compact = pass.replace(/\s/g, '')
  return /^[a-z]{16}$/i.test(compact)
}

export function getMailer() {
  const smtp = getSmtpConfig()
  if (!smtp) return null

  const port = Number(process.env.SMTP_PORT || 587)
  const isGmail =
    smtp.host.includes('gmail') || smtp.user.endsWith('@gmail.com') || smtp.user.endsWith('@cornell.edu')

  return nodemailer.createTransport({
    host: smtp.host,
    port,
    secure: port === 465,
    requireTLS: port === 587,
    auth: { user: smtp.user, pass: smtp.pass },
    ...(isGmail && {
      tls: { minVersion: 'TLSv1.2' },
    }),
  })
}

export function smtpAuthHint() {
  const smtp = getSmtpConfig()
  if (!smtp) return null
  const isGmail =
    smtp.host.includes('gmail') ||
    smtp.user.endsWith('@gmail.com') ||
    smtp.user.endsWith('@cornell.edu')
  if (!isGmail) {
    return 'Check SMTP_USER and SMTP_PASS in your .env file. Wrap the password in quotes if it contains special characters ($, #, etc.).'
  }
  if (!looksLikeGmailAppPassword(smtp.pass)) {
    return 'Gmail requires a 16-character App Password — not your normal Google login password. Create one at myaccount.google.com/apppasswords (2-Step Verification must be on). Put it in .env as SMTP_PASS="xxxx xxxx xxxx xxxx" then restart npm run dev.'
  }
  return 'Gmail rejected the App Password. Generate a new one at myaccount.google.com/apppasswords, update SMTP_PASS in .env (use quotes), and restart npm run dev.'
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

function buildEmailContent(input) {
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

  const attachments = files.map((file) => ({
    filename: sanitizeFilename(file.originalname),
    content: file.buffer,
    contentType: file.mimetype,
  }))

  return { subject, text, html, attachments, replyTo: replyTo || undefined }
}

async function sendViaResend(input, recipients) {
  const { Resend } = await import('resend')
  const resend = new Resend(process.env.RESEND_API_KEY)
  const { subject, html, text, attachments, replyTo } = buildEmailContent(input)
  const from =
    process.env.RESEND_FROM ||
    process.env.SMTP_FROM ||
    'MEM Planner <onboarding@resend.dev>'

  const { error } = await resend.emails.send({
    from,
    to: recipients,
    replyTo,
    subject,
    html,
    text,
    attachments: attachments.map((file) => ({
      filename: file.filename,
      content: file.content,
    })),
  })

  if (error) {
    const err = new Error(error.message || 'Resend delivery failed')
    err.code = error.name === 'validation_error' ? 'VALIDATION' : 'SEND_FAILED'
    throw err
  }
}

async function sendViaSmtp(input, recipients) {
  const mailer = getMailer()
  if (!mailer) {
    const error = new Error('NOT_CONFIGURED')
    error.code = 'NOT_CONFIGURED'
    throw error
  }

  const { subject, html, text, attachments, replyTo } = buildEmailContent(input)
  const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER

  try {
    await mailer.sendMail({
      from: fromAddress,
      to: recipients,
      replyTo,
      subject,
      text,
      html,
      attachments,
    })
  } catch (error) {
    if (error.code === 'EAUTH' || error.responseCode === 535) {
      const authError = new Error(smtpAuthHint())
      authError.code = 'EAUTH'
      throw authError
    }
    throw error
  }
}

/**
 * @param {{ name: string, replyTo: string, category: string, message: string, files: Array<{ originalname: string, buffer: Buffer, mimetype?: string }> }} input
 */
export async function sendFeatureRequestEmail(input) {
  const recipients = getRecipients()
  if (recipients.length === 0) {
    const error = new Error('NOT_CONFIGURED')
    error.code = 'NOT_CONFIGURED'
    throw error
  }

  if (process.env.RESEND_API_KEY) {
    await sendViaResend(input, recipients)
    return
  }

  if (getMailer()) {
    await sendViaSmtp(input, recipients)
    return
  }

  const error = new Error('NOT_CONFIGURED')
  error.code = 'NOT_CONFIGURED'
  throw error
}

export function fieldValue(fields, key) {
  const value = fields[key]
  if (Array.isArray(value)) return value[0]
  return value
}
