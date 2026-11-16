import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase.ts';
import type {
  ChatMessage,
  ChatSessionDoc,
  EducationLevel,
  QuizEvaluationItem,
  QuizResultDoc,
  Subject,
  SummaryDoc,
  SummaryOutput,
  UserPlan,
  UserProfile,
} from '../types/index.ts';
import {
  computeDeductedCredits,
  INITIAL_USER_CREDITS,
} from '../utils/credits.ts';

function toMillis(ts: unknown): number {
  if (ts instanceof Timestamp) return ts.toMillis();
  if (typeof ts === 'number') return ts;
  if (ts && typeof ts === 'object' && 'seconds' in ts) {
    return Number((ts as { seconds: number }).seconds) * 1000;
  }
  return 0;
}

export function formatFirestoreDate(ts: unknown): string {
  const ms = toMillis(ts);
  if (!ms) return 'Baru saja';
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ms));
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const path = `users/${uid}/profile/main`;
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'profile', 'main'));
    if (!snap.exists()) return null;
    return snap.data() as UserProfile;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export function subscribeUserProfile(
  uid: string,
  onData: (profile: UserProfile | null) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, 'users', uid, 'profile', 'main'),
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      const raw = snap.data() as Partial<UserProfile>;
      onData({
        uid: raw.uid || uid,
        name: raw.name || 'Pelajar EduSmart',
        email: raw.email || '',
        defaultLevel: raw.defaultLevel || 'SMA/SMK',
        credits:
          typeof raw.credits === 'number' ? raw.credits : INITIAL_USER_CREDITS,
        plan: raw.plan === 'unlimited' ? 'unlimited' : 'gratis',
        planExpiresAt:
          typeof raw.planExpiresAt === 'number' ? raw.planExpiresAt : 0,
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
      });
    },
    (err) => {
      console.error('Gagal menyinkronkan profil:', err);
    },
  );
}

