import {
  DEFAULT_MAX_OUTPUT_TOKENS,
  getProviderApiKey,
  getProviderModel,
  PROVIDER_SPECS,
  REQUEST_TIMEOUT_MS,
  type ProviderName,
} from '../config.ts';
import type { GroundingSource } from '../../src/types/index.ts';
import {
  ProviderError,
  type ProviderPromptPayload,
} from './types.ts';

export type FetchLike = typeof fetch;

export type MockBehavior =
  | { mode: 'ok'; text?: string }
  | { mode: 'error'; status: number; message?: string; retryAfterSeconds?: number }
  | { mode: 'timeout' };

export interface AdapterExecutionDeps {
  env?: NodeJS.ProcessEnv;
  fetchFn?: FetchLike;
  timeoutMs?: number;
  mockRules?: Partial<Record<ProviderName, MockBehavior>>;
}

export interface RawProviderOutput {
  text: string;
  sources: GroundingSource[];
  hasGrounding: boolean;
}

let runtimeMockRules: Partial<Record<ProviderName, MockBehavior>> = {};

export function setMockProviderRules(
  rules: Partial<Record<ProviderName, MockBehavior>>,
): void {
  runtimeMockRules = { ...rules };
}

export function clearMockProviderRules(): void {
  runtimeMockRules = {};
}

export function parseMockEnvRules(
  rawValue?: string,
): Partial<Record<ProviderName, MockBehavior>> {
  const result: Partial<Record<ProviderName, MockBehavior>> = {};
  if (!rawValue?.trim()) return result;

  for (const part of rawValue.split(',')) {
    const [rawProvider, rawAction] = part.trim().split(':');
    const provider = rawProvider?.trim().toLowerCase() as ProviderName;
    const action = rawAction?.trim().toLowerCase();
    if (!provider || !(provider in PROVIDER_SPECS) || !action) continue;

    if (action === 'ok') {
      result[provider] = { mode: 'ok' };
    } else if (action === 'timeout') {
      result[provider] = { mode: 'timeout' };
    } else if (/^\d{3}$/.test(action)) {
      result[provider] = { mode: 'error', status: Number(action) };
    }
  }
  return result;
}

export function normalizePlainTextOutput(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\u0000/g, '')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

export function parseRetryAfterHeader(value: string | null): number | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    const seconds = Number(trimmed);
    return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : undefined;
  }

  const parsedDate = Date.parse(trimmed);
  if (!Number.isNaN(parsedDate)) {
    const delta = parsedDate - Date.now();
    return delta > 0 ? delta : 0;
  }

  return undefined;
}

function redactPossibleSecrets(text: string): string {
  return text
    .replace(/(sk-[a-zA-Z0-9_-]{8,})/g, '[REDACTED]')
    .replace(/(AIza[a-zA-Z0-9_-]{8,})/g, '[REDACTED]')
    .replace(/(gsk_[a-zA-Z0-9_-]{8,})/g, '[REDACTED]')
    .replace(/(Bearer\s+[a-zA-Z0-9._-]{8,})/gi, 'Bearer [REDACTED]');
}

