# Cornell Project

Cornell MEM M.Eng. Management course planner — build a personalized semester-by-semester plan and export it to the official proposal Excel template.

## Run locally

```bash
npm install
cp .env.example .env   # then add mail credentials (see below)
npm run dev
```

Open the URL shown in the terminal (usually `http://localhost:5173`). The request form API runs inside the Vite dev server — no second process needed.

### Feature requests (email)

**Quick setup:**

```bash
npm run setup:email
```

Then restart `npm run dev`. The script writes Gmail SMTP or Resend credentials into `.env` (never committed to git).

**Manual setup** — add one of these to `.env`:

- **Gmail:** `SMTP_USER` + `SMTP_PASS` (Google [App Password](https://myaccount.google.com/apppasswords), not your normal password)
- **Resend (Vercel):** `RESEND_API_KEY` from [resend.com](https://resend.com)

Also set `FEATURE_REQUEST_RECIPIENTS` (comma-separated). Recipient addresses live only in server env — never in the frontend.

Production (self-hosted): run `npm run build && npm start` to serve the app and API together on one port.

### Deploy to Vercel

1. Push the repo and import the project in Vercel (framework preset: **Vite**).
2. Add the same env vars from `.env` in **Project → Settings → Environment Variables**.
3. The request form uses the serverless function at `api/feature-request.js` — no extra config needed.

Note: Vercel limits upload size to ~4.5 MB per request, so attachments are capped at 4 MB total.

## Features

- 4-step wizard: timeline, courses taken, remaining choices, personalized plan
- Automatic semester scheduling with prerequisite and credit-limit rules
- **Export Excel** on the final step — fills `Cornellproposal.xlsx` with your name, NetID, advisor, start/graduation semesters, and course credits per semester column

## Export

The export uses the template at `public/Cornellproposal.xlsx` and preserves its formatting, writing your plan into the same cells as the official form.
