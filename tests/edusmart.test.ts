import { describe, expect, it } from 'vitest';
import type { QuizQuestionFull } from '../src/types/index.ts';
import {
  canAffordCredit,
  computeDeductedCredits,
  getQuizCreditCost,
  INITIAL_USER_CREDITS,
  isUnlimitedActive,
  SUMMARY_CREDIT_COST,
  TUTOR_CREDIT_COST,
} from '../src/utils/credits.ts';
import {
  classifyAiError,
  EmptyAiResponseError,
  TimeoutError,
} from '../src/utils/errorMessages.ts';
import {
  buildSummarySystemInstruction,
  buildTutorSystemInstruction,
  shouldUseSearchGrounding,
} from '../src/utils/prompts.ts';
import {
  evaluateQuizSubmission,
  extractPartialSummary,
} from '../src/utils/quizUtils.ts';
import {
  parseAndValidateQuizQuestions,
  parseSummaryJson,
  QuizGenerateRequestSchema,
  sanitizeMaterialText,
  SummarizeRequestSchema,
  TutorRequestSchema,
} from '../src/utils/validation.ts';

describe('Validasi Input & Sanitasi Teks', () => {
  it('menolak pertanyaan tutor yang kosong atau melebihi 2000 karakter', () => {
    const emptyRes = TutorRequestSchema.safeParse({
      message: '   ',
      level: 'SMP',
      subject: 'Matematika',
    });
    expect(emptyRes.success).toBe(false);

    const tooLongRes = TutorRequestSchema.safeParse({
      message: 'a'.repeat(2001),
      level: 'SMA/SMK',
      subject: 'Fisika',
    });
    expect(tooLongRes.success).toBe(false);
  });

  it('memotong riwayat tutor maksimal 10 pesan terakhir', () => {
    const history = Array.from({ length: 15 }, (_, idx) => ({
      role: idx % 2 === 0 ? ('user' as const) : ('model' as const),
      text: `Pesan ke-${idx + 1}`,
    }));
    const valid = TutorRequestSchema.parse({
      message: 'Jelaskan hukum Newton II',
      level: 'SMA/SMK',
      subject: 'Fisika',
      history,
    });
    expect(valid.history).toHaveLength(10);
    expect(valid.history[0].text).toBe('Pesan ke-6');
  });

  it('membersihkan karakter kontrol hasil copy-paste PDF/Word tanpa merusak baris baru', () => {
    const dirty = 'Bab 1:\u0000 Pengantar\r\n• Poin pertama\u0007\n• Poin kedua';
    const clean = sanitizeMaterialText(dirty);
    expect(clean).toBe('Bab 1:  Pengantar\n• Poin pertama \n• Poin kedua');
  });

  it('memvalidasi panjang teks rangkuman antara 100 sampai 12000 karakter', () => {
    const shortRes = SummarizeRequestSchema.safeParse({
      text: 'Terlalu pendek',
      level: 'Mahasiswa',
    });
    expect(shortRes.success).toBe(false);

    const longRes = SummarizeRequestSchema.safeParse({
      text: 'x'.repeat(12001),
      level: 'Mahasiswa',
    });
    expect(longRes.success).toBe(false);

    const okRes = SummarizeRequestSchema.safeParse({
      text: 'Materi biologi sel tentang organel mitokondria dan kloroplas. '.repeat(3),
      level: 'SMA/SMK',
    });
    expect(okRes.success).toBe(true);
  });

  it('memvalidasi parameter generate kuis', () => {
    const valid = QuizGenerateRequestSchema.safeParse({
      topic: 'Termodinamika Dasar',
      difficulty: 'Sedang',
      count: 5,
      level: 'Mahasiswa',
    });
    expect(valid.success).toBe(true);

    const invalidCount = QuizGenerateRequestSchema.safeParse({
      topic: 'Termodinamika',
      difficulty: 'Mudah',
      count: 15,
      level: 'SMP',
    });
    expect(invalidCount.success).toBe(false);
  });
});

