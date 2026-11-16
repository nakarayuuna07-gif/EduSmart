export type ApiErrorCode =
  | 'API_NOT_CONFIGURED'
  | 'API_KEY_INVALID'
  | 'QUOTA_EXCEEDED'
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'EMPTY_RESPONSE'
  | 'RATE_LIMITED'
  | 'VALIDATION_ERROR'
  | 'INVALID_AI_FORMAT'
  | 'CONTENT_BLOCKED'
  | 'ALL_PROVIDERS_FAILED'
  | 'UNAUTHORIZED'
  | 'INTERNAL_ERROR';

export interface ClassifiedApiError {
  status: number;
  code: ApiErrorCode;
  message: string;
}

export const ALL_PROVIDERS_FAILED_MESSAGE =
  'Server AI sedang penuh, coba lagi beberapa menit. Kredit kamu tidak berkurang.';

export class TimeoutError extends Error {
  constructor(message = 'Waktu permintaan habis (30 detik). Silakan coba lagi.') {
    super(message);
    this.name = 'TimeoutError';
  }
}

export class EmptyAiResponseError extends Error {
  constructor(message = 'AI tidak memberi jawaban, coba ulang.') {
    super(message);
    this.name = 'EmptyAiResponseError';
  }
}

export function classifyAiError(err: unknown): ClassifiedApiError {
  if (err instanceof TimeoutError) {
    return {
      status: 504,
      code: 'TIMEOUT',
      message: err.message,
    };
  }

  if (err instanceof EmptyAiResponseError) {
    return {
      status: 502,
      code: 'EMPTY_RESPONSE',
      message: err.message,
    };
  }

  const rawMessage =
    err instanceof Error ? err.message : typeof err === 'string' ? err : JSON.stringify(err);
  const lower = rawMessage.toLowerCase();

  if (
    lower.includes('api_key_invalid') ||
    lower.includes('api key not valid') ||
    lower.includes('invalid api key') ||
    lower.includes('permission_denied') ||
    lower.includes('status: 403') ||
    (lower.includes('401') && lower.includes('key'))
  ) {
    return {
      status: 502,
      code: 'API_KEY_INVALID',
      message: 'API key layanan AI tidak valid atau ditolak.',
    };
  }

  if (
    lower.includes('resource_exhausted') ||
    lower.includes('quota') ||
    lower.includes('429')
  ) {
    return {
      status: 429,
      code: 'QUOTA_EXCEEDED',
      message: 'Kuota API sedang habis atau batas laju tercapai. Silakan coba beberapa saat lagi.',
    };
  }

  if (
    lower.includes('timeout') ||
    lower.includes('aborted') ||
    lower.includes('etimedout') ||
    lower.includes('deadline_exceeded')
  ) {
    return {
      status: 504,
      code: 'TIMEOUT',
      message: 'Permintaan ke layanan AI melebihi batas waktu 30 detik. Silakan coba lagi.',
    };
  }

  if (
    lower.includes('fetch failed') ||
    lower.includes('econnreset') ||
    lower.includes('enotfound') ||
    lower.includes('network') ||
    lower.includes('socket hang up')
  ) {
    return {
      status: 502,
      code: 'NETWORK_ERROR',
      message: 'Gagal terhubung ke layanan AI karena kendala jaringan. Coba lagi sebentar lagi.',
    };
  }

  if (lower.includes('not_found') || lower.includes('404')) {
    return {
      status: 502,
      code: 'INTERNAL_ERROR',
      message: 'Model AI yang dikonfigurasi tidak tersedia.',
    };
  }

  return {
    status: 500,
    code: 'INTERNAL_ERROR',
    message: ALL_PROVIDERS_FAILED_MESSAGE,
  };
}
