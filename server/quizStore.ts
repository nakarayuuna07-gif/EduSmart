import crypto from 'crypto';
import type {
  EducationLevel,
  QuizDifficulty,
  QuizQuestionFull,
} from '../src/types/index.ts';

export interface QuizSessionRecord {
  quizId: string;
  uid: string;
  topic: string;
  level: EducationLevel;
  difficulty: QuizDifficulty;
  questions: QuizQuestionFull[];
  expiresAt: number;
}

const QUIZ_SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const sessions = new Map<string, QuizSessionRecord>();

function pruneExpiredSessions(): void {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now > session.expiresAt) {
      sessions.delete(id);
    }
  }
}

export function createQuizSession(params: {
  uid: string;
  topic: string;
  level: EducationLevel;
  difficulty: QuizDifficulty;
  questions: QuizQuestionFull[];
}): QuizSessionRecord {
  pruneExpiredSessions();
  const quizId = crypto.randomUUID();
  const record: QuizSessionRecord = {
    quizId,
    uid: params.uid,
    topic: params.topic,
    level: params.level,
    difficulty: params.difficulty,
    questions: params.questions,
    expiresAt: Date.now() + QUIZ_SESSION_TTL_MS,
  };
  sessions.set(quizId, record);
  return record;
}

export function getQuizSession(quizId: string, uid: string): QuizSessionRecord | null {
  pruneExpiredSessions();
  const session = sessions.get(quizId);
  if (!session) return null;
  if (session.uid !== uid) return null;
  if (Date.now() > session.expiresAt) {
    sessions.delete(quizId);
    return null;
  }
  return session;
}

export function deleteQuizSession(quizId: string): void {
  sessions.delete(quizId);
}
