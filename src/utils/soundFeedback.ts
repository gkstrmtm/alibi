import { Audio } from 'expo-av';
import { Platform } from 'react-native';

type SoundKind = 'record-start' | 'success';

const SAMPLE_RATE = 22050;
const soundUriCache = new Map<SoundKind, string>();

let audioModeReady = false;

function pushUint16(bytes: number[], value: number) {
  bytes.push(value & 0xff, (value >> 8) & 0xff);
}

function pushUint32(bytes: number[], value: number) {
  bytes.push(value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff);
}

function encodeBase64(bytes: number[]) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let output = '';

  for (let i = 0; i < bytes.length; i += 3) {
    const byte1 = bytes[i] ?? 0;
    const byte2 = bytes[i + 1] ?? 0;
    const byte3 = bytes[i + 2] ?? 0;
    const chunk = (byte1 << 16) | (byte2 << 8) | byte3;

    output += chars[(chunk >> 18) & 63];
    output += chars[(chunk >> 12) & 63];
    output += i + 1 < bytes.length ? chars[(chunk >> 6) & 63] : '=';
    output += i + 2 < bytes.length ? chars[chunk & 63] : '=';
  }

  return output;
}

function synthesizeToneSequence(tones: Array<{ frequency: number; durationMs: number; gain?: number }>) {
  const samples: number[] = [];

  tones.forEach((tone, toneIndex) => {
    const sampleCount = Math.max(1, Math.floor((tone.durationMs / 1000) * SAMPLE_RATE));
    const fadeSamples = Math.max(8, Math.floor(sampleCount * 0.18));
    const gain = tone.gain ?? 0.28;

    for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
      const t = sampleIndex / SAMPLE_RATE;
      const wave = Math.sin(2 * Math.PI * tone.frequency * t);
      const harmonic = Math.sin(2 * Math.PI * tone.frequency * 2 * t) * 0.18;
      const shimmer = Math.sin(2 * Math.PI * (tone.frequency * 0.5) * t) * 0.12;

      let envelope = 1;
      if (sampleIndex < fadeSamples) envelope = sampleIndex / fadeSamples;
      if (sampleIndex > sampleCount - fadeSamples) envelope = Math.min(envelope, (sampleCount - sampleIndex) / fadeSamples);

      const value = Math.max(-1, Math.min(1, (wave + harmonic + shimmer) * gain * envelope));
      const pcm = Math.floor(value * 32767);

      pushUint16(samples, pcm & 0xffff);
    }

    if (toneIndex < tones.length - 1) {
      const gapSamples = Math.floor(SAMPLE_RATE * 0.012);
      for (let gapIndex = 0; gapIndex < gapSamples; gapIndex += 1) {
        pushUint16(samples, 0);
      }
    }
  });

  const dataSize = samples.length;
  const header: number[] = [];
  header.push(...Array.from('RIFF').map((char) => char.charCodeAt(0)));
  pushUint32(header, 36 + dataSize);
  header.push(...Array.from('WAVE').map((char) => char.charCodeAt(0)));
  header.push(...Array.from('fmt ').map((char) => char.charCodeAt(0)));
  pushUint32(header, 16);
  pushUint16(header, 1);
  pushUint16(header, 1);
  pushUint32(header, SAMPLE_RATE);
  pushUint32(header, SAMPLE_RATE * 2);
  pushUint16(header, 2);
  pushUint16(header, 16);
  header.push(...Array.from('data').map((char) => char.charCodeAt(0)));
  pushUint32(header, dataSize);

  const wavBytes = [...header, ...samples];
  return `data:audio/wav;base64,${encodeBase64(wavBytes)}`;
}

function getSoundUri(kind: SoundKind) {
  const cached = soundUriCache.get(kind);
  if (cached) return cached;

  const uri =
    kind === 'record-start'
      ? synthesizeToneSequence([
          { frequency: 740, durationMs: 38, gain: 0.2 },
          { frequency: 1048, durationMs: 92, gain: 0.28 },
        ])
      : synthesizeToneSequence([
          { frequency: 988, durationMs: 52, gain: 0.24 },
          { frequency: 1318, durationMs: 94, gain: 0.3 },
        ]);

  soundUriCache.set(kind, uri);
  return uri;
}

async function ensureAudioMode() {
  if (audioModeReady || Platform.OS === 'web') return;
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      allowsRecordingIOS: false,
      shouldDuckAndroid: true,
    });
    audioModeReady = true;
  } catch {
    // Ignore sound setup failures.
  }
}

export async function playFeedbackSound(kind: SoundKind) {
  if (Platform.OS === 'web') return;

  try {
    await ensureAudioMode();
    const { sound } = await Audio.Sound.createAsync(
      { uri: getSoundUri(kind) },
      { shouldPlay: true, volume: 1 },
    );

    sound.setOnPlaybackStatusUpdate((status) => {
      if (!status.isLoaded) return;
      if (!status.didJustFinish) return;
      sound.unloadAsync().catch(() => {});
    });
  } catch {
    // Ignore sound playback failures.
  }
}