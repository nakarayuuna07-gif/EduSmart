import { Router, type Response } from 'express';
import {
  requireFirebaseAuth,
  userRateLimiter,
  type AuthenticatedRequest,
} from './auth.ts';
import {
  buildCacheKey,
  buildTutorCacheKey,
  getCached,
  normalizeTextForCache,
  setCached,
} from './cache.ts';
import { AI_MODEL } from './config.ts';
import { aiOrchestrator } from './providers/orchestrator.ts';
import {
  AllProvidersFailedError,
  NoProviderConfiguredError,
  ProviderError,
} from './providers/types.ts';
import {
  createQuizSession,
  deleteQuizSession,
  getQuizSession,
} from './quizStore.ts';
import type {
  EducationLevel,
  GroundingSource,
  QuizDifficulty,
  QuizEvaluationResult,
  QuizGenerateResponse,
  QuizQuestionFull,
  SummaryOutput,
} from '../src/types/index.ts';
import { ALL_PROVIDERS_FAILED_MESSAGE } from '../src/utils/errorMessages.ts';
import {
  buildQuizPrompt,
  buildSummarySystemInstruction,
  buildTutorSystemInstruction,
  shouldUseSearchGrounding,
} from '../src/utils/prompts.ts';
import { evaluateQuizSubmission } from '../src/utils/quizUtils.ts';
import {
  parseAndValidateQuizQuestions,
  parseSummaryJson,
  QuizGenerateRequestSchema,
  QuizSubmitRequestSchema,
  SummarizeRequestSchema,
  TutorRequestSchema,
} from '../src/utils/validation.ts';

interface CachedTutorResponse {
  text: string;
  sources: GroundingSource[];
  hasGrounding: boolean;
}

function writeSseEvent(res: Response, payload: unknown): void {
  if (!res.writableEnded) {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  }
}

function initSseResponse(res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
}

function streamTextAsSseChunks(res: Response, fullText: string): void {
  const chunkSize = 48;
  for (let i = 0; i < fullText.length; i += chunkSize) {
    if (res.writableEnded) break;
    writeSseEvent(res, {
      type: 'chunk',
      text: fullText.slice(i, i + chunkSize),
    });
  }
}

function mapAiErrorToUserResponse(err: unknown): {
  status: number;
  code: string;
  message: string;
} {
  if (err instanceof NoProviderConfiguredError) {
    return {
      status: 503,
      code: 'API_NOT_CONFIGURED',
      message:
        'API belum dikonfigurasi. Tambahkan minimal satu API key provider AI di Secrets.',
    };
  }

  if (err instanceof ProviderError && err.kind === 'FATAL_ERROR') {
    return {
      status: 400,
      code: 'CONTENT_BLOCKED',
      message: err.message,
    };
  }

  if (err instanceof AllProvidersFailedError) {
    return {
      status: 503,
      code: 'ALL_PROVIDERS_FAILED',
      message: ALL_PROVIDERS_FAILED_MESSAGE,
    };
  }

  if (
    err instanceof SyntaxError ||
    (err instanceof Error && err.name === 'ZodError')
  ) {
    return {
      status: 502,
      code: 'INVALID_AI_FORMAT',
      message: ALL_PROVIDERS_FAILED_MESSAGE,
    };
  }

  return {
    status: 503,
    code: 'ALL_PROVIDERS_FAILED',
    message: ALL_PROVIDERS_FAILED_MESSAGE,
  };
}

async function generateQuizBatchWithFallback(params: {
  topic: string;
  level: EducationLevel;
  difficulty: QuizDifficulty;
  count: number;
  partIndex?: number;
  totalParts?: number;
  startId: number;
}): Promise<QuizQuestionFull[]> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const prompt = buildQuizPrompt({
        topic: params.topic,
        level: params.level,
        difficulty: params.difficulty,
        count: params.count,
        partIndex: params.partIndex,
        totalParts: params.totalParts,
      });

      const result = await aiOrchestrator.executeWithFallback('quiz', {
        systemPrompt:
          'Kamu adalah pembuat soal evaluasi pendidikan Indonesia. Keluarkan HANYA array JSON valid sesuai instruksi tanpa teks tambahan.',
        prompt,
        maxOutputTokens: Math.min(1800, Math.max(1000, params.count * 320)),
        responseFormat: 'json',
      });

      return parseAndValidateQuizQuestions(result.text, params.count, params.startId);
    } catch (err) {
      lastError = err;
      if (err instanceof ProviderError && err.kind === 'FATAL_ERROR') {
        throw err;
      }
      if (err instanceof AllProvidersFailedError || err instanceof NoProviderConfiguredError) {
        throw err;
      }
    }
  }
  throw lastError;
}

