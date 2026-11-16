import {
  ArrowRight,
  FileText,
  HelpCircle,
  MessageSquare,
  Search,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { PageSkeleton } from '../components/LoadingSkeleton.tsx';
import { useAuth } from '../hooks/useAuth.tsx';
import {
  deleteChatSession,
  deleteQuizResultRecord,
  deleteSummaryRecord,
  formatFirestoreDate,
  subscribeChats,
  subscribeQuizResults,
  subscribeSummaries,
} from '../services/firestoreService.ts';
import type {
  ChatSessionDoc,
  QuizResultDoc,
  SummaryDoc,
} from '../types/index.ts';

interface HistoryPageProps {
  onNavigate: (path: string) => void;
}

type HistoryFilter = 'semua' | 'chat' | 'rangkuman' | 'kuis';

interface UnifiedHistoryItem {
  id: string;
  rawId: string;
  type: Exclude<HistoryFilter, 'semua'>;
  title: string;
  subtitle: string;
  dateLabel: string;
  sortMs: number;
  summaryDoc?: SummaryDoc;
}

function extractMs(ts: unknown): number {
  if (ts && typeof ts === 'object' && 'toMillis' in ts) {
    return (ts as { toMillis: () => number }).toMillis();
  }
  if (ts && typeof ts === 'object' && 'seconds' in ts) {
    return Number((ts as { seconds: number }).seconds) * 1000;
  }
  return 0;
}

export function HistoryPage({ onNavigate }: HistoryPageProps) {
  const { user } = useAuth();
  const [chats, setChats] = useState<ChatSessionDoc[]>([]);
  const [summaries, setSummaries] = useState<SummaryDoc[]>([]);
  const [quizzes, setQuizzes] = useState<QuizResultDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<HistoryFilter>('semua');
  const [search, setSearch] = useState('');
  const [selectedSummary, setSelectedSummary] = useState<SummaryDoc | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    let settled = 0;
    const done = () => {
      settled += 1;
      if (settled >= 3) setLoading(false);
    };

    const unsub1 = subscribeChats(
      user.uid,
      (data) => {
        setChats(data);
        done();
      },
      () => done(),
    );
    const unsub2 = subscribeSummaries(
      user.uid,
      (data) => {
        setSummaries(data);
        done();
      },
      () => done(),
    );
    const unsub3 = subscribeQuizResults(
      user.uid,
      (data) => {
        setQuizzes(data);
        done();
      },
      () => done(),
    );

    return () => {
      unsub1();
      unsub2();
      unsub3();
    };
  }, [user]);

  const unifiedItems = useMemo<UnifiedHistoryItem[]>(() => {
    const items: UnifiedHistoryItem[] = [
      ...chats.map((c) => ({
        id: `chat-${c.id}`,
        rawId: c.id,
        type: 'chat' as const,
        title: c.title,
        subtitle: `AI Tutor · ${c.subject} · ${c.level} · ${c.messages.length} pesan`,
        dateLabel: formatFirestoreDate(c.updatedAt),
        sortMs: extractMs(c.updatedAt) || extractMs(c.createdAt),
      })),
      ...summaries.map((s) => ({
        id: `sum-${s.id}`,
        rawId: s.id,
        type: 'rangkuman' as const,
        title: s.result.judul,
        subtitle: `Rangkuman · ${s.level} · ${s.inputLength.toLocaleString('id-ID')} karakter`,
        dateLabel: formatFirestoreDate(s.createdAt),
        sortMs: extractMs(s.createdAt),
        summaryDoc: s,
      })),
      ...quizzes.map((q) => ({
        id: `quiz-${q.id}`,
        rawId: q.id,
        type: 'kuis' as const,
        title: q.topic,
        subtitle: `Kuis AI · Skor ${q.score}/100 · ${q.correctCount}/${q.totalQuestions} benar · ${q.difficulty}`,
        dateLabel: formatFirestoreDate(q.createdAt),
        sortMs: extractMs(q.createdAt),
      })),
    ];

    return items
      .filter((item) => filter === 'semua' || item.type === filter)
      .filter((item) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
          item.title.toLowerCase().includes(q) ||
          item.subtitle.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.sortMs - a.sortMs);
  }, [chats, summaries, quizzes, filter, search]);

  const handleOpenItem = (item: UnifiedHistoryItem) => {
    if (item.type === 'chat') {
      onNavigate(`/tutor?chatId=${item.rawId}`);
    } else if (item.type === 'kuis') {
      onNavigate(`/hasil/${item.rawId}`);
    } else if (item.summaryDoc) {
      setSelectedSummary(item.summaryDoc);
    }
  };

  const handleDeleteItem = async (item: UnifiedHistoryItem) => {
    if (!user) return;
    setError('');
    try {
      if (item.type === 'chat') {
        await deleteChatSession(user.uid, item.rawId);
      } else if (item.type === 'rangkuman') {
        await deleteSummaryRecord(user.uid, item.rawId);
        if (selectedSummary?.id === item.rawId) {
          setSelectedSummary(null);
        }
      } else {
        await deleteQuizResultRecord(user.uid, item.rawId);
      }
    } catch {
      setError('Gagal menghapus item riwayat.');
    }
  };

  if (loading) return <PageSkeleton />;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold text-navy">
          Riwayat Belajar
        </h1>
        <p className="text-sm text-ink-muted">
          Gabungan seluruh sesi AI Tutor, rangkuman materi, dan hasil kuis milik akun Anda secara real-time.
        </p>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg bg-surface-alt border border-primary text-sm text-navy">
          {error}
        </div>
      )}

      {/* Filter & Pencarian */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-surface-alt border border-border-soft w-fit">
          {(
            [
              { id: 'semua', label: 'Semua' },
              { id: 'chat', label: 'AI Tutor' },
              { id: 'rangkuman', label: 'Rangkuman' },
              { id: 'kuis', label: 'Kuis AI' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                filter === tab.id
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari topik atau judul..."
            className="w-full pl-9 pr-3.5 py-2 rounded-lg border border-border-soft bg-white text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {/* Daftar Riwayat */}
      {unifiedItems.length === 0 ? (
        <div className="bg-surface-alt border border-border-soft rounded-xl p-10 text-center space-y-3">
          <p className="text-base font-semibold text-navy">
            Belum ada riwayat yang cocok
          </p>
          <p className="text-sm text-ink-muted max-w-md mx-auto">
            Mulai gunakan AI Tutor, Rangkuman Materi, atau Kuis AI untuk mengisi riwayat belajar Anda.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-border-soft rounded-xl divide-y divide-border-soft shadow-sm">
          {unifiedItems.map((item) => {
            const Icon =
              item.type === 'chat'
                ? MessageSquare
                : item.type === 'rangkuman'
                  ? FileText
                  : HelpCircle;

            return (
              <div
                key={item.id}
                className="p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-surface-alt/40 transition-colors"
              >
                <button
                  type="button"
                  onClick={() => handleOpenItem(item)}
                  className="flex items-start gap-3.5 flex-1 min-w-0 text-left"
                >
                  <span className="w-9 h-9 rounded-lg bg-primary-light text-primary flex items-center justify-center shrink-0 mt-0.5">
                    <Icon className="w-4 h-4" />
                  </span>
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-sm sm:text-base font-semibold text-navy truncate">
                      {item.title}
                    </p>
                    <p className="text-xs text-ink-muted truncate">
                      {item.subtitle} · {item.dateLabel}
                    </p>
                  </div>
                </button>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleOpenItem(item)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border-soft bg-white hover:bg-surface-alt text-xs font-semibold text-primary"
                  >
                    <span>Buka</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Hapus riwayat"
                    onClick={() => void handleDeleteItem(item)}
                    className="p-2 rounded-lg border border-border-soft text-ink-muted hover:text-primary hover:bg-surface-alt"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Detail Rangkuman */}
      {selectedSummary && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-navy/40 flex items-center justify-center p-4"
        >
          <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-white border border-border-soft rounded-xl p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between gap-4 pb-3 border-b border-border-soft">
              <div>
                <p className="text-xs font-semibold text-primary">
                  Rangkuman · {selectedSummary.level} ·{' '}
                  {formatFirestoreDate(selectedSummary.createdAt)}
                </p>
                <h2 className="text-xl font-bold text-navy mt-0.5">
                  {selectedSummary.result.judul}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSummary(null)}
                className="px-3 py-1.5 rounded-lg border border-border-soft text-xs font-semibold text-ink hover:bg-surface-alt"
              >
                Tutup
              </button>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-sm font-semibold text-navy">Inti Pembahasan</h3>
              <p className="text-sm text-ink leading-relaxed">
                {selectedSummary.result.intiPembahasan}
              </p>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-sm font-semibold text-navy">Poin Penting</h3>
              <ul className="list-disc pl-5 space-y-1 text-sm text-ink">
                {selectedSummary.result.poinPenting.map((pt, i) => (
                  <li key={i}>{pt}</li>
                ))}
              </ul>
            </div>

            <div className="p-4 rounded-lg bg-surface-alt border border-border-soft space-y-1">
              <h3 className="text-sm font-semibold text-navy">Kesimpulan</h3>
              <p className="text-sm text-ink leading-relaxed">
                {selectedSummary.result.kesimpulan}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
