import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Coins,
  HelpCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { CreditGateBanner } from '../components/CreditGateBanner.tsx';
import { useAuth } from '../hooks/useAuth.tsx';
import { generateQuizApi, submitQuizApi } from '../services/apiService.ts';
import { saveQuizResultRecord } from '../services/firestoreService.ts';
import {
  EDUCATION_LEVELS,
  QUIZ_COUNTS,
  QUIZ_DIFFICULTIES,
  type EducationLevel,
  type QuizCount,
  type QuizDifficulty,
  type QuizEvaluationResult,
  type QuizGenerateResponse,
} from '../types/index.ts';
import { getQuizCreditCost } from '../utils/credits.ts';
import { QUIZ_TOPIC_MAX_CHARS, QUIZ_TOPIC_MIN_CHARS } from '../utils/validation.ts';

interface QuizPageProps {
  onQuizCompleted: (savedId: string, result: QuizEvaluationResult) => void;
  onNavigate: (path: string) => void;
}

export function QuizPage({ onQuizCompleted, onNavigate }: QuizPageProps) {
  const {
    user,
    profile,
    hasUnlimited,
    canAfford,
    consumeCredits,
    getIdToken,
  } = useAuth();
  const [topic, setTopic] = useState('');
  const [level, setLevel] = useState<EducationLevel>(
    profile?.defaultLevel || 'SMA/SMK',
  );
  const [difficulty, setDifficulty] = useState<QuizDifficulty>('Mudah');
  const [count, setCount] = useState<QuizCount>(5);

  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [quizSession, setQuizSession] = useState<QuizGenerateResponse | null>(
    null,
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Array<number | null>>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const levelInitRef = useRef(false);

  useEffect(() => {
    if (profile?.defaultLevel && !levelInitRef.current && !quizSession) {
      setLevel(profile.defaultLevel);
      levelInitRef.current = true;
    }
  }, [profile?.defaultLevel, quizSession]);

  const creditCost = getQuizCreditCost(difficulty, count);
  const affordable = canAfford(creditCost);

  const handleGenerate = async () => {
    setError('');
    const cleanTopic = topic.trim();
    if (cleanTopic.length < QUIZ_TOPIC_MIN_CHARS) {
      setError('Masukkan topik atau materi kuis minimal 3 karakter.');
      return;
    }
    if (cleanTopic.length > QUIZ_TOPIC_MAX_CHARS) {
      setError(
        `Topik/materi maksimal ${QUIZ_TOPIC_MAX_CHARS.toLocaleString('id-ID')} karakter.`,
      );
      return;
    }
    if (!canAfford(creditCost)) {
      setError(
        `Kredit tidak cukup untuk Kuis ${difficulty} (${count} soal). Butuh ${creditCost} kredit.`,
      );
      return;
    }
    if (generating) return;

    setGenerating(true);
    try {
      const token = await getIdToken();
      const generated = await generateQuizApi(token, {
        topic: cleanTopic,
        level,
        difficulty,
        count,
      });

      // Potong kredit HANYA setelah soal kuis valid berhasil dibuat
      try {
        await consumeCredits(creditCost);
      } catch {
        // Abaikan jika sinkronisasi kredit tertunda
      }

      setQuizSession(generated);
      setAnswers(new Array(generated.questions.length).fill(null));
      setCurrentIndex(0);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal membuat kuis.';
      const hasCreditNote = msg.toLowerCase().includes('kredit');
      setError(hasCreditNote ? msg : `${msg} Kredit Anda tidak berkurang.`);
    } finally {
      setGenerating(false);
    }
  };

  const handleSelectOption = (optionIndex: number) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[currentIndex] = optionIndex;
      return next;
    });
  };

  const handleSubmitQuiz = async () => {
    if (!quizSession || !user || submitting) return;
    setSubmitting(true);
    setError('');

    try {
      const token = await getIdToken();
      const evaluation = await submitQuizApi(token, {
        quizId: quizSession.quizId,
        answers,
      });

      const recordId = crypto.randomUUID();
      await saveQuizResultRecord(user.uid, recordId, {
        topic: evaluation.topic,
        level: evaluation.level,
        difficulty: evaluation.difficulty,
        score: evaluation.score,
        correctCount: evaluation.correctCount,
        totalQuestions: evaluation.totalQuestions,
        items: evaluation.items,
      });

      setConfirmOpen(false);
      onQuizCompleted(recordId, evaluation);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengirim jawaban kuis.');
      setConfirmOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  // Mode Konfigurasi Kuis
  if (!quizSession) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-navy">Kuis AI</h1>
            <p className="text-sm text-ink-muted">
              Latih pemahamanmu dengan soal pilihan ganda otomatis. Kunci jawaban disimpan aman di server hingga kuis selesai dikumpulkan.
            </p>
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-alt border border-border-soft text-xs font-semibold text-navy tabular-nums w-fit shrink-0">
            <Coins className="w-3.5 h-3.5 text-primary" />
            <span>{hasUnlimited ? 'Unlimited Aktif' : `Biaya: ${creditCost} Kredit`}</span>
          </span>
        </div>

        {!affordable && (
          <CreditGateBanner
            requiredCredits={creditCost}
            currentCredits={profile?.credits ?? 0}
            featureName={`membuat Kuis ${difficulty} (${count} soal)`}
            onUpgrade={() => onNavigate('/paket')}
          />
        )}

        <div className="bg-white border border-border-soft rounded-xl p-6 sm:p-8 shadow-sm space-y-5">
          {error && (
            <div
              role="alert"
              className="p-3.5 rounded-lg bg-surface-alt border border-primary flex items-center justify-between gap-3"
            >
              <div className="flex items-start gap-2 text-sm text-navy">
                <AlertCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
              {affordable && (
                <button
                  type="button"
                  disabled={generating}
                  onClick={() => void handleGenerate()}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Coba lagi</span>
                </button>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="quiz-topic" className="block text-sm font-medium text-ink">
                Topik atau Materi Kuis
              </label>
              <span className="text-xs text-ink-muted tabular-nums">
                {topic.trim().length.toLocaleString('id-ID')} /{' '}
                {QUIZ_TOPIC_MAX_CHARS.toLocaleString('id-ID')}
              </span>
            </div>
            <textarea
              id="quiz-topic"
              rows={4}
              value={topic}
              disabled={generating}
              onChange={(e) => {
                setTopic(e.target.value);
                if (error) setError('');
              }}
              placeholder="Contoh: Hukum Newton tentang gerak, atau tempel ringkasan materi bab..."
              className="w-full px-3.5 py-2.5 rounded-lg border border-border-soft text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary disabled:bg-surface-alt"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="quiz-level" className="block text-xs font-semibold text-ink-muted">
                Tingkat Pendidikan
              </label>
              <select
                id="quiz-level"
                value={level}
                disabled={generating}
                onChange={(e) => setLevel(e.target.value as EducationLevel)}
                className="w-full px-3 py-2.5 rounded-lg border border-border-soft bg-white text-sm font-medium text-navy focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {EDUCATION_LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <span className="block text-xs font-semibold text-ink-muted">
                Tingkat Kesulitan
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {QUIZ_DIFFICULTIES.map((diff) => (
                  <button
                    key={diff}
                    type="button"
                    disabled={generating}
                    onClick={() => setDifficulty(diff)}
                    className={`py-2 px-2 rounded-lg text-xs font-semibold border transition-colors ${
                      difficulty === diff
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white text-ink border-border-soft hover:bg-surface-alt'
                    }`}
                  >
                    {diff}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="block text-xs font-semibold text-ink-muted">
                Jumlah Soal
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {QUIZ_COUNTS.map((qty) => (
                  <button
                    key={qty}
                    type="button"
                    disabled={generating}
                    onClick={() => setCount(qty)}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold border tabular-nums transition-colors ${
                      count === qty
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white text-ink border-border-soft hover:bg-surface-alt'
                    }`}
                  >
                    {qty} Soal
                  </button>
                ))}
              </div>
            </div>
          </div>

          <p className="text-xs text-ink-muted">
            Tarif kredit: Mudah 5 soal = 30 kredit (maks. 3x dari 100 kredit awal), Sedang 5 soal = 45 kredit, Sulit 5 soal = 60 kredit.
          </p>

          {generating && (
            <div className="p-4 rounded-xl bg-surface-alt border border-border-soft space-y-2.5 animate-pulse">
              <div className="flex items-center gap-2 text-sm font-medium text-navy">
                <Loader2 className="w-4 h-4 text-primary animate-spin" />
                <span>Menyiapkan {count} soal {difficulty} untuk tingkat {level}...</span>
              </div>
              <div className="h-3 w-3/4 bg-primary-light rounded" />
              <div className="h-3 w-1/2 bg-primary-light rounded" />
            </div>
          )}

          <button
            type="button"
            disabled={generating || topic.trim().length < QUIZ_TOPIC_MIN_CHARS || !affordable}
            onClick={() => void handleGenerate()}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-primary hover:bg-primary-dark text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <HelpCircle className="w-4 h-4" />
            )}
            <span>
              {generating
                ? 'Membuat Soal...'
                : hasUnlimited
                  ? 'Mulai Kuis'
                  : `Mulai Kuis (${creditCost} Kredit)`}
            </span>
          </button>
        </div>
      </div>
    );
  }

  // Mode Pengerjaan Kuis Satu per Satu
  const total = quizSession.questions.length;
  const currentQuestion = quizSession.questions[currentIndex];
  const answeredCount = answers.filter((a) => a !== null).length;
  const unansweredCount = total - answeredCount;
  const progressPct = Math.round(((currentIndex + 1) / total) * 100);
  const optionLabels = ['A', 'B', 'C', 'D'] as const;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header Progress */}
      <div className="bg-white border border-border-soft rounded-xl p-5 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-primary">
              {quizSession.level} · {quizSession.difficulty}
            </p>
            <h1 className="text-lg font-bold text-navy line-clamp-1">
              {quizSession.topic}
            </h1>
          </div>
          <p className="text-sm font-semibold text-navy tabular-nums">
            Soal {currentIndex + 1} dari {total}
          </p>
        </div>

        <div className="w-full h-2.5 rounded-full bg-surface-alt overflow-hidden border border-border-soft">
          <div
            style={{ width: `${progressPct}%` }}
            className="h-full bg-primary transition-all duration-200"
          />
        </div>

        {/* Navigator Nomor Soal */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {quizSession.questions.map((q, idx) => {
            const isAnswered = answers[idx] !== null;
            const isCurrent = idx === currentIndex;
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                className={`w-9 h-9 rounded-lg text-xs font-semibold tabular-nums border transition-colors ${
                  isCurrent
                    ? 'bg-primary text-white border-primary'
                    : isAnswered
                      ? 'bg-primary-light text-navy border-primary/40'
                      : 'bg-white text-ink-muted border-border-soft hover:bg-surface-alt'
                }`}
                title={isAnswered ? `Soal ${idx + 1} (Sudah dijawab)` : `Soal ${idx + 1} (Belum dijawab)`}
              >
                {idx + 1}
              </button>
            );
          })}
          <span className="ml-auto text-xs text-ink-muted tabular-nums">
            Terjawab: {answeredCount}/{total}
          </span>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="p-3.5 rounded-lg bg-surface-alt border border-primary text-sm text-navy"
        >
          {error}
        </div>
      )}

      {/* Kartu Soal Aktif */}
      <div className="bg-white border border-border-soft rounded-xl p-6 sm:p-8 shadow-sm space-y-6">
        <h2 className="text-base sm:text-lg font-semibold text-navy leading-relaxed">
          {currentIndex + 1}. {currentQuestion.pertanyaan}
        </h2>

        <div className="space-y-3">
          {currentQuestion.opsi.map((optText, optIdx) => {
            const isSelected = answers[currentIndex] === optIdx;
            return (
              <button
                key={optIdx}
                type="button"
                onClick={() => handleSelectOption(optIdx)}
                className={`w-full text-left p-4 rounded-xl border transition-colors flex items-start gap-3 ${
                  isSelected
                    ? 'bg-surface-alt border-primary text-navy'
                    : 'bg-white border-border-soft text-ink hover:bg-surface-alt/60'
                }`}
              >
                <span
                  className={`w-7 h-7 rounded-md text-xs font-bold flex items-center justify-center shrink-0 ${
                    isSelected
                      ? 'bg-primary text-white'
                      : 'bg-surface-alt text-navy border border-border-soft'
                  }`}
                >
                  {optionLabels[optIdx]}
                </span>
                <span className="text-sm sm:text-[15px] leading-relaxed pt-0.5">
                  {optText}
                </span>
              </button>
            );
          })}
        </div>

        {/* Tombol Navigasi Soal */}
        <div className="pt-4 border-t border-border-soft flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-border-soft bg-white hover:bg-surface-alt text-sm font-semibold text-ink disabled:opacity-40"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Sebelumnya</span>
          </button>

          <div className="flex items-center gap-2.5">
            {currentIndex < total - 1 ? (
              <button
                type="button"
                onClick={() => setCurrentIndex((i) => Math.min(total - 1, i + 1))}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-primary hover:bg-primary-dark text-white text-sm font-semibold transition-colors"
              >
                <span>Berikutnya</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-primary hover:bg-primary-dark text-white text-sm font-semibold transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Selesai &amp; Nilai</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modal Konfirmasi Selesai */}
      {confirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-navy/40 flex items-center justify-center p-4"
        >
          <div className="w-full max-w-md bg-white border border-border-soft rounded-xl p-6 shadow-lg space-y-4">
            <h3 className="text-lg font-bold text-navy">
              Kumpulkan Jawaban Kuis?
            </h3>
            <p className="text-sm text-ink-muted leading-relaxed">
              {unansweredCount > 0
                ? `Masih ada ${unansweredCount} soal yang belum dijawab. Soal yang kosong akan dihitung salah. Yakin ingin menyelesaikan kuis sekarang?`
                : `Semua ${total} soal sudah dijawab. Kirim jawaban untuk melihat skor dan pembahasan lengkap.`}
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setConfirmOpen(false)}
                className="px-4 py-2 rounded-lg border border-border-soft bg-white hover:bg-surface-alt text-sm font-semibold text-ink"
              >
                Periksa Lagi
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleSubmitQuiz()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary-dark text-white text-sm font-semibold disabled:opacity-60"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{submitting ? 'Menilai...' : 'Ya, Selesai'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
