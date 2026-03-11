import type { VercelResponse } from '@vercel/node';

export function setJson(res: VercelResponse) {
  res.setHeader('content-type', 'application/json; charset=utf-8');
}

export function setCors(res: VercelResponse) {
  // Native mobile clients don't require CORS, but web previews do.
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
  res.setHeader('access-control-allow-headers', 'content-type,authorization');
}

export function badRequest(res: VercelResponse, message: string) {
  setCors(res);
  setJson(res);
  res.status(400).json({ ok: false, error: message });
}

export function serverError(res: VercelResponse, message: string) {
  setCors(res);
  setJson(res);
  res.status(500).json({ ok: false, error: message });
}