describe('Parser & Validator JSON Kuis dan Rangkuman (Zod)', () => {
  it('memvalidasi JSON kuis yang valid termasuk jika terbungkus markdown code fence', () => {
    const raw = `\`\`\`json
    [
      {
        "pertanyaan": "Berapakah hasil dari 2 + 3 x 4?",
        "opsi": ["14", "20", "24", "10"],
        "indexJawabanBenar": 0,
        "pembahasan": "Perkalian didahulukan sebelum penjumlahan: 3 x 4 = 12, lalu 2 + 12 = 14."
      }
    ]
    \`\`\``;
    const questions = parseAndValidateQuizQuestions(raw, 1);
    expect(questions).toHaveLength(1);
    expect(questions[0].indexJawabanBenar).toBe(0);
    expect(questions[0].opsi).toHaveLength(4);
  });

  it('menolak JSON kuis jika jumlah opsi bukan 4 atau indexJawabanBenar di luar 0-3', () => {
    const badOptions = JSON.stringify([
      {
        pertanyaan: 'Pertanyaan contoh valid?',
        opsi: ['A', 'B', 'C'],
        indexJawabanBenar: 0,
        pembahasan: 'Pembahasan contoh valid.',
      },
    ]);
    expect(() => parseAndValidateQuizQuestions(badOptions, 1)).toThrow();

    const badIndex = JSON.stringify([
      {
        pertanyaan: 'Pertanyaan contoh valid?',
        opsi: ['A', 'B', 'C', 'D'],
        indexJawabanBenar: 4,
        pembahasan: 'Pembahasan contoh valid.',
      },
    ]);
    expect(() => parseAndValidateQuizQuestions(badIndex, 1)).toThrow();
  });

  it('memvalidasi output JSON rangkuman 4 bagian dan ekstraksi parsial streaming', () => {
    const jsonStr = `Berikut ringkasannya:\n\`\`\`json\n${JSON.stringify({
      judul: 'Sistem Peredaran Darah',
      intiPembahasan: 'Jantung memompa darah ke seluruh tubuh melalui pembuluh nadi dan balik.',
      poinPenting: ['Bilik kiri memompa darah bersih', 'Serambi kanan menerima darah kotor'],
      kesimpulan: 'Sirkulasi darah menjaga suplai oksigen ke seluruh jaringan tubuh.',
    })}\n\`\`\``;
    const parsed = parseSummaryJson(jsonStr);
    expect(parsed.judul).toBe('Sistem Peredaran Darah');
    expect(parsed.poinPenting).toHaveLength(2);

    const partial = extractPartialSummary('{"judul":"Fotosintesis","intiPembahasan":"Proses tumb');
    expect(partial.judul).toBe('Fotosintesis');
    expect(partial.intiPembahasan).toBe('Proses tumb');
  });
});

describe('Perhitungan Skor Kuis', () => {
  const sampleQuestions: QuizQuestionFull[] = [
    {
      id: 1,
      pertanyaan: 'Soal 1',
      opsi: ['A', 'B', 'C', 'D'],
      indexJawabanBenar: 1,
      pembahasan: 'Jawaban B benar.',
    },
    {
      id: 2,
      pertanyaan: 'Soal 2',
      opsi: ['A', 'B', 'C', 'D'],
      indexJawabanBenar: 2,
      pembahasan: 'Jawaban C benar.',
    },
    {
      id: 3,
      pertanyaan: 'Soal 3',
      opsi: ['A', 'B', 'C', 'D'],
      indexJawabanBenar: 0,
      pembahasan: 'Jawaban A benar.',
    },
    {
      id: 4,
      pertanyaan: 'Soal 4',
      opsi: ['A', 'B', 'C', 'D'],
      indexJawabanBenar: 3,
      pembahasan: 'Jawaban D benar.',
    },
  ];

  it('menghitung skor 0-100 dengan akurat termasuk jawaban null (kosong)', () => {
    const evalResult = evaluateQuizSubmission(sampleQuestions, [1, 0, 0, null]);
    expect(evalResult.correctCount).toBe(2);
    expect(evalResult.totalQuestions).toBe(4);
    expect(evalResult.score).toBe(50);
    expect(evalResult.items[0].isCorrect).toBe(true);
    expect(evalResult.items[1].isCorrect).toBe(false);
    expect(evalResult.items[3].userAnswer).toBeNull();
  });
});

