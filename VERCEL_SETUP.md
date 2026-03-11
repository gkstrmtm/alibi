# Vercel control (safe setup)

This repo deploys the serverless API in `api/*` to Vercel.

## Option 1: GitHub Actions (hands-off)

1) In GitHub repo → Settings → Secrets and variables → Actions, add:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

2) Push to `main` → workflow deploys production.

## Option 2: Local CLI (one-time login)

From the repo root:

- `npx vercel@latest login`
- `npx vercel@latest link` (select the correct project)

Then you can run:

- `npx vercel@latest env pull .env.local`
- `npx vercel@latest deploy --prod`

## Required Vercel env vars (server-side)

Set in Vercel → Project → Settings → Environment Variables:

- `OPENAI_API_KEY` (required)
- `OPENAI_MODEL` (optional)

## Client env var (non-secret)

- `EXPO_PUBLIC_API_BASE_URL=https://alibi-ashen.vercel.app`

