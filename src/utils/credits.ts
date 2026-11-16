import type { QuizCount, QuizDifficulty, UserProfile } from '../types/index.ts';

export const INITIAL_USER_CREDITS = 100;
export const TUTOR_CREDIT_COST = 10;
export const SUMMARY_CREDIT_COST = 10;

export const QUIZ_CREDIT_COSTS: Record<QuizDifficulty, Record<QuizCount, number>> = {
  Mudah: {
    5: 30,
    10: 55,
  },
  Sedang: {
    5: 45,
    10: 75,
  },
  Sulit: {
    5: 60,
    10: 95,
  },
};

export interface CreditPackageOption {
  id: 'topup_1000' | 'unlimited_yearly';
  title: string;
  subtitle: string;
  priceIdr: number;
  priceLabel: string;
  creditGrant: number;
  badge: string;
  benefits: string[];
}

export const CREDIT_PACKAGES: CreditPackageOption[] = [
  {
    id: 'topup_1000',
    title: 'Paket 1.000 Kredit',
    subtitle: 'Sekali bayar · Kredit tidak hangus',
    priceIdr: 50000,
    priceLabel: 'Rp 50.000',
    creditGrant: 1000,
    badge: 'Populer',
    benefits: [
      'Tambah +1.000 kredit langsung ke akun',
      'Hingga 100x pertanyaan AI Tutor atau Rangkuman',
      'Bebas buat Kuis AI Mudah, Sedang, hingga Sulit',
      'Pembayaran instan via QRIS atau E-Wallet',
    ],
  },
  {
    id: 'unlimited_yearly',
    title: 'Langganan Unlimited 1 Tahun',
    subtitle: 'Akses penuh 365 hari tanpa batas kredit',
    priceIdr: 150000,
    priceLabel: 'Rp 150.000 / tahun',
    creditGrant: 0,
    badge: 'Hemat Maksimal',
    benefits: [
      'Unlimited AI Tutor untuk semua mata pelajaran',
      'Unlimited Rangkuman Materi hingga 12.000 karakter',
      'Unlimited Kuis AI tingkat Mudah, Sedang, & Sulit',
      'Aktif otomatis 1 tahun penuh di akun Anda',
    ],
  },
];

export function getQuizCreditCost(
  difficulty: QuizDifficulty,
  count: QuizCount,
): number {
  return QUIZ_CREDIT_COSTS[difficulty][count];
}

export function isUnlimitedActive(
  profile: Pick<UserProfile, 'plan' | 'planExpiresAt'> | null | undefined,
  nowMs = Date.now(),
): boolean {
  if (!profile) return false;
  return profile.plan === 'unlimited' && profile.planExpiresAt > nowMs;
}

export function canAffordCredit(
  profile: Pick<UserProfile, 'credits' | 'plan' | 'planExpiresAt'> | null | undefined,
  cost: number,
  nowMs = Date.now(),
): boolean {
  if (!profile) return false;
  if (isUnlimitedActive(profile, nowMs)) return true;
  return profile.credits >= cost;
}

export function computeDeductedCredits(
  currentCredits: number,
  cost: number,
): number {
  return Math.max(0, currentCredits - cost);
}
