import { AlertCircle, Database, RefreshCw, Server } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth.tsx';
import { fetchAdminProviders } from '../services/apiService.ts';
import type { AdminProvidersSnapshot } from '../types/index.ts';

const STATUS_BADGE: Record<
  AdminProvidersSnapshot['providers'][number]['status'],
  { label: string; className: string }
> = {
  aktif: {
    label: 'Aktif',
    className: 'bg-primary-light text-navy border-primary/40',
  },
  dilewati: {
    label: 'Dilewati (Cooldown)',
    className: 'bg-surface-alt text-navy border-border-soft',
  },
  rusak: {
    label: 'Rusak (Auth/Model)',
    className: 'bg-surface-alt text-primary border-primary',
  },
  tidak_dikonfigurasi: {
    label: 'Belum Dikonfigurasi',
    className: 'bg-white text-ink-muted border-border-soft',
  },
};

export function AdminProvidersPage() {
  const { getIdToken } = useAuth();
  const [snapshot, setSnapshot] = useState<AdminProvidersSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadSnapshot = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = await getIdToken();
      const data = await fetchAdminProviders(token);
      setSnapshot(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Gagal memuat status provider AI.',
      );
    } finally {
      setLoading(false);
    }
  }, [getIdToken]);

  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-navy flex items-center gap-2">
            <Server className="w-6 h-6 text-primary" />
            <span>Status Provider AI & Pemakaian Harian</span>
          </h1>
          <p className="text-sm text-ink-muted">
            Monitoring prioritas fallback multi-provider (tanpa API key maupun data pribadi pengguna).
          </p>
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={() => void loadSnapshot()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border-soft bg-white hover:bg-surface-alt text-sm font-semibold text-navy disabled:opacity-50 w-fit"
        >
          <RefreshCw className={`w-4 h-4 text-primary ${loading ? 'animate-spin' : ''}`} />
          <span>Muat Ulang</span>
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-surface-alt border border-primary flex items-center gap-2.5 text-sm text-navy"
        >
          <AlertCircle className="w-4 h-4 text-primary shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {snapshot && (
        <>
          <div className="bg-surface-alt border border-border-soft rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 text-sm text-navy">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-primary" />
              <span>
                <strong>Cache Jawaban:</strong> {snapshot.cache.entries} entri · TTL{' '}
                {snapshot.cache.ttlHours} jam ({snapshot.cache.backend})
              </span>
            </div>
            <span className="text-xs font-semibold text-ink-muted tabular-nums">
              Tanggal penghitung: {snapshot.dateKey}
            </span>
          </div>

          <div className="bg-white border border-border-soft rounded-xl shadow-sm overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-border-soft bg-surface-alt text-xs font-semibold text-navy">
                  <th className="py-3 px-4">Prioritas</th>
                  <th className="py-3 px-4">Provider</th>
                  <th className="py-3 px-4">Model Default / Aktif</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Pemakaian Hari Ini</th>
                  <th className="py-3 px-4 text-right">Berhasil / Gagal</th>
                  <th className="py-3 px-4">Catatan Terakhir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-soft">
                {snapshot.providers.map((item, idx) => {
                  const badge = STATUS_BADGE[item.status];
                  return (
                    <tr key={item.provider} className="hover:bg-surface-alt/40">
                      <td className="py-3 px-4 font-semibold text-navy tabular-nums">
                        #{idx + 1}
                      </td>
                      <td className="py-3 px-4 font-medium text-navy">{item.label}</td>
                      <td className="py-3 px-4 font-mono text-xs text-ink-muted">
                        {item.model}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-md border text-xs font-semibold ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-semibold tabular-nums text-navy">
                        {item.dailyRequests}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums text-ink-muted">
                        {item.dailySuccess} / {item.dailyFailures}
                      </td>
                      <td className="py-3 px-4 text-xs text-ink-muted">
                        {item.lastReason || (item.cooldownUntil ? `Cooldown hingga ${item.cooldownUntil}` : '-')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="bg-white border border-border-soft rounded-xl p-5 shadow-sm space-y-3">
            <h2 className="text-base font-bold text-navy">
              Log Pemanggilan Terbaru (Tanpa Key &amp; Tanpa PII)
            </h2>
            {snapshot.recentLogs.length === 0 ? (
              <p className="text-xs text-ink-muted">
                Belum ada panggilan AI pada sesi server ini.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border-soft text-ink-muted">
                      <th className="py-2 pr-4">Waktu</th>
                      <th className="py-2 pr-4">Fitur</th>
                      <th className="py-2 pr-4">Provider</th>
                      <th className="py-2 pr-4">Hasil</th>
                      <th className="py-2 pr-4 text-right">Retry</th>
                      <th className="py-2 pr-4 text-right">Durasi</th>
                      <th className="py-2">Alasan Fallback</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-soft">
                    {snapshot.recentLogs.map((log) => (
                      <tr key={log.id}>
                        <td className="py-2 pr-4 font-mono text-ink-muted whitespace-nowrap">
                          {log.timestamp}
                        </td>
                        <td className="py-2 pr-4 font-medium text-navy">{log.task}</td>
                        <td className="py-2 pr-4 font-medium text-navy">{log.provider}</td>
                        <td className="py-2 pr-4">{log.outcome}</td>
                        <td className="py-2 pr-4 text-right tabular-nums">{log.retries}</td>
                        <td className="py-2 pr-4 text-right tabular-nums">
                          {log.durationMs} ms
                        </td>
                        <td className="py-2 text-ink-muted">
                          {log.fallbackReason || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
