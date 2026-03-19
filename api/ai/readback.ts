import type { VercelRequest, VercelResponse } from '@vercel/node';

import { badRequest, serverError, setCors, setJson } from '../_lib/http';

type ReadbackRequestBody = {
  text?: string;
};

type ElevenLabsVoice = {
  voice_id?: string;
  name?: string;
  labels?: Record<string, string>;
  category?: string;
  description?: string;
};

const PREFERRED_VOICE_HINTS = ['rachel', 'bella', 'aria', 'jessica', 'matilda', 'lily', 'charlotte', 'sarah'];

let cachedVoiceId: string | null = null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    setJson(res);
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) return serverError(res, 'Missing ELEVENLABS_API_KEY');

  const body = (req.body ?? {}) as ReadbackRequestBody;
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) return badRequest(res, 'Text is required');

  try {
    const voiceId = await resolveVoiceId(apiKey);
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        accept: 'audio/mpeg',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        text: text.slice(0, 5000),
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.42,
          similarity_boost: 0.82,
          style: 0.28,
          use_speaker_boost: true,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return serverError(res, `ElevenLabs error (${response.status}): ${errorText.slice(0, 400)}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    setJson(res);
    res.status(200).json({
      ok: true,
      provider: 'elevenlabs',
      voiceId,
      mimeType: 'audio/mpeg',
      audioBase64: buffer.toString('base64'),
    });
  } catch (error: any) {
    return serverError(res, error?.message || 'Readback generation failed');
  }
}

async function resolveVoiceId(apiKey: string) {
  if (cachedVoiceId) return cachedVoiceId;

  const preferred = process.env.ELEVENLABS_VOICE_ID?.trim();
  if (preferred) {
    cachedVoiceId = preferred;
    return cachedVoiceId;
  }

  const response = await fetch('https://api.elevenlabs.io/v1/voices', {
    headers: {
      'xi-api-key': apiKey,
      accept: 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Unable to load ElevenLabs voices (${response.status}): ${errorText.slice(0, 300)}`);
  }

  const data = (await response.json()) as { voices?: ElevenLabsVoice[] };
  const voices = Array.isArray(data.voices) ? data.voices : [];
  if (!voices.length) throw new Error('No ElevenLabs voices available');

  const winner = [...voices].sort((a, b) => scoreVoice(b) - scoreVoice(a))[0];
  const voiceId = winner?.voice_id?.trim();
  if (!voiceId) throw new Error('No valid ElevenLabs voice id available');

  cachedVoiceId = voiceId;
  return cachedVoiceId;
}

function scoreVoice(voice: ElevenLabsVoice) {
  const raw = `${voice.name ?? ''} ${voice.description ?? ''} ${voice.category ?? ''} ${JSON.stringify(voice.labels ?? {})}`.toLowerCase();
  let score = 0;
  PREFERRED_VOICE_HINTS.forEach((hint, index) => {
    if (raw.includes(hint)) score += 40 - index;
  });
  if (raw.includes('female')) score += 10;
  if (raw.includes('narrat')) score += 8;
  if (raw.includes('conversational')) score += 6;
  if (raw.includes('young')) score -= 2;
  if (raw.includes('child')) score -= 8;
  return score;
}