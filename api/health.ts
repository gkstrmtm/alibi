import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.status(200).json({ ok: true, service: 'alibi-api', ts: Date.now() });
}