export function createApiRouter(): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    const snapshot = aiOrchestrator.getMonitoringSnapshot();
    const activeCount = snapshot.providers.filter((p) => p.status === 'aktif').length;
    res.json({
      ok: true,
      apiConfigured: aiOrchestrator.hasAnyConfiguredProvider(),
      model: AI_MODEL,
      activeProvidersCount: activeCount,
    });
  });

  // Endpoint admin sederhana: status provider & jumlah pemakaian harian (tanpa API key / PII)
  router.get('/admin/providers', requireFirebaseAuth, (_req, res) => {
    res.json(aiOrchestrator.getMonitoringSnapshot());
  });

  router.post(
    '/tutor',
    requireFirebaseAuth,
    userRateLimiter,
    async (req: AuthenticatedRequest, res: Response) => {
      if (!aiOrchestrator.hasAnyConfiguredProvider()) {
        res.status(503).json({
          code: 'API_NOT_CONFIGURED',
          error:
            'API belum dikonfigurasi. Tambahkan GEMINI_API_KEY atau key provider lain di Secrets.',
        });
        return;
      }

      const parsed = TutorRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          code: 'VALIDATION_ERROR',
          error: parsed.error.issues[0]?.message || 'Input tutor tidak valid.',
        });
        return;
      }

      const { message, level, subject, history } = parsed.data;
      const cacheKey =
        history.length === 0
          ? buildTutorCacheKey({ subject, level, question: message })
          : null;

      initSseResponse(res);

      if (cacheKey) {
        const cached = getCached<CachedTutorResponse>(cacheKey);
        if (cached) {
          streamTextAsSseChunks(res, cached.text);
          writeSseEvent(res, {
            type: 'done',
            sources: cached.sources,
            hasGrounding: cached.hasGrounding,
            cached: true,
          });
          res.end();
          return;
        }
      }

      let clientDisconnected = false;
      res.on('close', () => {
        if (!res.writableEnded) {
          clientDisconnected = true;
        }
      });

      try {
        const result = await aiOrchestrator.executeWithFallback('tutor', {
          systemPrompt: buildTutorSystemInstruction(level, subject),
          prompt: message,
          history,
          maxOutputTokens: 1000,
          responseFormat: 'text',
          useSearchGrounding: shouldUseSearchGrounding(message),
        });

        if (clientDisconnected) {
          res.end();
          return;
        }

        const responsePayload: CachedTutorResponse = {
          text: result.text,
          sources: result.sources,
          hasGrounding: result.hasGrounding,
        };

        if (cacheKey) {
          setCached<CachedTutorResponse>(cacheKey, responsePayload);
        }

        streamTextAsSseChunks(res, result.text);
        writeSseEvent(res, {
          type: 'done',
          sources: result.sources,
          hasGrounding: result.hasGrounding,
        });
        res.end();
      } catch (err) {
        const mapped = mapAiErrorToUserResponse(err);
        writeSseEvent(res, {
          type: 'error',
          code: mapped.code,
          message: mapped.message,
        });
        res.end();
      }
    },
  );

  router.post(
    '/summarize',
    requireFirebaseAuth,
    userRateLimiter,
    async (req: AuthenticatedRequest, res: Response) => {
      if (!aiOrchestrator.hasAnyConfiguredProvider()) {
        res.status(503).json({
          code: 'API_NOT_CONFIGURED',
          error:
            'API belum dikonfigurasi. Tambahkan GEMINI_API_KEY atau key provider lain di Secrets.',
        });
        return;
      }

      const parsed = SummarizeRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          code: 'VALIDATION_ERROR',
          error: parsed.error.issues[0]?.message || 'Materi tidak valid.',
        });
        return;
      }

      const { text, level } = parsed.data;
      const cacheKey = buildCacheKey('summary', {
        text: normalizeTextForCache(text),
        level: normalizeTextForCache(level),
      });

      initSseResponse(res);
      writeSseEvent(res, { type: 'received', charCount: text.length });

      const cached = getCached<SummaryOutput>(cacheKey);
      if (cached) {
        writeSseEvent(res, { type: 'done', summary: cached, cached: true });
        res.end();
        return;
      }

      let clientDisconnected = false;
      res.on('close', () => {
        if (!res.writableEnded) {
          clientDisconnected = true;
        }
      });

      try {
        const aiResult = await aiOrchestrator.executeWithFallback('summarize', {
          systemPrompt: buildSummarySystemInstruction(level),
          prompt: `Rangkum teks materi berikut secara akurat HANYA berdasarkan informasi di dalamnya:\n\n"""\n${text}\n"""`,
          maxOutputTokens: 1600,
          responseFormat: 'json',
        });

        if (clientDisconnected) {
          res.end();
          return;
        }

        const summary = parseSummaryJson(aiResult.text);
        setCached<SummaryOutput>(cacheKey, summary);

        writeSseEvent(res, { type: 'delta', partial: summary });
        writeSseEvent(res, { type: 'done', summary });
        res.end();
      } catch (err) {
        const mapped = mapAiErrorToUserResponse(err);
        writeSseEvent(res, {
          type: 'error',
          code: mapped.code,
          message: mapped.message,
        });
        res.end();
      }
    },
  );

  router.post(
    '/quiz',
    requireFirebaseAuth,
    userRateLimiter,
    async (req: AuthenticatedRequest, res: Response) => {
      if (!aiOrchestrator.hasAnyConfiguredProvider()) {
        res.status(503).json({
          code: 'API_NOT_CONFIGURED',
          error:
            'API belum dikonfigurasi. Tambahkan GEMINI_API_KEY atau key provider lain di Secrets.',
        });
        return;
      }

      const parsed = QuizGenerateRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          code: 'VALIDATION_ERROR',
          error: parsed.error.issues[0]?.message || 'Parameter kuis tidak valid.',
        });
        return;
      }

      const { topic, difficulty, count, level } = parsed.data;
      const uid = req.user!.uid;
      const cacheKey = buildCacheKey('quiz', {
        topic: normalizeTextForCache(topic),
        difficulty,
        count,
        level,
      });

      try {
        let questions = getCached<QuizQuestionFull[]>(cacheKey);

        if (!questions) {
          if (count > 5) {
            const firstHalfCount = Math.ceil(count / 2);
            const secondHalfCount = count - firstHalfCount;
            const [part1, part2] = await Promise.all([
              generateQuizBatchWithFallback({
                topic,
                level,
                difficulty,
                count: firstHalfCount,
                partIndex: 1,
                totalParts: 2,
                startId: 1,
              }),
              generateQuizBatchWithFallback({
                topic,
                level,
                difficulty,
                count: secondHalfCount,
                partIndex: 2,
                totalParts: 2,
                startId: firstHalfCount + 1,
              }),
            ]);
            questions = [...part1, ...part2];
          } else {
            questions = await generateQuizBatchWithFallback({
              topic,
              level,
              difficulty,
              count,
              startId: 1,
            });
          }

          setCached<QuizQuestionFull[]>(cacheKey, questions);
        }

        const session = createQuizSession({
          uid,
          topic,
          level,
          difficulty,
          questions,
        });

        const payload: QuizGenerateResponse = {
          quizId: session.quizId,
          topic: session.topic,
          level: session.level,
          difficulty: session.difficulty,
          questions: session.questions.map(({ id, pertanyaan, opsi }) => ({
            id,
            pertanyaan,
            opsi,
          })),
        };

        res.json(payload);
      } catch (err) {
        const mapped = mapAiErrorToUserResponse(err);
        res.status(mapped.status).json({
          code: mapped.code,
          error: mapped.message,
        });
      }
    },
  );

  router.post(
    '/quiz/submit',
    requireFirebaseAuth,
    userRateLimiter,
    (req: AuthenticatedRequest, res: Response) => {
      const parsed = QuizSubmitRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          code: 'VALIDATION_ERROR',
          error: parsed.error.issues[0]?.message || 'Jawaban kuis tidak valid.',
        });
        return;
      }

      const { quizId, answers } = parsed.data;
      const uid = req.user!.uid;
      const session = getQuizSession(quizId, uid);

      if (!session) {
        res.status(404).json({
          code: 'VALIDATION_ERROR',
          error:
            'Sesi kuis tidak ditemukan atau sudah kedaluwarsa. Silakan buat kuis baru.',
        });
        return;
      }

      if (answers.length !== session.questions.length) {
        res.status(400).json({
          code: 'VALIDATION_ERROR',
          error: `Jumlah jawaban (${answers.length}) tidak sesuai dengan jumlah soal (${session.questions.length}).`,
        });
        return;
      }

      const evaluation = evaluateQuizSubmission(session.questions, answers);
      deleteQuizSession(quizId);

      const result: QuizEvaluationResult = {
        quizId: session.quizId,
        topic: session.topic,
        level: session.level,
        difficulty: session.difficulty,
        score: evaluation.score,
        correctCount: evaluation.correctCount,
        totalQuestions: evaluation.totalQuestions,
        items: evaluation.items,
        completedAt: Date.now(),
      };

      res.json(result);
    },
  );

  return router;
}
