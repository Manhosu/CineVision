'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Totals {
  cost_usd: number;
  calls: number;
  in_tokens: number;
  out_tokens: number;
  cache_read: number;
}

interface TopUser {
  user_id: string | null;
  external_chat_id: string | null;
  cost_usd: number;
  calls: number;
  name: string | null;
  email: string | null;
}

interface HourBucket {
  hour: string;
  calls: number;
  cost_usd: number;
}

interface Summary {
  totals: Record<string, Totals>;
  top_users: TopUser[];
  hourly: HourBucket[];
}

function getHeaders() {
  const token = localStorage.getItem('access_token') || localStorage.getItem('auth_token');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

function fmtUsd(n: number) {
  return `US$ ${n.toFixed(2)}`;
}

function fmtTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function fmtHour(iso: string) {
  return iso.slice(11, 13) + 'h';
}

export default function AdminAiUsagePage() {
  const { isLoading: authLoading } = useAuth();
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/admin/ai-usage/summary`, { headers: getHeaders() });
      if (!res.ok) throw new Error('Falha ao carregar resumo');
      setData(await res.json());
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (!authLoading) load(); }, [authLoading, load]);

  if (authLoading || loading) return <div className="p-6 text-gray-300">Carregando…</div>;
  if (!data) return <div className="p-6 text-gray-300">Sem dados.</div>;

  const totals24h = data.totals['24h'];
  const totals7d = data.totals['7d'];
  const totals30d = data.totals['30d'];
  const maxHourCalls = Math.max(1, ...data.hourly.map(h => h.calls));

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Gasto IA Claude</h1>
          <p className="text-sm text-gray-400 mt-1">Auditoria de custo por chamada — identifica abuso e padrões de uso.</p>
        </div>
        <button onClick={load} className="px-3 py-1 text-sm text-gray-300 hover:text-white border border-white/10 rounded">
          Atualizar
        </button>
      </div>

      {/* Totais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {([
          { label: 'Últimas 24h', t: totals24h, accent: 'sky' },
          { label: 'Últimos 7d', t: totals7d, accent: 'emerald' },
          { label: 'Últimos 30d', t: totals30d, accent: 'purple' },
        ] as const).map(({ label, t, accent }) => (
          <div key={label} className={`bg-dark-800 border border-${accent}-500/20 rounded-lg p-4`}>
            <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
            <p className={`text-3xl font-bold text-${accent}-400 mt-1`}>{fmtUsd(t.cost_usd)}</p>
            <div className="text-xs text-gray-400 mt-3 space-y-1">
              <div className="flex justify-between"><span>Chamadas</span><span>{t.calls.toLocaleString('pt-BR')}</span></div>
              <div className="flex justify-between"><span>Input</span><span>{fmtTokens(t.in_tokens)}</span></div>
              <div className="flex justify-between"><span>Output</span><span>{fmtTokens(t.out_tokens)}</span></div>
              <div className="flex justify-between"><span>Cache read</span><span>{fmtTokens(t.cache_read)}</span></div>
            </div>
          </div>
        ))}
      </div>

      {/* Histograma 24h */}
      <div className="bg-dark-800 border border-white/10 rounded-lg p-4 mb-8">
        <h2 className="text-sm font-medium text-gray-300 mb-3">Chamadas por hora (últimas 24h)</h2>
        <div className="flex gap-1 items-end h-32">
          {data.hourly.map((h) => (
            <div key={h.hour} className="flex-1 group relative flex flex-col items-center">
              <div
                className="w-full bg-primary-500/40 hover:bg-primary-500/70 rounded-t transition-colors"
                style={{ height: `${(h.calls / maxHourCalls) * 100}%` }}
                title={`${fmtHour(h.hour)}: ${h.calls} calls, ${fmtUsd(h.cost_usd)}`}
              />
              <span className="text-[10px] text-gray-500 mt-1">{fmtHour(h.hour)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Top users */}
      <div className="bg-dark-800 border border-white/10 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5">
          <h2 className="text-sm font-medium text-gray-300">Top 20 usuários por gasto (7d)</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-dark-900 text-gray-400 text-xs uppercase">
            <tr>
              <th className="px-4 py-2 text-left">#</th>
              <th className="px-4 py-2 text-left">Usuário</th>
              <th className="px-4 py-2 text-right">Chamadas</th>
              <th className="px-4 py-2 text-right">Custo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {data.top_users.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">Nenhuma chamada no período.</td></tr>
            )}
            {data.top_users.map((u, i) => (
              <tr key={`${u.user_id || u.external_chat_id}-${i}`} className="text-gray-200">
                <td className="px-4 py-2 text-gray-500">{i + 1}</td>
                <td className="px-4 py-2">
                  {u.name ? (
                    <div>
                      <div className="font-medium">{u.name}</div>
                      <div className="text-xs text-gray-500">{u.email}</div>
                    </div>
                  ) : u.user_id ? (
                    <span className="text-gray-400 text-xs">user_id: {u.user_id.slice(0, 8)}…</span>
                  ) : (
                    <span className="text-gray-400 text-xs">chat: {u.external_chat_id}</span>
                  )}
                </td>
                <td className="px-4 py-2 text-right text-gray-300">{u.calls}</td>
                <td className="px-4 py-2 text-right font-medium text-emerald-400">{fmtUsd(u.cost_usd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