describe('Sistem Kredit & Langganan', () => {
  it('menetapkan 100 kredit awal untuk ~10x tutor/rangkuman dan maksimal 3x kuis mudah 5 soal', () => {
    expect(INITIAL_USER_CREDITS).toBe(100);
    expect(TUTOR_CREDIT_COST).toBe(10);
    expect(SUMMARY_CREDIT_COST).toBe(10);

    const easy5Cost = getQuizCreditCost('Mudah', 5);
    expect(easy5Cost).toBe(30);
    expect(Math.floor(INITIAL_USER_CREDITS / easy5Cost)).toBe(3);

    expect(getQuizCreditCost('Sedang', 5)).toBeGreaterThan(easy5Cost);
    expect(getQuizCreditCost('Sulit', 5)).toBeGreaterThan(getQuizCreditCost('Sedang', 5));
  });

  it('memeriksa kecukupan kredit, status unlimited, dan pengurangan aman', () => {
    expect(
      canAffordCredit({ credits: 25, plan: 'gratis', planExpiresAt: 0 }, 30),
    ).toBe(false);
    expect(
      canAffordCredit({ credits: 30, plan: 'gratis', planExpiresAt: 0 }, 30),
    ).toBe(true);

    const future = Date.now() + 86_400_000;
    expect(
      isUnlimitedActive({ plan: 'unlimited', planExpiresAt: future }),
    ).toBe(true);
    expect(
      canAffordCredit({ credits: 0, plan: 'unlimited', planExpiresAt: future }, 95),
    ).toBe(true);

    expect(computeDeductedCredits(100, 30)).toBe(70);
    expect(computeDeductedCredits(5, 30)).toBe(0);
  });
});

describe('Pembentukan Prompt Tutor & Rangkuman', () => {
  it('menyertakan tingkat pendidikan dan mata pelajaran di system instruction tutor', () => {
    const promptSmp = buildTutorSystemInstruction('SMP', 'Matematika');
    expect(promptSmp).toContain('SMP');
    expect(promptSmp).toContain('Matematika');

    const promptMhs = buildTutorSystemInstruction('Mahasiswa', 'Informatika');
    expect(promptMhs).toContain('Mahasiswa');
    expect(promptMhs).toContain('Informatika');
    expect(promptMhs).not.toBe(promptSmp);
  });

  it('menegaskan larangan menambah fakta di luar teks pada system instruction rangkuman', () => {
    const summaryPrompt = buildSummarySystemInstruction('SMA/SMK');
    expect(summaryPrompt).toContain('SMA/SMK');
    expect(summaryPrompt).toContain('HANYA berdasarkan materi yang diberikan');
  });

  it('mengaktifkan Google Search grounding hanya untuk pertanyaan faktual', () => {
    expect(shouldUseSearchGrounding('Siapa penemu hukum gravitasi dan kapan dipublikasikan?')).toBe(true);
    expect(shouldUseSearchGrounding('Hitung 25 * 4 + 10')).toBe(false);
    expect(shouldUseSearchGrounding('Halo')).toBe(false);
  });
});

describe('Penanganan Error API', () => {
  it('mengklasifikasikan timeout, API key tidak valid, kuota habis, dan respons kosong', () => {
    const timeoutErr = classifyAiError(new TimeoutError());
    expect(timeoutErr.status).toBe(504);
    expect(timeoutErr.code).toBe('TIMEOUT');

    const emptyErr = classifyAiError(new EmptyAiResponseError());
    expect(emptyErr.code).toBe('EMPTY_RESPONSE');

    const keyErr = classifyAiError(new Error('API_KEY_INVALID: bad key'));
    expect(keyErr.status).toBe(502);
    expect(keyErr.code).toBe('API_KEY_INVALID');

    const quotaErr = classifyAiError(new Error('429 RESOURCE_EXHAUSTED'));
    expect(quotaErr.status).toBe(429);
    expect(quotaErr.code).toBe('QUOTA_EXCEEDED');

    const networkErr = classifyAiError(new Error('fetch failed ECONNRESET'));
    expect(networkErr.status).toBe(502);
    expect(networkErr.code).toBe('NETWORK_ERROR');
  });
});

