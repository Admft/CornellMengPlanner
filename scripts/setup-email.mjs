#!/usr/bin/env node
/**
 * Interactive helper — writes SMTP or Resend credentials into .env (never committed).
 * Run: npm run setup:email
 */
import { createInterface } from 'node:readline'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.join(__dirname, '../.env')
const examplePath = path.join(__dirname, '../.env.example')

const rl = createInterface({ input: process.stdin, output: process.stdout })

function ask(question) {
  return new Promise((resolve) => rl.question(question, resolve))
}

function quoteEnv(value) {
  if (/[\s#$"'\\]/.test(value)) return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  return value
}

function upsertEnv(lines, key, value) {
  const idx = lines.findIndex((line) => line.startsWith(`${key}=`))
  const row = `${key}=${quoteEnv(value)}`
  if (idx >= 0) lines[idx] = row
  else lines.push(row)
}

async function main() {
  console.log('\nMEM Planner — email setup\n')
  console.log('Choose how to send request-form emails:\n')
  console.log('  1) Gmail SMTP (recommended — works with multiple recipients)')
  console.log('  2) Resend API key (good for Vercel; verify domain for production)\n')

  const choice = (await ask('Option [1/2]: ')).trim() || '1'

  let lines = existsSync(envPath)
    ? readFileSync(envPath, 'utf8').split('\n')
    : existsSync(examplePath)
      ? readFileSync(examplePath, 'utf8').split('\n')
      : []

  if (choice === '2') {
    const apiKey = (await ask('Resend API key (re_…): ')).trim()
    const from = (
      await ask('From address [MEM Planner <onboarding@resend.dev>]: ')
    ).trim()
    if (!apiKey) {
      console.error('\nNo API key entered. Cancelled.')
      rl.close()
      process.exit(1)
    }
    upsertEnv(lines, 'RESEND_API_KEY', apiKey)
    if (from) upsertEnv(lines, 'RESEND_FROM', from)
    console.log('\nTip: add FEATURE_REQUEST_RECIPIENTS in .env if not already set.')
  } else {
    console.log('\nGmail App Password: https://myaccount.google.com/apppasswords')
    console.log('(Requires 2-Step Verification on your Google account.)\n')
    const user = (await ask('Gmail address (SMTP_USER): ')).trim()
    const pass = (await ask('App password (16 chars, SMTP_PASS): ')).trim()
    if (!user || !pass) {
      console.error('\nBoth email and app password are required. Cancelled.')
      rl.close()
      process.exit(1)
    }
    upsertEnv(lines, 'SMTP_HOST', 'smtp.gmail.com')
    upsertEnv(lines, 'SMTP_PORT', '587')
    upsertEnv(lines, 'SMTP_SECURE', 'false')
    upsertEnv(lines, 'SMTP_USER', user)
    upsertEnv(lines, 'SMTP_PASS', pass.replace(/\s/g, ''))
    const from = (await ask(`From header [MEM Planner <${user}>]: `)).trim()
    upsertEnv(lines, 'SMTP_FROM', from || `MEM Planner <${user}>`)
    console.log('\nImportant: use a Google App Password (16 letters), NOT your normal password.')
  }

  const recipients = (
    await ask('\nRecipient emails (comma-separated, FEATURE_REQUEST_RECIPIENTS): ')
  ).trim()
  if (recipients) upsertEnv(lines, 'FEATURE_REQUEST_RECIPIENTS', recipients)

  writeFileSync(envPath, lines.filter((l, i, a) => l !== '' || i < a.length - 1).join('\n') + '\n')
  console.log(`\n✓ Saved to ${envPath}`)
  console.log('Restart the dev server (npm run dev) and try the request form again.\n')
  rl.close()
}

main().catch((err) => {
  console.error(err)
  rl.close()
  process.exit(1)
})
