import {
  CheckCircle2,
  Coins,
  Crown,
  Loader2,
  QrCode,
  ShieldCheck,
  Smartphone,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth.tsx';
import type {
  CreditPackageId,
  EWalletProvider,
  PaymentMethod,
} from '../types/index.ts';
import {
  CREDIT_PACKAGES,
  QUIZ_CREDIT_COSTS,
  SUMMARY_CREDIT_COST,
  TUTOR_CREDIT_COST,
  type CreditPackageOption,
} from '../utils/credits.ts';

interface PricingPageProps {
  onNavigate: (path: string) => void;
}

const EWALLET_LIST: EWalletProvider[] = ['GoPay', 'OVO', 'DANA', 'ShopeePay'];

function SimulatedQrisGraphic() {
  const cells = [
    1, 1, 1, 0, 1, 0, 1, 1, 1,
    1, 0, 1, 1, 0, 1, 1, 0, 1,
    1, 1, 1, 0, 1, 0, 1, 1, 1,
    0, 1, 0, 1, 1, 1, 0, 1, 0,
    1, 0, 1, 0, 1, 0, 1, 0, 1,
    0, 1, 1, 1, 0, 1, 0, 1, 0,
    1, 1, 1, 0, 1, 1, 1, 0, 1,
    1, 0, 1, 1, 0, 0, 0, 1, 1,
    1, 1, 1, 0, 1, 1, 1, 0, 1,
  ];
  return (
    <div className="p-4 bg-white border border-border-soft rounded-xl inline-flex flex-col items-center gap-2 shadow-sm">
      <div className="grid grid-cols-9 gap-1 w-40 h-40 p-2 bg-white">
        {cells.map((filled, idx) => (
          <div
            key={idx}
            className={`rounded-[1px] ${filled ? 'bg-navy' : 'bg-white'}`}
          />
        ))}
      </div>
      <p className="text-[11px] font-mono text-ink-muted">
        QRIS · EduSmart AI Indonesia
      </p>
    </div>
  );
}

export function PricingPage({ onNavigate }: PricingPageProps) {
  const { user, profile, hasUnlimited, buyTopUpCredits, subscribeUnlimitedYearly } =
    useAuth();
  const [selectedPkg, setSelectedPkg] = useState<CreditPackageOption | null>(
    null,
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('qris');
  const [ewallet, setEwallet] = useState<EWalletProvider>('GoPay');
  const [phone, setPhone] = useState('081234567890');
  const [processing, setProcessing] = useState(false);
  const [receipt, setReceipt] = useState<{
    title: string;
    detail: string;
    txId: string;
  } | null>(null);
  const [error, setError] = useState('');

  const handleStartCheckout = (pkg: CreditPackageOption) => {
    if (!user) {
      onNavigate('/masuk');
      return;
    }
    setReceipt(null);
    setError('');
    setSelectedPkg(pkg);
  };

  const handleConfirmPayment = async () => {
    if (!selectedPkg || processing) return;
    if (paymentMethod === 'ewallet' && phone.trim().length < 8) {
      setError('Masukkan nomor HP E-Wallet minimal 8 digit untuk simulasi.');
      return;
    }

    setError('');
    setProcessing(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 650));

      const pkgId: CreditPackageId = selectedPkg.id;
      if (pkgId === 'topup_1000') {
        await buyTopUpCredits(selectedPkg.creditGrant);
      } else {
        await subscribeUnlimitedYearly();
      }

      const methodLabel =
        paymentMethod === 'qris' ? 'QRIS Instan' : `E-Wallet (${ewallet})`;
      const txId = `EDU-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

      setReceipt({
        title:
          pkgId === 'topup_1000'
            ? '+1.000 Kredit Berhasil Ditambahkan'
            : 'Langganan Unlimited 1 Tahun Aktif',
        detail: `${selectedPkg.title} (${selectedPkg.priceLabel}) via ${methodLabel}`,
        txId,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Gagal memproses simulasi pembayaran.',
      );
    } finally {
      setProcessing(false);
    }
  };

  const activeUntilLabel =
    hasUnlimited && profile?.planExpiresAt
      ? new Intl.DateTimeFormat('id-ID', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }).format(new Date(profile.planExpiresAt))
      : '';

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Status Kredit */}
      <div className="bg-surface-alt border border-border-soft rounded-xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-primary">
            Saldo &amp; Paket EduSmart AI
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-navy">
            Isi Kredit atau Aktifkan Unlimited
          </h1>
          <p className="text-sm text-ink-muted max-w-xl">
            Setiap akun baru memperoleh 100 kredit gratis. Kredit hanya berkurang saat AI berhasil memberi jawaban—jika terjadi error atau timeout, kredit Anda tetap utuh.
          </p>
        </div>

        {user && (
          <div className="bg-white border border-border-soft rounded-xl px-5 py-4 shadow-sm shrink-0 space-y-1 min-w-[210px]">
            <p className="text-xs font-medium text-ink-muted">Status Akun Saat Ini</p>
            {hasUnlimited ? (
              <div className="space-y-0.5">
                <p className="text-xl font-bold text-primary flex items-center gap-1.5">
                  <Crown className="w-5 h-5" />
                  <span>Unlimited Aktif</span>
                </p>
                <p className="text-xs text-ink-muted">
                  Berlaku hingga {activeUntilLabel}
                </p>
              </div>
            ) : (
              <div className="space-y-0.5">
                <p className="text-2xl font-bold text-navy tabular-nums flex items-center gap-2">
                  <Coins className="w-5 h-5 text-primary" />
                  <span>{(profile?.credits ?? 0).toLocaleString('id-ID')} Kredit</span>
                </p>
                <p className="text-xs text-ink-muted">Paket Gratis · Bayar sesuai pakai</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Pilihan Paket */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
        {CREDIT_PACKAGES.map((pkg) => {
          const isUnlimitedPkg = pkg.id === 'unlimited_yearly';
          return (
            <div
              key={pkg.id}
              className={`rounded-xl p-6 sm:p-8 border shadow-sm flex flex-col justify-between space-y-6 ${
                isUnlimitedPkg
                  ? 'bg-white border-primary ring-1 ring-primary/20'
                  : 'bg-white border-border-soft'
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-primary">
                      {pkg.badge}
                    </p>
                    <h2 className="text-xl font-bold text-navy mt-0.5">
                      {pkg.title}
                    </h2>
                    <p className="text-sm text-ink-muted">{pkg.subtitle}</p>
                  </div>
                </div>

                <p className="text-3xl font-bold text-navy tabular-nums">
                  {pkg.priceLabel}
                </p>

                <ul className="space-y-2.5 pt-2 border-t border-border-soft">
                  {pkg.benefits.map((b) => (
                    <li
                      key={b}
                      className="flex items-start gap-2.5 text-sm text-ink"
                    >
                      <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                type="button"
                onClick={() => handleStartCheckout(pkg)}
                className={`w-full py-3 px-5 rounded-lg text-sm font-semibold transition-colors ${
                  isUnlimitedPkg
                    ? 'bg-primary hover:bg-primary-dark text-white'
                    : 'bg-navy hover:bg-primary text-white'
                }`}
              >
                {isUnlimitedPkg
                  ? hasUnlimited
                    ? 'Perpanjang Langganan Unlimited'
                    : 'Langganan Unlimited (QRIS / E-Wallet)'
                  : 'Beli 1.000 Kredit (QRIS / E-Wallet)'}
              </button>
            </div>
          );
        })}
      </div>

      {/* Rincian Penggunaan Kredit */}
      <div className="bg-white border border-border-soft rounded-xl p-6 shadow-sm space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-navy">
            Rincian Pemakaian Kredit per Fitur
          </h2>
          <p className="text-xs sm:text-sm text-ink-muted">
            Dengan 100 kredit awal, Anda bisa mencoba ~10x AI Tutor / Rangkuman atau maksimal 3x Kuis Mudah (5 soal). Kuis Sedang &amp; Sulit membutuhkan kredit lebih tinggi karena kompleksitas penalaran soal.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-border-soft text-xs text-ink-muted">
                <th className="py-2.5 pr-4 font-semibold">Fitur</th>
                <th className="py-2.5 pr-4 font-semibold">Keterangan</th>
                <th className="py-2.5 text-right font-semibold">Biaya Kredit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-soft text-ink">
              <tr>
                <td className="py-3 pr-4 font-medium text-navy">AI Tutor</td>
                <td className="py-3 pr-4 text-ink-muted">Per 1 pertanyaan terjawab sukses</td>
                <td className="py-3 text-right font-semibold tabular-nums text-primary">
                  {TUTOR_CREDIT_COST} Kredit
                </td>
              </tr>
              <tr>
                <td className="py-3 pr-4 font-medium text-navy">Rangkuman Materi</td>
                <td className="py-3 pr-4 text-ink-muted">Per 1 rangkuman 4 bagian sukses</td>
                <td className="py-3 text-right font-semibold tabular-nums text-primary">
                  {SUMMARY_CREDIT_COST} Kredit
                </td>
              </tr>
              <tr>
                <td className="py-3 pr-4 font-medium text-navy">Kuis AI · Mudah (5 Soal)</td>
                <td className="py-3 pr-4 text-ink-muted">Maksimal 3x dengan 100 kredit awal</td>
                <td className="py-3 text-right font-semibold tabular-nums text-primary">
                  {QUIZ_CREDIT_COSTS.Mudah[5]} Kredit
                </td>
              </tr>
              <tr>
                <td className="py-3 pr-4 font-medium text-navy">Kuis AI · Sedang (5 Soal)</td>
                <td className="py-3 pr-4 text-ink-muted">Tingkat analisis menengah</td>
                <td className="py-3 text-right font-semibold tabular-nums text-primary">
                  {QUIZ_CREDIT_COSTS.Sedang[5]} Kredit
                </td>
              </tr>
              <tr>
                <td className="py-3 pr-4 font-medium text-navy">Kuis AI · Sulit (5 Soal)</td>
                <td className="py-3 pr-4 text-ink-muted">Penalaran HOTS intensif</td>
                <td className="py-3 text-right font-semibold tabular-nums text-primary">
                  {QUIZ_CREDIT_COSTS.Sulit[5]} Kredit
                </td>
              </tr>
              <tr>
                <td className="py-3 pr-4 font-medium text-navy">Kuis AI · 10 Soal (Mudah / Sedang / Sulit)</td>
                <td className="py-3 pr-4 text-ink-muted">Paket evaluasi lengkap 10 butir</td>
                <td className="py-3 text-right font-semibold tabular-nums text-primary">
                  {QUIZ_CREDIT_COSTS.Mudah[10]} / {QUIZ_CREDIT_COSTS.Sedang[10]} /{' '}
                  {QUIZ_CREDIT_COSTS.Sulit[10]} Kredit
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Checkout Simulasi QRIS & E-Wallet */}
      {selectedPkg && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-navy/50 flex items-center justify-center p-4"
        >
          <div className="w-full max-w-lg bg-white border border-border-soft rounded-xl shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border-soft bg-surface-alt flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-primary">
                  Simulasi Checkout Pembayaran
                </p>
                <h3 className="text-base font-bold text-navy">
                  {selectedPkg.title} · {selectedPkg.priceLabel}
                </h3>
              </div>
              <button
                type="button"
                aria-label="Tutup checkout"
                onClick={() => setSelectedPkg(null)}
                className="p-1.5 rounded-lg text-ink-muted hover:text-navy hover:bg-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {receipt ? (
                <div className="text-center space-y-4 py-2">
                  <div className="w-12 h-12 rounded-full bg-primary-light text-primary flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-lg font-bold text-navy">{receipt.title}</h4>
                    <p className="text-sm text-ink-muted">{receipt.detail}</p>
                    <p className="text-xs font-mono text-ink-muted pt-1">
                      ID Transaksi Simulasi: {receipt.txId}
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPkg(null);
                        onNavigate('/tutor');
                      }}
                      className="px-5 py-2.5 rounded-lg bg-primary hover:bg-primary-dark text-white text-sm font-semibold"
                    >
                      Lanjut Belajar Sekarang
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedPkg(null)}
                      className="px-4 py-2.5 rounded-lg border border-border-soft text-sm font-semibold text-ink hover:bg-surface-alt"
                    >
                      Tutup
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Pilih Metode */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('qris')}
                      className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg border text-sm font-semibold transition-colors ${
                        paymentMethod === 'qris'
                          ? 'bg-primary text-white border-primary'
                          : 'bg-white text-ink border-border-soft hover:bg-surface-alt'
                      }`}
                    >
                      <QrCode className="w-4 h-4" />
                      <span>QRIS</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('ewallet')}
                      className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg border text-sm font-semibold transition-colors ${
                        paymentMethod === 'ewallet'
                          ? 'bg-primary text-white border-primary'
                          : 'bg-white text-ink border-border-soft hover:bg-surface-alt'
                      }`}
                    >
                      <Smartphone className="w-4 h-4" />
                      <span>E-Wallet</span>
                    </button>
                  </div>

                  {paymentMethod === 'qris' ? (
                    <div className="bg-surface-alt border border-border-soft rounded-xl p-5 text-center space-y-3">
                      <SimulatedQrisGraphic />
                      <p className="text-xs text-ink-muted leading-relaxed">
                        Mode simulasi presentasi: klik tombol konfirmasi di bawah untuk langsung memverifikasi pembayaran QRIS dan memperbarui saldo akun.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4 bg-surface-alt border border-border-soft rounded-xl p-4">
                      <div className="space-y-1.5">
                        <span className="block text-xs font-semibold text-ink-muted">
                          Pilih Dompet Digital
                        </span>
                        <div className="grid grid-cols-4 gap-2">
                          {EWALLET_LIST.map((wallet) => (
                            <button
                              key={wallet}
                              type="button"
                              onClick={() => setEwallet(wallet)}
                              className={`py-2 px-2 rounded-lg text-xs font-semibold border transition-colors ${
                                ewallet === wallet
                                  ? 'bg-primary text-white border-primary'
                                  : 'bg-white text-ink border-border-soft hover:bg-white/80'
                              }`}
                            >
                              {wallet}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label
                          htmlFor="ewallet-phone"
                          className="block text-xs font-semibold text-ink-muted"
                        >
                          Nomor HP {ewallet} (Simulasi)
                        </label>
                        <input
                          id="ewallet-phone"
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="081234567890"
                          className="w-full px-3 py-2 rounded-lg border border-border-soft bg-white text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                    </div>
                  )}

                  {error && (
                    <div className="p-3 rounded-lg bg-surface-alt border border-primary text-xs text-navy">
                      {error}
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-3 pt-2 border-t border-border-soft">
                    <div className="flex items-center gap-1.5 text-xs text-ink-muted">
                      <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
                      <span>Simulasi checkout aman (tanpa tagihan nyata)</span>
                    </div>
                    <button
                      type="button"
                      disabled={processing}
                      onClick={() => void handleConfirmPayment()}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary hover:bg-primary-dark text-white text-sm font-semibold transition-colors disabled:opacity-60 whitespace-nowrap"
                    >
                      {processing && <Loader2 className="w-4 h-4 animate-spin" />}
                      <span>
                        {processing
                          ? 'Memverifikasi...'
                          : paymentMethod === 'qris'
                            ? 'Konfirmasi Bayar QRIS'
                            : `Bayar via ${ewallet}`}
                      </span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
