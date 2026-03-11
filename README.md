# Alibi

Alibi is a private-first creative studio that turns raw voice/text into organized, expandable work.

## Mobile app (Expo)

Prereqs: Node.js + npm.

- Install deps: `npm install`
- Start dev server: `npx expo start --lan`
- Preview on your phone:
	- Install **Expo Go** (App Store / Google Play)
	- Connect phone + laptop to the same Wi‑Fi
	- Scan the QR code shown in the terminal
		- iOS: scan with the Camera app
		- Android: scan inside Expo Go
	- If you can’t see the QR in the terminal, open the dev UI in a browser (it shows the QR): `http://localhost:8081` (or whatever port Expo prints).

If Expo prints a URL like `exp://127.0.0.1:PORT` (your phone can’t reach that), force Expo to advertise your Wi‑Fi IP and restart:

- PowerShell:
	- `$env:REACT_NATIVE_PACKAGER_HOSTNAME='YOUR_LAN_IP'; $env:EXPO_PACKAGER_HOSTNAME='YOUR_LAN_IP'; npx expo start --lan --port 8083`

If LAN is blocked by your network, `npx expo start --tunnel` can work — but it depends on `ngrok` and may fail on some networks.

This repo currently focuses on the foundational app shell (navigation + screen hierarchy). Feature logic (recording, transcription, cloud processing, exports) is intentionally stubbed.

## Vercel backend (AI gateway)

This repo includes a minimal Vercel serverless API under `api/`.

- Health check: `/api/health`
- Draft generation (OpenAI): `/api/ai/draft`

### Environment variables

Copy `.env.example` for reference.

- On Vercel (server-side secrets)
	- `OPENAI_API_KEY` (required)
	- `OPENAI_MODEL` (optional; default in code)
	- Set these in Vercel for **Production** + **Preview** (and **Development** if you use `vercel dev`).

- In Expo (client-side, non-secret)
	- `EXPO_PUBLIC_API_BASE_URL` (your deployed Vercel URL, e.g. `https://your-project.vercel.app`)

The Expo app reads `EXPO_PUBLIC_API_BASE_URL` and will call the Vercel endpoint from the Studio “Generate” action. If it’s missing or the call fails, the app falls back to placeholder draft content.

### Quick verify

- After Vercel deploys, open: `https://YOUR_VERCEL_URL/api/health` and confirm it returns `{ ok: true, ... }`.
- Once `OPENAI_API_KEY` is set, Studio → Draft → Generate should return real content.

## Product docs

- Foundation: [FOUNDATION.md](FOUNDATION.md)
- V1 boundary + store-safe launch plan: [V1_BOUNDARY_AND_LAUNCH.md](V1_BOUNDARY_AND_LAUNCH.md)
- Mobile-first app shell (navigation + screens): [MOBILE_APP_SHELL_V1.md](MOBILE_APP_SHELL_V1.md)
