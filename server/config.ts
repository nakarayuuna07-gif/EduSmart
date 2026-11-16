import fs from 'fs';
import path from 'path';

export type ProviderName =
  | 'gemini'
  | 'openai'
  | 'anthropic'
  | 'deepseek'
  | 'groq'
  | 'mistral'
  | 'openrouter';

export const PROVIDER_ORDER: readonly ProviderName[] = [
  'gemini',
  'openai',
  'anthropic',
  'deepseek',
  'groq',
  'mistral',
  'openrouter',
] as const;

export interface ProviderEnvSpec {
  name: ProviderName;
  label: string;
  apiKeyEnv: string;
  modelEnv: string;
  defaultModel: string;
  baseUrl: string;
  apiVersion?: string;
}

export const PROVIDER_SPECS: Record<ProviderName, ProviderEnvSpec> = {
  gemini: {
    name: 'gemini',
    label: 'Gemini (Google)',
    apiKeyEnv: 'GEMINI_API_KEY',
    modelEnv: 'GEMINI_MODEL',
    defaultModel: 'gemini-3.5-flash-lite',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
  },
  openai: {
    name: 'openai',
    label: 'ChatGPT (OpenAI)',
    apiKeyEnv: 'OPENAI_API_KEY',
    modelEnv: 'OPENAI_MODEL',
    // PERLU VERIFIKASI: pastikan akun OpenAI memiliki akses gpt-5-nano (alternatif: gpt-4.1-nano / gpt-4o-mini).
    defaultModel: 'gpt-5-nano',
    baseUrl: 'https://api.openai.com/v1',
  },
  anthropic: {
    name: 'anthropic',
    label: 'Claude (Anthropic)',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    modelEnv: 'ANTHROPIC_MODEL',
    // PERLU VERIFIKASI: sesuaikan dengan versi Haiku aktif di akun Anthropic (alternatif: claude-haiku-4-5).
    defaultModel: 'claude-haiku-5-5',
    baseUrl: 'https://api.anthropic.com/v1',
    apiVersion: '2023-06-01', // PERLU VERIFIKASI berkala sesuai dokumentasi Anthropic Messages API
  },
  deepseek: {
    name: 'deepseek',
    label: 'DeepSeek',
    apiKeyEnv: 'DEEPSEEK_API_KEY',
    modelEnv: 'DEEPSEEK_MODEL',
    defaultModel: 'deepseek-chat',
    baseUrl: 'https://api.deepseek.com',
  },
  groq: {
    name: 'groq',
    label: 'Groq',
    apiKeyEnv: 'GROQ_API_KEY',
    modelEnv: 'GROQ_MODEL',
    defaultModel: 'llama-3.1-8b-instant',
    baseUrl: 'https://api.groq.com/openai/v1',
  },
  mistral: {
    name: 'mistral',
    label: 'Mistral',
    apiKeyEnv: 'MISTRAL_API_KEY',
    modelEnv: 'MISTRAL_MODEL',
    // PERLU VERIFIKASI: ministral-3b-latest atau mistral-small-latest.
    defaultModel: 'ministral-3b-latest',
    baseUrl: 'https://api.mistral.ai/v1',
  },
  openrouter: {
    name: 'openrouter',
    label: 'OpenRouter',
    apiKeyEnv: 'OPENROUTER_API_KEY',
    modelEnv: 'OPENROUTER_MODEL',
    defaultModel: 'openrouter/free',
    baseUrl: 'https://openrouter.ai/api/v1',
  },
};

export const REQUEST_TIMEOUT_MS = 30_000;
export const DEFAULT_MAX_OUTPUT_TOKENS = 1000;
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 jam
export const RATE_LIMIT_MAX_REQUESTS = 10; // Maks 10 pertanyaan per menit per pengguna
export const RATE_LIMIT_WINDOW_MS = 60_000;
export const CIRCUIT_BREAKER_THRESHOLD = 3;
export const CIRCUIT_BREAKER_COOLDOWN_MS = 5 * 60 * 1000; // 5 menit
export const PROVIDER_MAX_RETRIES = 2; // Maks 2x retry per provider

export function getProviderApiKey(
  provider: ProviderName,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const spec = PROVIDER_SPECS[provider];
  const raw = env[spec.apiKeyEnv]?.trim() || '';
  if (!raw || raw === 'MY_GEMINI_API_KEY') return '';
  return raw;
}

export function getProviderModel(
  provider: ProviderName,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const spec = PROVIDER_SPECS[provider];
  const fromPrimaryEnv = env[spec.modelEnv]?.trim();
  if (fromPrimaryEnv) return fromPrimaryEnv;
  if (provider === 'gemini' && env.AI_MODEL?.trim()) {
    return env.AI_MODEL.trim();
  }
  return spec.defaultModel;
}

export const AI_MODEL = getProviderModel('gemini');

interface FirebaseAppletConfig {
  projectId?: string;
}

let cachedProjectId: string | null = null;

export function getFirebaseProjectId(): string {
  if (cachedProjectId) return cachedProjectId;

  if (process.env.FIREBASE_PROJECT_ID?.trim()) {
    cachedProjectId = process.env.FIREBASE_PROJECT_ID.trim();
    return cachedProjectId;
  }

  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf-8');
      const parsed = JSON.parse(raw) as FirebaseAppletConfig;
      if (parsed.projectId) {
        cachedProjectId = parsed.projectId;
        return cachedProjectId;
      }
    }
  } catch (err) {
    console.error('Gagal membaca firebase-applet-config.json:', err);
  }

  return '';
}
