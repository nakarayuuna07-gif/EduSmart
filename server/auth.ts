import type { NextFunction, Request, Response } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import {
  getFirebaseProjectId,
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_MS,
} from './config.ts';

export interface AuthenticatedUser {
  uid: string;
  email?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

const FIREBASE_JWKS = createRemoteJWKSet(
  new URL(
    'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com',
  ),
);

export async function verifyFirebaseIdToken(
  token: string,
): Promise<AuthenticatedUser> {
  const projectId = getFirebaseProjectId();
  if (!projectId) {
    throw new Error('Firebase projectId tidak ditemukan di konfigurasi server.');
  }

  const { payload } = await jwtVerify(token, FIREBASE_JWKS, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
  });

  if (!payload.sub || typeof payload.sub !== 'string' || payload.sub.length === 0) {
    throw new Error('Token tidak memiliki subject UID yang valid.');
  }

  return {
    uid: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : undefined,
  };
}

export async function requireFirebaseAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      code: 'UNAUTHORIZED',
      error: 'Sesi autentikasi tidak ditemukan. Silakan masuk terlebih dahulu.',
    });
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    res.status(401).json({
      code: 'UNAUTHORIZED',
      error: 'Token autentikasi kosong. Silakan masuk kembali.',
    });
    return;
  }

  try {
    req.user = await verifyFirebaseIdToken(token);
    next();
  } catch {
    res.status(401).json({
      code: 'UNAUTHORIZED',
      error: 'Token autentikasi tidak valid atau telah kedaluwarsa. Silakan masuk kembali.',
    });
  }
}

export class UserRateLimiter {
  private readonly store = new Map<string, number[]>();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(
    maxRequests = RATE_LIMIT_MAX_REQUESTS,
    windowMs = RATE_LIMIT_WINDOW_MS,
  ) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  checkAndConsume(userKey: string, now = Date.now()): {
    allowed: boolean;
    remaining: number;
  } {
    const windowStart = now - this.windowMs;
    const recent = (this.store.get(userKey) || []).filter((ts) => ts > windowStart);

    if (recent.length >= this.maxRequests) {
      this.store.set(userKey, recent);
      return { allowed: false, remaining: 0 };
    }

    recent.push(now);
    this.store.set(userKey, recent);
    return {
      allowed: true,
      remaining: Math.max(0, this.maxRequests - recent.length),
    };
  }

  reset(userKey?: string): void {
    if (userKey) {
      this.store.delete(userKey);
    } else {
      this.store.clear();
    }
  }
}

export const defaultUserRateLimiter = new UserRateLimiter(
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_MS,
);

export function userRateLimiter(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  const uid = req.user?.uid || req.ip || 'anonymous';
  const result = defaultUserRateLimiter.checkAndConsume(uid);

  if (!result.allowed) {
    res.status(429).json({
      code: 'RATE_LIMITED',
      error: 'Terlalu cepat, tunggu sebentar lalu coba lagi.',
    });
    return;
  }

  next();
}
