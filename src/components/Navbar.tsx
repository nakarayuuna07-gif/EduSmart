import { AlertTriangle, BookOpen, Coins, Crown, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth.tsx';
import { AvatarInitials } from './AvatarInitials.tsx';

export type AppRoute =
  | '/'
  | '/masuk'
  | '/daftar'
  | '/dashboard'
  | '/tutor'
  | '/rangkuman'
  | '/kuis'
  | '/riwayat'
  | '/paket'
  | '/profil'
  | `/hasil/${string}`;

interface NavbarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

const AUTH_NAV_ITEMS = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'AI Tutor', path: '/tutor' },
  { label: 'Rangkuman', path: '/rangkuman' },
  { label: 'Kuis AI', path: '/kuis' },
  { label: 'Riwayat', path: '/riwayat' },
] as const;

export function Navbar({ currentPath, onNavigate }: NavbarProps) {
  const { user, profile, apiConfigured, hasUnlimited } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLinkClick = (path: string) => {
    setMobileOpen(false);
    onNavigate(path);
  };

  return (
    <div className="sticky top-0 z-40 bg-white border-b border-border-soft">
      {!apiConfigured && (
        <div
          role="alert"
          className="bg-surface-alt border-b border-primary-light px-4 py-2 text-xs sm:text-sm text-navy flex items-center justify-center gap-2"
        >
          <AlertTriangle className="w-4 h-4 text-primary shrink-0" />
          <span>
            API belum dikonfigurasi. Tambahkan <strong className="font-semibold">GEMINI_API_KEY</strong> di Secrets.
          </span>
        </div>
      )}

      <header className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zona 1: Brand wordmark */}
        <button
          type="button"
          onClick={() => handleLinkClick('/')}
          className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-navy whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md"
        >
          <span className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center shrink-0">
            <BookOpen className="w-4 h-4" />
          </span>
          <span>EduSmart AI</span>
        </button>

        {/* Zona 2: Navigasi desktop satu baris */}
        {user ? (
          <nav
            aria-label="Navigasi utama"
            className="hidden md:flex items-center gap-6 text-sm font-medium"
          >
            {AUTH_NAV_ITEMS.map((item) => {
              const isActive =
                currentPath === item.path ||
                (item.path === '/kuis' && currentPath.startsWith('/hasil/'));
              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => handleLinkClick(item.path)}
                  className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
                    isActive
                      ? 'text-primary border-primary font-semibold'
                      : 'text-ink-muted border-transparent hover:text-ink'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        ) : (
          <nav
            aria-label="Navigasi beranda"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-ink-muted"
          >
            <a
              href="#fitur"
              onClick={(e) => {
                if (currentPath !== '/') {
                  e.preventDefault();
                  handleLinkClick('/');
                }
              }}
              className="hover:text-ink transition-colors whitespace-nowrap shrink-0"
            >
              Fitur
            </a>
            <a
              href="#artikel"
              onClick={(e) => {
                if (currentPath !== '/') {
                  e.preventDefault();
                  handleLinkClick('/');
                }
              }}
              className="hover:text-ink transition-colors whitespace-nowrap shrink-0"
            >
              Artikel
            </a>
            <a
              href="#paket"
              onClick={(e) => {
                if (currentPath !== '/') {
                  e.preventDefault();
                  handleLinkClick('/');
                }
              }}
              className="hover:text-ink transition-colors whitespace-nowrap shrink-0"
            >
              Paket Kredit
            </a>
            <button
              type="button"
              onClick={() => handleLinkClick('/masuk')}
              className="hover:text-ink transition-colors whitespace-nowrap shrink-0"
            >
              Masuk
            </button>
          </nav>
        )}

        {/* Zona 3: Aksi utama */}
        <div className="flex items-center gap-2.5 shrink-0">
          {user ? (
            <div className="hidden md:flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleLinkClick('/paket')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                  currentPath === '/paket'
                    ? 'border-primary bg-primary text-white'
                    : 'border-border-soft bg-surface-alt text-navy hover:border-primary'
                }`}
                title="Lihat Saldo Kredit & Langganan"
              >
                {hasUnlimited ? (
                  <>
                    <Crown className="w-3.5 h-3.5 text-primary" />
                    <span>Unlimited</span>
                  </>
                ) : (
                  <>
                    <Coins className="w-3.5 h-3.5 text-primary" />
                    <span className="tabular-nums">
                      {(profile?.credits ?? 0).toLocaleString('id-ID')} Kredit
                    </span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleLinkClick('/profil')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                  currentPath === '/profil'
                    ? 'border-primary bg-surface-alt text-primary'
                    : 'border-border-soft bg-white text-ink hover:bg-surface-alt'
                }`}
                title="Buka Profil"
              >
                <AvatarInitials
                  name={profile?.name || user.displayName || 'Pelajar'}
                  size="sm"
                />
                <span className="text-sm font-medium max-w-[115px] truncate">
                  {profile?.name || user.displayName || 'Profil'}
                </span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => handleLinkClick('/daftar')}
              className="hidden md:inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-primary hover:bg-primary-dark rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Daftar Gratis
            </button>
          )}

          {/* Tombol menu mobile */}
          <button
            type="button"
            aria-label={mobileOpen ? 'Tutup menu' : 'Buka menu'}
            onClick={() => setMobileOpen((prev) => !prev)}
            className="md:hidden p-2 rounded-lg border border-border-soft text-ink hover:bg-surface-alt"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Drawer menu mobile */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border-soft bg-white px-4 py-3 space-y-1">
          {user ? (
            <>
              <button
                type="button"
                onClick={() => handleLinkClick('/paket')}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-surface-alt border border-border-soft text-xs font-semibold text-navy mb-2"
              >
                <span className="flex items-center gap-2">
                  {hasUnlimited ? (
                    <Crown className="w-4 h-4 text-primary" />
                  ) : (
                    <Coins className="w-4 h-4 text-primary" />
                  )}
                  <span>
                    {hasUnlimited
                      ? 'Langganan Unlimited Aktif'
                      : `Saldo: ${(profile?.credits ?? 0).toLocaleString('id-ID')} Kredit`}
                  </span>
                </span>
                <span className="text-primary">Isi / Paket</span>
              </button>

              {AUTH_NAV_ITEMS.map((item) => {
                const isActive = currentPath === item.path;
                return (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => handleLinkClick(item.path)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-surface-alt text-primary font-semibold'
                        : 'text-ink hover:bg-surface-alt'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => handleLinkClick('/profil')}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  currentPath === '/profil'
                    ? 'bg-surface-alt text-primary font-semibold'
                    : 'text-ink hover:bg-surface-alt'
                }`}
              >
                Profil ({profile?.name || 'Akun Saya'})
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => handleLinkClick('/')}
                className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-ink hover:bg-surface-alt"
              >
                Beranda
              </button>
              <button
                type="button"
                onClick={() => handleLinkClick('/masuk')}
                className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-ink hover:bg-surface-alt"
              >
                Masuk
              </button>
              <button
                type="button"
                onClick={() => handleLinkClick('/daftar')}
                className="w-full text-center px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-primary hover:bg-primary-dark"
              >
                Daftar Gratis
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
