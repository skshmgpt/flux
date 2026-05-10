// Programmatic click sounds. No assets — each click is a noise burst
// shaped by an exponential envelope and a one-pole low-pass, encoded
// to an in-memory 16-bit PCM WAV and handed to expo-audio.

import { AudioModule, AudioPlayer, setAudioModeAsync } from 'expo-audio';
import { File, Paths } from 'expo-file-system';

type Variant = 'tick' | 'open' | 'openHigh';

interface ClickSpec {
  durationMs: number;
  decay: number;
  lpAlpha: number;
  toneHz: number;
  toneMix: number;
  gain: number;
}

const SAMPLE_RATE = 22050;

const SPECS: Record<Variant, ClickSpec> = {
  // Theme switch — light dry tick
  tick: { durationMs: 28, decay: 180, lpAlpha: 0.5, toneHz: 0, toneMix: 0, gain: 0.55 },
  // Open feed — soft mid-body click
  open: { durationMs: 45, decay: 110, lpAlpha: 0.35, toneHz: 320, toneMix: 0.25, gain: 0.6 },
  // Open article — slightly brighter click
  openHigh: { durationMs: 40, decay: 130, lpAlpha: 0.4, toneHz: 520, toneMix: 0.3, gain: 0.6 },
};

function synth(spec: ClickSpec): Float32Array {
  const n = Math.floor((spec.durationMs / 1000) * SAMPLE_RATE);
  const out = new Float32Array(n);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const noise = Math.random() * 2 - 1;
    const tone =
      spec.toneHz > 0 ? Math.sin(2 * Math.PI * spec.toneHz * t) : 0;
    const env = Math.exp(-spec.decay * t);
    const x = (noise * (1 - spec.toneMix) + tone * spec.toneMix) * env;
    lp += spec.lpAlpha * (x - lp);
    out[i] = lp * spec.gain;
  }
  // Tiny linear fade-in over the first ~1ms to avoid a startup pop
  const fade = Math.min(n, Math.floor(SAMPLE_RATE * 0.001));
  for (let i = 0; i < fade; i++) out[i] *= i / fade;
  return out;
}

function encodeWav(samples: Float32Array): ArrayBuffer {
  const dataSize = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

const players: Partial<Record<Variant, AudioPlayer>> = {};
let audioInitialized = false;
let audioInitPromise: Promise<void> | null = null;

export function initAudio(): Promise<void> {
  if (audioInitialized) return Promise.resolve();
  if (audioInitPromise) return audioInitPromise;
  audioInitPromise = setAudioModeAsync({
    playsInSilentMode: true,
    interruptionMode: 'mixWithOthers',
    allowsRecording: false,
    shouldPlayInBackground: false,
    shouldRouteThroughEarpiece: false,
  })
    .then(() => {
      audioInitialized = true;
      // Warm up players so the first press has a sound ready.
      (Object.keys(SPECS) as Variant[]).forEach((v) => getPlayer(v));
    })
    .catch(() => {
      // If the mode can't be set, still warm players — playback may work on Android.
      (Object.keys(SPECS) as Variant[]).forEach((v) => getPlayer(v));
    });
  return audioInitPromise;
}

function getPlayer(variant: Variant): AudioPlayer | null {
  let p = players[variant];
  if (p) return p;
  try {
    const file = new File(Paths.cache, `flux-click-${variant}.wav`);
    if (!file.exists) {
      file.create();
      file.write(new Uint8Array(encodeWav(synth(SPECS[variant]))));
    }
    p = new AudioModule.AudioPlayer(file.uri, 500, false);
    p.volume = 1;
    players[variant] = p;
    return p;
  } catch {
    return null;
  }
}

export function playClick(variant: Variant = 'tick'): void {
  if (!audioInitialized) {
    // Fire-and-forget init; the first click might miss but subsequent ones land.
    void initAudio();
  }
  const p = getPlayer(variant);
  if (!p) return;
  try {
    void p.seekTo(0);
    p.play();
  } catch {
    // Audio failures are non-fatal; never let them block UI.
  }
}
