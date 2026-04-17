'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../../lib/api';
import { useT } from '../../../lib/i18n/context';

interface Model {
  id: string;
  provider: string;
  tier: string | null;
}

export default function ConsoleModelsPage() {
  const t = useT();
  const { data, isLoading } = useQuery({
    queryKey: ['console', 'models'],
    queryFn: () => apiFetch<{ data: Model[] }>('/v1/console/models'),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('console.models.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('console.models.subtitle')}</p>
      </div>

      <div className="rounded-lg border border-border bg-background">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">{t('console.models.col.id')}</th>
              <th className="px-4 py-2 font-medium">{t('console.models.col.provider')}</th>
              <th className="px-4 py-2 font-medium">{t('console.models.col.tier')}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">
                  {t('common.loading')}
                </td>
              </tr>
            )}
            {data?.data.map((m) => (
              <tr key={m.id} className="border-t border-border">
                <td className="px-4 py-2 font-mono">{m.id}</td>
                <td className="px-4 py-2">{m.provider}</td>
                <td className="px-4 py-2 text-muted-foreground">{m.tier ?? t('common.dash')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