export async function createUserProfile(params: {
  uid: string;
  name: string;
  email: string;
  defaultLevel: EducationLevel;
}): Promise<UserProfile> {
  const path = `users/${params.uid}/profile/main`;
  const cleanName = params.name.trim().slice(0, 100) || 'Pelajar EduSmart';
  const cleanEmail = params.email.trim().slice(0, 254);
  try {
    const payload = {
      uid: params.uid,
      name: cleanName,
      email: cleanEmail,
      defaultLevel: params.defaultLevel,
      credits: INITIAL_USER_CREDITS,
      plan: 'gratis' as UserPlan,
      planExpiresAt: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(doc(db, 'users', params.uid, 'profile', 'main'), payload);
    return {
      uid: params.uid,
      name: cleanName,
      email: cleanEmail,
      defaultLevel: params.defaultLevel,
      credits: INITIAL_USER_CREDITS,
      plan: 'gratis',
      planExpiresAt: 0,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function initializeLegacyProfileCredits(uid: string): Promise<void> {
  const path = `users/${uid}/profile/main`;
  try {
    await updateDoc(doc(db, 'users', uid, 'profile', 'main'), {
      credits: INITIAL_USER_CREDITS,
      plan: 'gratis',
      planExpiresAt: 0,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function updateUserProfile(
  uid: string,
  updates: { name: string; defaultLevel: EducationLevel },
): Promise<void> {
  const path = `users/${uid}/profile/main`;
  const cleanName = updates.name.trim().slice(0, 100) || 'Pelajar EduSmart';
  try {
    await updateDoc(doc(db, 'users', uid, 'profile', 'main'), {
      name: cleanName,
      defaultLevel: updates.defaultLevel,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deductProfileCredits(
  uid: string,
  currentCredits: number,
  cost: number,
): Promise<number> {
  const path = `users/${uid}/profile/main`;
  const nextCredits = computeDeductedCredits(currentCredits, cost);
  try {
    await updateDoc(doc(db, 'users', uid, 'profile', 'main'), {
      credits: nextCredits,
      updatedAt: serverTimestamp(),
    });
    return nextCredits;
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function applyTopUpCredits(
  uid: string,
  currentCredits: number,
  addedCredits: number,
): Promise<number> {
  const path = `users/${uid}/profile/main`;
  const nextCredits = Math.min(1_000_000, currentCredits + addedCredits);
  try {
    await updateDoc(doc(db, 'users', uid, 'profile', 'main'), {
      credits: nextCredits,
      updatedAt: serverTimestamp(),
    });
    return nextCredits;
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function activateUnlimitedPlan(uid: string): Promise<number> {
  const path = `users/${uid}/profile/main`;
  const oneYearMs = 365 * 24 * 60 * 60 * 1000;
  const expiresAt = Date.now() + oneYearMs;
  try {
    await updateDoc(doc(db, 'users', uid, 'profile', 'main'), {
      plan: 'unlimited',
      planExpiresAt: expiresAt,
      updatedAt: serverTimestamp(),
    });
    return expiresAt;
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

function sanitizeMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.slice(-100).map((msg) => ({
    id: msg.id,
    role: msg.role,
    text: msg.text,
    sources: Array.isArray(msg.sources) ? msg.sources.slice(0, 10) : [],
    hasGrounding: Boolean(msg.hasGrounding),
    createdAt: msg.createdAt,
  }));
}

export async function saveChatSession(
  uid: string,
  chatId: string,
  data: {
    title: string;
    level: EducationLevel;
    subject: Subject;
    messages: ChatMessage[];
  },
  isNew: boolean,
): Promise<void> {
  const path = `users/${uid}/chats/${chatId}`;
  const cleanTitle = data.title.trim().slice(0, 160) || 'Percakapan Baru';
  const cleanMessages = sanitizeMessages(data.messages);

  try {
    const docRef = doc(db, 'users', uid, 'chats', chatId);
    if (isNew) {
      await setDoc(docRef, {
        uid,
        title: cleanTitle,
        level: data.level,
        subject: data.subject,
        messages: cleanMessages,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(docRef, {
        title: cleanTitle,
        level: data.level,
        subject: data.subject,
        messages: cleanMessages,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(
      err,
      isNew ? OperationType.CREATE : OperationType.UPDATE,
      path,
    );
  }
}

export async function deleteChatSession(uid: string, chatId: string): Promise<void> {
  const path = `users/${uid}/chats/${chatId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'chats', chatId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export function subscribeChats(
  uid: string,
  onData: (chats: ChatSessionDoc[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const path = `users/${uid}/chats`;
  const q = query(collection(db, 'users', uid, 'chats'), where('uid', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: ChatSessionDoc[] = snapshot.docs.map((d) => ({
        ...(d.data() as Omit<ChatSessionDoc, 'id'>),
        id: d.id,
      }));
      items.sort((a, b) => toMillis(b.updatedAt) - toMillis(a.updatedAt));
      onData(items);
    },
    (err) => {
      if (onError) {
        onError(err);
      } else {
        handleFirestoreError(err, OperationType.LIST, path);
      }
    },
  );
}

export async function saveSummaryRecord(
  uid: string,
  summaryId: string,
  data: {
    level: EducationLevel;
    inputLength: number;
    sourceText: string;
    result: SummaryOutput;
  },
): Promise<void> {
  const path = `users/${uid}/summaries/${summaryId}`;
  const preview = data.sourceText.trim().replace(/\s+/g, ' ').slice(0, 220) || 'Materi';
  try {
    await setDoc(doc(db, 'users', uid, 'summaries', summaryId), {
      uid,
      level: data.level,
      inputLength: data.inputLength,
      sourcePreview: preview,
      result: {
        judul: data.result.judul.slice(0, 300),
        intiPembahasan: data.result.intiPembahasan.slice(0, 4000),
        poinPenting: data.result.poinPenting.slice(0, 25),
        kesimpulan: data.result.kesimpulan.slice(0, 2500),
      },
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function deleteSummaryRecord(
  uid: string,
  summaryId: string,
): Promise<void> {
  const path = `users/${uid}/summaries/${summaryId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'summaries', summaryId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export function subscribeSummaries(
  uid: string,
  onData: (summaries: SummaryDoc[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const path = `users/${uid}/summaries`;
  const q = query(
    collection(db, 'users', uid, 'summaries'),
    where('uid', '==', uid),
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const items: SummaryDoc[] = snapshot.docs.map((d) => ({
        ...(d.data() as Omit<SummaryDoc, 'id'>),
        id: d.id,
      }));
      items.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
      onData(items);
    },
    (err) => {
      if (onError) {
        onError(err);
      } else {
        handleFirestoreError(err, OperationType.LIST, path);
      }
    },
  );
}

export async function saveQuizResultRecord(
  uid: string,
  quizResultId: string,
  data: {
    topic: string;
    level: EducationLevel;
    difficulty: 'Mudah' | 'Sedang' | 'Sulit';
    score: number;
    correctCount: number;
    totalQuestions: number;
    items: QuizEvaluationItem[];
  },
): Promise<void> {
  const path = `users/${uid}/quizResults/${quizResultId}`;
  try {
    await setDoc(doc(db, 'users', uid, 'quizResults', quizResultId), {
      uid,
      topic: data.topic.slice(0, 5000),
      level: data.level,
      difficulty: data.difficulty,
      score: data.score,
      correctCount: data.correctCount,
      totalQuestions: data.totalQuestions,
      items: data.items,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function deleteQuizResultRecord(
  uid: string,
  quizResultId: string,
): Promise<void> {
  const path = `users/${uid}/quizResults/${quizResultId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'quizResults', quizResultId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export function subscribeQuizResults(
  uid: string,
  onData: (results: QuizResultDoc[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const path = `users/${uid}/quizResults`;
  const q = query(
    collection(db, 'users', uid, 'quizResults'),
    where('uid', '==', uid),
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const items: QuizResultDoc[] = snapshot.docs.map((d) => ({
        ...(d.data() as Omit<QuizResultDoc, 'id'>),
        id: d.id,
      }));
      items.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
      onData(items);
    },
    (err) => {
      if (onError) {
        onError(err);
      } else {
        handleFirestoreError(err, OperationType.LIST, path);
      }
    },
  );
}

export async function getQuizResultById(
  uid: string,
  quizResultId: string,
): Promise<QuizResultDoc | null> {
  const path = `users/${uid}/quizResults/${quizResultId}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'quizResults', quizResultId));
    if (!snap.exists()) return null;
    return {
      ...(snap.data() as Omit<QuizResultDoc, 'id'>),
      id: snap.id,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}
