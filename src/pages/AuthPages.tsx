import { ArrowRight, Loader2, LogIn, UserPlus } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../hooks/useAuth.tsx';
import { EDUCATION_LEVELS, type EducationLevel } from '../types/index.ts';

interface AuthPageProps {
  onNavigate: (path: string) => void;
}

function GoogleIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
      />
    </svg>
  );
}

export function LoginPage({ onNavigate }: AuthPageProps) {
  const { user, signInWithEmail, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      onNavigate('/dashboard');
    }
  }, [user, onNavigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Email dan kata sandi wajib diisi.');
      return;
    }

    setLoading(true);
    try {
      await signInWithEmail(email, password);
      onNavigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal masuk ke akun.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithGoogle();
      onNavigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal masuk dengan Google.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-surface-alt flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white border border-border-soft rounded-xl p-6 sm:p-8 shadow-sm space-y-6">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold text-navy">Masuk ke EduSmart AI</h1>
          <p className="text-sm text-ink-muted">
            Lanjutkan sesi AI Tutor, rangkuman materi, dan evaluasi kuismu.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="p-3.5 rounded-lg bg-surface-alt border border-primary text-sm text-navy"
          >
            {error}
          </div>
        )}

        <button
          type="button"
          disabled={loading}
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-lg border border-border-soft bg-white hover:bg-surface-alt text-ink font-semibold text-sm transition-colors disabled:opacity-60"
        >
          <GoogleIcon />
          <span>Masuk dengan Google</span>
        </button>

        <div className="relative flex items-center">
          <div className="flex-grow border-t border-border-soft" />
          <span className="px-3 text-xs text-ink-muted bg-white">atau dengan email</span>
          <div className="flex-grow border-t border-border-soft" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="login-email" className="block text-sm font-medium text-ink">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@email.com"
              className="w-full px-3.5 py-2.5 rounded-lg border border-border-soft text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="login-password" className="block text-sm font-medium text-ink">
              Kata Sandi
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Masukkan kata sandi"
              className="w-full px-3.5 py-2.5 rounded-lg border border-border-soft text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary-dark text-white font-semibold text-sm transition-colors disabled:opacity-60"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <LogIn className="w-4 h-4" />
            )}
            <span>{loading ? 'Memproses...' : 'Masuk'}</span>
          </button>
        </form>

        <p className="text-center text-sm text-ink-muted">
          Belum punya akun?{' '}
          <button
            type="button"
            onClick={() => onNavigate('/daftar')}
            className="font-semibold text-primary hover:text-primary-dark"
          >
            Daftar di sini
          </button>
        </p>
      </div>
    </div>
  );
}

export function RegisterPage({ onNavigate }: AuthPageProps) {
  const { user, registerWithEmail, signInWithGoogle } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [defaultLevel, setDefaultLevel] = useState<EducationLevel>('SMA/SMK');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      onNavigate('/dashboard');
    }
  }, [user, onNavigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Nama lengkap wajib diisi.');
      return;
    }
    if (!email.trim()) {
      setError('Alamat email wajib diisi.');
      return;
    }
    if (password.length < 6) {
      setError('Kata sandi minimal 6 karakter.');
      return;
    }

    setLoading(true);
    try {
      await registerWithEmail({ name, email, password, defaultLevel });
      onNavigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mendaftarkan akun.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithGoogle(defaultLevel);
      onNavigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mendaftar dengan Google.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-surface-alt flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white border border-border-soft rounded-xl p-6 sm:p-8 shadow-sm space-y-6">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold text-navy">Daftar Akun Baru</h1>
          <p className="text-sm text-ink-muted">
            Setiap akun memiliki ruang belajar dan riwayat tersimpan terpisah.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="p-3.5 rounded-lg bg-surface-alt border border-primary text-sm text-navy"
          >
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <span className="block text-sm font-medium text-ink">
            Jenjang Pendidikan Default
          </span>
          <div className="grid grid-cols-3 gap-2">
            {EDUCATION_LEVELS.map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setDefaultLevel(lvl)}
                className={`py-2 px-2 rounded-lg text-xs sm:text-sm font-semibold border transition-colors ${
                  defaultLevel === lvl
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-ink border-border-soft hover:bg-surface-alt'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={handleGoogleRegister}
          className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-lg border border-border-soft bg-white hover:bg-surface-alt text-ink font-semibold text-sm transition-colors disabled:opacity-60"
        >
          <GoogleIcon />
          <span>Masuk / Daftar dengan Google</span>
        </button>

        <div className="relative flex items-center">
          <div className="flex-grow border-t border-border-soft" />
          <span className="px-3 text-xs text-ink-muted bg-white">atau daftar email</span>
          <div className="flex-grow border-t border-border-soft" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="reg-name" className="block text-sm font-medium text-ink">
              Nama Lengkap
            </label>
            <input
              id="reg-name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Budi Santoso"
              maxLength={100}
              className="w-full px-3.5 py-2.5 rounded-lg border border-border-soft text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="reg-email" className="block text-sm font-medium text-ink">
              Email
            </label>
            <input
              id="reg-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@email.com"
              className="w-full px-3.5 py-2.5 rounded-lg border border-border-soft text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="reg-password" className="block text-sm font-medium text-ink">
              Kata Sandi
            </label>
            <input
              id="reg-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimal 6 karakter"
              minLength={6}
              className="w-full px-3.5 py-2.5 rounded-lg border border-border-soft text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary-dark text-white font-semibold text-sm transition-colors disabled:opacity-60"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <UserPlus className="w-4 h-4" />
            )}
            <span>{loading ? 'Mendaftarkan...' : 'Buat Akun'}</span>
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>

        <p className="text-center text-sm text-ink-muted">
          Sudah punya akun?{' '}
          <button
            type="button"
            onClick={() => onNavigate('/masuk')}
            className="font-semibold text-primary hover:text-primary-dark"
          >
            Masuk di sini
          </button>
        </p>
      </div>
    </div>
  );
}
