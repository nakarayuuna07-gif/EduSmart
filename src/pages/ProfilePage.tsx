import {
  CheckCircle2,
  Coins,
  Crown,
  Loader2,
  LogOut,
  Save,
} from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { AvatarInitials } from '../components/AvatarInitials.tsx';
import { useAuth } from '../hooks/useAuth.tsx';
import { EDUCATION_LEVELS, type EducationLevel } from '../types/index.ts';

interface ProfilePageProps {
  onNavigate: (path: string) => void;
}

export function ProfilePage({ onNavigate }: ProfilePageProps) {
  const { user, profile, hasUnlimited, updateProfileData, logout } = useAuth();
  const [name, setName] = useState(profile?.name || user?.displayName || '');
  const [defaultLevel, setDefaultLevel] = useState<EducationLevel>(
    profile?.defaultLevel || 'SMA/SMK',
  );
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setDefaultLevel(profile.defaultLevel);
    }
  }, [profile]);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSavedMsg('');

    if (!name.trim()) {
      setError('Nama tidak boleh kosong.');
      return;
    }

    setSaving(true);
    try {
      await updateProfileData({ name: name.trim(), defaultLevel });
      setSavedMsg(
        'Profil berhasil diperbarui. Jenjang default otomatis diterapkan di semua fitur.',
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Gagal memperbarui profil.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    onNavigate('/masuk');
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold text-navy">Profil Pelajar</h1>
        <p className="text-sm text-ink-muted">
          Data profil, saldo kredit, dan jenjang pendidikan default bersifat privat hanya untuk akun ini.
        </p>
      </div>

      {/* Kartu Kredit & Paket */}
      <div className="bg-surface-alt border border-border-soft rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-lg bg-primary text-white flex items-center justify-center shrink-0">
            {hasUnlimited ? (
              <Crown className="w-5 h-5" />
            ) : (
              <Coins className="w-5 h-5" />
            )}
          </span>
          <div>
            <p className="text-xs font-medium text-ink-muted">
              {hasUnlimited ? 'Status Paket' : 'Saldo Kredit Tersedia'}
            </p>
            <p className="text-lg font-bold text-navy tabular-nums">
              {hasUnlimited
                ? 'Langganan Unlimited Aktif (1 Tahun)'
                : `${(profile?.credits ?? 0).toLocaleString('id-ID')} Kredit`}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('/paket')}
          className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-dark text-white text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap w-fit"
        >
          {hasUnlimited ? 'Lihat Detail Paket' : 'Beli Kredit / Unlimited'}
        </button>
      </div>

      <div className="bg-white border border-border-soft rounded-xl p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex items-center gap-4 pb-6 border-b border-border-soft">
          <AvatarInitials name={name || profile?.name || 'Pelajar'} size="lg" />
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-navy truncate">
              {profile?.name || user?.displayName || 'Pelajar EduSmart'}
            </h2>
            <p className="text-sm text-ink-muted truncate">
              {profile?.email || user?.email}
            </p>
            <p className="text-xs font-medium text-primary mt-1">
              Jenjang Default: {profile?.defaultLevel || defaultLevel}
            </p>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="p-3.5 rounded-lg bg-surface-alt border border-primary text-sm text-navy"
          >
            {error}
          </div>
        )}

        {savedMsg && (
          <div
            role="status"
            className="p-3.5 rounded-lg bg-surface-alt border border-primary text-sm text-navy flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
            <span>{savedMsg}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="profile-name" className="block text-sm font-medium text-ink">
              Nama Lengkap
            </label>
            <input
              id="profile-name"
              type="text"
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-border-soft text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="profile-email" className="block text-sm font-medium text-ink">
              Email Akun
            </label>
            <input
              id="profile-email"
              type="email"
              value={profile?.email || user?.email || ''}
              disabled
              className="w-full px-3.5 py-2.5 rounded-lg border border-border-soft bg-surface-alt text-sm text-ink-muted cursor-not-allowed"
            />
          </div>

          <div className="space-y-2">
            <span className="block text-sm font-medium text-ink">
              Jenjang Pendidikan Default
            </span>
            <p className="text-xs text-ink-muted">
              Otomatis terisi saat membuka AI Tutor, Rangkuman Materi, dan Kuis AI.
            </p>
            <div className="grid grid-cols-3 gap-2.5 pt-1">
              {EDUCATION_LEVELS.map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setDefaultLevel(lvl)}
                  className={`py-2.5 px-3 rounded-lg text-sm font-semibold border transition-colors ${
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

          <div className="pt-2 flex flex-wrap items-center justify-between gap-4 border-t border-border-soft">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary hover:bg-primary-dark text-white text-sm font-semibold transition-colors disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>{saving ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border-soft bg-white hover:bg-surface-alt text-ink text-sm font-semibold transition-colors"
            >
              <LogOut className="w-4 h-4 text-primary" />
              <span>Keluar</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
