import type { ProviderName } from '../config.ts';
import type { ChatHistoryTurn, GroundingSource } from '../../src/types/index.ts';

export type ProviderErrorKind = 'FALLBACK_ERROR' | 'FATAL_ERROR' | 'AUTH_ERROR';

export type ProviderRuntimeStatus =
  | 'aktif'
  | 'dilewati'
  | 'rusak'
  | 'tidak_dikonfigurasi';

export type AiTaskType = 'tutor' | 'summarize' | 'quiz';

export interface ProviderPromptPayload {
  systemPrompt: string;
  prompt: string;
  history?: ChatHistoryTurn[];
  maxOutputTokens?: number;
  responseFormat?: 'text' | 'json';
  useSearchGrounding?: boolean;
}

export interface ProviderSuccessResult {
  text: string;
  provider: ProviderName;
  model: string;
  sources: GroundingSource[];
  hasGrounding: boolean;
  retriesUsed: number;
  durationMs: number;
}

export class ProviderError extends Error {
  readonly kind: ProviderErrorKind;
  readonly provider: ProviderName;
  readonly statusCode?: number;
  readonly retryable: boolean;
  readonly retryAfterMs?: number;
  readonly reason: string;

  constructor(params: {
    kind: ProviderErrorKind;
    provider: ProviderName;
    message: string;
    statusCode?: number;
    retryable?: boolean;
    retryAfterMs?: number;
    reason: string;
  }) {
    super(params.message);
    this.name = 'ProviderError';
    this.kind = params.kind;
    this.provider = params.provider;
    this.statusCode = params.statusCode;
    this.retryable = Boolean(params.retryable);
    this.retryAfterMs = params.retryAfterMs;
    this.reason = params.reason;
  }
}

export class AllProvidersFailedError extends Error {
  constructor(
    message = 'Server AI sedang penuh, coba lagi beberapa menit. Kredit kamu tidak berkurang.',
  ) {
    super(message);
    this.name = 'AllProvidersFailedError';
  }
}

export class NoProviderConfiguredError extends Error {
  constructor(
    message = 'API belum dikonfigurasi. Tambahkan minimal satu API key provider AI di Secrets.',
  ) {
    super(message);
    this.name = 'NoProviderConfiguredError';
  }
}

export interface ProviderCallLogEntry {
  id: string;
  timestamp: string;
  task: AiTaskType;
  provider: ProviderName;
  outcome: 'success' | 'fallback' | 'auth_failed' | 'fatal';
  retries: number;
  fallbackReason?: string;
  durationMs: number;
}

export interface ProviderMonitoringItem {
  provider: ProviderName;
  label: string;
  model: string;
  configured: boolean;
  status: ProviderRuntimeStatus;
  dailyRequests: number;
  dailySuccess: number;
  dailyFailures: number;
  consecutiveFailures: number;
  cooldownUntil: string | null;
  lastReason: string | null;
}

export interface ProviderMonitoringSnapshot {
  dateKey: string;
  providers: ProviderMonitoringItem[];
  cache: {
    entries: number;
    ttlHours: number;
    backend: string;
  };
  recentLogs: ProviderCallLogEntry[];
}
