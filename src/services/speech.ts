import * as Speech from 'expo-speech';

type SpeechKind = 'word' | 'sentence' | 'paragraph';

export interface EnglishVoiceOption {
  identifier: string;
  language: string;
  name: string;
  quality: string;
}

let voicesPromise: Promise<Speech.Voice[]> | undefined;

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

async function getEnglishVoices(): Promise<Speech.Voice[]> {
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
  return (await getEnglishVoices()).map((voice) => ({
    identifier: voice.identifier,
    language: voice.language,
    name: voice.name,
    quality: String(voice.quality),
  }));
}

async function getPreferredVoice(requestedVoice?: string): Promise<Speech.Voice | undefined> {
  const voices = await getEnglishVoices();
  if (requestedVoice) {
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
    if (combined.length <= limit) {
      current = combined;
    } else {
      if (current) chunks.push(current);
      current = sentence;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export async function speakEnglish(text: string, kind: SpeechKind = 'word', requestedVoice?: string) {
  const chunks = speechChunks(text);
  if (!chunks.length) return;
  await Speech.stop();
  const voice = await getPreferredVoice(requestedVoice);
  const rate = kind === 'word' ? 0.86 : kind === 'sentence' ? 0.9 : 0.92;
  for (const chunk of chunks) {
    Speech.speak(chunk, {
      language: voice?.language || 'en-US',
      voice: voice?.identifier,
      rate,
      pitch: 1,
      useApplicationAudioSession: false,
    });
  }
}

export async function stopSpeech() {
  await Speech.stop();
}
