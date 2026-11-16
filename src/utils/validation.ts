import { z } from 'zod';
import {
  EDUCATION_LEVELS,
  QUIZ_DIFFICULTIES,
  SUBJECTS,
  type QuizQuestionFull,
  type SummaryOutput,
} from '../types/index.ts';

export const TUTOR_MAX_CHARS = 2000;
export const TUTOR_MAX_HISTORY = 10;
export const SUMMARY_MIN_CHARS = 100;
export const SUMMARY_MAX_CHARS = 12000;
export const QUIZ_TOPIC_MIN_CHARS = 3;
export const QUIZ_TOPIC_MAX_CHARS = 5000;

export function sanitizeMaterialText(raw: string): string {
  return raw
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFD]/g, ' ')
    .replace(/\r\n/g, '\n')
    .trim();
}

export const EducationLevelSchema = z.enum(EDUCATION_LEVELS);
export const SubjectSchema = z.enum(SUBJECTS);
export const QuizDifficultySchema = z.enum(QUIZ_DIFFICULTIES);

export const ChatHistoryTurnSchema = z.object({
  role: z.enum(['user', 'model']),
  text: z.string().trim().min(1).max(4000),
});

export const TutorRequestSchema = z.object({
  message: z
    .string()
    .transform(sanitizeMaterialText)
    .pipe(
      z
        .string()
        .min(1, 'Pertanyaan tidak boleh kosong.')
        .max(TUTOR_MAX_CHARS, `Pertanyaan maksimal ${TUTOR_MAX_CHARS} karakter.`),
    ),
  level: EducationLevelSchema,
  subject: SubjectSchema,
  history: z
    .array(ChatHistoryTurnSchema)
    .max(30)
    .optional()
    .default([])
    .transform((items) => items.slice(-TUTOR_MAX_HISTORY)),
});

export const SummarizeRequestSchema = z.object({
  text: z
    .string()
    .transform(sanitizeMaterialText)
    .pipe(
      z
        .string()
        .min(
          SUMMARY_MIN_CHARS,
          `Materi terlalu pendek. Masukkan minimal ${SUMMARY_MIN_CHARS} karakter agar dapat dirangkum dengan akurat.`,
        )
        .max(
          SUMMARY_MAX_CHARS,
          `Materi melebihi batas ${SUMMARY_MAX_CHARS.toLocaleString('id-ID')} karakter. Silakan potong materi menjadi beberapa bagian terlebih dahulu.`,
        ),
    ),
  level: EducationLevelSchema,
});

export const SummaryOutputSchema = z.object({
  judul: z.string().trim().min(1, 'Judul rangkuman tidak boleh kosong.').max(300),
  intiPembahasan: z
    .string()
    .trim()
    .min(1, 'Inti pembahasan tidak boleh kosong.')
    .max(4000),
  poinPenting: z
    .array(z.string().trim().min(1))
    .min(1, 'Minimal harus ada 1 poin penting.')
    .max(25),
  kesimpulan: z
    .string()
    .trim()
    .min(1, 'Kesimpulan tidak boleh kosong.')
    .max(2500),
});

export const QuizGenerateRequestSchema = z.object({
  topic: z
    .string()
    .transform(sanitizeMaterialText)
    .pipe(
      z
        .string()
        .min(QUIZ_TOPIC_MIN_CHARS, 'Topik atau materi kuis minimal 3 karakter.')
        .max(
          QUIZ_TOPIC_MAX_CHARS,
          `Topik atau materi kuis maksimal ${QUIZ_TOPIC_MAX_CHARS.toLocaleString('id-ID')} karakter.`,
        ),
    ),
  difficulty: QuizDifficultySchema,
  count: z.union([z.literal(5), z.literal(10)]),
  level: EducationLevelSchema,
});

export const RawQuizQuestionSchema = z.object({
  pertanyaan: z.string().trim().min(5, 'Pertanyaan terlalu pendek.'),
  opsi: z
    .array(z.string().trim().min(1, 'Opsi jawaban tidak boleh kosong.'))
    .length(4, 'Setiap soal wajib memiliki tepat 4 opsi jawaban.'),
  indexJawabanBenar: z
    .number()
    .int()
    .min(0, 'Index jawaban benar minimal 0.')
    .max(3, 'Index jawaban benar maksimal 3.'),
  pembahasan: z.string().trim().min(5, 'Pembahasan wajib diisi.'),
});

export const RawQuizArraySchema = z.array(RawQuizQuestionSchema).min(1).max(10);

export const QuizSubmitRequestSchema = z.object({
  quizId: z.string().trim().min(1, 'ID kuis wajib diisi.').max(128),
  answers: z.array(z.number().int().min(0).max(3).nullable()).min(1).max(10),
});

export function stripMarkdownCodeFence(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

export function parseSummaryJson(raw: string): SummaryOutput {
  const cleaned = stripMarkdownCodeFence(raw);
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  const jsonSlice =
    firstBrace !== -1 && lastBrace > firstBrace
      ? cleaned.slice(firstBrace, lastBrace + 1)
      : cleaned;
  const parsed = JSON.parse(jsonSlice) as unknown;
  return SummaryOutputSchema.parse(parsed);
}

export function parseAndValidateQuizQuestions(
  raw: string,
  expectedCount: number,
  startId = 1,
): QuizQuestionFull[] {
  const cleaned = stripMarkdownCodeFence(raw);
  const parsedJson = JSON.parse(cleaned) as unknown;

  const arrayCandidate = Array.isArray(parsedJson)
    ? parsedJson
    : parsedJson && typeof parsedJson === 'object' && 'soal' in parsedJson
      ? (parsedJson as { soal: unknown }).soal
      : parsedJson;

  const validated = RawQuizArraySchema.parse(arrayCandidate);
  if (validated.length < expectedCount) {
    throw new Error(
      `Jumlah soal dari AI (${validated.length}) kurang dari permintaan (${expectedCount}).`,
    );
  }

  return validated.slice(0, expectedCount).map((item, idx) => ({
    id: startId + idx,
    pertanyaan: item.pertanyaan,
    opsi: [item.opsi[0], item.opsi[1], item.opsi[2], item.opsi[3]],
    indexJawabanBenar: item.indexJawabanBenar,
    pembahasan: item.pembahasan,
  }));
}
