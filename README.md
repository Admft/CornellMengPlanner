# Cornell Project

Cornell MEM M.Eng. Management course planner — build a personalized semester-by-semester plan and export it to the official proposal Excel template.

## Run locally

```bash
npm install
cp .env.example .env   # then add SMTP credentials (see below)
npm run dev
```

Open the URL shown in the terminal (usually `http://localhost:5173`). The request form API runs inside the Vite dev server — no second process needed.

### Feature requests (email)

The **Request a change** button sends email through a server-side API. Recipient addresses live only in `.env` on the server — they are never included in the frontend bundle.

Set these in `.env`:

- `FEATURE_REQUEST_RECIPIENTS` — comma-separated inbox addresses
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` — mail server (Gmail app password works)
- `SMTP_FROM` — optional From header

Until SMTP is configured, the form returns a clear setup message instead of a generic error.

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
