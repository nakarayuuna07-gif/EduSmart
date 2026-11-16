import type {
  QuizEvaluationItem,
  QuizQuestionFull,
  SummaryOutput,
} from '../types/index.ts';

export function evaluateQuizSubmission(
  questions: QuizQuestionFull[],
  answers: Array<number | null>,
): {
  score: number;
  correctCount: number;
  totalQuestions: number;
  items: QuizEvaluationItem[];
} {
  const totalQuestions = questions.length;
  let correctCount = 0;

  const items: QuizEvaluationItem[] = questions.map((q, index) => {
    const rawAns = answers[index];
    const userAnswer =
      typeof rawAns === 'number' && Number.isInteger(rawAns) && rawAns >= 0 && rawAns <= 3
        ? rawAns
        : null;
    const isCorrect = userAnswer === q.indexJawabanBenar;
    if (isCorrect) {
      correctCount += 1;
    }

    return {
      id: q.id,
      pertanyaan: q.pertanyaan,
      opsi: q.opsi,
      userAnswer,
      correctAnswer: q.indexJawabanBenar,
      isCorrect,
      pembahasan: q.pembahasan,
    };
  });

  const score = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

  return {
    score,
    correctCount,
    totalQuestions,
    items,
  };
}

function unescapeJsonString(raw: string): string {
  return raw
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '')
    .replace(/\\t/g, '  ')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}

function extractStringField(rawJson: string, fieldName: string): string {
  const keyRegex = new RegExp(`"${fieldName}"\\s*:\\s*"`, 'm');
  const match = keyRegex.exec(rawJson);
  if (!match) return '';

  let idx = match.index + match[0].length;
  let result = '';
  while (idx < rawJson.length) {
    const ch = rawJson[idx];
    if (ch === '\\' && idx + 1 < rawJson.length) {
      result += ch + rawJson[idx + 1];
      idx += 2;
      continue;
    }
    if (ch === '"') {
      break;
    }
    result += ch;
    idx += 1;
  }
  return unescapeJsonString(result).trim();
}

function extractStringArrayField(rawJson: string, fieldName: string): string[] {
  const keyRegex = new RegExp(`"${fieldName}"\\s*:\\s*\\[`, 'm');
  const match = keyRegex.exec(rawJson);
  if (!match) return [];

  let idx = match.index + match[0].length;
  const items: string[] = [];
  let inString = false;
  let current = '';

  while (idx < rawJson.length) {
    const ch = rawJson[idx];
    if (!inString) {
      if (ch === ']') break;
      if (ch === '"') {
        inString = true;
        current = '';
      }
      idx += 1;
      continue;
    }

    if (ch === '\\' && idx + 1 < rawJson.length) {
      current += ch + rawJson[idx + 1];
      idx += 2;
      continue;
    }
    if (ch === '"') {
      inString = false;
      const cleaned = unescapeJsonString(current).trim();
      if (cleaned) items.push(cleaned);
      idx += 1;
      continue;
    }
    current += ch;
    idx += 1;
  }

  if (inString && current.trim()) {
    items.push(unescapeJsonString(current).trim());
  }

  return items;
}

export function extractPartialSummary(rawText: string): Partial<SummaryOutput> {
  return {
    judul: extractStringField(rawText, 'judul'),
    intiPembahasan: extractStringField(rawText, 'intiPembahasan'),
    poinPenting: extractStringArrayField(rawText, 'poinPenting'),
    kesimpulan: extractStringField(rawText, 'kesimpulan'),
  };
}

export function formatSummaryAsPlainText(summary: SummaryOutput): string {
  const bullets = summary.poinPenting.map((p) => `- ${p}`).join('\n');
  return [
    summary.judul,
    '',
    'Inti Pembahasan:',
    summary.intiPembahasan,
    '',
    'Poin Penting:',
    bullets,
    '',
    'Kesimpulan:',
    summary.kesimpulan,
  ].join('\n');
}
