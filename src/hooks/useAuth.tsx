import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile as updateFirebaseAuthProfile,
  type User,
} from 'firebase/auth';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { fetchApiHealth } from '../services/apiService.ts';
import { auth, googleProvider } from '../services/firebase.ts';
import {
  activateUnlimitedPlan,
  applyTopUpCredits,
  createUserProfile,
  deductProfileCredits,
  getUserProfile,
  initializeLegacyProfileCredits,
  subscribeUserProfile,
  updateUserProfile,
} from '../services/firestoreService.ts';
import type { EducationLevel, UserProfile } from '../types/index.ts';
import {
  canAffordCredit,
  INITIAL_USER_CREDITS,
  isUnlimitedActive,
} from '../utils/credits.ts';

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  authReady: boolean;
  apiConfigured: boolean;
  hasUnlimited: boolean;
  getIdToken: () => Promise<string>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (params: {
    name: string;
    email: string;
    password: string;
    defaultLevel: EducationLevel;
  }) => Promise<void>;
  signInWithGoogle: (defaultLevel?: EducationLevel) => Promise<void>;
  updateProfileData: (updates: {
    name: string;
    defaultLevel: EducationLevel;
  }) => Promise<void>;
  canAfford: (cost: number) => boolean;
  consumeCredits: (cost: number) => Promise<void>;
  buyTopUpCredits: (amount: number) => Promise<void>;
  subscribeUnlimitedYearly: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function translateFirebaseAuthError(err: unknown): string {
  const code =
    err && typeof err === 'object' && 'code' in err
      ? String((err as { code: unknown }).code)
      : '';

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Email atau kata sandi salah. Periksa kembali data masuk Anda.';
    case 'auth/email-already-in-use':
      return 'Email ini sudah terdaftar. Silakan masuk atau gunakan email lain.';
    case 'auth/weak-password':
      return 'Kata sandi terlalu lemah. Gunakan minimal 6 karakter.';
    case 'auth/invalid-email':
      return 'Format alamat email tidak valid.';
    case 'auth/popup-closed-by-user':
      return 'Jendela masuk Google ditutup sebelum selesai.';
    case 'auth/popup-blocked':
      return 'Popup browser diblokir. Izinkan popup untuk masuk dengan Google.';
    case 'auth/operation-not-allowed':
      return 'Metode login ini belum diaktifkan di Firebase Console (Authentication > Sign-in method).';
    case 'auth/too-many-requests':
      return 'Terlalu banyak percobaan login. Tunggu beberapa menit lalu coba lagi.';
    case 'auth/network-request-failed':
      return 'Koneksi internet bermasalah. Periksa jaringan Anda lalu coba lagi.';
    default:
      return err instanceof Error
        ? err.message
        : 'Terjadi kesalahan autentikasi. Silakan coba lagi.';
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [apiConfigured, setApiConfigured] = useState(true);

  useEffect(() => {
    void fetchApiHealth().then((health) => {
      setApiConfigured(health.apiConfigured);
    });
  }, []);

  const ensureProfile = useCallback(
    async (firebaseUser: User, preferredLevel: EducationLevel = 'SMA/SMK') => {
      const existing = await getUserProfile(firebaseUser.uid);
      if (existing) {
        if (typeof existing.credits !== 'number' || !existing.plan) {
          try {
            await initializeLegacyProfileCredits(firebaseUser.uid);
          } catch {
            // Fall back to default in-memory state if migration write fails
          }
          const normalized: UserProfile = {
            ...existing,
            credits:
              typeof existing.credits === 'number'
                ? existing.credits
                : INITIAL_USER_CREDITS,
            plan: existing.plan === 'unlimited' ? 'unlimited' : 'gratis',
            planExpiresAt:
              typeof existing.planExpiresAt === 'number'
                ? existing.planExpiresAt
                : 0,
          };
          setProfile(normalized);
          return normalized;
        }
        setProfile(existing);
        return existing;
      }

      const created = await createUserProfile({
        uid: firebaseUser.uid,
        name:
          firebaseUser.displayName ||
          firebaseUser.email?.split('@')[0] ||
          'Pelajar EduSmart',
        email: firebaseUser.email || 'pengguna@edusmart.id',
        defaultLevel: preferredLevel,
      });
      setProfile(created);
      return created;
    },
    [],
  );

  useEffect(() => {
    let unsubProfile: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }

      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          await ensureProfile(firebaseUser);
          unsubProfile = subscribeUserProfile(firebaseUser.uid, (next) => {
            if (next) setProfile(next);
          });
        } catch {
          setProfile({
            uid: firebaseUser.uid,
            name: firebaseUser.displayName || 'Pelajar EduSmart',
            email: firebaseUser.email || '',
            defaultLevel: 'SMA/SMK',
            credits: INITIAL_USER_CREDITS,
            plan: 'gratis',
            planExpiresAt: 0,
          });
        }
      } else {
        setProfile(null);
      }
      setAuthReady(true);
    });

    return () => {
      unsubscribe();
      if (unsubProfile) unsubProfile();
    };
  }, [ensureProfile]);

  const getIdToken = useCallback(async (): Promise<string> => {
    const current = auth.currentUser;
    if (!current) {
      throw new Error('Sesi tidak ditemukan. Silakan masuk kembali.');
    }
    return current.getIdToken();
  }, []);

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      try {
        const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
        await ensureProfile(cred.user);
      } catch (err) {
        throw new Error(translateFirebaseAuthError(err));
      }
    },
    [ensureProfile],
  );

  const registerWithEmail = useCallback(
    async (params: {
      name: string;
      email: string;
      password: string;
      defaultLevel: EducationLevel;
    }) => {
      try {
        const cred = await createUserWithEmailAndPassword(
          auth,
          params.email.trim(),
          params.password,
        );
        await updateFirebaseAuthProfile(cred.user, {
          displayName: params.name.trim(),
        });
        const created = await createUserProfile({
          uid: cred.user.uid,
          name: params.name.trim(),
          email: params.email.trim(),
          defaultLevel: params.defaultLevel,
        });
        setProfile(created);
      } catch (err) {
        throw new Error(translateFirebaseAuthError(err));
      }
    },
    [],
  );

  const signInWithGoogle = useCallback(
    async (defaultLevel: EducationLevel = 'SMA/SMK') => {
      try {
        const cred = await signInWithPopup(auth, googleProvider);
        await ensureProfile(cred.user, defaultLevel);
      } catch (err) {
        throw new Error(translateFirebaseAuthError(err));
      }
    },
    [ensureProfile],
  );

  const updateProfileData = useCallback(
    async (updates: { name: string; defaultLevel: EducationLevel }) => {
      if (!auth.currentUser) {
        throw new Error('Pengguna belum masuk.');
      }
      await updateUserProfile(auth.currentUser.uid, updates);
      if (auth.currentUser.displayName !== updates.name.trim()) {
        await updateFirebaseAuthProfile(auth.currentUser, {
          displayName: updates.name.trim(),
        });
      }
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              name: updates.name.trim(),
              defaultLevel: updates.defaultLevel,
            }
          : null,
      );
    },
    [],
  );

  const hasUnlimited = isUnlimitedActive(profile);

  const canAfford = useCallback(
    (cost: number) => canAffordCredit(profile, cost),
    [profile],
  );

  const consumeCredits = useCallback(
    async (cost: number) => {
      if (!auth.currentUser || !profile) return;
      if (isUnlimitedActive(profile)) return;
      const next = await deductProfileCredits(
        auth.currentUser.uid,
        profile.credits,
        cost,
      );
      setProfile((prev) => (prev ? { ...prev, credits: next } : null));
    },
    [profile],
  );

  const buyTopUpCredits = useCallback(
    async (amount: number) => {
      if (!auth.currentUser || !profile) {
        throw new Error('Silakan masuk terlebih dahulu.');
      }
      const next = await applyTopUpCredits(
        auth.currentUser.uid,
        profile.credits,
        amount,
      );
      setProfile((prev) => (prev ? { ...prev, credits: next } : null));
    },
    [profile],
  );

  const subscribeUnlimitedYearly = useCallback(async () => {
    if (!auth.currentUser) {
      throw new Error('Silakan masuk terlebih dahulu.');
    }
    const expiresAt = await activateUnlimitedPlan(auth.currentUser.uid);
    setProfile((prev) =>
      prev ? { ...prev, plan: 'unlimited', planExpiresAt: expiresAt } : null,
    );
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
    setUser(null);
    setProfile(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        authReady,
        apiConfigured,
        hasUnlimited,
        getIdToken,
        signInWithEmail,
        registerWithEmail,
        signInWithGoogle,
        updateProfileData,
        canAfford,
        consumeCredits,
        buyTopUpCredits,
        subscribeUnlimitedYearly,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth harus dipakai di dalam AuthProvider.');
  }
  return ctx;
}
