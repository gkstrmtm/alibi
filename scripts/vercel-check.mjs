import fs from 'node:fs';
import path from 'node:path';

function loadDotEnvIfPresent() {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (key && !(key in process.env)) process.env[key] = value;
  }
}

loadDotEnvIfPresent();

const baseUrl = (process.env.EXPO_PUBLIC_API_BASE_URL || '').trim().replace(/\/+$/, '');

if (!baseUrl) {
  console.error('Missing EXPO_PUBLIC_API_BASE_URL (set it in .env for local checks).');
  process.exit(2);
}

async function fetchText(url, options) {
  const timeoutMs = 20000;
  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error(`timeout ${timeoutMs}ms`)), timeoutMs));
  const response = await Promise.race([fetch(url, options), timeout]);
  const text = await response.text();
  return { status: response.status, text };
}

function clip(text, max = 600) {
  const t = (text || '').trim();
  return t.length > max ? t.slice(0, max) + '…' : t;
}

async function main() {
  const healthUrl = `${baseUrl}/api/health`;
  const draftUrl = `${baseUrl}/api/ai/draft`;

  console.log(`Base URL: ${baseUrl}`);

  try {
    const health = await fetchText(healthUrl);
    console.log(`\nGET /api/health -> ${health.status}`);
    console.log(clip(health.text));
  } catch (e) {
    console.error(`\nGET /api/health failed: ${e?.message || e}`);
  }

  try {
    const body = {
      projectName: 'Smoke Test',
      format: 'essay',
      sources: [{ title: 'S1', transcript: 'Test transcript', highlights: ['One'] }],
    };

    const draft = await fetchText(draftUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

    console.log(`\nPOST /api/ai/draft -> ${draft.status}`);
    console.log(clip(draft.text, 900));

    if (draft.status === 500 && /Missing OPENAI_API_KEY/i.test(draft.text)) {
      console.log('\nNote: This error is expected until OPENAI_API_KEY is set in Vercel env vars.');
    }
  } catch (e) {
    console.error(`\nPOST /api/ai/draft failed: ${e?.message || e}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
