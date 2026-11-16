import { Coins, ArrowRight } from 'lucide-react';

interface CreditGateBannerProps {
  requiredCredits: number;
  currentCredits: number;
  featureName: string;
  onUpgrade: () => void;
}

export function CreditGateBanner({
  requiredCredits,
  currentCredits,
  featureName,
  onUpgrade,
}: CreditGateBannerProps) {
  return (
    <div
      role="alert"
      className="p-4 sm:p-5 rounded-xl bg-surface-alt border border-primary flex flex-col sm:flex-row sm:items-center justify-between gap-4"
    >
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 rounded-lg bg-primary text-white flex items-center justify-center shrink-0">
          <Coins className="w-4 h-4" />
        </span>
        <div className="space-y-1">
          <p className="text-sm font-bold text-navy">
            Kredit tidak mencukupi untuk {featureName}
          </p>
          <p className="text-xs sm:text-sm text-ink-muted">
            Dibutuhkan <strong className="text-navy tabular-nums">{requiredCredits} kredit</strong>, sedangkan saldo Anda saat ini{' '}
            <strong className="text-navy tabular-nums">{currentCredits} kredit</strong>. Isi ulang 1.000 kredit (Rp 50.000) atau aktifkan Langganan Unlimited 1 Tahun (Rp 150.000).
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onUpgrade}
        className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary-dark text-white text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
      >
        <span>Beli Kredit / Langganan</span>
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}
