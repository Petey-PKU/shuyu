import { Platform } from 'react-native';
import * as Speech from 'expo-speech';
import type { StreamingTtsEngine, TtsStreamController } from 'react-native-sherpa-onnx/tts';

type SpeechKind = 'word' | 'sentence' | 'paragraph';

export const OFFLINE_VOICE_ID = 'shuyu-offline-amy';
export const SYSTEM_AUTO_VOICE_ID = 'system-auto';

export interface EnglishVoiceOption {
  identifier: string;
  language: string;
  name: string;
  quality: string;
  source: 'offline' | 'system';
  description: string;
}

let voicesPromise: Promise<Speech.Voice[]> | undefined;
let offlineEnginePromise: Promise<StreamingTtsEngine> | undefined;
let activeOfflineStream: TtsStreamController | undefined;
let offlineGeneration = 0;
let systemGeneration = 0;

function voiceScore(voice: Speech.Voice): number {
  const language = voice.language.toLowerCase();
  const name = voice.name.toLowerCase();
  let score = 0;
  if (language === 'en-us') score += 60;
  else if (language.startsWith('en-us')) score += 55;
  else if (language === 'en-gb') score += 45;
  else if (language.startsWith('en')) score += 30;
  if (String(voice.quality).toLowerCase() === 'enhanced') score += 25;
  if (/enhanced|premium|natural|neural/.test(name)) score += 15;
  if (/network/.test(`${name} ${voice.identifier.toLowerCase()}`)) score += 12;
  return score;
}

async function getEnglishSystemVoices(): Promise<Speech.Voice[]> {
  if (!voicesPromise) {
    voicesPromise = Speech.getAvailableVoicesAsync()
      .then((voices) => voices
        .filter((voice) => voice.language.toLowerCase().startsWith('en'))
        .sort((left, right) => voiceScore(right) - voiceScore(left)))
      .catch(() => []);
  }
  return (await voicesPromise) ?? [];
}

export async function listEnglishVoices(): Promise<EnglishVoiceOption[]> {
  const systemVoices = (await getEnglishSystemVoices()).map((voice) => ({
    identifier: voice.identifier,
    language: voice.language,
    name: voice.name,
    quality: String(voice.quality),
    source: 'system' as const,
    description: `${voice.language} · ${String(voice.quality).toLowerCase() === 'enhanced' ? '增强音色' : '系统音色'}`,
  }));
  const bundledVoice: EnglishVoiceOption[] = Platform.OS === 'android' ? [{
      identifier: OFFLINE_VOICE_ID,
      language: 'en-US',
      name: '书语 · Amy',
      quality: 'Offline neural',
      source: 'offline',
      description: 'Piper 中等质量神经音色 · 完全离线',
    }] : [];
  return [
    ...bundledVoice,
    {
      identifier: SYSTEM_AUTO_VOICE_ID,
      language: 'en',
      name: '系统自动优选',
      quality: 'System',
      source: 'system',
      description: '使用手机已安装的最佳英语音色',
    },
    ...systemVoices,
  ];
}

async function getPreferredSystemVoice(requestedVoice?: string): Promise<Speech.Voice | undefined> {
  const voices = await getEnglishSystemVoices();
  if (requestedVoice && requestedVoice !== SYSTEM_AUTO_VOICE_ID) {
    const selected = voices.find((voice) => voice.identifier === requestedVoice);
    if (selected) return selected;
  }
  return voices[0];
}

