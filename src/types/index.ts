export const EDUCATION_LEVELS = ['SMP', 'SMA/SMK', 'Mahasiswa'] as const;
export type EducationLevel = (typeof EDUCATION_LEVELS)[number];

export const SUBJECTS = [
  'Umum',
  'Matematika',
  'Fisika',
  'Kimia',
  'Biologi',
  'Ekonomi',
  'Bahasa Indonesia',
  'Bahasa Inggris',
  'Informatika',
  'Lainnya',
] as const;
export type Subject = (typeof SUBJECTS)[number];

export const QUIZ_DIFFICULTIES = ['Mudah', 'Sedang', 'Sulit'] as const;
export type QuizDifficulty = (typeof QUIZ_DIFFICULTIES)[number];

export const QUIZ_COUNTS = [5, 10] as const;
export type QuizCount = (typeof QUIZ_COUNTS)[number];

export type UserPlan = 'gratis' | 'unlimited';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  defaultLevel: EducationLevel;
  credits: number;
  plan: UserPlan;
  planExpiresAt: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type CreditPackageId = 'topup_1000' | 'unlimited_yearly';
export type PaymentMethod = 'qris' | 'ewallet';
export type EWalletProvider = 'GoPay' | 'OVO' | 'DANA' | 'ShopeePay';

export interface GroundingSource {
  title: string;
  url: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  sources?: GroundingSource[];
  hasGrounding?: boolean;
  createdAt: number;
}

export interface ChatHistoryTurn {
  role: 'user' | 'model';
  text: string;
}

export interface ChatSessionDoc {
  id: string;
  uid: string;
  title: string;
  level: EducationLevel;
  subject: Subject;
  messages: ChatMessage[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface TutorRequest {
  message: string;
  level: EducationLevel;
  subject: Subject;
  history: ChatHistoryTurn[];
}

export interface SummaryOutput {
  judul: string;
  intiPembahasan: string;
  poinPenting: string[];
  kesimpulan: string;
}

export interface SummarizeRequest {
  text: string;
  level: EducationLevel;
}

export interface SummaryDoc {
  id: string;
  uid: string;
  level: EducationLevel;
  inputLength: number;
  sourcePreview: string;
  result: SummaryOutput;
  createdAt?: unknown;
}

export interface QuizQuestionPublic {
  id: number;
  pertanyaan: string;
  opsi: [string, string, string, string];
}

export interface QuizQuestionFull extends QuizQuestionPublic {
  indexJawabanBenar: number;
  pembahasan: string;
}

export interface QuizGenerateRequest {
  topic: string;
  difficulty: QuizDifficulty;
  count: QuizCount;
  level: EducationLevel;
}

export interface QuizGenerateResponse {
  quizId: string;
  topic: string;
  level: EducationLevel;
  difficulty: QuizDifficulty;
  questions: QuizQuestionPublic[];
}

export interface QuizSubmitRequest {
  quizId: string;
  answers: Array<number | null>;
}

export interface QuizEvaluationItem {
  id: number;
  pertanyaan: string;
  opsi: [string, string, string, string];
  userAnswer: number | null;
  correctAnswer: number;
  isCorrect: boolean;
  pembahasan: string;
}

export interface QuizEvaluationResult {
  quizId: string;
  topic: string;
  level: EducationLevel;
  difficulty: QuizDifficulty;
  score: number;
  correctCount: number;
  totalQuestions: number;
  items: QuizEvaluationItem[];
  completedAt: number;
}

export interface QuizResultDoc {
  id: string;
  uid: string;
  topic: string;
  level: EducationLevel;
  difficulty: QuizDifficulty;
  score: number;
  correctCount: number;
  totalQuestions: number;
  items: QuizEvaluationItem[];
  createdAt?: unknown;
}

export interface ApiHealthResponse {
  ok: boolean;
  apiConfigured: boolean;
  model: string;
  activeProvidersCount?: number;
}

export interface AdminProviderItem {
  provider: string;
  label: string;
  model: string;
  configured: boolean;
  status: 'aktif' | 'dilewati' | 'rusak' | 'tidak_dikonfigurasi';
  dailyRequests: number;
  dailySuccess: number;
  dailyFailures: number;
  consecutiveFailures: number;
  cooldownUntil: string | null;
  lastReason: string | null;
}

export interface AdminProviderLogEntry {
  id: string;
  timestamp: string;
  task: 'tutor' | 'summarize' | 'quiz';
  provider: string;
  outcome: 'success' | 'fallback' | 'auth_failed' | 'fatal';
  retries: number;
  fallbackReason?: string;
  durationMs: number;
}

export interface AdminProvidersSnapshot {
  dateKey: string;
  providers: AdminProviderItem[];
  cache: {
    entries: number;
    ttlHours: number;
    backend: string;
  };
  recentLogs: AdminProviderLogEntry[];
}

