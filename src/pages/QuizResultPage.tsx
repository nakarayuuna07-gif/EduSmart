import { ArrowLeft, CheckCircle2, RotateCcw, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PageSkeleton } from '../components/LoadingSkeleton.tsx';
import { useAuth } from '../hooks/useAuth.tsx';
import { getQuizResultById } from '../services/firestoreService.ts';
import type { QuizEvaluationResult, QuizResultDoc } from '../types/index.ts';

interface QuizResultPageProps {
  resultId: string;
  cachedResult?: QuizEvaluationResult | null;
  onNavigate: (path: string) => void;
}

export function QuizResultPage({
  resultId,
  cachedResult,
  onNavigate,
}: QuizResultPageProps) {
  const { user } = useAuth();
  const [data, setData] = useState<QuizEvaluationResult | QuizResultDoc | null>(
    cachedResult || null,
  );
  const [loading, setLoading] = useState(!cachedResult);
  const [error, setError] = useState('');

  useEffect(() => {
    if (cachedResult) {
      setData(cachedResult);
      setLoading(false);
      return;
    }
    if (!user || !resultId) return;

    setLoading(true);
    getQuizResultById(user.uid, resultId)
      .then((doc) => {
        if (!doc) {
          setError('Hasil evaluasi kuis tidak ditemukan.');
        } else {
          setData(doc);
        }
      })
      .catch(() => {
        setError('Gagal memuat hasil evaluasi kuis.');
      })
      .finally(() => setLoading(false));
  }, [user, resultId, cachedResult]);

  if (loading) return <PageSkeleton />;

  if (error || !data) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center space-y-4">
        <p className="text-base font-semibold text-navy">
          {error || 'Data hasil kuis tidak tersedia.'}
        </p>
        <button
          type="button"
          onClick={() => onNavigate('/kuis')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Kuis AI</span>
        </button>
      </div>
    );
  }

  const wrongCount = data.totalQuestions - data.correctCount;
  const optionLabels = ['A', 'B', 'C', 'D'] as const;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onNavigate('/riwayat')}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary-dark"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Lihat Semua Riwayat</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('/kuis')}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary hover:bg-primary-dark text-white text-sm font-semibold transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Kerjakan Kuis Baru</span>
        </button>
      </div>

      {/* Ringkasan Skor */}
      <div className="bg-white border border-border-soft rounded-xl p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-primary">
            Hasil Evaluasi · {data.level} · {data.difficulty}
          </p>
          <h1 className="text-xl sm:text-2xl font-bold text-navy">{data.topic}</h1>
          <div className="flex flex-wrap items-center gap-4 pt-1 text-sm">
            <span className="inline-flex items-center gap-1.5 font-semibold text-green-700">
              <CheckCircle2 className="w-4 h-4" />
              <span className="tabular-nums">{data.correctCount} Benar</span>
            </span>
            <span className="inline-flex items-center gap-1.5 font-semibold text-red-700">
              <XCircle className="w-4 h-4" />
              <span className="tabular-nums">{wrongCount} Salah</span>
            </span>
            <span className="text-ink-muted tabular-nums">
              Total {data.totalQuestions} Soal
            </span>
          </div>
        </div>

        <div className="px-6 py-4 rounded-xl bg-surface-alt border border-border-soft text-center shrink-0">
          <p className="text-xs font-medium text-ink-muted">Skor Akhir</p>
          <p className="text-4xl font-bold text-primary tabular-nums">
            {data.score}
          </p>
          <p className="text-[11px] text-ink-muted">dari 100</p>
        </div>
      </div>

      {/* Daftar Pembahasan Tiap Soal (Hijau & Merah khusus halaman Hasil Evaluasi) */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-navy">Pembahasan Jawaban</h2>
        {data.items.map((item, idx) => (
          <div
            key={item.id}
            className="bg-white border border-border-soft rounded-xl p-5 sm:p-6 shadow-sm space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-sm sm:text-base font-semibold text-navy leading-relaxed">
                {idx + 1}. {item.pertanyaan}
              </h3>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold shrink-0 ${
                  item.isCorrect
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}
              >
                {item.isCorrect ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Benar</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-3.5 h-3.5" />
                    <span>{item.userAnswer === null ? 'Kosong' : 'Salah'}</span>
                  </>
                )}
              </span>
            </div>

            <div className="space-y-2">
              {item.opsi.map((optText, optIdx) => {
                const isCorrectOpt = optIdx === item.correctAnswer;
                const isUserOpt = optIdx === item.userAnswer;

                let styleClass =
                  'bg-white border-border-soft text-ink';
                if (isCorrectOpt) {
                  styleClass = 'bg-green-50 border-green-300 text-green-900 font-medium';
                } else if (isUserOpt && !item.isCorrect) {
                  styleClass = 'bg-red-50 border-red-300 text-red-900';
                }

                return (
                  <div
                    key={optIdx}
                    className={`p-3 rounded-lg border text-sm flex items-start justify-between gap-3 ${styleClass}`}
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="font-bold shrink-0">
                        {optionLabels[optIdx]}.
                      </span>
                      <span>{optText}</span>
                    </div>
                    {isCorrectOpt && (
                      <span className="text-xs font-semibold text-green-700 shrink-0">
                        Jawaban Benar
                      </span>
                    )}
                    {isUserOpt && !isCorrectOpt && (
                      <span className="text-xs font-semibold text-red-700 shrink-0">
                        Jawaban Anda
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="p-3.5 rounded-lg bg-surface-alt border border-border-soft space-y-1">
              <p className="text-xs font-semibold text-navy">Pembahasan</p>
              <p className="text-sm text-ink leading-relaxed">{item.pembahasan}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