export function classifyProviderHttpFailure(
  provider: ProviderName,
  status: number,
  rawBody: string,
  retryAfterMs?: number,
): ProviderError {
  const safeBody = redactPossibleSecrets(rawBody).slice(0, 300);
  const lower = safeBody.toLowerCase();

  // Kebijakan keamanan / moderasi konten -> FATAL_ERROR (jangan fallback)
  if (
    lower.includes('safety') ||
    lower.includes('content_filter') ||
    lower.includes('policy') ||
    lower.includes('prohibited') ||
    lower.includes('blocked') ||
    lower.includes('moderation') ||
    lower.includes('harm_category')
  ) {
    return new ProviderError({
      kind: 'FATAL_ERROR',
      provider,
      statusCode: status,
      retryable: false,
      reason: 'blocked_by_safety_policy',
      message: 'Permintaan tidak dapat diproses karena kebijakan keamanan konten.',
    });
  }

  // Error kuota / billing / insufficient credit (kadang dikirim sebagai 400/402/429) -> FALLBACK_ERROR
  if (
    status === 402 ||
    lower.includes('insufficient') ||
    lower.includes('credit balance') ||
    lower.includes('billing') ||
    lower.includes('quota') ||
    lower.includes('resource_exhausted') ||
    lower.includes('exceeded your current quota')
  ) {
    return new ProviderError({
      kind: 'FALLBACK_ERROR',
      provider,
      statusCode: status,
      retryable: status === 429,
      retryAfterMs,
      reason: status === 429 ? 'rate_limit_or_quota' : 'billing_or_insufficient_credit',
      message: `Provider ${provider} mencapai batas kuota atau kredit.`,
    });
  }

  // Autentikasi gagal / key salah / akses ditolak -> AUTH_ERROR (tandai rusak lalu lewati)
  if (
    status === 401 ||
    status === 403 ||
    lower.includes('invalid_api_key') ||
    lower.includes('api_key_invalid') ||
    lower.includes('incorrect api key') ||
    lower.includes('authentication_error') ||
    lower.includes('permission_denied')
  ) {
    return new ProviderError({
      kind: 'AUTH_ERROR',
      provider,
      statusCode: status,
      retryable: false,
      reason: `auth_error_${status}`,
      message: `Autentikasi provider ${provider} gagal (${status}).`,
    });
  }

  // 429 Rate Limit -> FALLBACK_ERROR (retryable)
  if (status === 429) {
    return new ProviderError({
      kind: 'FALLBACK_ERROR',
      provider,
      statusCode: 429,
      retryable: true,
      retryAfterMs,
      reason: 'http_429_rate_limit',
      message: `Provider ${provider} mengalami rate limit (429).`,
    });
  }

  // 500, 502, 503, 504 -> FALLBACK_ERROR (retryable)
  if (status === 500 || status === 502 || status === 503 || status === 504) {
    return new ProviderError({
      kind: 'FALLBACK_ERROR',
      provider,
      statusCode: status,
      retryable: true,
      retryAfterMs,
      reason: `http_${status}_server_error`,
      message: `Provider ${provider} mengembalikan status server ${status}.`,
    });
  }

  // 400 prompt tidak valid -> FATAL_ERROR (jangan fallback)
  if (status === 400 || status === 422) {
    return new ProviderError({
      kind: 'FATAL_ERROR',
      provider,
      statusCode: status,
      retryable: false,
      reason: `invalid_input_${status}`,
      message: 'Input permintaan tidak valid dan tidak dapat diproses oleh AI.',
    });
  }

  // 404 model tidak ditemukan -> tandai rusak/konfigurasi agar tidak menghentikan fallback
  if (status === 404) {
    return new ProviderError({
      kind: 'AUTH_ERROR',
      provider,
      statusCode: 404,
      retryable: false,
      reason: 'model_not_found_404',
      message: `Model pada provider ${provider} tidak ditemukan (404).`,
    });
  }

  return new ProviderError({
    kind: 'FALLBACK_ERROR',
    provider,
    statusCode: status,
    retryable: status >= 500,
    retryAfterMs,
    reason: `http_${status}`,
    message: `Provider ${provider} gagal merespons (${status}).`,
  });
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  provider: ProviderName,
  fetchFn: FetchLike,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetchFn(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof ProviderError) throw err;
    const isAbort =
      (err instanceof Error && err.name === 'AbortError') ||
      (err instanceof Error && err.message.toLowerCase().includes('timeout'));

    throw new ProviderError({
      kind: 'FALLBACK_ERROR',
      provider,
      statusCode: isAbort ? 504 : 502,
      retryable: true,
      reason: isAbort ? 'timeout_30s' : 'network_error',
      message: isAbort
        ? `Permintaan ke ${provider} melewati batas waktu 30 detik.`
        : `Gagal terhubung ke ${provider} karena kendala jaringan.`,
    });
  } finally {
    clearTimeout(timer);
  }
}

function normalizePromptInput(
  prompt: string | ProviderPromptPayload,
): ProviderPromptPayload {
  if (typeof prompt === 'string') {
    return {
      systemPrompt: '',
      prompt,
      maxOutputTokens: DEFAULT_MAX_OUTPUT_TOKENS,
      responseFormat: 'text',
    };
  }
  return {
    ...prompt,
    maxOutputTokens: prompt.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
    responseFormat: prompt.responseFormat ?? 'text',
  };
}