function speechChunks(text: string): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  const platformLimit = Number.isFinite(Speech.maxSpeechInputLength) ? Speech.maxSpeechInputLength : 3_500;
  const limit = Math.max(200, Math.min(platformLimit, 3_500));
  if (normalized.length <= limit) return [normalized];
  const sentences = normalized.match(/[^.!?]+[.!?]+["'”’)]*|[^.!?]+$/g) ?? [normalized];
  const chunks: string[] = [];
  let current = '';
  for (const rawSentence of sentences) {
    const sentence = rawSentence.trim();
    const combined = current ? `${current} ${sentence}` : sentence;
    if (combined.length <= limit) current = combined;
    else {
      if (current) chunks.push(current);
      current = sentence;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

async function getOfflineEngine(): Promise<StreamingTtsEngine> {
  if (Platform.OS !== 'android') throw new Error('Bundled TTS is currently available on Android only.');
  if (!offlineEnginePromise) {
    offlineEnginePromise = import('react-native-sherpa-onnx/tts')
      .then(({ createStreamingTTS }) => createStreamingTTS({
        modelPath: { type: 'asset', path: 'models/vits-piper-en_US-amy-medium' },
        modelType: 'vits',
        numThreads: 2,
        maxNumSentences: 1,
        silenceScale: 0.18,
        modelOptions: { vits: { noiseScale: 0.667, noiseScaleW: 0.8, lengthScale: 1 } },
      }))
      .catch((error) => {
        offlineEnginePromise = undefined;
        throw error;
      });
  }
  return offlineEnginePromise;
}

async function stopOfflineSpeech() {
  offlineGeneration += 1;
  const controller = activeOfflineStream;
  activeOfflineStream = undefined;
  if (controller) await controller.cancel().catch(() => undefined);
  const engine = offlineEnginePromise ? await offlineEnginePromise.catch(() => undefined) : undefined;
  if (engine) {
    await engine.cancelSpeechStream().catch(() => undefined);
    await engine.stopPcmPlayer().catch(() => undefined);
  }
}

async function stopActiveSpeech() {
  await Promise.allSettled([Speech.stop(), stopOfflineSpeech()]);
}

async function speakWithOfflineVoice(text: string, kind: SpeechKind) {
  const engine = await getOfflineEngine();
  const generation = ++offlineGeneration;
  const sampleRate = await engine.getSampleRate();
  await engine.startPcmPlayer(sampleRate, 1);
  let writes = Promise.resolve();
  let completed = false;
  let streamError: Error | undefined;
  const speed = kind === 'word' ? 0.88 : kind === 'sentence' ? 0.94 : 0.97;
  const controller = await engine.generateSpeechStream(text, { sid: 0, speed, silenceScale: 0.18 }, {
    onChunk: (chunk) => {
      if (generation !== offlineGeneration) return;
      writes = writes.then(() => engine.writePcmChunk(chunk.samples)).catch(() => undefined);
    },
    onEnd: () => {
      completed = true;
      if (generation !== offlineGeneration) return;
      activeOfflineStream = undefined;
      void writes.finally(() => engine.stopPcmPlayer().catch(() => undefined));
    },
    onError: (error) => {
      completed = true;
      streamError = new Error(error.message || '离线音色生成失败');
      console.warn('Offline TTS playback failed:', error.message);
      if (generation === offlineGeneration) activeOfflineStream = undefined;
      void engine.stopPcmPlayer().catch(() => undefined);
    },
  });
  if (streamError) {
    await engine.stopPcmPlayer().catch(() => undefined);
    throw streamError;
  }
  if (!completed && generation === offlineGeneration) activeOfflineStream = controller;
  else await controller.cancel().catch(() => undefined);
}

async function speakWithSystemVoice(text: string, kind: SpeechKind, requestedVoice: string | undefined, generation: number) {
  const chunks = speechChunks(text);
  const voice = await getPreferredSystemVoice(requestedVoice);
  const rate = kind === 'word' ? 0.86 : kind === 'sentence' ? 0.9 : 0.92;
  for (const chunk of chunks) {
    if (generation !== systemGeneration) return;
    await new Promise<void>((resolve, reject) => {
      Speech.speak(chunk, {
        language: voice?.language || 'en-US',
        voice: voice?.identifier,
        rate,
        pitch: 1,
        useApplicationAudioSession: false,
        onDone: resolve,
        onStopped: resolve,
        onError: (error) => reject(new Error(error.message || '系统朗读失败')),
      });
    });
    if (generation !== systemGeneration) return;
  }
}

export async function speakEnglish(text: string, kind: SpeechKind = 'word', requestedVoice?: string) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return undefined;
  // Reserve the newest generation before awaiting cancellation. If another tap
  // arrives while the stop is still in flight, this request becomes stale and
  // must not start playback after the newer request.
  const generation = ++systemGeneration;
  await stopActiveSpeech();
  if (generation !== systemGeneration) return undefined;
  const selectedVoice = requestedVoice ?? (Platform.OS === 'android' ? OFFLINE_VOICE_ID : SYSTEM_AUTO_VOICE_ID);
  let offlineFallback = false;
  if (selectedVoice === OFFLINE_VOICE_ID) {
    try {
      await speakWithOfflineVoice(normalized, kind);
      return 'offline' as const;
    } catch (error) {
      offlineFallback = true;
      console.warn('Bundled offline voice unavailable; falling back to system TTS.', error);
    }
  }
  await speakWithSystemVoice(normalized, kind, selectedVoice, generation);
  return offlineFallback ? 'system-fallback' as const : 'system' as const;
}

export async function stopSpeech() {
  systemGeneration += 1;
  await stopActiveSpeech();
}
