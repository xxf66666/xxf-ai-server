'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../../lib/api';
import { useT } from '../../../lib/i18n/context';

interface Account { id: string; label: string | null; plan: string; status: string }
interface User { id: string; email: string }
interface ByAccount { accountId: string | null; tokens: number; requests: number }
interface ByKey { apiKeyId: string | null; tokens: number; requests: number }

const fmt = new Intl.NumberFormat();

export default function StatsPage() {
  const t = useT();
  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => apiFetch<{ data: Account[] }>('/admin/v1/accounts'),
  });
  useQuery({
    queryKey: ['users'],
    queryFn: () => apiFetch<{ data: User[] }>('/admin/v1/users'),
  });
  const { data: byAccount } = useQuery({
    queryKey: ['stats', 'by-account'],
    queryFn: () => apiFetch<{ data: ByAccount[] }>('/admin/v1/stats/by-account'),
    refetchInterval: 15_000,
  });
  const { data: byKey } = useQuery({
    queryKey: ['stats', 'by-key'],
    queryFn: () => apiFetch<{ data: ByKey[] }>('/admin/v1/stats/by-key'),
    refetchInterval: 15_000,
  });

  const accountIndex = new Map((accounts?.data ?? []).map((a) => [a.id, a]));

  const sortedAccounts = [...(byAccount?.data ?? [])].sort((a, b) => b.tokens - a.tokens);
  const sortedKeys = [...(byKey?.data ?? [])].sort((a, b) => b.tokens - a.tokens);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('stats.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('stats.subtitle')}</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">{t('stats.byAccount')}</h2>
        <div className="rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">{t('stats.col.account')}</th>
                <th className="px-4 py-2 font-medium">{t('stats.col.plan')}</th>
                <th className="px-4 py-2 font-medium">{t('stats.col.status')}</th>
                <th className="px-4 py-2 text-right font-medium">{t('stats.col.tokens')}</th>
                <th className="px-4 py-2 text-right font-medium">{t('stats.col.requests')}</th>
              </tr>
            </thead>
            <tbody>
              {sortedAccounts.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                    {t('stats.empty')}
                  </td>
                </tr>
              )}
              {sortedAccounts.map((row) => {
                const acct = row.accountId ? accountIndex.get(row.accountId) : null;
                return (
                  <tr key={row.accountId ?? 'null'} className="border-t border-border">
                    <td className="px-4 py-2">
                      {acct?.label ?? <span className="text-muted-foreground">{t('common.none_deleted')}</span>}
                    </td>
                    <td className="px-4 py-2">{acct?.plan ?? t('common.dash')}</td>
                    <td className="px-4 py-2">{acct?.status ?? t('common.dash')}</td>
                    <td className="px-4 py-2 text-right">{fmt.format(row.tokens)}</td>
                    <td className="px-4 py-2 text-right">{fmt.format(row.requests)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">{t('stats.byKey')}</h2>
        <div className="rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">{t('stats.col.keyId')}</th>
                <th className="px-4 py-2 text-right font-medium">{t('stats.col.tokens')}</th>
                <th className="px-4 py-2 text-right font-medium">{t('stats.col.requests')}</th>
              </tr>
            </thead>
            <tbody>
              {sortedKeys.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">
                    {t('stats.empty')}
                  </td>
                </tr>
              )}
              {sortedKeys.map((row) => (
                <tr key={row.apiKeyId ?? 'null'} className="border-t border-border">
                  <td className="px-4 py-2 font-mono text-xs">
                    {row.apiKeyId ? row.apiKeyId.slice(0, 8) + '…' : t('common.none_deleted')}
                  </td>
                  <td className="px-4 py-2 text-right">{fmt.format(row.tokens)}</td>
                  <td className="px-4 py-2 text-right">{fmt.format(row.requests)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
