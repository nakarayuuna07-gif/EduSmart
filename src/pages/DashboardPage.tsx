import {
  ArrowRight,
  BarChart3,
  Coins,
  Crown,
  FileText,
  HelpCircle,
  MessageSquare,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { PageSkeleton } from '../components/LoadingSkeleton.tsx';
import { useAuth } from '../hooks/useAuth.tsx';
import {
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

interface DashboardPageProps {
  onNavigate: (path: string) => void;
}

export function DashboardPage({ onNavigate }: DashboardPageProps) {
  const { user, profile, hasUnlimited } = useAuth();
  const [chats, setChats] = useState<ChatSessionDoc[]>([]);
  const [summaries, setSummaries] = useState<SummaryDoc[]>([]);
  const [quizResults, setQuizResults] = useState<QuizResultDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    let settledCount = 0;
    const markSettled = () => {
      settledCount += 1;
      if (settledCount >= 3) setLoading(false);
    };

    const unsubChats = subscribeChats(
      user.uid,
      (data) => {
        setChats(data);
        markSettled();
      },
      () => {
        setError('Sebagian riwayat chat gagal dimuat.');
        markSettled();
      },
    );

    const unsubSummaries = subscribeSummaries(
      user.uid,
      (data) => {
        setSummaries(data);
        markSettled();
      },
      () => {
        setError('Sebagian riwayat rangkuman gagal dimuat.');
        markSettled();
      },
    );

    const unsubQuizzes = subscribeQuizResults(
      user.uid,
      (data) => {
        setQuizResults(data);
        markSettled();
      },
      () => {
        setError('Sebagian hasil kuis gagal dimuat.');
        markSettled();
      },
    );

    return () => {
      unsubChats();
      unsubSummaries();
      unsubQuizzes();
    };
  }, [user]);

  const avgScore = useMemo(() => {
    if (quizResults.length === 0) return 0;
    const sum = quizResults.reduce((acc, q) => acc + q.score, 0);
    return Math.round(sum / quizResults.length);
  }, [quizResults]);

  const recentScores = useMemo(
    () => quizResults.slice(0, 8).reverse(),
    [quizResults],
  );

  const recentActivities = useMemo(() => {
    const items = [
      ...chats.slice(0, 3).map((c) => ({
        id: `chat-${c.id}`,
        kind: 'AI Tutor',
        title: c.title,
        meta: `${c.subject} · ${c.level}`,
        date: formatFirestoreDate(c.updatedAt),
        actionPath: `/tutor?chatId=${c.id}`,
      })),
      ...summaries.slice(0, 3).map((s) => ({
        id: `sum-${s.id}`,
        kind: 'Rangkuman',
        title: s.result.judul,
        meta: `${s.level} · ${s.inputLength.toLocaleString('id-ID')} karakter`,
        date: formatFirestoreDate(s.createdAt),
        actionPath: `/riwayat`,
      })),
      ...quizResults.slice(0, 3).map((q) => ({
        id: `quiz-${q.id}`,
        kind: 'Kuis AI',
        title: q.topic,
        meta: `Skor ${q.score}/100 · ${q.difficulty}`,
        date: formatFirestoreDate(q.createdAt),
        actionPath: `/hasil/${q.id}`,
      })),
    ];
    return items.slice(0, 6);
  }, [chats, summaries, quizResults]);

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header sambutan */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs sm:text-sm font-medium text-primary">
            Jenjang Default: {profile?.defaultLevel || 'SMA/SMK'}
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-navy">
            Halo, {profile?.name || user?.displayName || 'Pelajar'}
          </h1>
          <p className="text-sm text-ink-muted">
            Ringkasan progres belajarmu tersimpan aman dan privat untuk akun ini.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate('/tutor')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary-dark text-white text-sm font-semibold transition-colors whitespace-nowrap"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Tanya AI Tutor</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/kuis')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border-soft bg-white hover:bg-surface-alt text-ink text-sm font-semibold transition-colors whitespace-nowrap"
          >
            <HelpCircle className="w-4 h-4 text-primary" />
            <span>Mulai Kuis AI</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg bg-surface-alt border border-primary text-sm text-navy">
          {error}
        </div>
      )}

      {/* Kartu statistik utama */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => onNavigate('/paket')}
          className="text-left bg-surface-alt border border-primary-light hover:border-primary rounded-xl p-5 shadow-sm space-y-1 transition-colors"
        >
          <p className="text-xs font-medium text-primary flex items-center justify-between">
            <span>{hasUnlimited ? 'Status Langganan' : 'Saldo Kredit'}</span>
            {hasUnlimited ? (
              <Crown className="w-4 h-4" />
            ) : (
              <Coins className="w-4 h-4" />
            )}
          </p>
          <p className="text-2xl sm:text-3xl font-bold text-navy tabular-nums">
            {hasUnlimited
              ? 'Unlimited'
              : `${(profile?.credits ?? 0).toLocaleString('id-ID')}`}
          </p>
          <p className="text-xs font-semibold text-primary">
            {hasUnlimited ? 'Aktif 1 tahun penuh →' : 'Isi ulang / Langganan →'}
          </p>
        </button>

        <div className="bg-white border border-border-soft rounded-xl p-5 shadow-sm space-y-1">
          <p className="text-xs font-medium text-ink-muted">Total Kuis Selesai</p>
          <p className="text-3xl font-bold text-navy tabular-nums">
            {quizResults.length}
          </p>
          <p className="text-xs text-ink-muted">Rata-rata nilai: {quizResults.length > 0 ? avgScore : '—'}</p>
        </div>

        <div className="bg-white border border-border-soft rounded-xl p-5 shadow-sm space-y-1">
          <p className="text-xs font-medium text-ink-muted">Sesi AI Tutor</p>
          <p className="text-3xl font-bold text-navy tabular-nums">{chats.length}</p>
          <p className="text-xs text-ink-muted">Percakapan tersimpan</p>
        </div>

        <div className="bg-white border border-border-soft rounded-xl p-5 shadow-sm space-y-1">
          <p className="text-xs font-medium text-ink-muted">Rangkuman Materi</p>
          <p className="text-3xl font-bold text-navy tabular-nums">
            {summaries.length}
          </p>
          <p className="text-xs text-ink-muted">Catatan terstruktur</p>
        </div>
      </div>

      {/* Grafik nilai sederhana + Aktivitas terakhir */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-border-soft rounded-xl p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <BarChart3 className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold text-navy">
                Grafik Nilai Kuis Terakhir
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('/kuis')}
              className="text-xs font-semibold text-primary hover:text-primary-dark whitespace-nowrap"
            >
              Buat Kuis Baru
            </button>
          </div>

          {recentScores.length === 0 ? (
            <div className="bg-surface-alt border border-border-soft rounded-lg p-8 text-center space-y-3">
              <p className="text-sm font-medium text-navy">
                Belum ada nilai kuis yang tercatat
              </p>
              <p className="text-xs text-ink-muted max-w-md mx-auto">
                Kerjakan kuis pertamamu untuk melihat grafik perkembangan nilai dari waktu ke waktu.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('/kuis')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary hover:bg-primary-dark text-white text-xs font-semibold transition-colors"
              >
                <span>Buat Kuis Pertama</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="h-48 flex items-end gap-3 pt-6 pb-2 border-b border-border-soft">
                {recentScores.map((item, idx) => {
                  const heightPercent = Math.max(item.score, 8);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onNavigate(`/hasil/${item.id}`)}
                      className="flex-1 flex flex-col items-center justify-end gap-1.5 group h-full"
                      title={`${item.topic} — Skor ${item.score}`}
                    >
                      <span className="text-xs font-semibold text-navy tabular-nums">
                        {item.score}
                      </span>
                      <div className="w-full max-w-[44px] h-full flex items-end">
                        <div
                          style={{ height: `${heightPercent}%` }}
                          className="w-full rounded-t-md bg-primary group-hover:bg-primary-dark transition-colors"
                        />
                      </div>
                      <span className="text-[11px] text-ink-muted tabular-nums">
                        K{idx + 1}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-ink-muted">
                Klik salah satu batang grafik untuk membuka pembahasan lengkap kuis tersebut.
              </p>
            </div>
          )}
        </div>

        {/* Aktivitas terakhir */}
        <div className="lg:col-span-5 bg-white border border-border-soft rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-navy">Aktivitas Terakhir</h2>
            <button
              type="button"
              onClick={() => onNavigate('/riwayat')}
              className="text-xs font-semibold text-primary hover:text-primary-dark whitespace-nowrap"
            >
              Semua Riwayat
            </button>
          </div>

          {recentActivities.length === 0 ? (
            <div className="bg-surface-alt border border-border-soft rounded-lg p-6 text-center space-y-3">
              <p className="text-sm font-medium text-navy">Belum ada aktivitas belajar</p>
              <p className="text-xs text-ink-muted">
                Mulai dengan bertanya ke AI Tutor atau merangkum catatan materi.
              </p>
              <div className="flex justify-center gap-2">
                <button
                  type="button"
                  onClick={() => onNavigate('/rangkuman')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border-soft bg-white hover:bg-surface-alt text-xs font-semibold text-ink"
                >
                  <FileText className="w-3.5 h-3.5 text-primary" />
                  <span>Rangkum Materi</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border-soft">
              {recentActivities.map((act) => (
                <button
                  key={act.id}
                  type="button"
                  onClick={() => onNavigate(act.actionPath)}
                  className="w-full py-3 text-left hover:bg-surface-alt/60 px-2 -mx-2 rounded-lg transition-colors flex items-start justify-between gap-3"
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-xs font-medium text-primary">
                      {act.kind} · {act.date}
                    </p>
                    <p className="text-sm font-semibold text-navy truncate">
                      {act.title}
                    </p>
                    <p className="text-xs text-ink-muted truncate">{act.meta}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-ink-muted shrink-0 mt-1" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
