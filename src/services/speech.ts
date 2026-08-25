import * as Speech from 'expo-speech';

type SpeechKind = 'word' | 'sentence' | 'paragraph';

let preferredVoicePromise: Promise<string | undefined> | undefined;

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
  return score;
}

async function getPreferredVoice(): Promise<string | undefined> {
  if (!preferredVoicePromise) {
    preferredVoicePromise = Speech.getAvailableVoicesAsync()
      .then((voices) => voices
        .filter((voice) => voice.language.toLowerCase().startsWith('en'))
        .sort((left, right) => voiceScore(right) - voiceScore(left))[0]?.identifier)
      .catch(() => undefined);
  }
  return preferredVoicePromise;
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

export async function speakEnglish(text: string, kind: SpeechKind = 'word') {
  const chunks = speechChunks(text);
  if (!chunks.length) return;
  await Speech.stop();
  const voice = await getPreferredVoice();
  const rate = kind === 'word' ? 0.72 : kind === 'sentence' ? 0.8 : 0.84;
  for (const chunk of chunks) {
    Speech.speak(chunk, {
      language: 'en-US',
      voice,
      rate,
      pitch: 1,
      useApplicationAudioSession: false,
    });
  }
}

export async function stopSpeech() {
  await Speech.stop();
}