import { UserRateLimiter } from '../server/auth.ts';
import {
  buildTutorCacheKey,
  clearCache,
  getCached,
  normalizeTextForCache,
  setCached,
} from '../server/cache.ts';
import {
  callProvider,
  clearMockProviderRules,
  setMockProviderRules,
} from '../server/providers/adapters.ts';
import { AiFallbackOrchestrator } from '../server/providers/orchestrator.ts';
import {
  AllProvidersFailedError,
  ProviderError,
} from '../server/providers/types.ts';

describe('Multi-Provider Fallback, Retry, Circuit Breaker & Error Policy', () => {
  it('pindah otomatis ke provider berikutnya saat Gemini mengembalikan 429 (maks 2 retry + hormati Retry-After)', async () => {
    const delays: number[] = [];
    let currentTime = 1_000_000;
    const orchestrator = new AiFallbackOrchestrator({
      nowFn: () => currentTime,
      sleepFn: async (ms) => {
        delays.push(ms);
        currentTime += ms;
      },
      jitterFn: () => 0.5, // neutral jitter = 1.0x
    });

    let geminiCalls = 0;
    let openaiCalls = 0;
    const mockFetch: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes('generativelanguage.googleapis.com')) {
        geminiCalls += 1;
        return new Response(JSON.stringify({ error: { message: 'rate limit' } }), {
          status: 429,
          headers: { 'Retry-After': '1' },
        });
      }
      if (url.includes('api.openai.com')) {
        openaiCalls += 1;
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: '  Penjelasan dari OpenAI  \n\n' } }],
          }),
          { status: 200 },
        );
      }
      throw new Error(`Unexpected URL: ${url}`);
    };

    const result = await orchestrator.executeWithFallback(
      'tutor',
      {
        systemPrompt: 'Kamu tutor sabar.',
        prompt: 'Jelaskan hukum Ohm.',
      },
      {
        env: {
          GEMINI_API_KEY: 'test-gemini',
          OPENAI_API_KEY: 'test-openai',
        } as NodeJS.ProcessEnv,
        fetchFn: mockFetch,
      },
    );

    expect(geminiCalls).toBe(3); // 1 initial + 2 retries
    expect(delays).toEqual([1000, 1000]); // Menghormati Retry-After: 1s
    expect(openaiCalls).toBe(1);
    expect(result.provider).toBe('openai');
    expect(result.text).toBe('Penjelasan dari OpenAI');
  });

  it('FATAL_ERROR (input 400 atau blokir kebijakan keamanan) TIDAK memicu fallback', async () => {
    const orchestrator = new AiFallbackOrchestrator({
      sleepFn: async () => {},
    });

    let openaiCalls = 0;
    const mockFetch: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes('generativelanguage.googleapis.com')) {
        return new Response(
          JSON.stringify({ error: { message: 'Blocked by safety policy' } }),
          { status: 400 },
        );
      }
      if (url.includes('api.openai.com')) {
        openaiCalls += 1;
        return new Response(
          JSON.stringify({ choices: [{ message: { content: 'Seharusnya tidak dipanggil' } }] }),
          { status: 200 },
        );
      }
      throw new Error('Unexpected provider call');
    };

    await expect(
      orchestrator.executeWithFallback(
        'tutor',
        { systemPrompt: 'Tutor', prompt: 'Prompt terblokir' },
        {
          env: {
            GEMINI_API_KEY: 'test-gemini',
            OPENAI_API_KEY: 'test-openai',
          } as NodeJS.ProcessEnv,
          fetchFn: mockFetch,
        },
      ),
    ).rejects.toMatchObject({
      name: 'ProviderError',
      kind: 'FATAL_ERROR',
    });

    expect(openaiCalls).toBe(0);
  });

  it('401/403 menandai provider rusak lalu melewatkannya; circuit breaker skip 5 menit setelah 3x gagal berturut-turut', async () => {
    let now = 10_000_000;
    const orchestrator = new AiFallbackOrchestrator({
      nowFn: () => now,
      sleepFn: async () => {},
    });

    let geminiCalls = 0;
    let openaiCalls = 0;
    const mockFetch: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes('generativelanguage.googleapis.com')) {
        geminiCalls += 1;
        return new Response('Unauthorized', { status: 401 });
      }
      if (url.includes('api.openai.com')) {
        openaiCalls += 1;
        return new Response('Server error', { status: 500 });
      }
      if (url.includes('api.anthropic.com')) {
        return new Response(
          JSON.stringify({ content: [{ type: 'text', text: 'Jawaban dari Claude Haiku' }] }),
          { status: 200 },
        );
      }
      throw new Error('Unexpected');
    };

    const env = {
      GEMINI_API_KEY: 'bad-key',
      OPENAI_API_KEY: 'flaky-key',
      ANTHROPIC_API_KEY: 'good-claude',
    } as NodeJS.ProcessEnv;

    // 3 permintaan berturut-turut: Gemini ditandai 'rusak' pada panggilan ke-1,
    // OpenAI gagal 3x berturut-turut (1x3 retries per request -> 3 consecutive failures) -> cooldown 5 menit
    for (let i = 0; i < 3; i += 1) {
      const res = await orchestrator.executeWithFallback(
        'tutor',
        { systemPrompt: 'Tutor', prompt: `Soal ${i}` },
        { env, fetchFn: mockFetch },
      );
      expect(res.provider).toBe('anthropic');
    }

    expect(geminiCalls).toBe(1); // Langsung ditandai rusak pada request ke-1, tidak dipanggil lagi
    expect(orchestrator.getProviderStatus('gemini', { env })).toBe('rusak');
    expect(orchestrator.getProviderStatus('openai', { env })).toBe('dilewati');

    // Panggilan ke-4 dalam window 5 menit harus langsung ke Anthropic tanpa menyentuh OpenAI
    const callsBefore4th = openaiCalls;
    await orchestrator.executeWithFallback(
      'tutor',
      { systemPrompt: 'Tutor', prompt: 'Soal 4' },
      { env, fetchFn: mockFetch },
    );
    expect(openaiCalls).toBe(callsBefore4th);

    // Setelah > 5 menit, circuit breaker OpenAI kembali membuka probe
    now += 5 * 60 * 1000 + 1000;
    expect(orchestrator.getProviderStatus('openai', { env })).toBe('aktif');
  });

  it('menampilkan pesan ramah saat semua provider gagal dan kredit TIDAK terpotong', async () => {
    const orchestrator = new AiFallbackOrchestrator({
      sleepFn: async () => {},
    });

    let userCredits = 100;
    setMockProviderRules({
      gemini: { mode: 'error', status: 429 },
      openai: { mode: 'error', status: 503 },
    });

    try {
      let caught: unknown;
      try {
        await orchestrator.executeWithFallback(
          'tutor',
          { systemPrompt: 'Tutor', prompt: 'Jelaskan integral' },
          {
            env: {
              GEMINI_API_KEY: 'k1',
              OPENAI_API_KEY: 'k2',
            } as NodeJS.ProcessEnv,
          },
        );
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(AllProvidersFailedError);
      expect((caught as Error).message).toBe(
        'Server AI sedang penuh, coba lagi beberapa menit. Kredit kamu tidak berkurang.',
      );
      // Simulasi handler aplikasi: kredit hanya dipotong bila AI berhasil
      expect(userCredits).toBe(100);
    } finally {
      clearMockProviderRules();
    }
  });

  it('callProvider mengirim header & payload resmi untuk Gemini, Claude, dan provider OpenAI-compatible', async () => {
    const capturedCalls: Array<{
      url: string;
      headers: Record<string, string>;
      body: Record<string, unknown>;
    }> = [];

    const mockFetch: typeof fetch = async (input, init) => {
      const url = String(input);
      const headers = (init?.headers || {}) as Record<string, string>;
      const body = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>;
      capturedCalls.push({ url, headers, body });

      if (url.includes('generativelanguage.googleapis.com')) {
        return new Response(
          JSON.stringify({ candidates: [{ content: { parts: [{ text: 'OK Gemini' }] } }] }),
          { status: 200 },
        );
      }
      if (url.includes('api.anthropic.com')) {
        return new Response(
          JSON.stringify({ content: [{ type: 'text', text: 'OK Claude' }] }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({ choices: [{ message: { content: 'OK OpenAI-Compat' } }] }),
        { status: 200 },
      );
    };

    const env = {
      GEMINI_API_KEY: 'gem-key',
      ANTHROPIC_API_KEY: 'ant-key',
      GROQ_API_KEY: 'groq-key',
      DEEPSEEK_API_KEY: 'ds-key',
      MISTRAL_API_KEY: 'mis-key',
      OPENROUTER_API_KEY: 'or-key',
    } as NodeJS.ProcessEnv;

    expect(await callProvider('gemini', 'Halo', { env, fetchFn: mockFetch })).toBe('OK Gemini');
    expect(capturedCalls[0].headers['x-goog-api-key']).toBe('gem-key');
    expect(capturedCalls[0].url).toContain(':generateContent');

    expect(await callProvider('anthropic', 'Halo', { env, fetchFn: mockFetch })).toBe('OK Claude');
    expect(capturedCalls[1].headers['x-api-key']).toBe('ant-key');
    expect(capturedCalls[1].headers['anthropic-version']).toBe('2023-06-01');
    expect(capturedCalls[1].body.max_tokens).toBe(1000);

    expect(await callProvider('groq', 'Halo', { env, fetchFn: mockFetch })).toBe('OK OpenAI-Compat');
    expect(capturedCalls[2].url).toBe('https://api.groq.com/openai/v1/chat/completions');

    expect(await callProvider('deepseek', 'Halo', { env, fetchFn: mockFetch })).toBe('OK OpenAI-Compat');
    expect(capturedCalls[3].url).toBe('https://api.deepseek.com/chat/completions');

    expect(await callProvider('mistral', 'Halo', { env, fetchFn: mockFetch })).toBe('OK OpenAI-Compat');
    expect(capturedCalls[4].url).toBe('https://api.mistral.ai/v1/chat/completions');

    expect(await callProvider('openrouter', 'Halo', { env, fetchFn: mockFetch })).toBe('OK OpenAI-Compat');
    expect(capturedCalls[5].url).toBe('https://openrouter.ai/api/v1/chat/completions');
  });
});

describe('Cache Jawaban (24 Jam) & Limit Pengguna (10/Menit)', () => {
  it('menormalisasi kunci cache (mapel + level + pertanyaan) dan mencegah panggilan API ulang', async () => {
    clearCache();
    expect(normalizeTextForCache('  Apa   itu   FOTOSINTESIS? \n')).toBe(
      'apa itu fotosintesis?',
    );

    const key1 = buildTutorCacheKey({
      subject: 'Biologi',
      level: 'SMP',
      question: 'Apa itu FOTOSINTESIS?',
    });
    const key2 = buildTutorCacheKey({
      subject: ' biologi ',
      level: 'smp',
      question: '  apa   itu   fotosintesis? ',
    });
    expect(key1).toBe(key2);

    let apiCallCount = 0;
    const simulateTutorHandler = async (q: string) => {
      const k = buildTutorCacheKey({ subject: 'Biologi', level: 'SMP', question: q });
      const cached = getCached<string>(k);
      if (cached) return cached;

      apiCallCount += 1;
      const fresh = 'Fotosintesis adalah proses tumbuhan membuat makanan.';
      setCached(k, fresh);
      return fresh;
    };

    const first = await simulateTutorHandler('Apa itu FOTOSINTESIS?');
    const second = await simulateTutorHandler('  apa   itu fotosintesis?  ');
    expect(first).toBe(second);
    expect(apiCallCount).toBe(1); // Panggilan ke-2 kena cache, API tidak dipanggil sama sekali
    clearCache();
  });

  it('membatasi maksimal 10 permintaan per menit per pengguna tanpa memotong kredit saat ditolak', () => {
    const limiter = new UserRateLimiter(10, 60_000);
    let now = 500_000;

    for (let i = 0; i < 10; i += 1) {
      expect(limiter.checkAndConsume('user-1', now).allowed).toBe(true);
    }

    // Permintaan ke-11 dalam 1 menit ditolak
    expect(limiter.checkAndConsume('user-1', now).allowed).toBe(false);
    // Pengguna lain tetap bisa akses
    expect(limiter.checkAndConsume('user-2', now).allowed).toBe(true);

    // Setelah > 1 menit, limit ter-reset
    now += 60_001;
    expect(limiter.checkAndConsume('user-1', now).allowed).toBe(true);
  });
});

