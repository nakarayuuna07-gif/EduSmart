import {
  AlertCircle,
  Check,
  CheckCircle2,
  Coins,
  Copy,
  FileText,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { CreditGateBanner } from '../components/CreditGateBanner.tsx';
import { SummarySkeleton } from '../components/LoadingSkeleton.tsx';
import { useAuth } from '../hooks/useAuth.tsx';
import { streamSummarizeApi } from '../services/apiService.ts';
import { saveSummaryRecord } from '../services/firestoreService.ts';
import {
  EDUCATION_LEVELS,
  type EducationLevel,
  type SummaryOutput,
} from '../types/index.ts';
import { SUMMARY_CREDIT_COST } from '../utils/credits.ts';
import { formatSummaryAsPlainText } from '../utils/quizUtils.ts';
import {
  sanitizeMaterialText,
  SUMMARY_MAX_CHARS,
  SUMMARY_MIN_CHARS,
} from '../utils/validation.ts';

interface SummarizePageProps {
  onNavigate: (path: string) => void;
}

export function SummarizePage({ onNavigate }: SummarizePageProps) {
  const {
    user,
    profile,
    hasUnlimited,
    canAfford,
    consumeCredits,
    getIdToken,
  } = useAuth();
  const [text, setText] = useState('');
  const [level, setLevel] = useState<EducationLevel>(
    profile?.defaultLevel || 'SMA/SMK',
  );
  const [loading, setLoading] = useState(false);
  const [receivedChars, setReceivedChars] = useState<number | null>(null);
  const [partialSummary, setPartialSummary] =
    useState<Partial<SummaryOutput> | null>(null);
  const [finalSummary, setFinalSummary] = useState<SummaryOutput | null>(null);
  const [error, setError] = useState('');
  const [copiedToast, setCopiedToast] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const levelInitRef = useRef(false);

  useEffect(() => {
    if (profile?.defaultLevel && !levelInitRef.current) {
      setLevel(profile.defaultLevel);
      levelInitRef.current = true;
    }
  }, [profile?.defaultLevel]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const cleanText = sanitizeMaterialText(text);
  const trimmedLength = cleanText.length;
  const isEmpty = trimmedLength === 0;
  const isTooShort = trimmedLength > 0 && trimmedLength < SUMMARY_MIN_CHARS;
  const isTooLong = trimmedLength > SUMMARY_MAX_CHARS;
  const affordable = canAfford(SUMMARY_CREDIT_COST);

  const handleSummarize = async () => {
    setError('');
    if (isEmpty) {
      setError('Masukkan teks materi terlebih dahulu sebelum membuat rangkuman.');
      return;
    }
    if (isTooShort) {
      setError(
        `Materi terlalu pendek (${trimmedLength} karakter). Masukkan minimal ${SUMMARY_MIN_CHARS} karakter agar rangkuman akurat.`,
      );
      return;
    }
    if (isTooLong) {
      setError(
        `Materi melebihi batas ${SUMMARY_MAX_CHARS.toLocaleString('id-ID')} karakter (saat ini ${trimmedLength.toLocaleString('id-ID')} karakter). Silakan potong materi menjadi beberapa bagian terlebih dahulu.`,
      );
      return;
    }
    if (!canAfford(SUMMARY_CREDIT_COST)) {
      setError(
        `Kredit tidak cukup (butuh ${SUMMARY_CREDIT_COST} kredit). Silakan isi kredit atau aktifkan Langganan Unlimited.`,
      );
      return;
    }
    if (loading || !user) return;

    setLoading(true);
    setReceivedChars(null);
    setPartialSummary(null);
    setFinalSummary(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const token = await getIdToken();
      await streamSummarizeApi(
        token,
        { text: cleanText, level },
        {
          onReceived: (charCount) => {
            setReceivedChars(charCount);
          },
          onPartial: (partial) => {
            setPartialSummary(partial);
          },
          onDone: async (summary) => {
            setFinalSummary(summary);
            setPartialSummary(null);
            setLoading(false);

            // Potong kredit HANYA setelah rangkuman selesai dan valid
            try {
              await consumeCredits(SUMMARY_CREDIT_COST);
            } catch {
              // Abaikan jika sinkronisasi kredit tertunda
            }

            try {
              await saveSummaryRecord(user.uid, crypto.randomUUID(), {
                level,
                inputLength: cleanText.length,
                sourceText: cleanText,
                result: summary,
              });
            } catch {
              setError('Rangkuman selesai, namun gagal disimpan ke riwayat cloud.');
            }
          },
          onError: (msg) => {
            const hasCreditNote = msg.toLowerCase().includes('kredit');
            setError(hasCreditNote ? msg : `${msg} Kredit Anda tidak berkurang.`);
            setLoading(false);
          },
        },
        controller.signal,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? `${err.message} Kredit Anda tidak berkurang.`
          : 'Terjadi kesalahan saat merangkum materi. Kredit Anda tidak berkurang.',
      );
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!finalSummary) return;
    const plain = formatSummaryAsPlainText(finalSummary);
    try {
      await navigator.clipboard.writeText(plain);
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2500);
    } catch {
      setError('Gagal menyalin ke clipboard browser.');
    }
  };

  const activeOutput: Partial<SummaryOutput> | null = finalSummary || partialSummary;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-navy">
            Rangkuman Materi
          </h1>
          <p className="text-sm text-ink-muted">
            Tempel catatan pelajaran, materi dosen, atau teks PDF/Word. Rangkuman disusun murni dari materi yang Anda berikan.
          </p>
        </div>

        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-alt border border-border-soft text-xs font-semibold text-navy tabular-nums w-fit shrink-0">
          <Coins className="w-3.5 h-3.5 text-primary" />
          <span>{hasUnlimited ? 'Unlimited Aktif' : `Biaya: ${SUMMARY_CREDIT_COST} Kredit`}</span>
        </span>
      </div>

      {!affordable && (
        <CreditGateBanner
          requiredCredits={SUMMARY_CREDIT_COST}
          currentCredits={profile?.credits ?? 0}
          featureName="membuat Rangkuman Materi"
          onUpgrade={() => onNavigate('/paket')}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Panel Input */}
        <div className="lg:col-span-6 bg-white border border-border-soft rounded-xl p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <label
                htmlFor="summary-level"
                className="block text-xs font-semibold text-ink-muted"
              >
                Tingkat Pendidikan
              </label>
              <select
                id="summary-level"
                value={level}
                disabled={loading}
                onChange={(e) => setLevel(e.target.value as EducationLevel)}
                className="px-3 py-2 rounded-lg border border-border-soft bg-white text-sm font-medium text-navy focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {EDUCATION_LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </select>
            </div>

            <div className="text-right">
              <p className="text-xs font-medium text-ink-muted">Panjang Teks</p>
              <p
                className={`text-sm font-semibold tabular-nums ${
                  isTooLong ? 'text-primary' : 'text-navy'
                }`}
              >
                {trimmedLength.toLocaleString('id-ID')} /{' '}
                {SUMMARY_MAX_CHARS.toLocaleString('id-ID')} karakter
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="summary-input" className="block text-sm font-medium text-ink">
              Teks Materi (minimal {SUMMARY_MIN_CHARS} karakter)
            </label>
            <textarea
              id="summary-input"
              rows={12}
              value={text}
              disabled={loading}
              onChange={(e) => {
                setText(e.target.value);
                if (error) setError('');
              }}
              placeholder="Tempel teks materi dari dosen, modul kuliah, atau catatan pelajaran di sini..."
              className="w-full px-3.5 py-3 rounded-lg border border-border-soft text-sm text-ink leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary disabled:bg-surface-alt"
            />
          </div>

          {isTooShort && (
            <p className="text-xs text-ink-muted">
              Tambahkan {SUMMARY_MIN_CHARS - trimmedLength} karakter lagi untuk memulai rangkuman.
            </p>
          )}

          {isTooLong && (
            <div className="p-3 rounded-lg bg-surface-alt border border-primary text-xs sm:text-sm text-navy">
              Materi terlalu panjang ({trimmedLength.toLocaleString('id-ID')} karakter). Batas maksimal adalah {SUMMARY_MAX_CHARS.toLocaleString('id-ID')} karakter—potong sebagian teks agar proses cepat dan akurat.
            </div>
          )}

          <button
            type="button"
            disabled={loading || isEmpty || isTooShort || isTooLong || !affordable}
            onClick={() => void handleSummarize()}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-primary hover:bg-primary-dark text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileText className="w-4 h-4" />
            )}
            <span>
              {loading
                ? 'Sedang Merangkum...'
                : hasUnlimited
                  ? 'Buat Rangkuman'
                  : `Buat Rangkuman (${SUMMARY_CREDIT_COST} Kredit)`}
            </span>
          </button>
        </div>

        {/* Panel Output */}
        <div className="lg:col-span-6 space-y-4">
          {receivedChars !== null && (
            <div className="px-4 py-2.5 rounded-lg bg-surface-alt border border-primary-light text-xs sm:text-sm text-navy flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
              <span className="tabular-nums font-medium">
                Materi diterima: {receivedChars.toLocaleString('id-ID')} karakter
              </span>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="p-4 rounded-xl bg-surface-alt border border-primary flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex items-start gap-2.5 text-sm text-navy">
                <AlertCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
              {affordable && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void handleSummarize()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary hover:bg-primary-dark text-white text-xs font-semibold shrink-0 self-start sm:self-auto"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Coba lagi</span>
                </button>
              )}
            </div>
          )}

          {loading && !activeOutput?.judul && <SummarySkeleton />}

          {activeOutput && (activeOutput.judul || activeOutput.intiPembahasan) && (
            <div className="bg-white border border-border-soft rounded-xl p-6 shadow-sm space-y-5">
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-border-soft">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-primary">
                    Rangkuman · Tingkat {level}
                  </p>
                  <h2 className="text-xl font-bold text-navy">
                    {activeOutput.judul || 'Menyusun judul...'}
                  </h2>
                </div>

                {finalSummary && (
                  <button
                    type="button"
                    onClick={() => void handleCopy()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-soft bg-white hover:bg-surface-alt text-xs font-semibold text-ink transition-colors shrink-0 whitespace-nowrap"
                  >
                    {copiedToast ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-primary" />
                        <span className="text-primary">Tersalin</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-primary" />
                        <span>Salin Hasil</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              <div className="space-y-1.5">
                <h3 className="text-sm font-semibold text-navy">Inti Pembahasan</h3>
                <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap">
                  {activeOutput.intiPembahasan || 'Menyusun inti pembahasan...'}
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-navy">Poin Penting</h3>
                {activeOutput.poinPenting && activeOutput.poinPenting.length > 0 ? (
                  <ul className="list-disc pl-5 space-y-1.5 text-sm text-ink leading-relaxed">
                    {activeOutput.poinPenting.map((poin, idx) => (
                      <li key={idx}>{poin}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-ink-muted">Menyusun poin-poin penting...</p>
                )}
              </div>

              <div className="p-4 rounded-lg bg-surface-alt border border-border-soft space-y-1.5">
                <h3 className="text-sm font-semibold text-navy">Kesimpulan</h3>
                <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap">
                  {activeOutput.kesimpulan || 'Menyusun kesimpulan...'}
                </p>
              </div>
            </div>
          )}

          {!loading && !activeOutput && !error && (
            <div className="bg-surface-alt border border-border-soft rounded-xl p-8 text-center space-y-2">
              <FileText className="w-8 h-8 text-primary mx-auto" />
              <h2 className="text-base font-semibold text-navy">
                Hasil Rangkuman Akan Tampil di Sini
              </h2>
              <p className="text-sm text-ink-muted max-w-md mx-auto">
                Output selalu dibagi menjadi 4 bagian rapi: Judul, Inti Pembahasan, Poin Penting, dan Kesimpulan.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
