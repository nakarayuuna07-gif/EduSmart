import { GoogleGenAI } from '@google/genai';
import { REQUEST_TIMEOUT_MS } from './config.ts';
import { TimeoutError } from '../src/utils/errorMessages.ts';

export function getGeminiApiKey(): string {
  const key = process.env.GEMINI_API_KEY?.trim() || '';
  if (!key || key === 'MY_GEMINI_API_KEY') return '';
  return key;
}

export function isGeminiConfigured(): boolean {
  return getGeminiApiKey().length > 0;
}

export function getGeminiClient(): GoogleGenAI | null {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return null;

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new TimeoutError());
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