function resolveMockBehavior(
  provider: ProviderName,
  deps?: AdapterExecutionDeps,
): MockBehavior | undefined {
  if (deps?.mockRules && deps.mockRules[provider]) {
    return deps.mockRules[provider];
  }
  if (runtimeMockRules[provider]) {
    return runtimeMockRules[provider];
  }
  const envRules = parseMockEnvRules((deps?.env ?? process.env).AI_MOCK_PROVIDERS);
  return envRules[provider];
}

function executeMockBehavior(
  provider: ProviderName,
  model: string,
  payload: ProviderPromptPayload,
  mock: MockBehavior,
): RawProviderOutput {
  if (mock.mode === 'timeout') {
    throw new ProviderError({
      kind: 'FALLBACK_ERROR',
      provider,
      statusCode: 504,
      retryable: true,
      reason: 'mock_timeout',
      message: `Simulasi timeout pada ${provider}.`,
    });
  }

  if (mock.mode === 'error') {
    throw classifyProviderHttpFailure(
      provider,
      mock.status,
      mock.message || `Simulated HTTP ${mock.status}`,
      mock.retryAfterSeconds ? mock.retryAfterSeconds * 1000 : undefined,
    );
  }

  const text =
    mock.text ??
    (payload.responseFormat === 'json'
      ? JSON.stringify({
          judul: `Ringkasan Mock (${provider})`,
          intiPembahasan: `Hasil simulasi dari provider ${provider} (${model}).`,
          poinPenting: ['Poin simulasi pertama', 'Poin simulasi kedua'],
          kesimpulan: 'Simulasi fallback berjalan dengan baik.',
        })
      : `[Simulasi ${provider}/${model}] Jawaban bertahap untuk: ${payload.prompt.slice(0, 120)}`);

  return {
    text: normalizePlainTextOutput(text),
    sources: [],
    hasGrounding: false,
  };
}

/**
 * Adapter 1: Gemini (Google) - Resmi generateContent REST endpoint + header x-goog-api-key
 */
async function callGeminiAdapter(
  model: string,
  apiKey: string,
  payload: ProviderPromptPayload,
  timeoutMs: number,
  fetchFn: FetchLike,
): Promise<RawProviderOutput> {
  const spec = PROVIDER_SPECS.gemini;
  const endpoint = `${spec.baseUrl}/models/${encodeURIComponent(model)}:generateContent`;

  const contents = [
    ...(payload.history || []).map((turn) => ({
      role: turn.role,
      parts: [{ text: turn.text }],
    })),
    {
      role: 'user',
      parts: [{ text: payload.prompt }],
    },
  ];

  const generationConfig: Record<string, unknown> = {
    maxOutputTokens: payload.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
  };
  if (payload.responseFormat === 'json') {
    generationConfig.responseMimeType = 'application/json';
  }

  const body: Record<string, unknown> = {
    contents,
    generationConfig,
  };
  if (payload.systemPrompt.trim()) {
    body.systemInstruction = {
      parts: [{ text: payload.systemPrompt }],
    };
  }
  if (payload.useSearchGrounding) {
    body.tools = [{ googleSearch: {} }];
  }

  const res = await fetchWithTimeout(
    endpoint,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
        'User-Agent': 'aistudio-build',
      },
      body: JSON.stringify(body),
    },
    timeoutMs,
    'gemini',
    fetchFn,
  );

  const retryAfterMs = parseRetryAfterHeader(res.headers.get('retry-after'));
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw classifyProviderHttpFailure('gemini', res.status, errText, retryAfterMs);
  }

  const data = (await res.json()) as {
    promptFeedback?: { blockReason?: string };
    candidates?: Array<{
      finishReason?: string;
      content?: { parts?: Array<{ text?: string }> };
      groundingMetadata?: {
        groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>;
      };
    }>;
  };

  if (data.promptFeedback?.blockReason) {
    throw new ProviderError({
      kind: 'FATAL_ERROR',
      provider: 'gemini',
      statusCode: 400,
      retryable: false,
      reason: `safety_block_${data.promptFeedback.blockReason}`,
      message: 'Permintaan tidak dapat diproses karena kebijakan keamanan konten.',
    });
  }

  const candidate = data.candidates?.[0];
  if (candidate?.finishReason === 'SAFETY' || candidate?.finishReason === 'PROHIBITED_CONTENT') {
    throw new ProviderError({
      kind: 'FATAL_ERROR',
      provider: 'gemini',
      statusCode: 400,
      retryable: false,
      reason: `safety_finish_${candidate.finishReason}`,
      message: 'Jawaban dihentikan oleh kebijakan keamanan konten.',
    });
  }

  const partsText = (candidate?.content?.parts || [])
    .map((p) => p.text ?? '')
    .join('');
  const normalized = normalizePlainTextOutput(partsText);

  if (!normalized) {
    throw new ProviderError({
      kind: 'FALLBACK_ERROR',
      provider: 'gemini',
      statusCode: 502,
      retryable: true,
      reason: 'empty_response',
      message: 'Gemini mengembalikan jawaban kosong.',
    });
  }

  const sourcesMap = new Map<string, GroundingSource>();
  const gChunks = candidate?.groundingMetadata?.groundingChunks;
  if (Array.isArray(gChunks)) {
    for (const chunk of gChunks) {
      const url = chunk.web?.uri;
      const title = chunk.web?.title;
      if (url && title && !sourcesMap.has(url)) {
        sourcesMap.set(url, { title, url });
      }
    }
  }
  const sources = Array.from(sourcesMap.values());

  return {
    text: normalized,
    sources,
    hasGrounding: sources.length > 0,
  };
}

