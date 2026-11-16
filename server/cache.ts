import crypto from 'crypto';
import { CACHE_TTL_MS } from './config.ts';

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Antarmuka cache yang mudah ditukar ke Redis atau database di masa depan.
 * CATATAN: Implementasi default InMemoryCacheStore menyimpan cache di RAM proses Node.js,
 * sehingga seluruh entri cache akan hilang saat server restart.
 */
export interface CacheStore {
  get<T>(key: string): T | null;
  set<T>(key: string, value: T, ttlMs?: number): void;
  delete(key: string): void;
  clear(): void;
  size(): number;
}

export class InMemoryCacheStore implements CacheStore {
  private readonly store = new Map<string, CacheEntry<unknown>>();
  private readonly maxEntries: number;

  constructor(maxEntries = 1000) {
    this.maxEntries = maxEntries;
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs = CACHE_TTL_MS): void {
    if (this.store.size >= this.maxEntries && !this.store.has(key)) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey) this.store.delete(oldestKey);
    }
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  size(): number {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
    return this.store.size;
  }
}

let activeCacheStore: CacheStore = new InMemoryCacheStore(1000);

export function setCacheStore(store: CacheStore): void {
  activeCacheStore = store;
}

export function getCacheStore(): CacheStore {
  return activeCacheStore;
}

export function normalizeTextForCache(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function buildTutorCacheKey(params: {
  subject: string;
  level: string;
  question: string;
}): string {
  const normalizedPayload = {
    subject: normalizeTextForCache(params.subject),
    level: normalizeTextForCache(params.level),
    question: normalizeTextForCache(params.question),
  };
  return buildCacheKey('tutor', normalizedPayload);
}

export function buildCacheKey(namespace: string, payload: unknown): string {
  const serialized = JSON.stringify(payload);
  const digest = crypto.createHash('sha256').update(serialized).digest('hex');
  return `${namespace}:${digest}`;
}

export function getCached<T>(key: string): T | null {
  return activeCacheStore.get<T>(key);
}

export function setCached<T>(key: string, value: T, ttlMs = CACHE_TTL_MS): void {
  activeCacheStore.set<T>(key, value, ttlMs);
}

export function clearCache(): void {
  activeCacheStore.clear();
}

export function getCacheStats(): { entries: number; ttlHours: number; backend: string } {
  return {
    entries: activeCacheStore.size(),
    ttlHours: Math.round(CACHE_TTL_MS / (60 * 60 * 1000)),
    backend: 'InMemoryCacheStore (hilang saat server restart)',
  };
}
