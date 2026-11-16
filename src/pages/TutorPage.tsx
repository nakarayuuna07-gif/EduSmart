import {
  AlertCircle,
  Coins,
  ExternalLink,
  History,
  MessageSquarePlus,
  RefreshCw,
  Send,
  Trash2,
} from 'lucide-react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { CreditGateBanner } from '../components/CreditGateBanner.tsx';
import { FormattedAiText } from '../components/FormattedAiText.tsx';
import { useAuth } from '../hooks/useAuth.tsx';
import { streamTutorApi } from '../services/apiService.ts';
import {
  deleteChatSession,
  formatFirestoreDate,
  saveChatSession,
  subscribeChats,
} from '../services/firestoreService.ts';
import {
  EDUCATION_LEVELS,
  SUBJECTS,
  type ChatMessage,
  type ChatSessionDoc,
  type EducationLevel,
  type Subject,
} from '../types/index.ts';
import { TUTOR_CREDIT_COST } from '../utils/credits.ts';
import { TUTOR_MAX_CHARS, TUTOR_MAX_HISTORY } from '../utils/validation.ts';

interface TutorPageProps {
  initialChatId?: string | null;
  onNavigate: (path: string) => void;
}

export function TutorPage({ initialChatId, onNavigate }: TutorPageProps) {
  const {
    user,
    profile,
    hasUnlimited,
    canAfford,
    consumeCredits,
    getIdToken,
  } = useAuth();
  const [level, setLevel] = useState<EducationLevel>(
    profile?.defaultLevel || 'SMA/SMK',
  );
  const [subject, setSubject] = useState<Subject>('Umum');
  const [chats, setChats] = useState<ChatSessionDoc[]>([]);
  const [activeChatId, setActiveChatId] = useState<string>(() =>
    crypto.randomUUID(),
  );
  const [isSavedSession, setIsSavedSession] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [error, setError] = useState('');
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const levelInitializedRef = useRef(false);

  useEffect(() => {
    if (profile?.defaultLevel && !levelInitializedRef.current && messages.length === 0) {
      setLevel(profile.defaultLevel);
      levelInitializedRef.current = true;
    }
  }, [profile?.defaultLevel, messages.length]);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeChats(
      user.uid,
      (list) => setChats(list),
      () => setError('Gagal memuat riwayat percakapan.'),
    );
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!initialChatId || chats.length === 0) return;
    const found = chats.find((c) => c.id === initialChatId);
    if (found) {
      setActiveChatId(found.id);
      setMessages(found.messages);
      setLevel(found.level);
      setSubject(found.subject);
      setIsSavedSession(true);
      setError('');
    }
  }, [initialChatId, chats]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText, streaming]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const charCount = input.length;
  const trimmedInput = input.trim();
  const isTooLong = charCount > TUTOR_MAX_CHARS;
  const affordable = canAfford(TUTOR_CREDIT_COST);

  const historyForApi = useMemo(
    () =>
      messages.slice(-TUTOR_MAX_HISTORY).map((m) => ({
        role: m.role,
        text: m.text,
      })),
    [messages],
  );

  const handleNewChat = () => {
    abortRef.current?.abort();
    setStreaming(false);
    setStreamingText('');
    setActiveChatId(crypto.randomUUID());
    setIsSavedSession(false);
    setMessages([]);
    setInput('');
    setError('');
    setLastFailedPrompt(null);
    if (profile?.defaultLevel) {
      setLevel(profile.defaultLevel);
    }
    setMobileHistoryOpen(false);
  };

  const handleSelectChat = (chat: ChatSessionDoc) => {
    abortRef.current?.abort();
    setStreaming(false);
    setStreamingText('');
    setActiveChatId(chat.id);
    setIsSavedSession(true);
    setMessages(chat.messages);
    setLevel(chat.level);
    setSubject(chat.subject);
    setError('');
    setLastFailedPrompt(null);
    setMobileHistoryOpen(false);
  };

  const handleDeleteChat = async (chatId: string) => {
    if (!user) return;
    try {
      await deleteChatSession(user.uid, chatId);
      if (activeChatId === chatId) {
        handleNewChat();
      }
    } catch {
      setError('Gagal menghapus percakapan.');
    }
  };

  const sendMessage = async (promptText: string, appendUserBubble = true) => {
    const cleanText = promptText.trim();
    if (!cleanText) {
      setError('Masukkan pertanyaan terlebih dahulu sebelum mengirim.');
      return;
    }
    if (cleanText.length > TUTOR_MAX_CHARS) {
      setError(`Pertanyaan maksimal ${TUTOR_MAX_CHARS.toLocaleString('id-ID')} karakter.`);
      return;
    }
    if (!canAfford(TUTOR_CREDIT_COST)) {
      setError(
        `Kredit tidak cukup (butuh ${TUTOR_CREDIT_COST} kredit). Silakan isi kredit atau aktifkan Langganan Unlimited.`,
      );
      return;
    }
    if (streaming || !user) return;

    setError('');
    setLastFailedPrompt(null);

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text: cleanText,
      createdAt: Date.now(),
    };

    const baseMessages = appendUserBubble ? [...messages, userMsg] : messages;
    if (appendUserBubble) {
      setMessages(baseMessages);
      setInput('');
    }

    const recentHistory = baseMessages
      .slice(0, -1)
      .slice(-TUTOR_MAX_HISTORY)
      .map((m) => ({ role: m.role, text: m.text }));

    setStreaming(true);
    setStreamingText('');

    const controller = new AbortController();
    abortRef.current = controller;

    let accumulated = '';

    try {
      const token = await getIdToken();
      await streamTutorApi(
        token,
        {
          message: cleanText,
          level,
          subject,
          history: recentHistory,
        },
        {
          onChunk: (delta) => {
            accumulated += delta;
            setStreamingText(accumulated);
          },
          onDone: async ({ sources, hasGrounding }) => {
            const finalText = accumulated.trim();
            if (!finalText) {
              setError('AI tidak memberi jawaban, coba ulang. Kredit Anda tidak berkurang.');
              setLastFailedPrompt(cleanText);
              setStreaming(false);
              setStreamingText('');
              return;
            }

            const modelMsg: ChatMessage = {
              id: crypto.randomUUID(),
              role: 'model',
              text: finalText,
              sources,
              hasGrounding,
              createdAt: Date.now(),
            };

            const nextMessages = [...baseMessages, modelMsg];
            setMessages(nextMessages);
            setStreaming(false);
            setStreamingText('');

            // Potong kredit HANYA setelah AI berhasil memberikan jawaban valid
            try {
              await consumeCredits(TUTOR_CREDIT_COST);
            } catch {
              // Tetap simpan pesan meski sinkronisasi kredit tertunda
            }

            try {
              const firstUserMsg = nextMessages.find((m) => m.role === 'user');
              const sessionTitle =
                firstUserMsg?.text.slice(0, 80) || 'Percakapan AI Tutor';
              await saveChatSession(
                user.uid,
                activeChatId,
                {
                  title: sessionTitle,
                  level,
                  subject,
                  messages: nextMessages,
                },
                !isSavedSession,
              );
              setIsSavedSession(true);
            } catch {
              setError('Jawaban diterima, namun gagal menyimpan ke riwayat cloud.');
            }
          },
          onError: (errMsg) => {
            const hasCreditNote = errMsg.toLowerCase().includes('kredit');
            setError(
              hasCreditNote ? errMsg : `${errMsg} Kredit Anda tidak berkurang.`,
            );
            setLastFailedPrompt(cleanText);
            setStreaming(false);
            setStreamingText('');
          },
        },
        controller.signal,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? `${err.message} Kredit Anda tidak berkurang.`
          : 'Terjadi kesalahan saat menghubungi AI Tutor. Kredit Anda tidak berkurang.',
      );
      setLastFailedPrompt(cleanText);
      setStreaming(false);
      setStreamingText('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!streaming && trimmedInput && !isTooLong && affordable) {
        void sendMessage(input, true);
      }
    }
  };

  const historyListContent = (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border-soft flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-navy">Riwayat Tutor</h2>
        <button
          type="button"
          onClick={handleNewChat}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary hover:bg-primary-dark text-white text-xs font-semibold transition-colors whitespace-nowrap"
        >
          <MessageSquarePlus className="w-3.5 h-3.5" />
          <span>Percakapan baru</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
        {chats.length === 0 ? (
          <p className="text-xs text-ink-muted p-3 text-center">
            Belum ada percakapan tersimpan.
          </p>
        ) : (
          chats.map((chat) => {
            const isActive = chat.id === activeChatId && isSavedSession;
            return (
              <div
                key={chat.id}
                className={`group flex items-start justify-between gap-2 p-2.5 rounded-lg border transition-colors ${
                  isActive
                    ? 'bg-surface-alt border-primary text-navy'
                    : 'bg-white border-transparent hover:bg-surface-alt'
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleSelectChat(chat)}
                  className="flex-1 min-w-0 text-left space-y-0.5"
                >
                  <p className="text-xs font-semibold text-navy truncate">
                    {chat.title}
                  </p>
                  <p className="text-[11px] text-ink-muted truncate">
                    {chat.subject} · {chat.level} · {formatFirestoreDate(chat.updatedAt)}
                  </p>
                </button>
                <button
                  type="button"
                  aria-label="Hapus percakapan"
                  onClick={() => void handleDeleteChat(chat.id)}
                  className="p-1 rounded text-ink-muted hover:text-primary shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
      {!affordable && (
        <CreditGateBanner
          requiredCredits={TUTOR_CREDIT_COST}
          currentCredits={profile?.credits ?? 0}
          featureName="bertanya ke AI Tutor"
          onUpgrade={() => onNavigate('/paket')}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Sidebar Riwayat Desktop */}
        <aside className="hidden lg:block lg:col-span-3 bg-white border border-border-soft rounded-xl shadow-sm h-[calc(100vh-9rem)] overflow-hidden">
          {historyListContent}
        </aside>

        {/* Area Chat Utama */}
        <section className="lg:col-span-9 bg-white border border-border-soft rounded-xl shadow-sm flex flex-col h-[calc(100vh-9rem)] min-h-[500px] overflow-hidden">
          {/* Toolbar Pengaturan Level & Mata Pelajaran */}
          <div className="p-4 border-b border-border-soft bg-surface-alt/50 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="space-y-1">
                <label
                  htmlFor="tutor-level"
                  className="block text-[11px] font-semibold text-ink-muted"
                >
                  Tingkat Pemahaman
                </label>
                <select
                  id="tutor-level"
                  value={level}
                  disabled={streaming}
                  onChange={(e) => setLevel(e.target.value as EducationLevel)}
                  className="px-3 py-1.5 rounded-lg border border-border-soft bg-white text-sm font-medium text-navy focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {EDUCATION_LEVELS.map((lvl) => (
                    <option key={lvl} value={lvl}>
                      {lvl}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="tutor-subject"
                  className="block text-[11px] font-semibold text-ink-muted"
                >
                  Mata Pelajaran
                </label>
                <select
                  id="tutor-subject"
                  value={subject}
                  disabled={streaming}
                  onChange={(e) => setSubject(e.target.value as Subject)}
                  className="px-3 py-1.5 rounded-lg border border-border-soft bg-white text-sm font-medium text-navy focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {SUBJECTS.map((subj) => (
                    <option key={subj} value={subj}>
                      {subj}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-border-soft text-xs font-medium text-navy tabular-nums">
                <Coins className="w-3.5 h-3.5 text-primary" />
                <span>{hasUnlimited ? 'Unlimited' : `${TUTOR_CREDIT_COST} Kredit / tanya`}</span>
              </span>

              <button
                type="button"
                onClick={() => setMobileHistoryOpen((prev) => !prev)}
                className="lg:hidden inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border-soft bg-white text-xs font-semibold text-ink hover:bg-surface-alt"
              >
                <History className="w-3.5 h-3.5 text-primary" />
                <span>Riwayat ({chats.length})</span>
              </button>

              <button
                type="button"
                onClick={handleNewChat}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border-soft bg-white hover:bg-surface-alt text-xs font-semibold text-ink whitespace-nowrap"
              >
                <MessageSquarePlus className="w-3.5 h-3.5 text-primary" />
                <span>Percakapan baru</span>
              </button>
            </div>
          </div>

          {/* Drawer Riwayat Mobile */}
          {mobileHistoryOpen && (
            <div className="lg:hidden border-b border-border-soft bg-white max-h-60 overflow-y-auto">
              {historyListContent}
            </div>
          )}

          {/* Area Pesan */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-white">
            {messages.length === 0 && !streaming && (
              <div className="max-w-xl mx-auto my-8 bg-surface-alt border border-border-soft rounded-xl p-6 text-center space-y-3">
                <h1 className="text-lg font-bold text-navy">
                  AI Tutor · {subject} ({level})
                </h1>
                <p className="text-sm text-ink-muted leading-relaxed">
                  Ajukan pertanyaan konsep, langkah penyelesaian soal, atau diskusi materi. Jawaban akan disesuaikan otomatis dengan tingkat <strong>{level}</strong> pada mata pelajaran <strong>{subject}</strong>.
                </p>
                <div className="pt-2 flex flex-wrap justify-center gap-2">
                  {[
                    'Jelaskan konsep fotosintesis secara singkat beserta contohnya',
                    'Bagaimana cara menyelesaikan persamaan kuadrat dengan pemfaktoran?',
                    'Apa penyebab utama inflasi dalam perekonomian?',
                  ].map((sample) => (
                    <button
                      key={sample}
                      type="button"
                      onClick={() => setInput(sample)}
                      className="text-left text-xs px-3 py-2 rounded-lg bg-white border border-border-soft hover:border-primary text-ink transition-colors"
                    >
                      {sample}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'user' ? (
                  <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-br-sm bg-primary text-white px-4 py-3 text-sm sm:text-[15px] leading-relaxed whitespace-pre-wrap shadow-sm">
                    {msg.text}
                  </div>
                ) : (
                  <div className="max-w-[92%] sm:max-w-[82%] rounded-2xl rounded-bl-sm bg-surface-alt border border-border-soft px-4 py-3.5 space-y-3">
                    <FormattedAiText text={msg.text} />

                    <div className="pt-2.5 border-t border-primary-light/80 space-y-1.5">
                      {msg.hasGrounding && msg.sources && msg.sources.length > 0 ? (
                        <div className="space-y-1">
                          <p className="text-[11px] font-semibold text-navy">
                            Sumber Referensi:
                          </p>
                          <ul className="space-y-1">
                            {msg.sources.map((src) => (
                              <li key={src.url}>
                                <a
                                  href={src.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary-dark underline break-all"
                                >
                                  <span>{src.title}</span>
                                  <ExternalLink className="w-3 h-3 shrink-0" />
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <p className="text-[11px] text-ink-muted">
                          Jawaban ini tidak disertai sumber eksternal, verifikasi ke buku/sumber resmi.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Gelembung Streaming / Indikator Mengetik */}
            {streaming && (
              <div className="flex justify-start">
                <div className="max-w-[92%] sm:max-w-[82%] rounded-2xl rounded-bl-sm bg-surface-alt border border-border-soft px-4 py-3.5">
                  {streamingText ? (
                    <FormattedAiText text={streamingText} />
                  ) : (
                    <div className="flex items-center gap-2 text-xs font-medium text-ink-muted">
                      <span>AI Tutor sedang mengetik</span>
                      <span className="inline-flex gap-1" aria-hidden="true">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" />
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Banner Error + Coba Lagi */}
            {error && (
              <div
                role="alert"
                className="p-3.5 rounded-xl bg-surface-alt border border-primary flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-start gap-2.5 text-sm text-navy">
                  <AlertCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
                {lastFailedPrompt && affordable && (
                  <button
                    type="button"
                    disabled={streaming}
                    onClick={() => void sendMessage(lastFailedPrompt, false)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary hover:bg-primary-dark text-white text-xs font-semibold transition-colors shrink-0 self-start sm:self-auto"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Coba lagi</span>
                  </button>
                )}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Form Input */}
          <div className="p-3 sm:p-4 border-t border-border-soft bg-white space-y-2">
            <div className="flex items-end gap-2.5">
              <textarea
                rows={2}
                value={input}
                disabled={streaming || !affordable}
                onChange={(e) => {
                  setInput(e.target.value);
                  if (error) setError('');
                }}
                onKeyDown={handleKeyDown}
                placeholder={
                  affordable
                    ? `Tulis pertanyaan ${subject} tingkat ${level}... (Enter kirim, Shift+Enter baris baru)`
                    : 'Kredit habis. Silakan isi ulang kredit atau aktifkan Langganan Unlimited.'
                }
                className="flex-1 resize-none px-3.5 py-2.5 rounded-lg border border-border-soft text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary disabled:bg-surface-alt"
              />
              <button
                type="button"
                disabled={streaming || !trimmedInput || isTooLong || !affordable}
                onClick={() => void sendMessage(input, true)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 h-[42px] rounded-lg bg-primary hover:bg-primary-dark text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">Kirim</span>
              </button>
            </div>
            <div className="flex items-center justify-between text-[11px] text-ink-muted">
              <span>
                Konteks: {Math.min(historyForApi.length, TUTOR_MAX_HISTORY)} pesan · {level} · {subject}
              </span>
              <span
                className={`tabular-nums font-medium ${
                  isTooLong ? 'text-primary font-semibold' : ''
                }`}
              >
                {charCount.toLocaleString('id-ID')} / {TUTOR_MAX_CHARS.toLocaleString('id-ID')} karakter
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