/**
 * Adapter 2: Claude (Anthropic) - Resmi Messages API, header x-api-key & anthropic-version, wajib max_tokens
 */
async function callAnthropicAdapter(
  model: string,
  apiKey: string,
  payload: ProviderPromptPayload,
  timeoutMs: number,
  fetchFn: FetchLike,
): Promise<RawProviderOutput> {
  const spec = PROVIDER_SPECS.anthropic;
  const endpoint = `${spec.baseUrl}/messages`;

  const messages = [
    ...(payload.history || []).map((turn) => ({
      role: turn.role === 'model' ? ('assistant' as const) : ('user' as const),
      content: turn.text,
    })),
    {
      role: 'user' as const,
      content: payload.prompt,
    },
  ];

  const body: Record<string, unknown> = {
    model,
    max_tokens: payload.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
    messages,
  };
  if (payload.systemPrompt.trim()) {
    body.system = payload.systemPrompt;
  }

  const res = await fetchWithTimeout(
    endpoint,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': spec.apiVersion || '2023-06-01',
      },
      body: JSON.stringify(body),
    },
    timeoutMs,
    'anthropic',
    fetchFn,
  );

  const retryAfterMs = parseRetryAfterHeader(res.headers.get('retry-after'));
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw classifyProviderHttpFailure('anthropic', res.status, errText, retryAfterMs);
  }

  const data = (await res.json()) as {
    content?: Array<{ type?: string; text?: string }>;
    stop_reason?: string;
  };

  const rawText = (data.content || [])
    .filter((block) => block.type === 'text' || typeof block.text === 'string')
    .map((block) => block.text ?? '')
    .join('');

  const normalized = normalizePlainTextOutput(rawText);
  if (!normalized) {
    throw new ProviderError({
      kind: 'FALLBACK_ERROR',
      provider: 'anthropic',
      statusCode: 502,
      retryable: true,
      reason: 'empty_response',
      message: 'Claude mengembalikan jawaban kosong.',
    });
  }

  return {
    text: normalized,
    sources: [],
    hasGrounding: false,
  };
}

/**
 * Adapter 3 (Generik): OpenAI, DeepSeek, Groq, Mistral, OpenRouter
 * Satu fungsi bersama menggunakan format Chat Completions yang kompatibel dengan OpenAI.
 */
