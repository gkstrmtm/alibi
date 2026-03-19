import fs from 'node:fs';
import path from 'node:path';

function readTextIfExists(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function parseDotenvValue(text, key) {
  const lines = text.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    if (!line.startsWith(key + '=')) continue;
    let value = line.slice((key + '=').length).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    return value;
  }
  return null;
}

const cwd = process.cwd();
const candidates = [
  path.join(cwd, '.env.production.local'),
  path.join(cwd, '.env.local'),
  path.join(cwd, '.env'),
];

let supabaseUrl = null;
for (const filePath of candidates) {
  const text = readTextIfExists(filePath);
  if (!text) continue;

  supabaseUrl =
    parseDotenvValue(text, 'EXPO_PUBLIC_SUPABASE_URL') ||
    parseDotenvValue(text, 'SUPABASE_URL');

  if (supabaseUrl) break;
}

if (!supabaseUrl) {
  console.error('SUPABASE_URL not found. Try: npx vercel env pull .env.production.local --environment=production');
  process.exit(1);
}

// Print only the URL (non-secret)
process.stdout.write(String(supabaseUrl));
