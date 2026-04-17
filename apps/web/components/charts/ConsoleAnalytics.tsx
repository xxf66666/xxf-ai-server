'use client';

import { useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useT } from '../../lib/i18n/context';
import type { DictKey } from '../../lib/i18n/dict';

export interface Breakdown {
  byModel: Array<{ model: string; tokens: number; requests: number }>;
  byKey: Array<{ keyId: string | null; keyName: string | null; tokens: number; requests: number }>;
  byStatus: Array<{ bucket: string; requests: number }>;
  trend: Array<{ ts: string; inputTokens: number; outputTokens: number; requests: number }>;
}

// Tailwind-mapped accent palette for slices.
const PALETTE = [
  '#6366f1', // indigo-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#f43f5e', // rose-500
  '#8b5cf6', // violet-500
  '#0ea5e9', // sky-500
  '#ec4899', // pink-500
  '#14b8a6', // teal-500
];
const STATUS_COLOR: Record<string, string> = {
  '2xx': '#10b981',
  '3xx': '#0ea5e9',
  '4xx': '#f59e0b',
  '5xx': '#f43f5e',
  other: '#6b7280',
};

type Tab = 'trend' | 'byModel' | 'byKey' | 'topKeys' | 'status';

const TABS: Array<{ key: Tab; label: DictKey }> = [
  { key: 'trend', label: 'console.charts.tab.trend' },
  { key: 'byModel', label: 'console.charts.tab.byModel' },
  { key: 'byKey', label: 'console.charts.tab.byKey' },
  { key: 'topKeys', label: 'console.charts.tab.topKeys' },
  { key: 'status', label: 'console.charts.tab.status' },
];

const fmt = new Intl.NumberFormat();
const hour = new Intl.DateTimeFormat(undefined, {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export function ConsoleAnalytics({ data }: { data: Breakdown }) {
  const t = useT();
  const [tab, setTab] = useState<Tab>('trend');

  const hasAny =
    data.trend.length + data.byModel.length + data.byKey.length + data.byStatus.length > 0;

  return (
    <div className="rounded-lg border border-border bg-background">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-medium">{t('console.charts.title')}</h2>
        <div className="flex gap-1 rounded-md bg-muted p-0.5 text-xs">
          {TABS.map((b) => (
            <button
              key={b.key}
              type="button"
              onClick={() => setTab(b.key)}
              className={`rounded px-2 py-1 ${tab === b.key ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground'}`}
            >
              {t(b.label)}
            </button>
          ))}
        </div>
      </div>
      <div className="p-4">
        {!hasAny ? (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            {t('console.charts.empty')}
          </div>
        ) : tab === 'trend' ? (
          <TrendChart trend={data.trend} />
        ) : tab === 'byModel' ? (
          <ModelPie byModel={data.byModel} />
        ) : tab === 'byKey' ? (
          <KeyPie byKey={data.byKey} />
        ) : tab === 'topKeys' ? (
          <TopKeysBar byKey={data.byKey} />
        ) : (
          <StatusPie byStatus={data.byStatus} />
        )}
      </div>
    </div>
  );
}

function TrendChart({ trend }: { trend: Breakdown['trend'] }) {
  const t = useT();
  const rows = trend.map((p) => ({
    ts: hour.format(new Date(p.ts)),
    [t('console.charts.input')]: p.inputTokens,
    [t('console.charts.output')]: p.outputTokens,
  }));
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={rows}>
        <defs>
          <linearGradient id="g-in" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity={0.6} />
            <stop offset="100%" stopColor="#6366f1" stopOpacity={0.05} />
          </linearGradient>
          <linearGradient id="g-out" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity={0.6} />
            <stop offset="100%" stopColor="#10b981" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <XAxis dataKey="ts" stroke="#94a3b8" fontSize={11} />
        <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(n: number) => fmt.format(n)} />
        <Tooltip formatter={(v) => fmt.format(Number(v) || 0)} contentStyle={{ fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Area
          type="monotone"
          dataKey={t('console.charts.input')}
          stackId="1"
          stroke="#6366f1"
          fill="url(#g-in)"
        />
        <Area
          type="monotone"
          dataKey={t('console.charts.output')}
          stackId="1"
          stroke="#10b981"
          fill="url(#g-out)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function ModelPie({ byModel }: { byModel: Breakdown['byModel'] }) {
  const t = useT();
  const rows = byModel.map((r) => ({ name: r.model, value: r.tokens }));
  return <PieBlock rows={rows} label={t('console.charts.tokens')} colors={PALETTE} />;
}

function KeyPie({ byKey }: { byKey: Breakdown['byKey'] }) {
  const t = useT();
  const rows = byKey.map((r) => ({
    name: r.keyName ?? r.keyId?.slice(0, 8) ?? '—',
    value: r.requests,
  }));
  return <PieBlock rows={rows} label={t('console.charts.requests')} colors={PALETTE} />;
}

function StatusPie({ byStatus }: { byStatus: Breakdown['byStatus'] }) {
  const t = useT();
  const rows = byStatus.map((r) => ({ name: r.bucket, value: r.requests }));
  const colors = rows.map((r) => STATUS_COLOR[r.name] ?? '#6b7280');
  return <PieBlock rows={rows} label={t('console.charts.requests')} colors={colors} />;
}

function TopKeysBar({ byKey }: { byKey: Breakdown['byKey'] }) {
  const t = useT();
  const rows = [...byKey]
    .sort((a, b) => b.requests - a.requests)
    .slice(0, 10)
    .map((r) => ({
      name: r.keyName ?? r.keyId?.slice(0, 8) ?? '—',
      [t('console.charts.requests')]: r.requests,
    }));
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={rows} layout="vertical" margin={{ left: 10 }}>
        <XAxis type="number" stroke="#94a3b8" fontSize={11} />
        <YAxis type="category" dataKey="name" stroke="#94a3b8" fontSize={11} width={110} />
        <Tooltip contentStyle={{ fontSize: 12 }} />
        <Bar dataKey={t('console.charts.requests')} fill="#6366f1" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function PieBlock({
  rows,
  label,
  colors,
}: {
  rows: Array<{ name: string; value: number }>;
  label: string;
  colors: string[];
}) {
  if (rows.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">—</div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={rows}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={90}
          innerRadius={46}
          paddingAngle={1}
          label={(p: { name?: string }) => p.name ?? ''}
        >
          {rows.map((_, i) => (
            <Cell key={i} fill={colors[i % colors.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(v) => [fmt.format(Number(v) || 0), label] as [string, string]}
          contentStyle={{ fontSize: 12 }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