async function callOpenAICompatibleAdapter(
  provider: 'openai' | 'deepseek' | 'groq' | 'mistral' | 'openrouter',
  model: string,
  apiKey: string,
  payload: ProviderPromptPayload,
  timeoutMs: number,
  fetchFn: FetchLike,
): Promise<RawProviderOutput> {
  const spec = PROVIDER_SPECS[provider];
  const endpoint = `${spec.baseUrl}/chat/completions`;

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
  if (payload.systemPrompt.trim()) {
    messages.push({ role: 'system', content: payload.systemPrompt });
  }
  for (const turn of payload.history || []) {
    messages.push({
      role: turn.role === 'model' ? 'assistant' : 'user',
      content: turn.text,
    });
  }
  messages.push({ role: 'user', content: payload.prompt });

  const maxTokens = payload.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS;
  const body: Record<string, unknown> = {
    model,
    messages,
  };

  // Pada OpenAI model seri gpt-5 / reasoning, gunakan max_completion_tokens agar tidak ditolak 400
  if (provider === 'openai' && /^(gpt-5|o\d)/i.test(model)) {
    body.max_completion_tokens = maxTokens;
    body.reasoning_effort = 'minimal';
  } else {
    body.max_tokens = maxTokens;
  }

  if (payload.responseFormat === 'json' && provider !== 'openrouter') {
    body.response_format = { type: 'json_object' };
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };
  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = process.env.APP_URL || 'https://edusmart.id';
    headers['X-Title'] = 'EduSmart AI';
  }

  const res = await fetchWithTimeout(
    endpoint,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    },
    timeoutMs,
    provider,
    fetchFn,
  );

  const retryAfterMs = parseRetryAfterHeader(res.headers.get('retry-after'));
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw classifyProviderHttpFailure(provider, res.status, errText, retryAfterMs);
  }

  const data = (await res.json()) as {
    choices?: Array<{
      finish_reason?: string;
      message?: {
        content?: string | Array<{ type?: string; text?: string }> | null;
      };
    }>;
  };

  const firstChoice = data.choices?.[0];
  if (firstChoice?.finish_reason === 'content_filter') {
    throw new ProviderError({
      kind: 'FATAL_ERROR',
      provider,
      statusCode: 400,
      retryable: false,
      reason: 'content_filter',
      message: 'Permintaan diblokir oleh kebijakan filter konten.',
    });
  }

  const rawContent = firstChoice?.message?.content;
  const extracted =
    typeof rawContent === 'string'
      ? rawContent
      : Array.isArray(rawContent)
        ? rawContent.map((part) => part.text ?? '').join('')
        : '';

  const normalized = normalizePlainTextOutput(extracted);
  if (!normalized) {
    throw new ProviderError({
      kind: 'FALLBACK_ERROR',
      provider,
      statusCode: 502,
      retryable: true,
      reason: 'empty_response',
      message: `Provider ${provider} mengembalikan jawaban kosong.`,
    });
  }

  return {
    text: normalized,
    sources: [],
    hasGrounding: false,
  };
}

/**
 * Fungsi seragam untuk memanggil provider AI tertentu dengan metadata hasil.
 */
export async function callProviderDetailed(
  providerName: ProviderName,
  prompt: string | ProviderPromptPayload,
  deps?: AdapterExecutionDeps,
): Promise<RawProviderOutput> {
  const env = deps?.env ?? process.env;
  const fetchFn = deps?.fetchFn ?? fetch;
  const timeoutMs = deps?.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const payload = normalizePromptInput(prompt);
  const model = getProviderModel(providerName, env);

  const mock = resolveMockBehavior(providerName, deps);
  if (mock) {
    return executeMockBehavior(providerName, model, payload, mock);
  }

  const apiKey = getProviderApiKey(providerName, env);
  if (!apiKey) {
    throw new ProviderError({
      kind: 'AUTH_ERROR',
      provider: providerName,
      statusCode: 401,
      retryable: false,
      reason: 'missing_api_key',
      message: `API key untuk ${providerName} belum dikonfigurasi.`,
    });
  }

  if (providerName === 'gemini') {
    return callGeminiAdapter(model, apiKey, payload, timeoutMs, fetchFn);
  }
  if (providerName === 'anthropic') {
    return callAnthropicAdapter(model, apiKey, payload, timeoutMs, fetchFn);
  }
  return callOpenAICompatibleAdapter(
    providerName,
    model,
    apiKey,
    payload,
    timeoutMs,
    fetchFn,
  );
}

/**
 * Fungsi seragam sesuai kontrak: callProvider(providerName, prompt) -> teks jawaban atau lempar ProviderError.
 */
export async function callProvider(
  providerName: ProviderName,
  prompt: string | ProviderPromptPayload,
  deps?: AdapterExecutionDeps,
): Promise<string> {
  const result = await callProviderDetailed(providerName, prompt, deps);
  return result.text;
}
