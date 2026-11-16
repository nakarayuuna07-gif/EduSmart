import crypto from 'crypto';
import { getCacheStats } from '../cache.ts';
import {
  CIRCUIT_BREAKER_COOLDOWN_MS,
  CIRCUIT_BREAKER_THRESHOLD,
  getProviderApiKey,
  getProviderModel,
  PROVIDER_MAX_RETRIES,
  PROVIDER_ORDER,
  PROVIDER_SPECS,
  type ProviderName,
} from '../config.ts';
import {
  callProviderDetailed,
  parseMockEnvRules,
  type AdapterExecutionDeps,
} from './adapters.ts';
import {
  AllProvidersFailedError,
  NoProviderConfiguredError,
  ProviderError,
  type AiTaskType,
  type ProviderCallLogEntry,
  type ProviderMonitoringItem,
  type ProviderMonitoringSnapshot,
  type ProviderPromptPayload,
  type ProviderRuntimeStatus,
  type ProviderSuccessResult,
} from './types.ts';

interface ProviderState {
  consecutiveFailures: number;
  cooldownUntil: number;
  broken: boolean;
  lastReason: string | null;
  dailyRequests: number;
  dailySuccess: number;
  dailyFailures: number;
}

export interface OrchestratorDeps extends AdapterExecutionDeps {
  nowFn?: () => number;
  sleepFn?: (ms: number) => Promise<void>;
  jitterFn?: () => number;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getDateKey(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

export class AiFallbackOrchestrator {
  private states = new Map<ProviderName, ProviderState>();
  private recentLogs: ProviderCallLogEntry[] = [];
  private activeDateKey: string;
  private readonly nowFn: () => number;
  private readonly sleepFn: (ms: number) => Promise<void>;
  private readonly jitterFn: () => number;

  constructor(deps?: Pick<OrchestratorDeps, 'nowFn' | 'sleepFn' | 'jitterFn'>) {
    this.nowFn = deps?.nowFn ?? (() => Date.now());
    this.sleepFn = deps?.sleepFn ?? defaultSleep;
    this.jitterFn = deps?.jitterFn ?? (() => Math.random());
    this.activeDateKey = getDateKey(this.nowFn());
    this.initStates();
  }

  private initStates(): void {
    for (const provider of PROVIDER_ORDER) {
      this.states.set(provider, {
        consecutiveFailures: 0,
        cooldownUntil: 0,
        broken: false,
        lastReason: null,
        dailyRequests: 0,
        dailySuccess: 0,
        dailyFailures: 0,
      });
    }
  }

  private rollDailyCountersIfNeeded(now: number): void {
    const today = getDateKey(now);
    if (today !== this.activeDateKey) {
      this.activeDateKey = today;
      for (const state of this.states.values()) {
        state.dailyRequests = 0;
        state.dailySuccess = 0;
        state.dailyFailures = 0;
      }
    }
  }

  private pushLog(entry: ProviderCallLogEntry): void {
    this.recentLogs.unshift(entry);
    if (this.recentLogs.length > 50) {
      this.recentLogs.length = 50;
    }

    // Log aman tanpa API key dan tanpa data pribadi pengguna
    console.info(
      `[AI-ORCHESTRATOR] task=${entry.task} provider=${entry.provider} outcome=${entry.outcome} retries=${entry.retries} durationMs=${entry.durationMs}${
        entry.fallbackReason ? ` reason=${entry.fallbackReason}` : ''
      }`,
    );
  }

  reset(): void {
    this.activeDateKey = getDateKey(this.nowFn());
    this.recentLogs = [];
    this.initStates();
  }

  isProviderConfigured(
    provider: ProviderName,
    deps?: OrchestratorDeps,
  ): boolean {
    const env = deps?.env ?? process.env;
    if (getProviderApiKey(provider, env).length > 0) return true;
    if (deps?.mockRules && deps.mockRules[provider]) return true;
    const envMock = parseMockEnvRules(env.AI_MOCK_PROVIDERS);
    return Boolean(envMock[provider]);
  }

  hasAnyConfiguredProvider(deps?: OrchestratorDeps): boolean {
    return PROVIDER_ORDER.some((p) => this.isProviderConfigured(p, deps));
  }

  getProviderStatus(
    provider: ProviderName,
    deps?: OrchestratorDeps,
  ): ProviderRuntimeStatus {
    if (!this.isProviderConfigured(provider, deps)) {
      return 'tidak_dikonfigurasi';
    }
    const state = this.states.get(provider)!;
    if (state.broken) {
      return 'rusak';
    }
    if (state.cooldownUntil > this.nowFn()) {
      return 'dilewati';
    }
    return 'aktif';
  }

  getMonitoringSnapshot(deps?: OrchestratorDeps): ProviderMonitoringSnapshot {
    const now = this.nowFn();
    this.rollDailyCountersIfNeeded(now);
    const env = deps?.env ?? process.env;

    const providers: ProviderMonitoringItem[] = PROVIDER_ORDER.map((provider) => {
      const state = this.states.get(provider)!;
      const configured = this.isProviderConfigured(provider, deps);
      return {
        provider,
        label: PROVIDER_SPECS[provider].label,
        model: getProviderModel(provider, env),
        configured,
        status: this.getProviderStatus(provider, deps),
        dailyRequests: state.dailyRequests,
        dailySuccess: state.dailySuccess,
        dailyFailures: state.dailyFailures,
        consecutiveFailures: state.consecutiveFailures,
        cooldownUntil:
          state.cooldownUntil > now
            ? new Date(state.cooldownUntil).toISOString()
            : null,
        lastReason: state.lastReason,
      };
    });

    return {
      dateKey: this.activeDateKey,
      providers,
      cache: getCacheStats(),
      recentLogs: [...this.recentLogs],
    };
  }

  private computeRetryDelayMs(attemptIndex: number, retryAfterMs?: number): number {
    if (typeof retryAfterMs === 'number' && retryAfterMs > 0) {
      // Hormati Retry-After dari provider (dibatasi maks 15 dtk agar request 30 dtk tidak langsung habis)
      return Math.min(retryAfterMs, 15_000);
    }
    // Exponential backoff + jitter: ~1000ms lalu ~2000ms (±20%)
    const baseMs = attemptIndex === 0 ? 1000 : 2000;
    const jitterMultiplier = 0.8 + this.jitterFn() * 0.4;
    return Math.round(baseMs * jitterMultiplier);
  }

  async executeWithFallback(
    task: AiTaskType,
    payload: ProviderPromptPayload,
    deps?: OrchestratorDeps,
  ): Promise<ProviderSuccessResult> {
    const now = this.nowFn();
    this.rollDailyCountersIfNeeded(now);

    if (!this.hasAnyConfiguredProvider(deps)) {
      throw new NoProviderConfiguredError();
    }

    for (const provider of PROVIDER_ORDER) {
      if (!this.isProviderConfigured(provider, deps)) {
        continue;
      }

      const state = this.states.get(provider)!;
      if (state.broken) {
        continue;
      }

      const currentNow = this.nowFn();
      if (state.cooldownUntil > currentNow) {
        continue;
      }
      // Reset expired cooldown so provider can be probed again after 5 minutes
      if (state.cooldownUntil > 0 && state.cooldownUntil <= currentNow) {
        state.cooldownUntil = 0;
        state.consecutiveFailures = 0;
      }

      const providerStart = this.nowFn();
      let retriesUsed = 0;
      const maxAttempts = 1 + PROVIDER_MAX_RETRIES;

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        state.dailyRequests += 1;

        try {
          const result = await callProviderDetailed(provider, payload, deps);
          const durationMs = Math.max(0, this.nowFn() - providerStart);

          state.consecutiveFailures = 0;
          state.cooldownUntil = 0;
          state.lastReason = null;
          state.dailySuccess += 1;

          this.pushLog({
            id: crypto.randomUUID(),
            timestamp: new Date(this.nowFn()).toISOString(),
            task,
            provider,
            outcome: 'success',
            retries: retriesUsed,
            durationMs,
          });

          return {
            text: result.text,
            provider,
            model: getProviderModel(provider, deps?.env ?? process.env),
            sources: result.sources,
            hasGrounding: result.hasGrounding,
            retriesUsed,
            durationMs,
          };
        } catch (err) {
          const providerErr =
            err instanceof ProviderError
              ? err
              : new ProviderError({
                  kind: 'FALLBACK_ERROR',
                  provider,
                  retryable: true,
                  reason: 'unexpected_error',
                  message: err instanceof Error ? err.message : 'Error tidak dikenal',
                });

          state.dailyFailures += 1;
          state.lastReason = providerErr.reason;

          // FATAL_ERROR: input invalid / kebijakan keamanan -> HENTIKAN langsung tanpa fallback
          if (providerErr.kind === 'FATAL_ERROR') {
            this.pushLog({
              id: crypto.randomUUID(),
              timestamp: new Date(this.nowFn()).toISOString(),
              task,
              provider,
              outcome: 'fatal',
              retries: retriesUsed,
              fallbackReason: providerErr.reason,
              durationMs: Math.max(0, this.nowFn() - providerStart),
            });
            throw providerErr;
          }

          // AUTH_ERROR: 401/403 -> tandai provider "rusak" dan langsung pindah ke provider berikutnya
          if (providerErr.kind === 'AUTH_ERROR') {
            state.broken = true;
            this.pushLog({
              id: crypto.randomUUID(),
              timestamp: new Date(this.nowFn()).toISOString(),
              task,
              provider,
              outcome: 'auth_failed',
              retries: retriesUsed,
              fallbackReason: providerErr.reason,
              durationMs: Math.max(0, this.nowFn() - providerStart),
            });
            break;
          }

          // FALLBACK_ERROR: retry maksimal 2 kali khusus untuk 429 / 5xx / timeout
          const hasRetryLeft = providerErr.retryable && attempt < PROVIDER_MAX_RETRIES;
          if (hasRetryLeft) {
            const delayMs = this.computeRetryDelayMs(attempt, providerErr.retryAfterMs);
            retriesUsed += 1;
            await this.sleepFn(delayMs);
            continue;
          }

          // Habis jatah retry untuk provider ini -> catat kegagalan berturut-turut untuk circuit breaker
          state.consecutiveFailures += 1;
          if (state.consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
            state.cooldownUntil = this.nowFn() + CIRCUIT_BREAKER_COOLDOWN_MS;
          }

          this.pushLog({
            id: crypto.randomUUID(),
            timestamp: new Date(this.nowFn()).toISOString(),
            task,
            provider,
            outcome: 'fallback',
            retries: retriesUsed,
            fallbackReason: providerErr.reason,
            durationMs: Math.max(0, this.nowFn() - providerStart),
          });
          break;
        }
      }
    }

    throw new AllProvidersFailedError();
  }
}

export const aiOrchestrator = new AiFallbackOrchestrator();
